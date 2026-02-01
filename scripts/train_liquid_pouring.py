#!/usr/bin/env python3
"""
Training script for ACT Policy on liquid pouring task using SO-101 arm.

This script trains an Action Chunking Transformer (ACT) policy on the
Gaonuk/physai-hack-final dataset for a liquid pouring task.

Usage:
    python train_liquid_pouring.py

Or using the LeRobot CLI:
    lerobot-train \
        --dataset.repo_id=Gaonuk/physai-hack-final \
        --policy.type=act \
        --policy.device=mps \
        --output_dir=outputs/train/act_liquid_pouring \
        --job_name=act_liquid_pouring \
        --batch_size=8 \
        --steps=50000
"""

import logging
import time
from pathlib import Path

import torch

from lerobot.configs.types import FeatureType
from lerobot.datasets.lerobot_dataset import LeRobotDataset, LeRobotDatasetMetadata
from lerobot.datasets.utils import dataset_to_policy_features
from lerobot.policies.act.configuration_act import ACTConfig
from lerobot.policies.act.modeling_act import ACTPolicy
from lerobot.policies.factory import make_pre_post_processors

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def get_device() -> torch.device:
    """Auto-detect the best available device (MPS for Apple Silicon, CUDA, or CPU)."""
    if torch.backends.mps.is_available():
        logger.info("Using MPS (Apple Silicon) backend")
        return torch.device("mps")
    elif torch.cuda.is_available():
        logger.info("Using CUDA backend")
        return torch.device("cuda")
    else:
        logger.warning("No GPU available, using CPU (training will be slow)")
        return torch.device("cpu")


def make_delta_timestamps(delta_indices: list[int] | None, fps: int) -> list[float]:
    """Convert frame indices to timestamps based on FPS."""
    if delta_indices is None:
        return [0.0]
    return [i / fps for i in delta_indices]


def main():
    # ==========================================================================
    # Configuration
    # ==========================================================================

    # Dataset configuration
    dataset_id = "Gaonuk/physai-hack-final"

    # Training configuration
    training_steps = 50_000  # Total training steps
    batch_size = 8  # Batch size (8 is memory-efficient for 1080p images on M4 Pro)
    log_freq = 100  # Log every N steps
    save_freq = 10_000  # Save checkpoint every N steps

    # ACT Policy configuration for liquid pouring
    chunk_size = 50  # Number of future actions to predict (adjusted for 30 FPS)
    n_action_steps = 50  # Number of actions to execute per inference

    # Output directory
    output_dir = Path("outputs/train/act_liquid_pouring")
    output_dir.mkdir(parents=True, exist_ok=True)

    # HuggingFace Hub configuration (optional)
    push_to_hub = False  # Set to True to push to HuggingFace Hub
    hub_repo_id = "<your-username>/act_liquid_pouring"  # Replace with your repo ID

    # ==========================================================================
    # Setup
    # ==========================================================================

    # Select device
    device = get_device()

    logger.info(f"Loading dataset: {dataset_id}")
    logger.info(f"Output directory: {output_dir}")

    # Load dataset metadata to configure the policy
    dataset_metadata = LeRobotDatasetMetadata(dataset_id)
    logger.info(f"Dataset FPS: {dataset_metadata.fps}")
    logger.info(f"Dataset features: {list(dataset_metadata.features.keys())}")

    # Convert dataset features to policy features
    features = dataset_to_policy_features(dataset_metadata.features)

    # Separate input and output features
    output_features = {key: ft for key, ft in features.items() if ft.type is FeatureType.ACTION}
    input_features = {key: ft for key, ft in features.items() if key not in output_features}

    logger.info(f"Input features: {list(input_features.keys())}")
    logger.info(f"Output features: {list(output_features.keys())}")

    # ==========================================================================
    # Create ACT Policy
    # ==========================================================================

    logger.info("Creating ACT policy...")

    # Configure ACT for the liquid pouring task
    cfg = ACTConfig(
        input_features=input_features,
        output_features=output_features,
        # Action chunking configuration
        chunk_size=chunk_size,
        n_action_steps=n_action_steps,
        # Vision backbone (ResNet18 with ImageNet pretrained weights)
        vision_backbone="resnet18",
        pretrained_backbone_weights="ResNet18_Weights.IMAGENET1K_V1",
        # Transformer architecture
        dim_model=512,
        n_heads=8,
        n_encoder_layers=4,
        n_decoder_layers=1,
        dim_feedforward=3200,
        # VAE configuration
        use_vae=True,
        latent_dim=32,
        n_vae_encoder_layers=4,
        # Training configuration
        dropout=0.1,
        kl_weight=10.0,
    )

    # Create policy and move to device
    policy = ACTPolicy(cfg)
    policy.train()
    policy.to(device)

    # Create pre/post processors for normalization
    preprocessor, postprocessor = make_pre_post_processors(
        cfg,
        dataset_stats=dataset_metadata.stats
    )

    logger.info(f"Policy created with {sum(p.numel() for p in policy.parameters()):,} parameters")

    # ==========================================================================
    # Create Dataset and DataLoader
    # ==========================================================================

    logger.info("Creating dataset and dataloader...")

    # Configure delta timestamps for action chunking
    # ACT expects a sequence of future actions as targets
    delta_timestamps = {
        "action": make_delta_timestamps(cfg.action_delta_indices, dataset_metadata.fps),
    }

    # Add image features with their delta timestamps
    delta_timestamps.update({
        key: make_delta_timestamps(cfg.observation_delta_indices, dataset_metadata.fps)
        for key in cfg.image_features
    })

    logger.info(f"Delta timestamps: {delta_timestamps}")

    # Create dataset
    dataset = LeRobotDataset(dataset_id, delta_timestamps=delta_timestamps)
    logger.info(f"Dataset loaded: {len(dataset)} samples")

    # Create dataloader
    dataloader = torch.utils.data.DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=4,
        pin_memory=device.type != "cpu",
        drop_last=True,
    )

    # ==========================================================================
    # Create Optimizer
    # ==========================================================================

    # Use the optimizer preset from ACT config
    optimizer = cfg.get_optimizer_preset().build(policy.parameters())
    logger.info(f"Optimizer: {type(optimizer).__name__} with lr={cfg.optimizer_lr}")

    # ==========================================================================
    # Training Loop
    # ==========================================================================

    logger.info("=" * 60)
    logger.info("Starting training...")
    logger.info(f"  Training steps: {training_steps:,}")
    logger.info(f"  Batch size: {batch_size}")
    logger.info(f"  Chunk size: {chunk_size}")
    logger.info(f"  Device: {device}")
    logger.info("=" * 60)

    step = 0
    epoch = 0
    total_loss = 0.0
    start_time = time.time()

    while step < training_steps:
        epoch += 1
        for batch in dataloader:
            # Preprocess batch (normalization, move to device)
            batch = preprocessor(batch)

            # Forward pass
            loss, loss_dict = policy.forward(batch)

            # Backward pass
            optimizer.zero_grad()
            loss.backward()

            # Gradient clipping for stability
            torch.nn.utils.clip_grad_norm_(policy.parameters(), max_norm=10.0)

            optimizer.step()

            # Accumulate loss for logging
            total_loss += loss.item()
            step += 1

            # Logging
            if step % log_freq == 0:
                avg_loss = total_loss / log_freq
                elapsed = time.time() - start_time
                steps_per_sec = step / elapsed
                eta = (training_steps - step) / steps_per_sec if steps_per_sec > 0 else 0

                logger.info(
                    f"Step {step:>6}/{training_steps} | "
                    f"Loss: {avg_loss:.4f} | "
                    f"Steps/s: {steps_per_sec:.2f} | "
                    f"ETA: {eta/60:.1f} min"
                )

                # Log individual loss components if available
                if loss_dict:
                    loss_str = " | ".join(f"{k}: {v:.4f}" for k, v in loss_dict.items())
                    logger.info(f"  Loss breakdown: {loss_str}")

                total_loss = 0.0

            # Save checkpoint
            if step % save_freq == 0:
                checkpoint_dir = output_dir / f"checkpoint_{step:06d}"
                checkpoint_dir.mkdir(parents=True, exist_ok=True)

                policy.save_pretrained(checkpoint_dir)
                preprocessor.save_pretrained(checkpoint_dir)
                postprocessor.save_pretrained(checkpoint_dir)

                logger.info(f"Checkpoint saved to {checkpoint_dir}")

            # Check if training is complete
            if step >= training_steps:
                break

    # ==========================================================================
    # Save Final Model
    # ==========================================================================

    total_time = time.time() - start_time
    logger.info("=" * 60)
    logger.info(f"Training complete!")
    logger.info(f"  Total time: {total_time/60:.1f} minutes")
    logger.info(f"  Total steps: {step:,}")
    logger.info(f"  Total epochs: {epoch}")
    logger.info("=" * 60)

    # Save final model
    final_dir = output_dir / "final"
    final_dir.mkdir(parents=True, exist_ok=True)

    policy.save_pretrained(final_dir)
    preprocessor.save_pretrained(final_dir)
    postprocessor.save_pretrained(final_dir)

    logger.info(f"Final model saved to {final_dir}")

    # Optionally push to HuggingFace Hub
    if push_to_hub:
        logger.info(f"Pushing model to HuggingFace Hub: {hub_repo_id}")
        policy.push_to_hub(hub_repo_id)
        preprocessor.push_to_hub(hub_repo_id)
        postprocessor.push_to_hub(hub_repo_id)
        logger.info("Model pushed to HuggingFace Hub successfully!")

    logger.info("Done!")


if __name__ == "__main__":
    main()
