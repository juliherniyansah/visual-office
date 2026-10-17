'use client';

import { useGLTF } from '@react-three/drei';

export const BUILDING_MODEL_URL = '/models/building.glb';

export function Building() {
  const { scene } = useGLTF(BUILDING_MODEL_URL);
  return <primitive object={scene} />;
}
