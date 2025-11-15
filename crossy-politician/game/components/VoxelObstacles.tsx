// src/game/components/VoxelObstacles.tsx
import * as THREE from 'three';

/**
 * Build a fire hydrant obstacle
 */
export function buildFireHydrant(): THREE.Group {
  const g = new THREE.Group();

  // Base
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.1, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x555555 })
  );
  base.position.y = 0.05;
  g.add(base);

  // Main body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.35, 8),
    new THREE.MeshStandardMaterial({ color: 0xff0000 })
  );
  body.position.y = 0.275;
  body.castShadow = true;
  g.add(body);

  // Top cap
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.12, 0.08, 8),
    new THREE.MeshStandardMaterial({ color: 0xcc0000 })
  );
  cap.position.y = 0.49;
  g.add(cap);

  // Side nozzles
  const nozzle1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.06, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xcc0000 })
  );
  nozzle1.position.set(0.13, 0.35, 0);
  g.add(nozzle1);

  const nozzle2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.06, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xcc0000 })
  );
  nozzle2.position.set(-0.13, 0.35, 0);
  g.add(nozzle2);

  return g;
}

/**
 * Build a mailbox obstacle
 */
export function buildMailbox(): THREE.Group {
  const g = new THREE.Group();

  // Post
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.5, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x555555 })
  );
  post.position.y = 0.25;
  g.add(post);

  // Box
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.2, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x2b5ba0 })
  );
  box.position.y = 0.6;
  box.castShadow = true;
  g.add(box);

  // Flag
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.04, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xff0000 })
  );
  flag.position.set(0.21, 0.65, 0);
  g.add(flag);

  return g;
}

/**
 * Build a traffic cone obstacle
 */
export function buildTrafficCone(): THREE.Group {
  const g = new THREE.Group();

  // Base
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.05, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  base.position.y = 0.025;
  g.add(base);

  // Cone body
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xff6600 })
  );
  cone.position.y = 0.25;
  cone.castShadow = true;
  g.add(cone);

  // White stripe 1
  const stripe1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.115, 0.08, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  stripe1.position.y = 0.15;
  g.add(stripe1);

  // White stripe 2
  const stripe2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.08, 0.08, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  stripe2.position.y = 0.3;
  g.add(stripe2);

  return g;
}

/**
 * Build a trash can obstacle
 */
export function buildTrashCan(): THREE.Group {
  const g = new THREE.Group();

  // Can body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.45, 8),
    new THREE.MeshStandardMaterial({ color: 0x2d5016 })
  );
  body.position.y = 0.225;
  body.castShadow = true;
  g.add(body);

  // Lid
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.15, 0.08, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a3009 })
  );
  lid.position.y = 0.49;
  g.add(lid);

  // Lid handle
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.06, 0.02, 6, 8, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  handle.position.y = 0.53;
  handle.rotation.x = Math.PI / 2;
  g.add(handle);

  return g;
}

/**
 * Build a street lamp obstacle
 */
export function buildStreetLamp(): THREE.Group {
  const g = new THREE.Group();

  // Post
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  post.position.y = 0.4;
  g.add(post);

  // Lamp head
  const lampHead = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.12, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
  );
  lampHead.position.y = 0.86;
  g.add(lampHead);

  // Light
  const light = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.02, 0.13),
    new THREE.MeshStandardMaterial({
      color: 0xfff9e6,
      emissive: 0xfff9e6,
      emissiveIntensity: 0.3
    })
  );
  light.position.y = 0.79;
  g.add(light);

  return g;
}

/**
 * Build a bench obstacle
 */
export function buildBench(): THREE.Group {
  const g = new THREE.Group();

  // Seat
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.05, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x6b4423 })
  );
  seat.position.y = 0.225;
  seat.castShadow = true;
  g.add(seat);

  // Backrest
  const backrest = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.3, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x6b4423 })
  );
  backrest.position.set(0, 0.375, -0.1);
  g.add(backrest);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.06, 0.2, 0.06);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

  const leg1 = new THREE.Mesh(legGeo, legMat);
  leg1.position.set(-0.25, 0.1, 0.08);
  g.add(leg1);

  const leg2 = new THREE.Mesh(legGeo, legMat);
  leg2.position.set(0.25, 0.1, 0.08);
  g.add(leg2);

  const leg3 = new THREE.Mesh(legGeo, legMat);
  leg3.position.set(-0.25, 0.1, -0.08);
  g.add(leg3);

  const leg4 = new THREE.Mesh(legGeo, legMat);
  leg4.position.set(0.25, 0.1, -0.08);
  g.add(leg4);

  return g;
}

/**
 * Randomly select and build an obstacle
 */
export function buildRandomObstacle(): THREE.Group {
  const obstacles = [
    buildFireHydrant,
    buildMailbox,
    buildTrafficCone,
    buildTrashCan,
    buildStreetLamp,
    buildBench,
  ];

  const randomIndex = Math.floor(Math.random() * obstacles.length);
  return obstacles[randomIndex]();
}
