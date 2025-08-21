// src/game/VoxelScene.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { PanResponder, View } from 'react-native';
import { GLView } from 'expo-gl';
import * as THREE from 'three';

// ─── Types coming from Game.tsx ──────────────────────────────────────────────
type CarKind = 'red' | 'yellow' | 'truck';
type LaneDTO = {
  type: 'grass' | 'road';
  cars: { x: number; kind: CarKind }[];
};

type Props = {
  cols: number;
  visibleRows: number;
  lanes: LaneDTO[];
  player: { x: number; y: number };
  rowOffset: number;
  onSwipe: (dx: number, dy: number) => void;
};

// ─── Colors & materials ──────────────────────────────────────────────────────
const SKY = new THREE.Color('#0b1220');         // page bg
const GREEN = new THREE.Color('#1e5d2b');
const ASPHALT = new THREE.Color('#2b2f34');
const ROAD_MARK = new THREE.Color('#3a3f45');

const CAR_COLOR: Record<CarKind, THREE.Color> = {
  red: new THREE.Color('#c24b3a'),
  yellow: new THREE.Color('#d0ad2f'),
  truck: new THREE.Color('#bfc4ca'),
};

const PLAYER_COLORS = {
  suit: new THREE.Color('#111317'),
  shirt: new THREE.Color('#e9e9e9'),
  tie: new THREE.Color('#d0433b'),
  hair: new THREE.Color('#e39d1a'),
  face: new THREE.Color('#c8a57e'),
};

// ─── Small helpers ───────────────────────────────────────────────────────────
const TILE = 1; // world units per tile

function makeBox(w: number, h: number, d: number, color: THREE.Color | string) {
  const geom = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color: color instanceof THREE.Color ? color : new THREE.Color(color),
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function clearGroup(group: THREE.Group) {
  for (let i = group.children.length - 1; i >= 0; i--) {
    const obj = group.children[i] as THREE.Mesh;
    if (obj.geometry) obj.geometry.dispose();
    // @ts-ignore
    if (obj.material?.dispose) obj.material.dispose();
    group.remove(obj);
  }
}

// Ease camera a bit for smooth follow
function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function VoxelScene({
  cols,
  visibleRows,
  lanes,
  player,
  rowOffset,
  onSwipe,
}: Props) {
  // three refs
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // world roots
  const boardRoot = useRef(new THREE.Group());
  const carsRoot = useRef(new THREE.Group());
  const bgRoot = useRef(new THREE.Group());
  const playerRoot = useRef(new THREE.Group());

  // cache previous frame data (to avoid rebuilding everything)
  const prevJSON = useRef<string>('');

  // ── Swipe handler (up is forward) ──────────────────────────────────────────
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 16 || Math.abs(g.dy) > 16,
        onPanResponderRelease: (_, g) => {
          const { dx, dy } = g;
          if (Math.abs(dx) > Math.abs(dy)) {
            // left / right
            if (dx > 16) onSwipe(1, 0);
            else if (dx < -16) onSwipe(-1, 0);
          } else {
            // up (forward) / down (back)
            if (dy < -16) onSwipe(0, -1);
            else if (dy > 16) onSwipe(0, 1);
          }
        },
      }),
    [onSwipe]
  );

  // ── Build static city backdrop (once) ──────────────────────────────────────
  function buildCityBackdrop(parent: THREE.Group) {
    clearGroup(parent);
    const cols = [
      '#223140',
      '#1c2a39',
      '#1f3140',
      '#203346',
      '#273a4e',
      '#203243',
      '#293c51',
    ];
    const rnd = THREE.MathUtils.seededRandom;
    for (let i = 0; i < 22; i++) {
      const w = 0.8 + rnd() * 1.4;
      const d = 0.8 + rnd() * 1.4;
      const h = 4 + rnd() * 11;
      const box = makeBox(w, h, d, new THREE.Color(cols[i % cols.length]));
      // ring of buildings around play area
      const rad = 10 + rnd() * 5;
      const ang = (i / 22) * Math.PI * 2;
      box.position.set(Math.cos(ang) * rad, h / 2 - 1.2, Math.sin(ang) * rad);
      parent.add(box);
    }
  }

  // ── Player voxel (once) ────────────────────────────────────────────────────
  function buildPlayer(parent: THREE.Group) {
    clearGroup(parent);

    // body
    const body = makeBox(0.48, 0.6, 0.3, PLAYER_COLORS.suit);
    body.position.set(0, 0.3, 0);
    parent.add(body);

    // head
    const head = makeBox(0.36, 0.34, 0.3, PLAYER_COLORS.face);
    head.position.set(0, 0.6 + 0.17, 0);
    parent.add(head);

    // hair (side sweep)
    const hair = makeBox(0.42, 0.18, 0.34, PLAYER_COLORS.hair);
    hair.position.set(0.02, 0.6 + 0.34, 0);
    parent.add(hair);

    // shirt collar
    const collar = makeBox(0.34, 0.08, 0.26, PLAYER_COLORS.shirt);
    collar.position.set(0, 0.6 + 0.04, 0);
    parent.add(collar);

    // tie
    const tie = makeBox(0.08, 0.22, 0.06, PLAYER_COLORS.tie);
    tie.position.set(0, 0.6 - 0.1, 0.12);
    parent.add(tie);

    parent.position.set(0, 0, 0);
  }

  // ── Board sync (tiles + roads) ─────────────────────────────────────────────
  function syncBoard(parent: THREE.Group, lanesData: LaneDTO[]) {
    // regenerate if the layout changed
    const sig = JSON.stringify(lanesData.map(l => l.type));
    if ((parent as any)._sig === sig) return;

    clearGroup(parent);
    (parent as any)._sig = sig;

    for (let r = 0; r < lanesData.length; r++) {
      const lane = lanesData[r];
      // lane ground
      const ground = makeBox(cols * TILE, 0.12, TILE, lane.type === 'road' ? ASPHALT : GREEN);
      ground.position.set((cols * TILE) / 2 - 0.5, -0.06, r * TILE);
      ground.receiveShadow = true;
      parent.add(ground);

      if (lane.type === 'road') {
        // faint dashed center marks
        const marks = new THREE.Group();
        for (let i = 0; i < cols; i++) {
          const m = makeBox(0.25, 0.02, 0.06, ROAD_MARK);
          m.position.set(i + 0.5, 0.02, r * TILE);
          marks.add(m);
        }
        parent.add(marks);
      }
    }
  }

  // ── Cars sync (per frame) ──────────────────────────────────────────────────
  function syncCars(parent: THREE.Group, lanesData: LaneDTO[]) {
    // lazy pool: one group per lane
    if (parent.children.length !== lanesData.length) {
      clearGroup(parent);
      for (let r = 0; r < lanesData.length; r++) {
        const g = new THREE.Group();
        parent.add(g);
      }
    }

    for (let r = 0; r < lanesData.length; r++) {
      const lane = lanesData[r];
      const laneGroup = parent.children[r] as THREE.Group;

      // ensure car count matches
      while (laneGroup.children.length < lane.cars.length) laneGroup.add(new THREE.Group());
      while (laneGroup.children.length > lane.cars.length) {
        const last = laneGroup.children[laneGroup.children.length - 1] as THREE.Group;
        clearGroup(last);
        laneGroup.remove(last);
      }

      for (let i = 0; i < lane.cars.length; i++) {
        const carDesc = lane.cars[i];
        let car = laneGroup.children[i] as THREE.Group;
        if (car.children.length === 0) {
          // construct mesh once
          if (carDesc.kind === 'truck') {
            const cab = makeBox(0.6, 0.32, 0.32, '#b24b41');
            cab.position.set(-0.2, 0.16, 0);
            const bed = makeBox(0.9, 0.30, 0.32, CAR_COLOR.truck);
            bed.position.set(0.25, 0.15, 0);
            car.add(cab, bed);
          } else {
            const body = makeBox(0.65, 0.28, 0.34, CAR_COLOR[carDesc.kind]);
            body.position.set(0, 0.15, 0);
            const roof = makeBox(0.4, 0.1, 0.24, '#dcdcdc');
            roof.position.set(0, 0.26, 0);
            car.add(body, roof);
          }
        }
        car.position.set(carDesc.x, 0, r * TILE);
      }
    }
  }

  // ── Camera follow ──────────────────────────────────────────────────────────
  function updateCamera(cam: THREE.PerspectiveCamera, target: THREE.Vector3, dt = 1 / 60) {
    // isometric 3/4 view from bottom‑left, looking “forward”
    const desired = new THREE.Vector3(
      target.x - 3.8,
      target.y + 5.2,
      target.z - 4.2
    );
    cam.position.set(
      damp(cam.position.x, desired.x, 6, dt),
      damp(cam.position.y, desired.y, 6, dt),
      damp(cam.position.z, desired.z, 6, dt)
    );
    const lookAt = new THREE.Vector3(target.x, target.y + 0.6, target.z + 2.0);
    cam.lookAt(lookAt);
  }

  // ── GL bootstrap ───────────────────────────────────────────────────────────
  const onContextCreate = async (gl: any) => {
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

    const renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas,
      context: gl,
      antialias: true,
      alpha: true,
    } as any);
    renderer.setPixelRatio(THREE.MathUtils.clamp(globalThis.devicePixelRatio ?? 1, 1, 2));
    renderer.setSize(width, height, false);
    renderer.setClearColor(SKY, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 300);
    cameraRef.current = camera;

    // GL‑safe one‑time fit (fix for 0×0 canvas on native)
    const fit = () => {
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    fit();

    // lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.55);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(-6, 10, -6);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 40;
    scene.add(dir);

    // world roots
    boardRoot.current.position.set(0, 0, 0);
    carsRoot.current.position.set(0, 0, 0);
    playerRoot.current.position.set(0, 0, 0);
    bgRoot.current.position.set(0, -1.2, 0);

    scene.add(boardRoot.current);
    scene.add(carsRoot.current);
    scene.add(playerRoot.current);
    scene.add(bgRoot.current);

    buildCityBackdrop(bgRoot.current);
    buildPlayer(playerRoot.current);

    // initial camera placement
    updateCamera(camera, new THREE.Vector3(0, 0, 0), 1 / 30);

    // render loop
    let last = Date.now();
    const loop = () => {
      const now = Date.now();
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;

      // sync board/cars only if props changed (via prevJSON)
      const signature = JSON.stringify({
        l: lanes.map(l => ({ t: l.type, n: l.cars.length })),
        p: player,
        r: rowOffset,
      });
      if (prevJSON.current !== signature) {
        prevJSON.current = signature;
        syncBoard(boardRoot.current, lanes);
        syncCars(carsRoot.current, lanes);
      }

      // update player transform
      playerRoot.current.position.set(player.x, 0, player.y);

      // gentle backdrop parallax: opposite of target
      bgRoot.current.position.x = -player.x * 0.12;
      bgRoot.current.position.z = -player.y * 0.08;

      // follow player
      const camTarget = new THREE.Vector3(player.x, 0, player.y);
      updateCamera(camera, camTarget, dt);

      renderer.render(scene, camera);
      gl.endFrameEXP();
      requestAnimationFrame(loop);
    };
    loop();
  };

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      const r = rendererRef.current;
      const s = sceneRef.current;
      if (s) {
        s.traverse(obj => {
          const m = obj as THREE.Mesh;
          // @ts-ignore
          if (m.material?.dispose) m.material.dispose?.();
          m.geometry?.dispose?.();
        });
      }
      r?.dispose?.();
    };
  }, []);

  // ── Render GLView + full‑screen gesture layer ──────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
      <View style={{ position: 'absolute', inset: 0 }} {...pan.panHandlers} />
    </View>
  );
}
