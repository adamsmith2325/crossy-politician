// src/three/voxels/Tree.ts
import * as THREE from 'three';

export function buildTree(): THREE.Group {
  const g = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.35, 12),
    new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.2 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.45;
  g.add(shadow);

  const trunk = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.25, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x7b4f28 })
  );
  trunk.position.y = -0.1;
  g.add(trunk);

  const leaf1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x6dba4a })
  );
  leaf1.position.y = 0.2;
  const leaf2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.34, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x579e3a })
  );
  leaf2.position.y = 0.45;
  g.add(leaf1, leaf2);

  return g;
}
