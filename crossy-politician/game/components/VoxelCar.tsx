// src/three/VoxelCar.tsx
import React from 'react';

type Props = { x: number; z: number; variant?: 'red' | 'yellow' };

const PALETTE = {
  red: '#e85c3c',
  yellow: '#f3c53b',
  roof: '#f4f6f8',
  wheel: '#16181b',
};

export default function VoxelCar({ x, z, variant = 'red' }: Props) {
  const w = 0.9, h = 0.4, y = 0.22;
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, -0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 12]} />
        <meshStandardMaterial color="black" transparent opacity={0.2} />
      </mesh>

      <mesh castShadow>
        <boxGeometry args={[w, h, 0.55]} />
        <meshStandardMaterial color={PALETTE[variant]} />
      </mesh>

      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[w * 0.6, h * 0.5, 0.35]} />
        <meshStandardMaterial color={PALETTE.roof} />
      </mesh>

      {[-0.28, 0.28].map((ox, i) => (
        <mesh key={`fw${i}`} position={[ox, -0.05, 0.23]}>
          <boxGeometry args={[0.18, 0.18, 0.1]} />
          <meshStandardMaterial color={PALETTE.wheel} />
        </mesh>
      ))}
      {[-0.28, 0.28].map((ox, i) => (
        <mesh key={`bw${i}`} position={[ox, -0.05, -0.23]}>
          <boxGeometry args={[0.18, 0.18, 0.1]} />
          <meshStandardMaterial color={PALETTE.wheel} />
        </mesh>
      ))}
    </group>
  );
}
