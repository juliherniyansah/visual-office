'use client';

import { useEffect } from 'react';
import type { FloorId } from '@redhunter/shared';
import { useHqGltf } from './useHqGltf';
import { findNodesByPrefix } from './nodes';

export const HQ_SHELL_URL = '/models/hq_shell.glb';

const ALL_FLOORS: FloorId[] = [1, 2, 3, 4];
const FACADE_KINDS = ['wall', 'window', 'door'] as const;

export function HqShell({
  activeFloor,
  disableCutaway = false,
}: {
  activeFloor: FloorId;
  disableCutaway?: boolean;
}) {
  const { scene } = useHqGltf(HQ_SHELL_URL);

  useEffect(() => {
    if (disableCutaway) return;
    let hidden = 0;
    for (const floor of ALL_FLOORS) {
      for (const kind of FACADE_KINDS) {
        const nodes = findNodesByPrefix(scene, `${kind}_f${floor}_`);
        for (const node of nodes) {
          node.visible = floor !== activeFloor;
        }
        if (floor === activeFloor) hidden += nodes.length;
      }
    }
    console.debug(`[HqShell] cutaway f${activeFloor}: hid ${hidden} facade nodes`);
  }, [scene, activeFloor, disableCutaway]);

  return <primitive object={scene} />;
}
