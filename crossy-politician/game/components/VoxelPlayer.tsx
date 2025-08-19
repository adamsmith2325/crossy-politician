// src/three/voxels/Player.ts
import * as THREE from 'three';

/**
 * Voxel politician styled like the logo:
 * - Dark suit (near-black)
 * - Red tie
 * - Peach skin
 * - Yellow–orange swoop hair
 */
export function buildPlayer(): THREE.Group {
  const g = new THREE.Group();

  // ---- Palette (tweak if you want closer matches)
  const SUIT = 0x101317;        // dark suit
  const TIE = 0xE53935;         // red tie
  const SKIN = 0xFFD7A1;        // skin tone
  const HAIR = 0xF4A321;        // yellow-orange hair
  const SHOE = 0x0A0A0A;

  // Soft shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.36, 20),
    new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.5;
  g.add(shadow);

  // Torso (suit jacket)
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.58, 0.32),
    new THREE.MeshStandardMaterial({ color: SUIT })
  );
  torso.position.y = 0.18;
  torso.castShadow = true;
  g.add(torso);

  // Shirt triangle (white collar) – simplified as a thin wedge on front
  const collar = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.18, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xF4EBDC })
  );
  collar.position.set(0, 0.35, 0.17);
  g.add(collar);

  // Tie (thin vertical prism)
  const tie = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.34, 0.05),
    new THREE.MeshStandardMaterial({ color: TIE })
  );
  tie.position.set(0, 0.18, 0.18);
  tie.castShadow = true;
  g.add(tie);

  // Head
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.32, 0.28),
    new THREE.MeshStandardMaterial({ color: SKIN })
  );
  head.position.y = 0.62;
  head.castShadow = true;
  g.add(head);

  // Hair “swoop” – base cap + front wave + sideburn to mimic logo silhouette
  const hairCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.10, 0.30),
    new THREE.MeshStandardMaterial({ color: HAIR })
  );
  hairCap.position.set(0, 0.80, 0);
  hairCap.castShadow = true;

  const hairWave = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.12, 0.12),
    new THREE.MeshStandardMaterial({ color: HAIR })
  );
  hairWave.position.set(0.08, 0.78, 0.16);
  hairWave.rotation.y = -0.15; // subtle sweep

  const sideburn = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.16, 0.10),
    new THREE.MeshStandardMaterial({ color: HAIR })
  );
  sideburn.position.set(-0.18, 0.66, 0.01);

  g.add(hairCap, hairWave, sideburn);

  // Arms (suit sleeves)
  const armGeo = new THREE.BoxGeometry(0.12, 0.36, 0.12);
  const armMat = new THREE.MeshStandardMaterial({ color: SUIT });
  const lArm = new THREE.Mesh(armGeo, armMat);
  const rArm = new THREE.Mesh(armGeo, armMat);
  lArm.position.set(-0.36, 0.08, 0);
  rArm.position.set( 0.36, 0.08, 0);
  lArm.castShadow = rArm.castShadow = true;
  g.add(lArm, rArm);

  // Legs (suit pants)
  const legGeo = new THREE.BoxGeometry(0.16, 0.36, 0.16);
  const legMat = new THREE.MeshStandardMaterial({ color: SUIT });
  const lLeg = new THREE.Mesh(legGeo, legMat);
  const rLeg = new THREE.Mesh(legGeo, legMat);
  lLeg.position.set(-0.14, -0.28, 0.02);
  rLeg.position.set( 0.14, -0.28, 0.02);
  lLeg.castShadow = rLeg.castShadow = true;
  g.add(lLeg, rLeg);

  // Shoes
  const shoeGeo = new THREE.BoxGeometry(0.18, 0.08, 0.20);
  const shoeMat = new THREE.MeshStandardMaterial({ color: SHOE });
  const lShoe = new THREE.Mesh(shoeGeo, shoeMat);
  const rShoe = new THREE.Mesh(shoeGeo, shoeMat);
  lShoe.position.set(-0.14, -0.50, 0.06);
  rShoe.position.set( 0.14, -0.50, 0.06);
  g.add(lShoe, rShoe);

  // Slight forward offset so feet don’t clip the ground when moving
  g.position.y = 0.5;

  return g;
}
