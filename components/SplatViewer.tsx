'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CylinderFit } from '@/lib/cylinder-fitting';
import { PhysicsState, toRadians } from '@/lib/tipover-physics';

interface SplatViewerProps {
  splatBuffer: ArrayBuffer | null;
  cylinder: CylinderFit | null;
  physicsState: PhysicsState | null;
  tiltAngle: number;
  onSceneReady?: (scene: THREE.Scene) => void;
}

// Splat viewer using point cloud representation
export default function SplatViewer({
  splatBuffer,
  cylinder,
  physicsState,
  tiltAngle,
  onSceneReady
}: SplatViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointCloudRef = useRef<THREE.Points | null>(null);
  const overlayGroupRef = useRef<THREE.Group | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 1000);
    camera.position.set(0, 0.5, 2);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0.25, 0);
    controls.update();
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Grid helper
    const gridHelper = new THREE.GridHelper(2, 20, 0x444444, 0x333333);
    scene.add(gridHelper);

    // Overlay group for cylinder visualization
    const overlayGroup = new THREE.Group();
    overlayGroup.name = 'overlay';
    scene.add(overlayGroup);
    overlayGroupRef.current = overlayGroup;

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    if (onSceneReady) onSceneReady(scene);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onSceneReady]);

  // Load splat data as point cloud
  useEffect(() => {
    if (!splatBuffer || !sceneRef.current) return;

    const scene = sceneRef.current;

    // Remove old point cloud
    if (pointCloudRef.current) {
      scene.remove(pointCloudRef.current);
      pointCloudRef.current.geometry.dispose();
      (pointCloudRef.current.material as THREE.PointsMaterial).dispose();
      pointCloudRef.current = null;
    }

    // Parse splat data
    const BYTES_PER_GAUSSIAN = 32;
    const dataView = new DataView(splatBuffer);
    const numGaussians = Math.floor(splatBuffer.byteLength / BYTES_PER_GAUSSIAN);

    const positions = new Float32Array(numGaussians * 3);
    const colors = new Float32Array(numGaussians * 3);

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < numGaussians; i++) {
      const offset = i * BYTES_PER_GAUSSIAN;

      const x = dataView.getFloat32(offset, true);
      const y = dataView.getFloat32(offset + 4, true);
      const z = dataView.getFloat32(offset + 8, true);

      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Read color
      const r = dataView.getUint8(offset + 24) / 255;
      const g = dataView.getUint8(offset + 25) / 255;
      const b = dataView.getUint8(offset + 26) / 255;

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }

    // Create point cloud geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.01,
      vertexColors: true,
      sizeAttenuation: true
    });

    const pointCloud = new THREE.Points(geometry, material);
    scene.add(pointCloud);
    pointCloudRef.current = pointCloud;

    // Center camera on object
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ);

    if (controlsRef.current && cameraRef.current) {
      controlsRef.current.target.set(centerX, centerY, centerZ);
      cameraRef.current.position.set(
        centerX + size * 1.5,
        centerY + size * 0.5,
        centerZ + size * 1.5
      );
      controlsRef.current.update();
    }
  }, [splatBuffer]);

  // Update overlay visualization
  useEffect(() => {
    if (!overlayGroupRef.current || !cylinder) return;

    const group = overlayGroupRef.current;

    // Clear previous overlay
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        if (Array.isArray((child as THREE.Mesh).material)) {
          ((child as THREE.Mesh).material as THREE.Material[]).forEach(m => m.dispose());
        } else {
          ((child as THREE.Mesh).material as THREE.Material).dispose();
        }
      }
    }

    // Create cylinder outline
    const outlineGeometry = new THREE.CylinderGeometry(
      cylinder.radius,
      cylinder.radius,
      cylinder.height,
      32,
      1,
      true  // Open-ended
    );
    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      wireframe: true
    });
    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
    outline.position.set(
      cylinder.center[0],
      cylinder.center[1] + cylinder.height / 2,
      cylinder.center[2]
    );
    group.add(outline);

    // Create liquid mesh
    if (physicsState && physicsState.fillLevel > 0) {
      const liquidHeight = cylinder.height * physicsState.fillLevel;
      const liquidGeometry = new THREE.CylinderGeometry(
        cylinder.radius * 0.9,
        cylinder.radius * 0.9,
        liquidHeight,
        32
      );
      const liquidMaterial = new THREE.MeshPhongMaterial({
        color: 0x4488ff,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      });
      const liquid = new THREE.Mesh(liquidGeometry, liquidMaterial);
      liquid.position.set(
        cylinder.center[0],
        cylinder.center[1] + liquidHeight / 2,
        cylinder.center[2]
      );
      group.add(liquid);

      // Liquid surface disc
      const surfaceGeometry = new THREE.CircleGeometry(cylinder.radius * 0.9, 32);
      const surfaceMaterial = new THREE.MeshBasicMaterial({
        color: 0x66aaff,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
      });
      const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
      surface.rotation.x = -Math.PI / 2;
      surface.position.set(
        cylinder.center[0],
        cylinder.center[1] + liquidHeight,
        cylinder.center[2]
      );
      group.add(surface);
    }

    // Create center of mass marker
    if (physicsState) {
      const comGeometry = new THREE.SphereGeometry(cylinder.radius * 0.12, 16, 16);
      const comMaterial = new THREE.MeshBasicMaterial({
        color: physicsState.isStable ? 0x44ff44 : 0xff4444,
        transparent: true,
        opacity: 0.9
      });
      const com = new THREE.Mesh(comGeometry, comMaterial);
      com.position.set(
        physicsState.centerOfMass.x,
        physicsState.centerOfMass.y,
        physicsState.centerOfMass.z
      );
      group.add(com);

      // Line from base to CoM
      const linePoints = [
        new THREE.Vector3(cylinder.center[0], cylinder.center[1], cylinder.center[2]),
        new THREE.Vector3(
          physicsState.centerOfMass.x,
          physicsState.centerOfMass.y,
          physicsState.centerOfMass.z
        )
      ];
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: physicsState.isStable ? 0x44ff44 : 0xff4444,
        transparent: true,
        opacity: 0.6
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      group.add(line);

      // Base circle indicator
      const baseCircleGeometry = new THREE.RingGeometry(
        cylinder.radius * 0.95,
        cylinder.radius,
        32
      );
      const baseCircleMaterial = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      });
      const baseCircle = new THREE.Mesh(baseCircleGeometry, baseCircleMaterial);
      baseCircle.rotation.x = -Math.PI / 2;
      baseCircle.position.set(
        cylinder.center[0],
        cylinder.center[1] + 0.001,
        cylinder.center[2]
      );
      group.add(baseCircle);
    }

    // Apply tilt
    const pivotPoint = new THREE.Vector3(
      cylinder.center[0],
      cylinder.center[1],
      cylinder.center[2]
    );

    // Reset position
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);

    // Apply tilt around Z axis at base
    const tiltRad = toRadians(tiltAngle);
    group.position.sub(pivotPoint);
    group.rotation.z = tiltRad;
    group.position.applyAxisAngle(new THREE.Vector3(0, 0, 1), tiltRad);
    group.position.add(pivotPoint);

    // Also tilt the point cloud
    if (pointCloudRef.current) {
      pointCloudRef.current.position.set(0, 0, 0);
      pointCloudRef.current.rotation.set(0, 0, 0);
      pointCloudRef.current.position.sub(pivotPoint);
      pointCloudRef.current.rotation.z = tiltRad;
      pointCloudRef.current.position.applyAxisAngle(new THREE.Vector3(0, 0, 1), tiltRad);
      pointCloudRef.current.position.add(pivotPoint);
    }
  }, [cylinder, physicsState, tiltAngle]);

  return (
    <div
      ref={containerRef}
      className="canvas-container w-full h-full min-h-[400px] bg-gray-900 rounded-lg"
    />
  );
}
