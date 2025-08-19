// src/three/VoxelPlayer.tsx
import React from 'react';
export default function VoxelPlayer({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.5, z]}>
      <mesh position={[0, -0.48, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 12]} />
        <meshStandardMaterial color="black" transparent opacity={0.2} />
      </mesh>
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.6, 0.5]} />
        <meshStandardMaterial color="#F8C34A" />
      </mesh>
      <mesh position={[0, 0.12, 0.26]}>
        <boxGeometry args={[0.28, 0.22, 0.04]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}
