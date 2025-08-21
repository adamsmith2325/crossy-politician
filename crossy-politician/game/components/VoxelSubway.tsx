// src/game/components/VoxelSubway.tsx
import * as THREE from 'three';

export function buildSubway(): THREE.Group {
  const g = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 1),
    new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.2 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.25;
  g.add(shadow);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.8, 0.9),
    new THREE.MeshStandardMaterial({ color: 0xcccccc })
  );
  body.castShadow = true;
  g.add(body);

  const windowMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  for (let i = 0; i < 4; i++) {
    const window = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.4, 0.05),
      windowMat
    );
    window.position.set(-1.5 + i * 1, 0.2, 0.45);
    g.add(window);
  }

  return g;
}
