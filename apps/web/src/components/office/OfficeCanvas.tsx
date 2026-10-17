'use client';

import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import type { FloorId } from '@redhunter/shared';
import { Scene } from './Scene';
import { FloorSelector } from './FloorSelector';
import { WebGLErrorBoundary } from './WebGLErrorBoundary';
import { FocusContext, type FocusTarget } from './focusContext';
import { floorCenter } from './deskLayout';
import { DEFAULT_STATUSES, type AgentStatuses } from './constants';

interface OfficeCanvasProps {
  agentStatuses?: Partial<AgentStatuses>;
}

export default function OfficeCanvas({ agentStatuses: agentStatusesProp }: OfficeCanvasProps) {
  const [currentFloor, setCurrentFloor] = useState<FloorId>(2);
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);

  const agentStatuses = useMemo<AgentStatuses>(
    () => ({
      ...DEFAULT_STATUSES,
      ...agentStatusesProp,
    }),
    [agentStatusesProp],
  );

  const handleFloorSelect = (floorId: FloorId) => {
    setCurrentFloor(floorId);
    setFocusTarget({ position: floorCenter(floorId), distance: 15 });
  };

  return (
    <WebGLErrorBoundary>
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <FloorSelector currentFloor={currentFloor} onSelect={handleFloorSelect} />
        <Canvas
          shadows
          camera={{ position: [0, 6, 18], fov: 60, near: 0.1, far: 200 }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1,
          }}
          onCreated={({ gl }) => {
            gl.setClearColor('#0a0a0a');
          }}
        >
          <Suspense fallback={null}>
            <FocusContext.Provider value={{ target: focusTarget, setTarget: setFocusTarget }}>
              <Scene agentStatuses={agentStatuses} />
            </FocusContext.Provider>
          </Suspense>
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
}
