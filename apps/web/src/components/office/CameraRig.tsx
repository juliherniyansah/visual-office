'use client';

import { useContext, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { CAMERA_LERP_SPEED } from './constants';
import { FocusContext } from './focusContext';

export function CameraRig() {
  const { target } = useContext(FocusContext);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3(0, 6, 18));
  const targetLookAt = useRef(new THREE.Vector3(0, 4, 0));

  useEffect(() => {
    if (!target) return;
    const { position, distance } = target;
    targetLookAt.current.copy(position);
    const offset = new THREE.Vector3(distance * 0.6, distance * 0.4, distance * 0.8);
    targetPosition.current.copy(position).add(offset);
  }, [target]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const t = Math.min(1, delta * CAMERA_LERP_SPEED);
    controls.target.lerp(targetLookAt.current, t);
    camera.position.lerp(targetPosition.current, t);
    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      minDistance={3}
      maxDistance={40}
      maxPolarAngle={Math.PI * 0.48}
    />
  );
}
