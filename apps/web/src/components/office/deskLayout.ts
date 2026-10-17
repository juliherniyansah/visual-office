import * as THREE from 'three';
import type { FloorId } from '@redhunter/shared';
import { FLOOR_HEIGHT, AGENT_Y_OFFSET } from './constants';

export function deskPositionForDeskId(deskId: string): { x: number; z: number } {
  const hash = deskId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return {
    x: ((hash % 10) - 5) * 1.5,
    z: ((Math.floor(hash / 10) % 10) - 5) * 1.5,
  };
}

export function deskToWorld(floorId: FloorId, deskId: string): THREE.Vector3 {
  const { x, z } = deskPositionForDeskId(deskId);
  return new THREE.Vector3(x, (floorId - 1) * FLOOR_HEIGHT + AGENT_Y_OFFSET, z);
}

export function floorCenter(floorId: FloorId): THREE.Vector3 {
  return new THREE.Vector3(0, (floorId - 1) * FLOOR_HEIGHT + 1, 0);
}
