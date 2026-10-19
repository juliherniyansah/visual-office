import * as THREE from 'three';

export function findNodesByPrefix(root: THREE.Object3D, prefix: string): THREE.Object3D[] {
  const matches: THREE.Object3D[] = [];
  root.traverse((node) => {
    if (node.name.startsWith(prefix)) {
      matches.push(node);
    }
  });
  return matches;
}

export function findFirstByPrefix(root: THREE.Object3D, prefix: string): THREE.Object3D | undefined {
  if (root.name.startsWith(prefix)) {
    return root;
  }
  for (const child of root.children) {
    const found = findFirstByPrefix(child, prefix);
    if (found) {
      return found;
    }
  }
  return undefined;
}

export function hideByPrefix(root: THREE.Object3D, prefix: string): number {
  const nodes = findNodesByPrefix(root, prefix);
  nodes.forEach((node) => {
    node.visible = false;
  });
  return nodes.length;
}

export function nodeWorldPosition(node: THREE.Object3D): THREE.Vector3 {
  node.updateWorldMatrix(true, false);
  return new THREE.Vector3().setFromMatrixPosition(node.matrixWorld);
}
