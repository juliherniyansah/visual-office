'use client';

import { createContext } from 'react';
import type * as THREE from 'three';

export type FocusTarget = { position: THREE.Vector3; distance: number } | null;

export interface FocusContextValue {
  target: FocusTarget;
  setTarget: (t: FocusTarget) => void;
}

export const FocusContext = createContext<FocusContextValue>({
  target: null,
  setTarget: () => {},
});
