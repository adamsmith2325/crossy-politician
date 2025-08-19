// src/three/VoxelScene.tsx
import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { View } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { buildGrassTile, buildRoadTile } from './components/VoxelTile';
import { buildCar } from './components/VoxelCar';
import { buildTruck } from './components/VoxelTruck';
import { buildTree } from './components/VoxelTree';
import { buildPlayer } from './components/VoxelPlayer';

export type MoveFn = (dx: number, dy: number) => void;

type Lane = {
  type: 'grass' | 'road';
  cars: { x: number; kind: 'red' | 'yellow' | 'truck' }[];
};

export default function VoxelScene({
  lanes,
  player,
  onSwipe,
  cols,
  visibleRows,
  rowOffset
}: {
  lanes: Lane[];                      // length === visibleRows
  player: { x: number; y: number };   // y is 0..visibleRows-1
  onSwipe: MoveFn;
  cols: number;
  visibleRows: number;
  rowOffset: number;                  // absolute index of lanes[0] (for camera)
}) {
  const swipe = useMemo(
    () =>
      Gesture.Pan().onEnd((e) => {
        const dx = e.translationX;
        const dy = e.translationY;
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dx) > Math.abs(dy)) runOnJS(onSwipe)(dx > 0 ? 1 : -1, 0);
        else runOnJS(onSwipe)(0, dy < 0 ? 1 : -1);
      }),
    [onSwipe]
  );

  // ---- refs that hold the latest props for the render loop
  const lanesRef = useRef(lanes);
  const playerRef = useRef(player);
  const colsRef = useRef(cols);
  const visibleRowsRef = useRef(visibleRows);
  const rowOffsetRef = useRef(rowOffset);
  useEffect(() => { lanesRef.current = lanes; }, [lanes]);
  useEffect(() => { playerRef.current = player; }, [player]);
  useEffect(() => { colsRef.current = cols; }, [cols]);
  useEffect(() => { visibleRowsRef.current = visibleRows; }, [visibleRows]);
  useEffect(() => { rowOffsetRef.current = rowOffset; }, [rowOffset]);

  const animateRef = useRef<number | null>(null);

  const onContextCreate = useCallback(async (gl: any) => {
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);
    renderer.setClearColor(0x0b1220);

    const scene = new THREE.Scene();

    // Camera & lighting
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 2000);
    const amb = new THREE.AmbientLight(0xffffff, 0.7);
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(10, 12, 6); dir.castShadow = true;
    scene.add(amb, dir);

    // Prebuild lane containers so we recycle meshes per row
    const laneGroups: THREE.Group[] = [];
    for (let r = 0; r < visibleRowsRef.current; r++) {
      const g = new THREE.Group();
      g.position.set(colsRef.current / 2, 0, r + 0.5);
      scene.add(g);
      laneGroups.push(g);
    }

    // Player
    const playerMesh = buildPlayer();
    playerMesh.position.set(playerRef.current.x + 0.5, 0.5, playerRef.current.y + 0.5);
    scene.add(playerMesh);

    // util: reconcile the contents of one lane group with the lane state
    function patchLaneVisual(rowIndex: number, lane: Lane) {
      const g = laneGroups[rowIndex];

      // [0] slot: ground tile
      // [1..n] slots: obstacles/trees/cars
      if (g.children.length === 0) {
        g.add(new THREE.Group()); // placeholder for ground (we’ll replace below)
      }

      // Replace ground if type changed
      const ground = g.children[0] as THREE.Group;
      const wantRoad = lane.type === 'road';
      const isRoad = (ground as any).__isRoad === true;

      if (wantRoad !== isRoad) {
        if (ground) g.remove(ground);
        const newGround = wantRoad ? buildRoadTile(colsRef.current) : buildGrassTile(colsRef.current);
        (newGround as any).__isRoad = wantRoad;
        g.add(newGround);
      }

      // Clear non-ground children; rebuild quickly (simple and fast enough)
      for (let i = g.children.length - 1; i >= 1; i--) g.remove(g.children[i]);

      if (lane.type === 'grass') {
        // sprinkle a couple trees deterministically so it doesn't flicker
        for (let t = 0; t < 2; t++) {
          const gx = ((rowOffsetRef.current + rowIndex) * 17 + t * 41) % (colsRef.current - 1);
          const tree = buildTree();
          tree.position.set(gx + 0.7, 0.45, 0);
          g.add(tree);
        }
      } else {
        // add cars
        lane.cars.forEach((c, i) => {
          const m = i % 6 === 0 ? buildTruck() : buildCar(i % 2 ? 'red' : 'yellow');
          m.position.set(c.x + 0.5, i % 6 === 0 ? 0.25 : 0.22, 0);
          (m as any).__carIndex = i;
          g.add(m);
        });
      }
    }

    // Initial build
    for (let r = 0; r < visibleRowsRef.current; r++) {
      patchLaneVisual(r, lanesRef.current[r]);
    }

    // Animation loop
    const clock = new THREE.Clock();
    const tick = () => {
      clock.getDelta(); // we don’t need dt here; Game.tsx moved cars already

      // Reconcile + update positions every frame (cheap at this size)
      for (let r = 0; r < visibleRowsRef.current; r++) {
        const lane = lanesRef.current[r];
        patchLaneVisual(r, lane);

        // Update car X positions without rebuilding geometries each frame
        const g = laneGroups[r];
        if (lane.type === 'road') {
          // children[0] = ground, cars start at index 1
          lane.cars.forEach((car, i) => {
            const slot = g.children[i + 1];
            if (slot) slot.position.x = car.x + 0.5;
          });
        }
      }

      // Follow player
      const p = playerRef.current;
      playerMesh.position.set(p.x + 0.5, 0.5, p.y + 0.5);
      const targetZ = p.y + 3.0;
      camera.position.set(colsRef.current * 0.7, visibleRowsRef.current * 0.9, colsRef.current * 1.2);
      camera.lookAt(colsRef.current * 0.5, 0, targetZ);

      renderer.render(scene, camera);
      gl.endFrameEXP();
      animateRef.current = requestAnimationFrame(tick);
    };
    tick();

    // Cleanup
    return () => {
      if (animateRef.current) cancelAnimationFrame(animateRef.current);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        (mesh.geometry as any)?.dispose?.();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => (m as any)?.dispose?.());
        else (mat as any)?.dispose?.();
      });
      renderer.dispose();
    };
  }, []);

  return (
    <GestureDetector gesture={swipe}>
      <View style={{ flex: 1, backgroundColor: '#0b1220' }}>
        <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
      </View>
    </GestureDetector>
  );
}
