'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import { useHqGltf } from './useHqGltf';
import { disposeScene } from './FloorModel';
import { findFirstByPrefix, nodeWorldPosition } from './nodes';

declare global {
  interface Window {
    __hqChar?: { x: number; y: number; z: number };
  }
}

const CHAR_URL = '/models/char_base.glb';
const IDLE_CLIP = 'idle';

export function CharAgent({ floorScene }: { floorScene: THREE.Object3D }) {
  const group = useRef<THREE.Group>(null!);
  const { scene, animations } = useHqGltf(CHAR_URL);
  const { actions, names } = useAnimations(animations, group);

  const spawnPos = useMemo(() => {
    const spawnNode = findFirstByPrefix(floorScene, 'NAV_spawn_lobby');
    if (!spawnNode) {
      console.warn('[CharAgent] NAV_spawn_lobby not found; spawning at origin');
      return new THREE.Vector3();
    }
    return nodeWorldPosition(spawnNode);
  }, [floorScene]);

  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
      }
    });
    return () => {
      disposeScene(scene);
      useGLTF.clear(CHAR_URL);
    };
  }, [scene]);

  useEffect(() => {
    const clipName = names.includes(IDLE_CLIP) ? IDLE_CLIP : names[0];
    if (!clipName) {
      console.warn('[CharAgent] no animation clips found');
      return;
    }
    if (clipName !== IDLE_CLIP) {
      console.warn(`[CharAgent] clip '${IDLE_CLIP}' missing; falling back to '${clipName}'`);
    }
    const action = actions[clipName];
    action?.reset().play();
    return () => {
      action?.stop();
    };
  }, [actions, names]);

  useFrame(() => {
    if (!group.current) return;
    const p = new THREE.Vector3();
    group.current.getWorldPosition(p);
    window.__hqChar = { x: p.x, y: p.y, z: p.z };
  });

  return (
    <group ref={group} position={spawnPos}>
      <primitive object={scene} />
    </group>
  );
}
