// src/three/VoxelTruck.tsx
import React from 'react';
export default function VoxelTruck({ x, z }: { x: number; z: number }) {
  const y = 0.25;
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, -0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 12]} />
        <meshStandardMaterial color="black" transparent opacity={0.22} />
      </mesh>
      <mesh castShadow position={[-0.18, 0, 0]}>
        <boxGeometry args={[1.1, 0.5, 0.6]} />
        <meshStandardMaterial color="#e0e6ee" />
      </mesh>
      <mesh castShadow position={[0.55, -0.02, 0]}>
        <boxGeometry args={[0.45, 0.45, 0.6]} />
        <meshStandardMaterial color="#de3d3d" />
      </mesh>
    </group>
  );
}
