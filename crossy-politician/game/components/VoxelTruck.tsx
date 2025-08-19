// src/three/voxels/Truck.ts
import * as THREE from 'three';

export function buildTruck(): THREE.Group {
  const g = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 12),
    new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.25;
  g.add(shadow);

  const trailer = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.5, 0.6),
    new THREE.MeshStandardMaterial({ color: 0xe0e6ee })
  );
  trailer.castShadow = true;
  trailer.position.x = -0.18;
  g.add(trailer);

  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.45, 0.6),
    new THREE.MeshStandardMaterial({ color: 0xde3d3d })
  );
  cab.castShadow = true;
  cab.position.x = 0.55;
  g.add(cab);

  return g;
}
