'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CylinderFit } from '@/lib/cylinder-fitting';
import { PhysicsState, toRadians } from '@/lib/tipover-physics';
import { parsePlyFile, ParsedPly } from '@/lib/ply-parser';
import { CylinderAdjustments } from './CylinderControls';

interface PlyViewerProps {
  plyBuffer: ArrayBuffer | null;
  cylinder: CylinderFit | null;
  cylinderAdjustments?: CylinderAdjustments;
  physicsState: PhysicsState | null;
  tiltAngle: number;
  onSceneReady?: (scene: THREE.Scene) => void;
}

export default function PlyViewer({
  plyBuffer,
  cylinder,
  cylinderAdjustments,
  physicsState,
  tiltAngle,
  onSceneReady
}: PlyViewerProps) {
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

  // Load PLY data as point cloud
  useEffect(() => {
    if (!plyBuffer || !sceneRef.current) return;

    const scene = sceneRef.current;

    // Remove old point cloud
    if (pointCloudRef.current) {
      scene.remove(pointCloudRef.current);
      pointCloudRef.current.geometry.dispose();
      (pointCloudRef.current.material as THREE.PointsMaterial).dispose();
      pointCloudRef.current = null;
    }

    // Parse PLY data
    let parsedPly: ParsedPly;
    try {
      parsedPly = parsePlyFile(plyBuffer);
    } catch (err) {
      console.error('Failed to parse PLY file:', err);
      return;
    }

    const { points, bounds } = parsedPly;
    const numPoints = points.length;

    const positions = new Float32Array(numPoints * 3);
    const colors = new Float32Array(numPoints * 3);

    for (let i = 0; i < numPoints; i++) {
      const point = points[i];
      positions[i * 3] = point.position[0];
      positions[i * 3 + 1] = point.position[1];
      positions[i * 3 + 2] = point.position[2];

      // Use color if available, otherwise default to gray
      if (point.color) {
        colors[i * 3] = point.color[0] / 255;
        colors[i * 3 + 1] = point.color[1] / 255;
        colors[i * 3 + 2] = point.color[2] / 255;
      } else {
        colors[i * 3] = 0.7;
        colors[i * 3 + 1] = 0.7;
        colors[i * 3 + 2] = 0.7;
      }
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
    const { min, max, center } = bounds;
    const size = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);

    if (controlsRef.current && cameraRef.current) {
      controlsRef.current.target.set(center[0], center[1], center[2]);
      cameraRef.current.position.set(
        center[0] + size * 1.5,
        center[1] + size * 0.5,
        center[2] + size * 1.5
      );
      controlsRef.current.update();
    }
  }, [plyBuffer]);

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

    // Apply adjustments
    const adj = cylinderAdjustments || {
      rotationX: 0, rotationY: 0, rotationZ: 0,
      offsetX: 0, offsetY: 0, offsetZ: 0,
      radiusScale: 1, heightScale: 1
    };

    const adjustedRadius = cylinder.radius * adj.radiusScale;
    const adjustedHeight = cylinder.height * adj.heightScale;
    const adjustedCenter: [number, number, number] = [
      cylinder.center[0] + adj.offsetX,
      cylinder.center[1] + adj.offsetY,
      cylinder.center[2] + adj.offsetZ
    ];

    // Create a container group for the cylinder that we can rotate
    const cylinderGroup = new THREE.Group();

    // Create cylinder outline
    const outlineGeometry = new THREE.CylinderGeometry(
      adjustedRadius,
      adjustedRadius,
      adjustedHeight,
      32,
      1,
      true  // Open-ended
    );
    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      wireframe: true
    });
    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
    outline.position.set(0, adjustedHeight / 2, 0);
    cylinderGroup.add(outline);

    // Create liquid mesh
    if (physicsState && physicsState.fillLevel > 0) {
      const liquidHeight = adjustedHeight * physicsState.fillLevel;
      const liquidGeometry = new THREE.CylinderGeometry(
        adjustedRadius * 0.9,
        adjustedRadius * 0.9,
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
      liquid.position.set(0, liquidHeight / 2, 0);
      cylinderGroup.add(liquid);

      // Liquid surface disc
      const surfaceGeometry = new THREE.CircleGeometry(adjustedRadius * 0.9, 32);
      const surfaceMaterial = new THREE.MeshBasicMaterial({
        color: 0x66aaff,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
      });
      const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
      surface.rotation.x = -Math.PI / 2;
      surface.position.set(0, liquidHeight, 0);
      cylinderGroup.add(surface);
    }

    // Create center of mass marker
    if (physicsState) {
      const comGeometry = new THREE.SphereGeometry(adjustedRadius * 0.12, 16, 16);
      const comMaterial = new THREE.MeshBasicMaterial({
        color: physicsState.isStable ? 0x44ff44 : 0xff4444,
        transparent: true,
        opacity: 0.9
      });
      const com = new THREE.Mesh(comGeometry, comMaterial);
      // Position CoM relative to cylinder base
      const comRelativeY = physicsState.centerOfMass.y - cylinder.center[1];
      com.position.set(0, comRelativeY, 0);
      cylinderGroup.add(com);

      // Line from base to CoM
      const linePoints = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, comRelativeY, 0)
      ];
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: physicsState.isStable ? 0x44ff44 : 0xff4444,
        transparent: true,
        opacity: 0.6
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      cylinderGroup.add(line);

      // Base circle indicator
      const baseCircleGeometry = new THREE.RingGeometry(
        adjustedRadius * 0.95,
        adjustedRadius,
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
      baseCircle.position.set(0, 0.001, 0);
      cylinderGroup.add(baseCircle);
    }

    // Apply manual rotation adjustments to align cylinder with cup
    cylinderGroup.rotation.x = toRadians(adj.rotationX);
    cylinderGroup.rotation.y = toRadians(adj.rotationY);
    cylinderGroup.rotation.z = toRadians(adj.rotationZ);

    // Position at adjusted center
    cylinderGroup.position.set(adjustedCenter[0], adjustedCenter[1], adjustedCenter[2]);

    group.add(cylinderGroup);

    // Apply tilt for physics simulation (around the base)
    const tiltRad = toRadians(tiltAngle);
    if (tiltRad !== 0) {
      // Create pivot at base center
      const pivot = new THREE.Group();
      pivot.position.set(adjustedCenter[0], adjustedCenter[1], adjustedCenter[2]);

      // Move cylinder to be relative to pivot
      cylinderGroup.position.set(0, 0, 0);
      pivot.add(cylinderGroup);

      // Remove cylinderGroup from main group and add pivot
      group.remove(cylinderGroup);
      group.add(pivot);

      // Apply tilt
      pivot.rotation.z = tiltRad;

      // Also tilt the point cloud
      if (pointCloudRef.current) {
        const pivotPoint = new THREE.Vector3(adjustedCenter[0], adjustedCenter[1], adjustedCenter[2]);
        pointCloudRef.current.position.set(0, 0, 0);
        pointCloudRef.current.rotation.set(0, 0, 0);
        pointCloudRef.current.position.sub(pivotPoint);
        pointCloudRef.current.rotation.z = tiltRad;
        pointCloudRef.current.position.applyAxisAngle(new THREE.Vector3(0, 0, 1), tiltRad);
        pointCloudRef.current.position.add(pivotPoint);
      }
    } else {
      // Reset point cloud position when no tilt
      if (pointCloudRef.current) {
        pointCloudRef.current.position.set(0, 0, 0);
        pointCloudRef.current.rotation.set(0, 0, 0);
      }
    }
  }, [cylinder, cylinderAdjustments, physicsState, tiltAngle]);

  return (
    <div
      ref={containerRef}
      className="canvas-container w-full h-full min-h-[400px] bg-gray-900 rounded-lg"
    />
  );
}
