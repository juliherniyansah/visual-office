import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { findFirstByPrefix, findNodesByPrefix, hideByPrefix, nodeWorldPosition } from './nodes';

function buildTree(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'root';

  const colA = new THREE.Group();
  colA.name = 'COL_a';

  const navB = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  navB.name = 'NAV_b';

  const taskC = new THREE.Object3D();
  taskC.name = 'TASK_c';

  const nested = new THREE.Group();
  nested.name = 'nested';
  nested.add(taskC);

  root.add(colA, navB, nested);
  return root;
}

describe('findNodesByPrefix', () => {
  test('returns all descendants whose name starts with prefix in stable order', () => {
    const root = buildTree();

    expect(findNodesByPrefix(root, 'COL_').map((n) => n.name)).toEqual(['COL_a']);
    expect(findNodesByPrefix(root, 'NAV_').map((n) => n.name)).toEqual(['NAV_b']);
    expect(findNodesByPrefix(root, 'TASK_').map((n) => n.name)).toEqual(['TASK_c']);
  });

  test('returns empty array when no names match', () => {
    const root = buildTree();
    expect(findNodesByPrefix(root, 'ROOM_')).toEqual([]);
  });
});

describe('findFirstByPrefix', () => {
  test('returns first match or undefined', () => {
    const root = buildTree();

    expect(findFirstByPrefix(root, 'COL_')?.name).toBe('COL_a');
    expect(findFirstByPrefix(root, 'NAV_')?.name).toBe('NAV_b');
    expect(findFirstByPrefix(root, 'TASK_')?.name).toBe('TASK_c');
    expect(findFirstByPrefix(root, 'ROOM_')).toBeUndefined();
  });
});

describe('hideByPrefix', () => {
  test('sets visible=false and returns hidden count', () => {
    const root = buildTree();

    const hidden = hideByPrefix(root, 'COL_');
    expect(hidden).toBe(1);
    expect(findFirstByPrefix(root, 'COL_')?.visible).toBe(false);

    expect(hideByPrefix(root, 'ROOM_')).toBe(0);
  });
});

describe('nodeWorldPosition', () => {
  test('equals parent-world transform applied to local position', () => {
    const parent = new THREE.Group();
    parent.position.set(2, 0, 0);
    parent.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    parent.updateMatrixWorld();

    const child = new THREE.Object3D();
    child.position.set(0, 1, 0);
    parent.add(child);

    const expected = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(parent.quaternion)
      .add(parent.position);

    expect(nodeWorldPosition(child)).toEqual(expected);
  });
});
