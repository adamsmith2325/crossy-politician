// src/game/components/VoxelBus.tsx
import * as THREE from 'three';

const PALETTE = {
  body: 0xff6b35,
  window: 0x4a5568,
  wheel: 0x16181b,
  stripe: 0xffd966,
};

export function buildBus(): THREE.Group {
  const g = new THREE.Group();

  // shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.65, 12),
    new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.2 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.22;
  g.add(shadow);

  // body (larger and taller)
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.6, 0.65),
    new THREE.MeshStandardMaterial({ color: PALETTE.body })
  );
  body.position.y = 0.1;
  body.castShadow = true;
  g.add(body);

  // yellow stripe
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(1.62, 0.15, 0.66),
    new THREE.MeshStandardMaterial({ color: PALETTE.stripe })
  );
  stripe.position.set(0, 0.1, 0);
  g.add(stripe);

  // windows
  const windowGeo = new THREE.BoxGeometry(0.3, 0.25, 0.67);
  const windowMat = new THREE.MeshStandardMaterial({ color: PALETTE.window });

  // Front windows
  const frontWindowL = new THREE.Mesh(windowGeo, windowMat);
  frontWindowL.position.set(-0.5, 0.25, 0);
  g.add(frontWindowL);

  const frontWindowR = new THREE.Mesh(windowGeo, windowMat);
  frontWindowR.position.set(-0.15, 0.25, 0);
  g.add(frontWindowR);

  // Back windows
  const backWindowL = new THREE.Mesh(windowGeo, windowMat);
  backWindowL.position.set(0.2, 0.25, 0);
  g.add(backWindowL);

  const backWindowR = new THREE.Mesh(windowGeo, windowMat);
  backWindowR.position.set(0.55, 0.25, 0);
  g.add(backWindowR);

  // wheels (larger)
  const wheelGeo = new THREE.BoxGeometry(0.22, 0.22, 0.12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: PALETTE.wheel });
  const fwL = new THREE.Mesh(wheelGeo, wheelMat); fwL.position.set(-0.55, -0.15, 0.28);
  const fwR = new THREE.Mesh(wheelGeo, wheelMat); fwR.position.set( 0.55, -0.15, 0.28);
  const bwL = new THREE.Mesh(wheelGeo, wheelMat); bwL.position.set(-0.55, -0.15,-0.28);
  const bwR = new THREE.Mesh(wheelGeo, wheelMat); bwR.position.set( 0.55, -0.15,-0.28);
  g.add(fwL, fwR, bwL, bwR);

  return g;
}
