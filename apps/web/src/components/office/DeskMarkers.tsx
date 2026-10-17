'use client';

import { useMemo } from 'react';
import { Instances, Instance } from '@react-three/drei';
import { OFFICE_LAYOUT } from '@redhunter/shared';
import { FLOOR_HEIGHT } from './constants';
import { deskPositionForDeskId } from './deskLayout';

export function DeskMarkers() {
  const desks = useMemo(() => {
    const all: Array<{ position: [number, number, number] }> = [];
    for (const floor of OFFICE_LAYOUT.floors) {
      for (const desk of floor.desks) {
        const { x, z } = deskPositionForDeskId(desk.deskId);
        all.push({
          position: [x, (floor.id - 1) * FLOOR_HEIGHT + 0.4, z],
        });
      }
    }
    return all;
  }, []);

  return (
    <Instances limit={desks.length}>
      <boxGeometry args={[0.8, 0.1, 0.5]} />
      <meshStandardMaterial color="#78716c" roughness={0.6} metalness={0.3} />
      {desks.map((desk, i) => (
        <Instance key={i} position={desk.position} />
      ))}
    </Instances>
  );
}
