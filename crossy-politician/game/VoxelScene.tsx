import React, { useCallback, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { buildGrassTile, buildRoadTile } from './components/VoxelTile';
import { buildCar, CarVariant } from './components/VoxelCar';
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
  rows
}: {
  lanes: Lane[];
  player: { x: number; y: number };
  onSwipe: MoveFn;
  cols: number;
  rows: number;
}) {
  const swipe = useMemo(
    () =>
      Gesture.Pan().onEnd((e) => {
        const dx = e.translationX, dy = e.translationY;
        if (Math.abs(dx) > Math.abs(dy)) runOnJS(onSwipe)(dx > 0 ? 1 : -1, 0);
        else runOnJS(onSwipe)(0, dy < 0 ? 1 : -1);
      }),
    [onSwipe]
  );

  const animateRef = useRef<number | null>(null);

  const onContextCreate = useCallback(async (gl: any) => {
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);
    renderer.setClearColor(0x0b1220);

    const scene = new THREE.Scene();

    // Camera (isometric-ish)
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
    camera.position.set(cols * 0.7, rows * 0.9, cols * 1.2);
    camera.lookAt(cols * 0.5, 0, rows * 0.5);

    // Lights
    const amb = new THREE.AmbientLight(0xffffff, 0.6);
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(10, 12, 6);
    dir.castShadow = true;
    scene.add(amb, dir);

    // Ground
    for (let r = 0; r < rows; r++) {
      const tile = (lanes[r]?.type === 'road') ? buildRoadTile(cols) : buildGrassTile(cols);
      tile.position.set(cols / 2, -0.01, r + 0.5);
      scene.add(tile);

      // trees on grass
      if (lanes[r]?.type === 'grass') {
        for (let t = 0; t < 2; t++) {
          const x = ((r * 17 + t * 41) % (cols - 1)) + 0.2;
          const tree = buildTree();
          tree.position.set(x + 0.5, 0.45, r + 0.5);
          scene.add(tree);
        }
      }

      // cars on roads
      if (lanes[r]?.type === 'road') {
        lanes[r].cars.forEach((c, i) => {
          const mesh =
            c.kind === 'truck' ? buildTruck() : buildCar(c.kind as CarVariant);
          mesh.position.set(c.x + 0.5, c.kind === 'truck' ? 0.25 : 0.22, r + 0.5);
          mesh.userData = { laneIndex: r, carIndex: i };
          scene.add(mesh);
        });
      }
    }

    // Player
    const playerMesh = buildPlayer();
    playerMesh.position.set(player.x + 0.5, 0.5, player.y + 0.5);
    scene.add(playerMesh);

    // Animation loop
    const clock = new THREE.Clock();
    const tick = () => {
      const _dt = Math.min(clock.getDelta(), 0.05);

      // Update cars positions from `lanes` (if you update lanes in RN state,
      // you can reflect that here via refs or events)

      // Keep player mesh in sync (simple polling; or wire to a ref callback)
      playerMesh.position.set(player.x + 0.5, 0.5, player.y + 0.5);

      renderer.render(scene, camera);
      gl.endFrameEXP();
      animateRef.current = requestAnimationFrame(tick);
    };
    tick();

    // cleanup
    return () => {
      if (animateRef.current) cancelAnimationFrame(animateRef.current);
      renderer.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose?.();
        if ((obj as THREE.Mesh).material) {
          const m = (obj as THREE.Mesh).material as THREE.Material;
          m.dispose?.();
        }
      });
    };
  }, [lanes, player.x, player.y, cols, rows]);

  return (
    <GestureDetector gesture={swipe}>
      <View style={{ flex: 1, backgroundColor: '#0b1220' }}>
        <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
      </View>
    </GestureDetector>
  );
}
