// src/game/components/VoxelTaxi.tsx
import * as THREE from 'three';

const PALETTE = {
  body: 0xf3c53b,
  roof: 0x16181b,
  wheel: 0x16181b,
  sign: 0xffffff,
  checker: 0x16181b,
};

export function buildTaxi(): THREE.Group {
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
    new THREE.MeshStandardMaterial({ color: PALETTE.body })
  );
  body.castShadow = true;
  g.add(body);

  // checkered stripe pattern
  const checkerWidth = 0.12;
  for (let i = 0; i < 4; i++) {
    const checker = new THREE.Mesh(
      new THREE.BoxGeometry(checkerWidth, 0.08, 0.56),
      new THREE.MeshStandardMaterial({ color: PALETTE.checker })
    );
    checker.position.set(-0.35 + i * checkerWidth * 2, -0.05, 0);
    g.add(checker);
  }

  // roof
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.2, 0.35),
    new THREE.MeshStandardMaterial({ color: PALETTE.roof })
  );
  roof.position.set(0, 0.25, 0);
  g.add(roof);

  // taxi sign
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.08, 0.12),
    new THREE.MeshStandardMaterial({
      color: PALETTE.sign,
      emissive: PALETTE.sign,
      emissiveIntensity: 0.3
    })
  );
  sign.position.set(0, 0.38, 0);
  g.add(sign);

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
