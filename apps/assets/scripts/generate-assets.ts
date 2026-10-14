#!/usr/bin/env bun
/**
 * Asset Pipeline - Generate placeholder GLB models
 *
 * Generates:
 * - building.glb: Simple office building shell (box geometry)
 * - character.glb: Placeholder character rig with 5 animation clips
 *
 * Builds glTF JSON directly and packs into GLB binary format.
 * No browser APIs needed — runs in Bun/Node.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(import.meta.dir, '..', 'models');
mkdirSync(OUTPUT_DIR, { recursive: true });

type GlTF = Record<string, any>;

function pad4(n: number): number {
  return (4 - (n % 4)) % 4;
}

function buildGLB(gltf: GlTF, bin: ArrayBuffer): ArrayBuffer {
  const jsonStr = JSON.stringify(gltf);
  const jsonBuf = new TextEncoder().encode(jsonStr);
  const jsonPad = pad4(jsonBuf.byteLength);
  const binPad = pad4(bin.byteLength);

  const jsonChunkLen = jsonBuf.byteLength + jsonPad;
  const binChunkLen = bin.byteLength + binPad;
  const totalLen = 12 + 8 + jsonChunkLen + 8 + binChunkLen;

  const glb = new ArrayBuffer(totalLen);
  const view = new DataView(glb);
  const u8 = new Uint8Array(glb);

  // Header
  view.setUint32(0, 0x46546c67, true); // glTF
  view.setUint32(4, 2, true); // version
  view.setUint32(8, totalLen, true);

  // JSON chunk
  view.setUint32(12, jsonChunkLen, true);
  view.setUint32(16, 0x4e4f534a, true); // JSON
  u8.set(jsonBuf, 20);
  for (let i = 0; i < jsonPad; i++) u8[20 + jsonBuf.byteLength + i] = 0x20;

  // BIN chunk
  const binOffset = 20 + jsonChunkLen;
  view.setUint32(binOffset, binChunkLen, true);
  view.setUint32(binOffset + 4, 0x004e4942, true); // BIN\0
  u8.set(new Uint8Array(bin), binOffset + 8);

  return glb;
}

function createBoxGeometry(
  w: number, h: number, d: number
): { positions: Float32Array; normals: Float32Array; indices: Uint16Array } {
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const positions = new Float32Array([
    // Front
    -hw, -hh, hd, hw, -hh, hd, hw, hh, hd, -hw, hh, hd,
    // Back
    hw, -hh, -hd, -hw, -hh, -hd, -hw, hh, -hd, hw, hh, -hd,
    // Top
    -hw, hh, hd, hw, hh, hd, hw, hh, -hd, -hw, hh, -hd,
    // Bottom
    -hw, -hh, -hd, hw, -hh, -hd, hw, -hh, hd, -hw, -hh, hd,
    // Right
    hw, -hh, hd, hw, -hh, -hd, hw, hh, -hd, hw, hh, hd,
    // Left
    -hw, -hh, -hd, -hw, -hh, hd, -hw, hh, hd, -hw, hh, -hd,
  ]);
  const normals = new Float32Array([
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ]);
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23,
  ]);
  return { positions, normals, indices };
}

function createCapsuleGeometry(
  radius: number, height: number, segments: number
): { positions: Float32Array; normals: Float32Array; indices: Uint16Array } {
  const halfH = height / 2;
  const rings = segments;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  // Top hemisphere
  for (let y = 0; y <= rings / 2; y++) {
    const phi = (y / rings) * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    for (let x = 0; x <= segments; x++) {
      const theta = (x / segments) * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      const px = radius * sinPhi * cosTheta;
      const py = radius * cosPhi + halfH;
      const pz = radius * sinPhi * sinTheta;
      positions.push(px, py, pz);
      const nx = sinPhi * cosTheta;
      const ny = cosPhi;
      const nz = sinPhi * sinTheta;
      normals.push(nx, ny, nz);
    }
  }

  // Bottom hemisphere
  for (let y = rings / 2; y <= rings; y++) {
    const phi = (y / rings) * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    for (let x = 0; x <= segments; x++) {
      const theta = (x / segments) * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      const px = radius * sinPhi * cosTheta;
      const py = radius * cosPhi - halfH;
      const pz = radius * sinPhi * sinTheta;
      positions.push(px, py, pz);
      const nx = sinPhi * cosTheta;
      const ny = cosPhi;
      const nz = sinPhi * sinTheta;
      normals.push(nx, ny, nz);
    }
  }

  const totalRings = rings + 1;
  const segs1 = segments + 1;
  for (let y = 0; y < totalRings; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * segs1 + x;
      const b = a + segs1;
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}

function createSphereGeometry(
  radius: number, wSeg: number, hSeg: number
): { positions: Float32Array; normals: Float32Array; indices: Uint16Array } {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (let y = 0; y <= hSeg; y++) {
    const phi = (y / hSeg) * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    for (let x = 0; x <= wSeg; x++) {
      const theta = (x / wSeg) * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      positions.push(radius * sinPhi * cosTheta, radius * cosPhi, radius * sinPhi * sinTheta);
      normals.push(sinPhi * cosTheta, cosPhi, sinPhi * sinTheta);
    }
  }

  const segs1 = wSeg + 1;
  for (let y = 0; y < hSeg; y++) {
    for (let x = 0; x < wSeg; x++) {
      const a = y * segs1 + x;
      const b = a + segs1;
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}

function concatBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  let totalLen = 0;
  for (const b of buffers) totalLen += b.byteLength;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const b of buffers) {
    result.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  return result.buffer;
}

function alignBuffer(buffer: ArrayBuffer, alignment: number): ArrayBuffer {
  const pad = (alignment - (buffer.byteLength % alignment)) % alignment;
  if (pad === 0) return buffer;
  const result = new Uint8Array(buffer.byteLength + pad);
  result.set(new Uint8Array(buffer), 0);
  return result.buffer;
}

function buildBuilding(): void {
  const body = createBoxGeometry(4, 6, 4);
  const roof = createBoxGeometry(4.2, 0.3, 4.2);
  const windowGeo = createBoxGeometry(0.8, 1, 0.1);
  const door = createBoxGeometry(1, 1.8, 0.1);

  const bufferParts: ArrayBuffer[] = [];
  let byteOffset = 0;
  const bufferViews: any[] = [];
  const accessors: any[] = [];
  const meshes: any[] = [];
  const nodes: any[] = [];
  const materials: any[] = [];

  function addMeshPart(
    geo: { positions: Float32Array; normals: Float32Array; indices: Uint16Array },
    transform: number[],
    materialIndex: number,
    name: string
  ) {
    const posBuf = alignBuffer(geo.positions.buffer, 4);
    const normBuf = alignBuffer(geo.normals.buffer, 4);
    const idxBuf = alignBuffer(geo.indices.buffer, 4);

    const posBV = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: posBuf.byteLength, target: 34962 });
    bufferParts.push(posBuf);
    byteOffset += posBuf.byteLength;

    const normBV = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: normBuf.byteLength, target: 34962 });
    bufferParts.push(normBuf);
    byteOffset += normBuf.byteLength;

    const idxBV = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: idxBuf.byteLength, target: 34963 });
    bufferParts.push(idxBuf);
    byteOffset += idxBuf.byteLength;

    // Compute bounds
    const posArr = new Float32Array(posBuf);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < posArr.length; i += 3) {
      for (let j = 0; j < 3; j++) {
        min[j] = Math.min(min[j], posArr[i + j]);
        max[j] = Math.max(max[j], posArr[i + j]);
      }
    }

    const posAcc = accessors.length;
    accessors.push({
      bufferView: posBV,
      componentType: 5126,
      count: geo.positions.length / 3,
      type: 'VEC3',
      min: min as number[],
      max: max as number[],
    });

    const normAcc = accessors.length;
    accessors.push({
      bufferView: normBV,
      componentType: 5126,
      count: geo.normals.length / 3,
      type: 'VEC3',
    });

    const idxAcc = accessors.length;
    const idxArr = new Uint16Array(idxBuf);
    accessors.push({
      bufferView: idxBV,
      componentType: 5123,
      count: geo.indices.length,
      type: 'SCALAR',
      min: [Math.min(...idxArr)],
      max: [Math.max(...idxArr)],
    });

    meshes.push({
      name,
      primitives: [{ attributes: { POSITION: posAcc, NORMAL: normAcc }, indices: idxAcc, material: materialIndex }],
    });

    nodes.push({ name, mesh: meshes.length - 1, translation: transform });
  }

  // Materials
  materials.push(
    { name: 'BuildingBody', pbrMetallicRoughness: { baseColorFactor: [0.5, 0.5, 0.56, 1], metallicFactor: 0.1, roughnessFactor: 0.7 } },
    { name: 'Roof', pbrMetallicRoughness: { baseColorFactor: [0.25, 0.25, 0.31, 1], metallicFactor: 0, roughnessFactor: 0.9 } },
    { name: 'Window', pbrMetallicRoughness: { baseColorFactor: [0.53, 0.8, 1, 1], metallicFactor: 0.8, roughnessFactor: 0.1 }, emissiveFactor: [0.13, 0.27, 0.4] },
    { name: 'Door', pbrMetallicRoughness: { baseColorFactor: [0.29, 0.19, 0.13, 1], metallicFactor: 0, roughnessFactor: 0.8 } }
  );

  // Building body
  addMeshPart(body, [0, 3, 0], 0, 'BuildingBody');
  // Roof
  addMeshPart(roof, [0, 6.15, 0], 1, 'Roof');

  // Windows
  for (let floor = 0; floor < 3; floor++) {
    for (let col = 0; col < 2; col++) {
      addMeshPart(windowGeo, [-0.8 + col * 1.6, 1.5 + floor * 2, 2.01], 2, `Window_F${floor}_C${col}`);
    }
  }

  // Door
  addMeshPart(door, [0, 0.9, 2.01], 3, 'Door');

  const gltf: GlTF = {
    asset: { version: '2.0', generator: 'visual-office-asset-pipeline' },
    scene: 0,
    scenes: [{ name: 'BuildingScene', nodes: [0] }],
    nodes: [{ name: 'Building', children: nodes.map((_, i) => i + 1), translation: [0, 0, 0] }, ...nodes],
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: byteOffset }],
  };

  const bin = concatBuffers(bufferParts);
  const glb = buildGLB(gltf, bin);
  writeFileSync(join(OUTPUT_DIR, 'building.glb'), Buffer.from(glb));
  console.log(`✓ building.glb (${glb.byteLength} bytes)`);
}

function buildCharacter(): void {
  const body = createCapsuleGeometry(0.3, 0.8, 12);
  const head = createSphereGeometry(0.25, 16, 16);
  const arm = createCapsuleGeometry(0.08, 0.5, 8);
  const leg = createCapsuleGeometry(0.1, 0.6, 8);

  const bufferParts: ArrayBuffer[] = [];
  let byteOffset = 0;
  const bufferViews: any[] = [];
  const accessors: any[] = [];
  const meshes: any[] = [];
  const materials: any[] = [];
  const nodeEntries: any[] = [];

  function addMeshPart(
    geo: { positions: Float32Array; normals: Float32Array; indices: Uint16Array },
    materialIndex: number,
    name: string
  ): number {
    const posBuf = alignBuffer(geo.positions.buffer, 4);
    const normBuf = alignBuffer(geo.normals.buffer, 4);
    const idxBuf = alignBuffer(geo.indices.buffer, 4);

    const posBV = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: posBuf.byteLength, target: 34962 });
    bufferParts.push(posBuf);
    byteOffset += posBuf.byteLength;

    const normBV = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: normBuf.byteLength, target: 34962 });
    bufferParts.push(normBuf);
    byteOffset += normBuf.byteLength;

    const idxBV = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: idxBuf.byteLength, target: 34963 });
    bufferParts.push(idxBuf);
    byteOffset += idxBuf.byteLength;

    const posArr = new Float32Array(posBuf);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < posArr.length; i += 3) {
      for (let j = 0; j < 3; j++) {
        min[j] = Math.min(min[j], posArr[i + j]);
        max[j] = Math.max(max[j], posArr[i + j]);
      }
    }

    const posAcc = accessors.length;
    accessors.push({ bufferView: posBV, componentType: 5126, count: geo.positions.length / 3, type: 'VEC3', min, max });

    const normAcc = accessors.length;
    accessors.push({ bufferView: normBV, componentType: 5126, count: geo.normals.length / 3, type: 'VEC3' });

    const idxAcc = accessors.length;
    const idxArr = new Uint16Array(idxBuf);
    accessors.push({ bufferView: idxBV, componentType: 5123, count: geo.indices.length, type: 'SCALAR', min: [Math.min(...idxArr)], max: [Math.max(...idxArr)] });

    meshes.push({
      name,
      primitives: [{ attributes: { POSITION: posAcc, NORMAL: normAcc }, indices: idxAcc, material: materialIndex }],
    });

    const nodeIdx = nodeEntries.length;
    nodeEntries.push({ name, mesh: meshes.length - 1 });
    return nodeIdx;
  }

  materials.push(
    { name: 'Body', pbrMetallicRoughness: { baseColorFactor: [0.2, 0.4, 0.67, 1], metallicFactor: 0, roughnessFactor: 0.6 } },
    { name: 'Head', pbrMetallicRoughness: { baseColorFactor: [1, 0.86, 0.67, 1], metallicFactor: 0, roughnessFactor: 0.7 } },
    { name: 'Legs', pbrMetallicRoughness: { baseColorFactor: [0.16, 0.16, 0.23, 1], metallicFactor: 0, roughnessFactor: 0.8 } }
  );

  const bodyIdx = addMeshPart(body, 0, 'Body');
  const headIdx = addMeshPart(head, 1, 'Head');
  const leftArmIdx = addMeshPart(arm, 0, 'LeftArm');
  const rightArmIdx = addMeshPart(arm, 0, 'RightArm');
  const leftLegIdx = addMeshPart(leg, 2, 'LeftLeg');
  const rightLegIdx = addMeshPart(leg, 2, 'RightLeg');

  // Set node transforms
  nodeEntries[bodyIdx].translation = [0, 1.0, 0];
  nodeEntries[headIdx].translation = [0, 1.75, 0];
  nodeEntries[leftArmIdx].translation = [-0.4, 1.1, 0];
  nodeEntries[leftArmIdx].rotation = quatFromEuler(0, 0, 0.2);
  nodeEntries[rightArmIdx].translation = [0.4, 1.1, 0];
  nodeEntries[rightArmIdx].rotation = quatFromEuler(0, 0, -0.2);
  nodeEntries[leftLegIdx].translation = [-0.15, 0.4, 0];
  nodeEntries[rightLegIdx].translation = [0.15, 0.4, 0];

  // Build animation buffer data
  const animBufferParts: ArrayBuffer[] = [];
  let animByteOffset = 0;
  const animBufferViews: any[] = [];
  const animAccessors: any[] = [];

  function addAnimAccessor(data: Float32Array, type: string, min?: number[], max?: number[]): number {
    const buf = alignBuffer(data.buffer, 4);
    const bvIdx = animBufferViews.length + bufferViews.length;
    animBufferViews.push({ buffer: 0, byteOffset: animByteOffset, byteLength: buf.byteLength });
    animBufferParts.push(buf);
    animByteOffset += buf.byteLength;

    const accIdx = animAccessors.length + accessors.length;
    const acc: any = { bufferView: bvIdx, componentType: 5126, count: data.length / (type === 'VEC3' ? 3 : type === 'VEC4' ? 4 : 1), type };
    if (min) acc.min = min;
    if (max) acc.max = max;
    animAccessors.push(acc);
    return accIdx;
  }

  function buildAnimations(nodes: any[]): any[] {
    const clips: any[] = [];

    // Helper: build sampler for a node's property
    function buildSampler(
      nodeIdx: number,
      property: 'translation' | 'rotation' | 'scale',
      times: number[],
      values: number[],
      interpolation: string
    ) {
      const timesArr = new Float32Array(times);
      const valuesArr = new Float32Array(values);
      const type = property === 'rotation' ? 'VEC4' : 'VEC3';
      const timeMin = [times[0]];
      const timeMax = [times[times.length - 1]];

      let valMin: number[] | undefined;
      let valMax: number[] | undefined;
      if (type === 'VEC3') {
        valMin = [Infinity, Infinity, Infinity];
        valMax = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < valuesArr.length; i += 3) {
          for (let j = 0; j < 3; j++) {
            valMin[j] = Math.min(valMin[j], valuesArr[i + j]);
            valMax[j] = Math.max(valMax[j], valuesArr[i + j]);
          }
        }
      }

      const timeAcc = addAnimAccessor(timesArr, 'SCALAR', timeMin, timeMax);
      const valAcc = addAnimAccessor(valuesArr, type, valMin, valMax);

      return { input: timeAcc, output: valAcc, interpolation };
    }

    // 1. IDLE
    {
      const bodyTimes = [0, 1, 2];
      const bodyVals = [0, 1.0, 0, 0, 1.02, 0, 0, 1.0, 0];
      const headTimes = [0, 2, 4];
      const headVals: number[] = [];
      for (const q of [
        quatFromEuler(0, 0, 0),
        quatFromEuler(0.05, 0.05, 0),
        quatFromEuler(0, 0, 0),
      ]) headVals.push(...q);

      clips.push({
        name: 'idle',
        samplers: [
          buildSampler(bodyIdx, 'translation', bodyTimes, bodyVals, 'CUBICSPLINE'),
          buildSampler(headIdx, 'rotation', headTimes, headVals, 'CUBICSPLINE'),
        ],
        channels: [
          { sampler: 0, target: { node: bodyIdx, path: 'translation' } },
          { sampler: 1, target: { node: headIdx, path: 'rotation' } },
        ],
      });
    }

    // 2. TYPING
    {
      const la_times = [0, 0.2, 0.4, 0.6, 0.8];
      const la_vals: number[] = [];
      for (const q of [
        quatFromEuler(0, 0, 0.2),
        quatFromEuler(-0.3, 0, 0.2),
        quatFromEuler(0, 0, 0.2),
        quatFromEuler(-0.3, 0, 0.2),
        quatFromEuler(0, 0, 0.2),
      ]) la_vals.push(...q);

      const ra_times = [0, 0.2, 0.4, 0.6, 0.8];
      const ra_vals: number[] = [];
      for (const q of [
        quatFromEuler(-0.3, 0, -0.2),
        quatFromEuler(0, 0, -0.2),
        quatFromEuler(-0.3, 0, -0.2),
        quatFromEuler(0, 0, -0.2),
        quatFromEuler(-0.3, 0, -0.2),
      ]) ra_vals.push(...q);

      const headTimes = [0, 1, 2];
      const headVals: number[] = [];
      for (const q of [
        quatFromEuler(-0.1, 0, 0),
        quatFromEuler(-0.15, 0.05, 0),
        quatFromEuler(-0.1, 0, 0),
      ]) headVals.push(...q);

      clips.push({
        name: 'typing',
        samplers: [
          buildSampler(leftArmIdx, 'rotation', la_times, la_vals, 'LINEAR'),
          buildSampler(rightArmIdx, 'rotation', ra_times, ra_vals, 'LINEAR'),
          buildSampler(headIdx, 'rotation', headTimes, headVals, 'CUBICSPLINE'),
        ],
        channels: [
          { sampler: 0, target: { node: leftArmIdx, path: 'rotation' } },
          { sampler: 1, target: { node: rightArmIdx, path: 'rotation' } },
          { sampler: 2, target: { node: headIdx, path: 'rotation' } },
        ],
      });
    }

    // 3. STAND
    {
      const times = [0, 1];
      const vals = [0, 1.0, 0, 0, 1.0, 0];
      clips.push({
        name: 'stand',
        samplers: [buildSampler(bodyIdx, 'translation', times, vals, 'LINEAR')],
        channels: [{ sampler: 0, target: { node: bodyIdx, path: 'translation' } }],
      });
    }

    // 4. WALK
    {
      const ll_times = [0, 0.5, 1];
      const ll_vals: number[] = [];
      for (const q of [quatFromEuler(0.3, 0, 0), quatFromEuler(-0.3, 0, 0), quatFromEuler(0.3, 0, 0)])
        ll_vals.push(...q);

      const rl_times = [0, 0.5, 1];
      const rl_vals: number[] = [];
      for (const q of [quatFromEuler(-0.3, 0, 0), quatFromEuler(0.3, 0, 0), quatFromEuler(-0.3, 0, 0)])
        rl_vals.push(...q);

      const la_times = [0, 0.5, 1];
      const la_vals: number[] = [];
      for (const q of [quatFromEuler(-0.4, 0, 0.2), quatFromEuler(0.4, 0, 0.2), quatFromEuler(-0.4, 0, 0.2)])
        la_vals.push(...q);

      const ra_times = [0, 0.5, 1];
      const ra_vals: number[] = [];
      for (const q of [quatFromEuler(0.4, 0, -0.2), quatFromEuler(-0.4, 0, -0.2), quatFromEuler(0.4, 0, -0.2)])
        ra_vals.push(...q);

      const bodyTimes = [0, 0.25, 0.5, 0.75, 1];
      const bodyVals = [0, 1.0, 0, 0, 1.02, 0, 0, 1.0, 0, 0, 1.02, 0, 0, 1.0, 0];

      clips.push({
        name: 'walk',
        samplers: [
          buildSampler(leftLegIdx, 'rotation', ll_times, ll_vals, 'CUBICSPLINE'),
          buildSampler(rightLegIdx, 'rotation', rl_times, rl_vals, 'CUBICSPLINE'),
          buildSampler(leftArmIdx, 'rotation', la_times, la_vals, 'CUBICSPLINE'),
          buildSampler(rightArmIdx, 'rotation', ra_times, ra_vals, 'CUBICSPLINE'),
          buildSampler(bodyIdx, 'translation', bodyTimes, bodyVals, 'CUBICSPLINE'),
        ],
        channels: [
          { sampler: 0, target: { node: leftLegIdx, path: 'rotation' } },
          { sampler: 1, target: { node: rightLegIdx, path: 'rotation' } },
          { sampler: 2, target: { node: leftArmIdx, path: 'rotation' } },
          { sampler: 3, target: { node: rightArmIdx, path: 'rotation' } },
          { sampler: 4, target: { node: bodyIdx, path: 'translation' } },
        ],
      });
    }

    // 5. TALK
    {
      const headTimes = [0, 0.5, 1, 1.5, 2];
      const headVals: number[] = [];
      for (const q of [
        quatFromEuler(0, 0, 0),
        quatFromEuler(0.1, 0.1, 0),
        quatFromEuler(-0.05, -0.05, 0),
        quatFromEuler(0.08, 0.08, 0),
        quatFromEuler(0, 0, 0),
      ]) headVals.push(...q);

      const ra_times = [0, 0.5, 1, 1.5, 2];
      const ra_vals: number[] = [];
      for (const q of [
        quatFromEuler(0, 0, -0.2),
        quatFromEuler(-0.5, 0, -0.3),
        quatFromEuler(-0.3, 0, -0.2),
        quatFromEuler(-0.6, 0, -0.3),
        quatFromEuler(0, 0, -0.2),
      ]) ra_vals.push(...q);

      clips.push({
        name: 'talk',
        samplers: [
          buildSampler(headIdx, 'rotation', headTimes, headVals, 'CUBICSPLINE'),
          buildSampler(rightArmIdx, 'rotation', ra_times, ra_vals, 'CUBICSPLINE'),
        ],
        channels: [
          { sampler: 0, target: { node: headIdx, path: 'rotation' } },
          { sampler: 1, target: { node: rightArmIdx, path: 'rotation' } },
        ],
      });
    }

    return clips;
  }

  const animations = buildAnimations(nodeEntries);

  // Merge animation buffers into main buffer
  const allBufferParts = [...bufferParts, ...animBufferParts];
  const totalByteOffset = byteOffset;

  // Update buffer views for animation data to use correct offsets
  for (const bv of animBufferViews) {
    bv.byteOffset += byteOffset;
    bufferViews.push(bv);
  }

  const gltf: GlTF = {
    asset: { version: '2.0', generator: 'visual-office-asset-pipeline' },
    scene: 0,
    scenes: [{ name: 'CharacterScene', nodes: [0] }],
    nodes: [
      { name: 'Character', children: nodeEntries.map((_, i) => i + 1), translation: [0, 0, 0] },
      ...nodeEntries,
    ],
    meshes,
    materials,
    accessors: [...accessors, ...animAccessors],
    bufferViews,
    buffers: [{ byteLength: totalByteOffset + animByteOffset }],
    animations,
  };

  const bin = concatBuffers(allBufferParts);
  const glb = buildGLB(gltf, bin);
  writeFileSync(join(OUTPUT_DIR, 'character.glb'), Buffer.from(glb));
  console.log(`✓ character.glb (${glb.byteLength} bytes, ${animations.length} animations)`);
}

function quatFromEuler(x: number, y: number, z: number): number[] {
  const cx = Math.cos(x / 2), sx = Math.sin(x / 2);
  const cy = Math.cos(y / 2), sy = Math.sin(y / 2);
  const cz = Math.cos(z / 2), sz = Math.sin(z / 2);
  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
}

console.log('🏗️  Generating asset pipeline...');
buildBuilding();
buildCharacter();
console.log('\n✓ Asset generation complete!');
console.log('  - building.glb: Office building shell');
console.log('  - character.glb: Character rig with 5 animations (idle, typing, stand, walk, talk)');
