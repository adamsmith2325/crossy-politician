// src/game/components/VoxelPoliceCar.tsx
import * as THREE from 'three';

const PALETTE = {
  body: 0x2c5aa0,
  roof: 0xf4f6f8,
  wheel: 0x16181b,
  stripe: 0xffffff,
  lights: 0xff0000,
};

export function buildPoliceCar(): THREE.Group {
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

  // white stripe
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.12, 0.56),
    new THREE.MeshStandardMaterial({ color: PALETTE.stripe })
  );
  stripe.position.set(0, 0, 0);
  g.add(stripe);

  // roof
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.2, 0.35),
    new THREE.MeshStandardMaterial({ color: PALETTE.roof })
  );
  roof.position.set(0, 0.25, 0);
  g.add(roof);

  // police lights
  const lightBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.08, 0.15),
    new THREE.MeshStandardMaterial({
      color: PALETTE.lights,
      emissive: PALETTE.lights,
      emissiveIntensity: 0.5
    })
  );
  lightBar.position.set(0, 0.38, 0);
  g.add(lightBar);

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
