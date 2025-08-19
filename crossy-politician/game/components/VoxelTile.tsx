// src/three/VoxelTile.tsx
import React from 'react';
import { Color } from 'three';

const COLORS = {
  grass: new Color('#86d46c'),
  grassBand: new Color('#73c156'),
  road: new Color('#3C424C'),
  dash: new Color('#cdd6e3'),
};

export default function VoxelTile({
  type,
  x,
  z,
  width,
}: {
  type: 'grass' | 'road';
  x: number;
  z: number;
  width: number;
}) {
  const isGrass = type === 'grass';
  return (
    <group position={[x, -0.01, z]}>
      <mesh receiveShadow>
        <boxGeometry args={[width, 0.02, 1]} />
        <meshStandardMaterial color={isGrass ? COLORS.grass : COLORS.road} />
      </mesh>

      {isGrass ? (
        <mesh position={[0, 0.001, 0]}>
          <boxGeometry args={[width, 0.01, 0.2]} />
          <meshStandardMaterial color={COLORS.grassBand} />
        </mesh>
      ) : (
        <group position={[-width / 2 + 0.6, 0.001, 0]}>
          {Array.from({ length: Math.floor(width / 1.2) }).map((_, i) => (
            <mesh key={i} position={[i * 1.2, 0, 0]}>
              <boxGeometry args={[0.6, 0.01, 0.05]} />
              <meshStandardMaterial color={COLORS.dash} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
