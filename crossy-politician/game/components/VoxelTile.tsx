// src/three/voxels/Tile.ts
import * as THREE from 'three';

export function buildGrassTile(width = 9): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.02, 1),
    new THREE.MeshStandardMaterial({ color: 0x86d46c })
  );
  base.receiveShadow = true;
  g.add(base);

  const band = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.01, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x73c156 })
  );
  band.position.y = 0.001;
  g.add(band);

  return g;
}

export function buildRoadTile(width = 9): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.02, 1),
    new THREE.MeshStandardMaterial({ color: 0x3c424c })
  );
  base.receiveShadow = true;
  g.add(base);

  const dashMat = new THREE.MeshStandardMaterial({ color: 0xcdd6e3 });
  for (let i = 0; i < Math.floor(width / 1.2); i++) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.01, 0.05), dashMat);
    dash.position.set(-width / 2 + 0.6 + i * 1.2, 0.001, 0);
    g.add(dash);
  }
  return g;
}
