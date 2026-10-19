'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { FloorId } from '@redhunter/shared';

declare global {
  interface Window {
    __hqStats?: {
      floorId: FloorId;
      calls: number;
      triangles: number;
      fps: number;
    };
  }
}

interface PerfProbeProps {
  floorId: FloorId;
}

export function PerfProbe({ floorId }: PerfProbeProps) {
  const gl = useThree((s) => s.gl);
  const accRef = useRef({
    elapsed: 0,
    frames: 0,
    maxCalls: 0,
    maxTriangles: 0,
  });

  useFrame((_, delta) => {
    const info = gl.info.render;
    const acc = accRef.current;

    acc.frames += 1;
    acc.elapsed += delta;
    acc.maxCalls = Math.max(acc.maxCalls, info.calls);
    acc.maxTriangles = Math.max(acc.maxTriangles, info.triangles);

    if (acc.elapsed >= 1) {
      window.__hqStats = {
        floorId,
        calls: acc.maxCalls,
        triangles: acc.maxTriangles,
        fps: Math.round(acc.frames / acc.elapsed),
      };
      accRef.current = {
        elapsed: 0,
        frames: 0,
        maxCalls: 0,
        maxTriangles: 0,
      };
    }
  });

  return null;
}
