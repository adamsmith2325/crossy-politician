// src/three/VoxelTree.tsx
import React from 'react';
export default function VoxelTree({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.45, z]}>
      <mesh position={[0, -0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.35, 12]} />
        <meshStandardMaterial color="black" transparent opacity={0.2} />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.12, 0.25, 0.12]} />
        <meshStandardMaterial color="#7B4F28" />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color="#6DBA4A" />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.34, 0.34, 0.34]} />
        <meshStandardMaterial color="#579E3A" />
      </mesh>
    </group>
  );
}
