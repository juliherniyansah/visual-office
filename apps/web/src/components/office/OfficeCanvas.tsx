'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { StdlibKTX2Loader } from './useHqGltf';
import { getSharedKtx2Loader, releaseKtx2Loader, retainKtx2Loader } from './useHqGltf';
import type { FloorId } from '@redhunter/shared';
import { Scene } from './Scene';
import { FloorSelector } from './FloorSelector';
import { WebGLErrorBoundary } from './WebGLErrorBoundary';
import { FloorLoadBoundary } from './FloorLoadBoundary';
import { FocusContext, type FocusTarget } from './focusContext';
import { floorCenter } from './deskLayout';

// Preload must live inside Canvas: KTX2Loader.detectSupport needs the renderer,
// and module-scope preload throws on KTX2 GLBs.
function ModelPreloader() {
  const gl = useThree((s) => s.gl);
  const ktx2 = useMemo(() => getSharedKtx2Loader(gl), [gl]);
  useEffect(() => {
    retainKtx2Loader(gl);
    const extendLoader = (loader: { setKTX2Loader: (k: StdlibKTX2Loader) => unknown }) => {
      loader.setKTX2Loader(ktx2 as unknown as StdlibKTX2Loader);
    };
    useGLTF.preload('/models/hq_shell.glb', false, true, extendLoader);
    useGLTF.preload('/models/floor_1.glb', false, true, extendLoader);
    // Deferred release: dispose happens only if holders stays 0 after a macrotask,
    // so StrictMode's synchronous remount retains the loader again before eviction.
    return () => releaseKtx2Loader(gl);
  }, [gl, ktx2]);
  return null;
}

export default function OfficeCanvas() {
  const [currentFloor, setCurrentFloor] = useState<FloorId>(1);
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);
  const [disableCutaway] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('nocut'),
  );

  const handleFloorSelect = (floorId: FloorId) => {
    setCurrentFloor(floorId);
    setFocusTarget({ position: floorCenter(floorId), distance: 15 });
  };

  return (
    <WebGLErrorBoundary>
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <FloorSelector currentFloor={currentFloor} onSelect={handleFloorSelect} />
        <FloorLoadBoundary resetKey={currentFloor} modelUrl={`/models/floor_${currentFloor}.glb`}>
          <Canvas
            shadows
            camera={{ position: [14, 12, 18], fov: 60, near: 0.1, far: 200 }}
            gl={{
              antialias: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1,
            }}
            onCreated={({ gl }) => {
              gl.setClearColor('#0a0a0a');
            }}
          >
            <ModelPreloader />
            <Suspense fallback={null}>
              <FocusContext.Provider value={{ target: focusTarget, setTarget: setFocusTarget }}>
                <Scene currentFloor={currentFloor} disableCutaway={disableCutaway} />
              </FocusContext.Provider>
            </Suspense>
          </Canvas>
        </FloorLoadBoundary>
      </div>
    </WebGLErrorBoundary>
  );
}
