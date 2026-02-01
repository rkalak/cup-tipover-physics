'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CylinderFit } from '@/lib/cylinder-fitting';
import { PhysicsState, toRadians, getLiquidSurfaceWhenTilted } from '@/lib/tipover-physics';

interface VolumeOverlayProps {
  scene: THREE.Scene | null;
  cylinder: CylinderFit | null;
  physicsState: PhysicsState | null;
  tiltAngle: number;  // degrees
}

export default function VolumeOverlay({
  scene,
  cylinder,
  physicsState,
  tiltAngle
}: VolumeOverlayProps) {
  const groupRef = useRef<THREE.Group | null>(null);
  const liquidMeshRef = useRef<THREE.Mesh | null>(null);
  const comMarkerRef = useRef<THREE.Mesh | null>(null);
  const cylinderOutlineRef = useRef<THREE.LineSegments | null>(null);

  useEffect(() => {
    if (!scene || !cylinder) return;

    // Create group if not exists
    if (!groupRef.current) {
      groupRef.current = new THREE.Group();
      groupRef.current.name = 'volumeOverlay';
      scene.add(groupRef.current);
    }

    const group = groupRef.current;

    // Clear previous meshes
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }

    // Create cylinder outline
    const outlineGeometry = new THREE.EdgesGeometry(
      new THREE.CylinderGeometry(
        cylinder.radius,
        cylinder.radius,
        cylinder.height,
        32
      )
    );
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.5
    });
    const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
    outline.position.set(
      cylinder.center[0],
      cylinder.center[1] + cylinder.height / 2,
      cylinder.center[2]
    );
    group.add(outline);
    cylinderOutlineRef.current = outline;

    // Create liquid mesh
    if (physicsState && physicsState.fillLevel > 0) {
      const liquidHeight = cylinder.height * physicsState.fillLevel;
      const liquidGeometry = new THREE.CylinderGeometry(
        cylinder.radius * 0.95,
        cylinder.radius * 0.95,
        liquidHeight,
        32
      );
      const liquidMaterial = new THREE.MeshPhongMaterial({
        color: 0x4488ff,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
      });
      const liquid = new THREE.Mesh(liquidGeometry, liquidMaterial);
      liquid.position.set(
        cylinder.center[0],
        cylinder.center[1] + liquidHeight / 2,
        cylinder.center[2]
      );
      group.add(liquid);
      liquidMeshRef.current = liquid;
    }

    // Create center of mass marker
    if (physicsState) {
      const comGeometry = new THREE.SphereGeometry(cylinder.radius * 0.15, 16, 16);
      const comMaterial = new THREE.MeshBasicMaterial({
        color: 0xff4444,
        transparent: true,
        opacity: 0.8
      });
      const com = new THREE.Mesh(comGeometry, comMaterial);
      com.position.set(
        physicsState.centerOfMass.x,
        physicsState.centerOfMass.y,
        physicsState.centerOfMass.z
      );
      group.add(com);
      comMarkerRef.current = com;

      // Add line from base center to CoM
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(cylinder.center[0], cylinder.center[1], cylinder.center[2]),
        new THREE.Vector3(
          physicsState.centerOfMass.x,
          physicsState.centerOfMass.y,
          physicsState.centerOfMass.z
        )
      ]);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xff4444,
        transparent: true,
        opacity: 0.5
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      group.add(line);
    }

    // Apply tilt rotation
    const tiltRad = toRadians(tiltAngle);
    group.rotation.z = tiltRad;
    group.position.set(cylinder.center[0], cylinder.center[1], cylinder.center[2]);

    return () => {
      // Cleanup on unmount
      if (groupRef.current && scene) {
        scene.remove(groupRef.current);
        groupRef.current = null;
      }
    };
  }, [scene, cylinder, physicsState, tiltAngle]);

  return null;
}
