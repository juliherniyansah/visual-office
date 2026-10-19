'use client';

import { Suspense } from 'react';
import type { FloorId } from '@redhunter/shared';
import { Lighting } from './Lighting';
import { HqShell } from './HqShell';
import { FloorModel } from './FloorModel';
import { CameraRig } from './CameraRig';
import { PerfProbe } from './PerfProbe';

export function Scene({
  currentFloor,
  disableCutaway = false,
}: {
  currentFloor: FloorId;
  disableCutaway?: boolean;
}) {
  return (
    <>
      <Lighting />
      <PerfProbe floorId={currentFloor} />

      <HqShell activeFloor={currentFloor} disableCutaway={disableCutaway} />

      <Suspense fallback={null}>
        <FloorModel n={currentFloor} />
      </Suspense>

      <CameraRig />
    </>
  );
}
