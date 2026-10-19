'use client';

import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

// drei's GLTFLoader comes from three-stdlib (not reachable as a direct import
// here), and its KTX2Loader type is incompatible with @types/three despite
// being runtime-identical — derive it from useGLTF.preload instead.
type ExtendLoader = NonNullable<Parameters<typeof useGLTF.preload>[3]>;
export type StdlibKTX2Loader = Parameters<Parameters<ExtendLoader>[0]['setKTX2Loader']>[0];

// Shared KTX2Loader per renderer, keyed by WebGLRenderer. Prevents 4 instantiations
// per Canvas mount (preloader + HqShell + FloorModel + CharAgent) and leaks on
// error-recovery remounts.
const ktx2LoaderCache = new WeakMap<THREE.WebGLRenderer, { loader: KTX2Loader; holders: number }>();

export function getSharedKtx2Loader(gl: THREE.WebGLRenderer): KTX2Loader {
  let entry = ktx2LoaderCache.get(gl);
  if (!entry) {
    entry = { loader: new KTX2Loader().setTranscoderPath('/basis/').detectSupport(gl), holders: 0 };
    ktx2LoaderCache.set(gl, entry);
  }
  return entry.loader;
}

export function retainKtx2Loader(gl: THREE.WebGLRenderer): void {
  getSharedKtx2Loader(gl);
  const entry = ktx2LoaderCache.get(gl);
  if (entry) entry.holders += 1;
}

export function releaseKtx2Loader(gl: THREE.WebGLRenderer): void {
  const entry = ktx2LoaderCache.get(gl);
  if (!entry) return;
  entry.holders = Math.max(0, entry.holders - 1);
  setTimeout(() => {
    const e = ktx2LoaderCache.get(gl);
    if (e && e.holders === 0) {
      e.loader.dispose();
      ktx2LoaderCache.delete(gl);
    }
  }, 0);
}

// KTX2Loader needs the live WebGLRenderer, so it must be created inside a
// component under Canvas — never at module scope.
export function useKtx2Loader(): KTX2Loader {
  const gl = useThree((s) => s.gl);
  return useMemo(() => getSharedKtx2Loader(gl), [gl]);
}

export function useHqGltf(url: string) {
  const ktx2 = useKtx2Loader();
  return useGLTF(url, false, true, (loader) => {
    loader.setKTX2Loader(ktx2 as unknown as StdlibKTX2Loader);
  });
}
