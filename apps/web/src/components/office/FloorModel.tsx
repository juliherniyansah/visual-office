'use client';

import { Suspense, useEffect } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import type { FloorId } from '@redhunter/shared';
import { useHqGltf } from './useHqGltf';
import { CharAgent } from './CharAgent';
import { hideByPrefix } from './nodes';

export function disposeScene(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    const materials = Array.isArray(material) ? material : [material];
    for (const mat of materials) {
      for (const value of Object.values(mat)) {
        if (value && (value as THREE.Texture).isTexture) {
          (value as THREE.Texture).dispose();
        }
      }
      mat.dispose();
    }
  });
}

export function FloorModel({ n }: { n: FloorId }) {
  const url = `/models/floor_${n}.glb`;
  const { scene } = useHqGltf(url);

  useEffect(() => {
    const hidden = hideByPrefix(scene, 'COL_');
    console.debug(`[FloorModel] floor ${n}: hid ${hidden} COL_ nodes`);
    return () => {
      disposeScene(scene);
      useGLTF.clear(url);
    };
  }, [scene, url, n]);

  return (
    <>
      <primitive object={scene} />
      {n === 1 && (
        <Suspense fallback={null}>
          <CharAgent floorScene={scene} />
        </Suspense>
      )}
    </>
  );
}
