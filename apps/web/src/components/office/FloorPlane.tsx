'use client';

import type { FloorId } from '@redhunter/shared';
import { FLOOR_HEIGHT, FLOOR_COLORS, FLOOR_EMISSIVE } from './constants';

export function FloorPlane({ floorId }: { floorId: FloorId }) {
  const y = (floorId - 1) * FLOOR_HEIGHT;
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial
        color={FLOOR_COLORS[floorId]}
        emissive={FLOOR_EMISSIVE[floorId]}
        emissiveIntensity={0.3}
        roughness={0.8}
      />
    </mesh>
  );
}
