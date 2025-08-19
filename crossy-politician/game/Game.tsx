// src/three/Game3D.tsx
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Canvas } from '@react-three/fiber/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import VoxelTile from '../game/components/VoxelTile';
import VoxelCar from '../game/components/VoxelCar';
import VoxelTruck from '../game/components/VoxelTruck';
import VoxelTree from '../game/components/VoxelTree';
import VoxelPlayer from '../game/components/VoxelPlayer';
import { COLS, ROWS } from '../game/constants';

type Lane = {
  type: 'grass' | 'road';
  cars: { x: number; kind: 'red' | 'yellow' | 'truck' }[];
};
type MoveFn = (dx: number, dy: number) => void;

export default function Game3D({
  lanes,
  player,
  onSwipe,
}: {
  lanes: Lane[];
  player: { x: number; y: number };
  onSwipe: MoveFn;
}) {
  const SWIPE_MIN = 12;
  const swipe = useMemo(
    () =>
      Gesture.Pan().onEnd((e) => {
        const dx = e.translationX;
        const dy = e.translationY;
        if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
        if (Math.abs(dx) > Math.abs(dy)) runOnJS(onSwipe)(dx > 0 ? 1 : -1, 0);
        else runOnJS(onSwipe)(0, dy < 0 ? 1 : -1);
      }),
    [onSwipe]
  );

  return (
    <GestureDetector gesture={swipe}>
      <View style={{ flex: 1, backgroundColor: '#0b1220' }}>
        <Canvas
          gl={{ antialias: true }}
          camera={{ position: [COLS * 0.7, ROWS * 0.9, COLS * 1.2], fov: 35 }}
          onCreated={({ camera }) => camera.lookAt(COLS * 0.5, 0, ROWS * 0.5)}
        >
          {/* Lights are JSX intrinsics; no imports needed */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 12, 6]} intensity={1.2} castShadow />

          {lanes.map((lane, r) => (
            <VoxelTile key={`t-${r}`} type={lane.type} x={COLS / 2} z={r + 0.5} width={COLS} />
          ))}

          {lanes.map((lane, r) =>
            lane.type === 'grass'
              ? [0, 1].map((t) => {
                  const gx = ((r * 17 + t * 41) % (COLS - 1)) + 0.2;
                  return <VoxelTree key={`tree-${r}-${t}`} x={gx + 0.5} z={r + 0.5} />;
                })
              : null
          )}

          {lanes.map((lane, r) =>
            lane.type === 'road'
              ? lane.cars.map((c, i) =>
                  c.kind === 'truck' ? (
                    <VoxelTruck key={`tr-${r}-${i}`} x={c.x + 0.5} z={r + 0.5} />
                  ) : (
                    <VoxelCar key={`c-${r}-${i}`} x={c.x + 0.5} z={r + 0.5} variant={c.kind} />
                  )
                )
              : null
          )}

          <VoxelPlayer x={player.x + 0.5} z={player.y + 0.5} />
        </Canvas>
      </View>
    </GestureDetector>
  );
}
