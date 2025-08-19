// src/three/voxels/Car.ts
import * as THREE from 'three';

export type CarVariant = 'red' | 'yellow';

const PALETTE = {
  red: 0xe85c3c,
  yellow: 0xf3c53b,
  roof: 0xf4f6f8,
  wheel: 0x16181b,
};

export function buildCar(variant: CarVariant = 'red'): THREE.Group {
  const g = new THREE.Group();

  // shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 12),
    new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.2 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.22;
  g.add(shadow);

  // body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.4, 0.55),
    new THREE.MeshStandardMaterial({ color: PALETTE[variant] })
  );
  body.castShadow = true;
  g.add(body);

  // roof
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.2, 0.35),
    new THREE.MeshStandardMaterial({ color: PALETTE.roof })
  );
  roof.position.set(0, 0.25, 0);
  g.add(roof);

  // wheels
  const wheelGeo = new THREE.BoxGeometry(0.18, 0.18, 0.1);
  const wheelMat = new THREE.MeshStandardMaterial({ color: PALETTE.wheel });
  const fwL = new THREE.Mesh(wheelGeo, wheelMat); fwL.position.set(-0.28, -0.05, 0.23);
  const fwR = new THREE.Mesh(wheelGeo, wheelMat); fwR.position.set( 0.28, -0.05, 0.23);
  const bwL = new THREE.Mesh(wheelGeo, wheelMat); bwL.position.set(-0.28, -0.05,-0.23);
  const bwR = new THREE.Mesh(wheelGeo, wheelMat); bwR.position.set( 0.28, -0.05,-0.23);
  g.add(fwL, fwR, bwL, bwR);

  return g;
}
