// src/game/VoxelScene.tsx
import React, { useCallback, useEffect, useRef } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';

type CarDef = { x: number; kind: 'red' | 'yellow' | 'truck' };
type LaneDef = { type: 'grass' | 'road'; cars: CarDef[] };

type Props = {
  cols?: number;
  visibleRows?: number;
  lanes?: LaneDef[];
  player?: { x: number; y: number };
  rowOffset?: number;
  onSwipe?: (dx: number, dy: number) => void;
};

function box(w=1, h=1, d=1, color=0x222222) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = false; mesh.receiveShadow = false;
  return mesh;
}

export default function VoxelScene({
  cols = 9,
  visibleRows = 14,
}: Props) {
  const glRef = useRef<any>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const centerRef = useRef(new THREE.Vector3());
  const clockRef = useRef(new THREE.Clock());
  const rafRef = useRef<number | null>(null);
  const carsRef = useRef<THREE.Object3D[]>([]);
  const playerRef = useRef<THREE.Group | null>(null);

  const onContextCreate = useCallback(async (gl: any) => {
    console.log('[GL] onContextCreate');
    glRef.current = gl;

    const renderer = new Renderer({ gl, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x0b1220, 1);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // -------- Board center & camera ----------
    const center = new THREE.Vector3((cols - 1) / 2, 0, (visibleRows - 1) / 2);
    centerRef.current.copy(center);

    const cam = new THREE.PerspectiveCamera(52, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 500);
    // iso-ish: 45° around Y and ~35° tilt down
    const radius = Math.max(cols, visibleRows) * 1.05; // distance scales with board
    const yaw = -Math.PI / 4;  // 45° from the right/back
    const eye = new THREE.Vector3(
      center.x + Math.cos(yaw) * radius,
      center.y + radius * 0.75,
      center.z + Math.sin(yaw) * radius
    );
    cam.position.copy(eye);
    cam.lookAt(center);
    cameraRef.current = cam;

    // -------- Lights ----------
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(-6, 12, 7);
    dir.target.position.copy(center);
    scene.add(dir, dir.target);

    // -------- City ring background (static) ----------
    const bg = new THREE.Group();
    const ringR = Math.max(cols, visibleRows) * 2.3;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    for (let i = 0; i < 24; i++) {
      const w = rnd(2, 4), d = rnd(2, 4), h = rnd(8, 16);
      const b = box(w, h, d, 0x1f2a36);
      const ang = (i / 24) * Math.PI * 2 + rnd(-0.05, 0.05);
      const r = ringR + rnd(-1.2, 1.2);
      b.position.set(center.x + Math.cos(ang) * r, h / 2 - 1, center.z + Math.sin(ang) * r);
      bg.add(b);
    }
    scene.add(bg);

    // -------- Ground + one road stripe (debug) ----------
    const ground = box(cols + 12, 0.2, visibleRows + 10, 0x25462b);
    ground.position.set(center.x, -0.1, center.z);
    scene.add(ground);

    const road = box(cols + 12, 0.05, 2.4, 0x2c3035);
    road.position.set(center.x, 0, center.z + 1.2);
    scene.add(road);

    // -------- Player voxel (logo colors) ----------
    const p = new THREE.Group();
    const body = box(0.7, 1.0, 0.7, 0x0a0a0a); body.position.y = 0.5;
    const head = box(0.75, 0.55, 0.75, 0x996633); head.position.y = 1.1;
    const hair = box(0.9, 0.25, 0.9, 0xffa800);   hair.position.y = 1.35;
    const tie  = box(0.15, 0.5, 0.1, 0xcc2b2b);   tie.position.set(0, 0.5, 0.35);
    p.add(body, head, hair, tie);
    p.position.set(center.x, 0, center.z - visibleRows * 0.25);
    scene.add(p);
    playerRef.current = p;

    // -------- Two demo cars to prove animation --------
    const makeCar = (color: number) => {
      const g = new THREE.Group();
      const base = box(1.2, 0.5, 2.2, color); base.position.y = 0.25;
      const cab  = box(1.2, 0.4, 1.0, 0xbcc1c8); cab.position.set(0, 0.55, -0.5);
      g.add(base, cab);
      return g;
    };
    const carA = makeCar(0xd5433b); // red
    const carB = makeCar(0xf0b534); // yellow
    carA.position.set(center.x - cols * 0.6, 0, center.z + 1.2);
    carB.position.set(center.x + cols * 0.6, 0, center.z - 2.4);
    scene.add(carA, carB);
    carsRef.current = [carA, carB];

    // -------- Animation loop --------
    clockRef.current.start();
    const loop = () => {
      const dt = clockRef.current.getDelta();
      // move demo cars
      const [a, b] = carsRef.current;
      if (a) { a.position.x += 2.4 * dt; if (a.position.x > center.x + cols) a.position.x = center.x - cols; }
      if (b) { b.position.x -= 2.8 * dt; if (b.position.x < center.x - cols) b.position.x = center.x + cols; }

      renderer.render(scene, cam);
      gl.endFrameEXP();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [cols, visibleRows]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rendererRef.current?.dispose?.();
    };
  }, []);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const renderer = rendererRef.current;
    const cam = cameraRef.current;
    const center = centerRef.current;
    if (renderer && cam && width && height) {
      renderer.setSize(width, height, false);
      cam.aspect = width / height;
      cam.updateProjectionMatrix();
      // keep camera aimed at board center after any size change
      cam.lookAt(center);
    }
  }, []);

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
    </View>
  );
}
