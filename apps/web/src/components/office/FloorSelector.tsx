'use client';

import { OFFICE_LAYOUT, type FloorId } from '@redhunter/shared';
import { FLOOR_COLORS } from './constants';

export function FloorSelector({
  currentFloor,
  onSelect,
}: {
  currentFloor: FloorId;
  onSelect: (f: FloorId) => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 10,
      }}
    >
      {OFFICE_LAYOUT.floors.map((floor) => {
        const fid = floor.id as FloorId;
        const isActive = fid === currentFloor;
        return (
          <button
            key={floor.id}
            onClick={() => onSelect(fid)}
            style={{
              padding: '8px 16px',
              background: isActive ? FLOOR_COLORS[fid] : 'rgba(0,0,0,0.5)',
              color: 'white',
              border: isActive ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'system-ui',
              fontWeight: isActive ? 600 : 400,
              transition: 'all 0.2s',
              textAlign: 'left' as const,
            }}
          >
            F{floor.id} · {floor.name}
          </button>
        );
      })}
    </div>
  );
}
