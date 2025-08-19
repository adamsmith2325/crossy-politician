// src/three/voxels/Player.ts
import * as THREE from 'three';

export function buildPlayer(): THREE.Group {
  const g = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 12),
    new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.2 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.48;
  g.add(shadow);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.6, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xf8c34a })
  );
  body.castShadow = true;
  g.add(body);

  const face = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.22, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  face.position.set(0, 0.12, 0.26);
  g.add(face);

  return g;
}
