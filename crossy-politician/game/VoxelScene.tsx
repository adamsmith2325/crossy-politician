// src/game/VoxelScene.tsx
import React, { useEffect, useRef } from 'react';
import { PanResponder, View } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';

export default function VoxelScene({ score, setScore, onGameOver }) {
  const glRef = useRef<any>(null);
  const sceneRef = useRef<THREE.Scene>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const playerRef = useRef<THREE.Group | null>(null);

  // simple swipe detection
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, g) => {
        const dx = g.dx, dy = g.dy;
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) hop('right');
          else hop('left');
        } else {
          if (dy > 0) hop('down');
          else hop('up');
        }
      },
    })
  ).current;

  const hop = (dir: 'up' | 'down' | 'left' | 'right') => {
    if (!playerRef.current) return;
    const step = 1;
    if (dir === 'up') {
      playerRef.current.position.z -= step;
      setScore((s) => s + 1);
    }
    if (dir === 'down') playerRef.current.position.z += step;
    if (dir === 'left') playerRef.current.position.x -= step;
    if (dir === 'right') playerRef.current.position.x += step;
  };

  const onContextCreate = async (gl: any) => {
    glRef.current = gl;
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x0b1220, 1);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 1000);
    camera.position.set(5, 10, 15);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // lights
    scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 1));

    // ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // static city skyline (background)
    for (let i = 0; i < 20; i++) {
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(2, Math.random() * 5 + 5, 2),
        new THREE.MeshStandardMaterial({ color: 0x1a2330 })
      );
      const angle = (i / 20) * Math.PI * 2;
      const radius = 25;
      b.position.set(Math.cos(angle) * radius, b.geometry.parameters.height / 2, Math.sin(angle) * radius);
      scene.add(b);
    }

    // player
    const player = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x000000 }));
    const hair = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 1), new THREE.MeshStandardMaterial({ color: 0xffa800 }));
    hair.position.y = 0.65;
    player.add(body, hair);
    player.position.y = 0.5;
    scene.add(player);
    playerRef.current = player;

    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();
  };

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
    </View>
  );
}
