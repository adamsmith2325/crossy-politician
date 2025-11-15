// src/game/components/VoxelAmbulance.tsx
import * as THREE from 'three';

const PALETTE = {
  body: 0xffffff,
  roof: 0xf4f6f8,
  wheel: 0x16181b,
  cross: 0xff0000,
  lights: 0xff0000,
};

export function buildAmbulance(): THREE.Group {
  const g = new THREE.Group();

  // shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 12),
    new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.2 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.22;
  g.add(shadow);

  // body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.5, 0.6),
    new THREE.MeshStandardMaterial({ color: PALETTE.body })
  );
  body.castShadow = true;
  g.add(body);

  // red cross (vertical)
  const crossV = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.25, 0.62),
    new THREE.MeshStandardMaterial({ color: PALETTE.cross })
  );
  crossV.position.set(0, 0, 0);
  g.add(crossV);

  // red cross (horizontal)
  const crossH = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.08, 0.62),
    new THREE.MeshStandardMaterial({ color: PALETTE.cross })
  );
  crossH.position.set(0, 0, 0);
  g.add(crossH);

  // roof/box
  const roofBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.25, 0.4),
    new THREE.MeshStandardMaterial({ color: PALETTE.roof })
  );
  roofBox.position.set(-0.1, 0.3, 0);
  g.add(roofBox);

  // emergency lights
  const lightBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.08, 0.15),
    new THREE.MeshStandardMaterial({
      color: PALETTE.lights,
      emissive: PALETTE.lights,
      emissiveIntensity: 0.5
    })
  );
  lightBar.position.set(-0.1, 0.45, 0);
  g.add(lightBar);

  // wheels
  const wheelGeo = new THREE.BoxGeometry(0.2, 0.2, 0.12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: PALETTE.wheel });
  const fwL = new THREE.Mesh(wheelGeo, wheelMat); fwL.position.set(-0.35, -0.08, 0.26);
  const fwR = new THREE.Mesh(wheelGeo, wheelMat); fwR.position.set( 0.35, -0.08, 0.26);
  const bwL = new THREE.Mesh(wheelGeo, wheelMat); bwL.position.set(-0.35, -0.08,-0.26);
  const bwR = new THREE.Mesh(wheelGeo, wheelMat); bwR.position.set( 0.35, -0.08,-0.26);
  g.add(fwL, fwR, bwL, bwR);

  return g;
}
