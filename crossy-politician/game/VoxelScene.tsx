// src/game/VoxelScene.tsx
import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { buildPlayer } from './components/VoxelPlayer';
import { buildCar } from './components/VoxelCar';
import { buildTruck } from './components/VoxelTruck';
import { buildTree } from './components/VoxelTree';
import { buildSubway } from './components/VoxelSubway';
import { buildGrassTile, buildRoadTile } from './components/VoxelTile';

const LANE_WIDTH = 1;
const TILE_LENGTH = 1;
const WORLD_WIDTH = 9;

interface VoxelSceneProps {
  score: number;
  setScore: React.Dispatch<React.SetStateAction<number>>;
  onGameOver: (finalScore: number) => void;
}

export default function VoxelScene({ score, setScore, onGameOver }: VoxelSceneProps) {
  const glRef = useRef<any>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const scoreRef = useRef(score);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const playerRef = useRef<THREE.Group | null>(null);
  const lanesRef = useRef<any[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isHopping, setIsHopping] = useState(false);
  const hopStartTime = useRef(0);
  const hopDuration = 200; // ms

  // simple swipe detection
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, g) => {
        if (isAnimating) return;
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
    if (!playerRef.current || isAnimating) return;

    const targetPosition = playerRef.current.position.clone();
    if (dir === 'up') targetPosition.z -= TILE_LENGTH;
    if (dir === 'down') targetPosition.z += TILE_LENGTH;
    if (dir === 'left') targetPosition.x -= LANE_WIDTH;
    if (dir === 'right') targetPosition.x += LANE_WIDTH;

    // Check for world boundaries
    if (Math.abs(targetPosition.x) > WORLD_WIDTH / 2) {
        return; // Block movement
    }

    // Check for tree collisions
    const targetBox = new THREE.Box3().setFromCenterAndSize(
        targetPosition,
        new THREE.Vector3(0.5, 0.5, 0.5)
    );

    for (const lane of lanesRef.current) {
        if (lane.type === 'grass') {
            for (const tree of lane.objects) {
                const treeBox = new THREE.Box3().setFromObject(tree);
                if (targetBox.intersectsBox(treeBox)) {
                    return; // Block movement
                }
            }
        }
    }


    setIsAnimating(true);
    setIsHopping(true);
    hopStartTime.current = Date.now();

    if (dir === 'up') {
      playerRef.current.position.z -= TILE_LENGTH;
      setScore((s) => {
        const newScore = s + 1;
        scoreRef.current = newScore;
        return newScore;
      });
    }
    if (dir === 'down') playerRef.current.position.z += TILE_LENGTH;
    if (dir === 'left') playerRef.current.position.x -= LANE_WIDTH;
    if (dir === 'right') playerRef.current.position.x += LANE_WIDTH;

    setTimeout(() => {
      setIsAnimating(false);
      setIsHopping(false);
      if (playerRef.current) {
        playerRef.current.position.y = 0.5; // reset to ground
      }
    }, hopDuration);
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
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

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
    const player = buildPlayer();
    player.position.z = 10;
    scene.add(player);
    playerRef.current = player;

    // Generate lanes
    lanesRef.current = [];
    for (let i = 0; i < 20; i++) {
      const laneZ = 10 - i * TILE_LENGTH;
      if (i < 2 || i > 18) { // Safe zones
        const tile = buildGrassTile(WORLD_WIDTH);
        tile.position.z = laneZ;
        scene.add(tile);
        lanesRef.current.push({ type: 'grass', objects: [] });
      } else { // Road or grass with trees
        if (Math.random() > 0.4) { // Road or Subway lane
          if (Math.random() < 0.2) { // Subway Lane
            const tile = buildRoadTile(WORLD_WIDTH);
            tile.position.z = laneZ;
            scene.add(tile);
            const speed = (Math.random() * 3 + 2) * (Math.random() > 0.5 ? 1 : -1);
            const subways = [];
            for (let j = 0; j < 2; j++) {
              const subway = buildSubway();
              subway.position.set(-WORLD_WIDTH / 2 + j * (WORLD_WIDTH + 4), 0.4, laneZ);
              scene.add(subway);
              subways.push(subway);
            }
            lanesRef.current.push({ type: 'subway', speed, vehicles: subways });
          } else { // Road lane
            const tile = buildRoadTile(WORLD_WIDTH);
            tile.position.z = laneZ;
            scene.add(tile);
            const speed = (Math.random() * 2 + 1) * (Math.random() > 0.5 ? 1 : -1);
            const vehicles = [];
            for (let j = 0; j < Math.floor(Math.random() * 3) + 1; j++) {
              const vehicle = Math.random() > 0.3 ? buildCar() : buildTruck();
              vehicle.position.set(Math.random() * WORLD_WIDTH - WORLD_WIDTH / 2, 0.25, laneZ);
              scene.add(vehicle);
              vehicles.push(vehicle);
            }
            lanesRef.current.push({ type: 'road', speed, vehicles });
          }
        } else { // Grass lane with trees
          const tile = buildGrassTile(WORLD_WIDTH);
          tile.position.z = laneZ;
          scene.add(tile);
          const trees = [];
          for (let j = 0; j < Math.floor(Math.random() * 4); j++) {
            const tree = buildTree();
            tree.position.set(Math.random() * WORLD_WIDTH - WORLD_WIDTH / 2, 0.5, laneZ);
            scene.add(tree);
            trees.push(tree);
          }
          lanesRef.current.push({ type: 'grass', objects: trees });
        }
      }
    }

    const animate = () => {
      requestAnimationFrame(animate);
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current || !playerRef.current) return;

      if (isHopping && playerRef.current) {
        const elapsed = Date.now() - hopStartTime.current;
        const progress = elapsed / hopDuration;
        if (progress < 1) {
          playerRef.current.position.y = 0.5 + Math.sin(progress * Math.PI) * 0.5; // hopHeight = 0.5
        } else {
          playerRef.current.position.y = 0.5;
        }
      }

      // animate vehicles
      lanesRef.current.forEach(lane => {
        if (lane.type === 'road' || lane.type === 'subway') {
          lane.vehicles.forEach(vehicle => {
            vehicle.position.x += lane.speed * 0.016;
            const boundary = lane.type === 'subway' ? WORLD_WIDTH / 2 + 5 : WORLD_WIDTH / 2 + 2;
            if (vehicle.position.x > boundary) vehicle.position.x = -boundary;
            if (vehicle.position.x < -boundary) vehicle.position.x = boundary;
          });
        }
      });

      // Follow player with camera
      cameraRef.current.position.z = playerRef.current.position.z + 10;
      cameraRef.current.position.y = playerRef.current.position.y + 5;


      // Collision detection
      const playerBox = new THREE.Box3().setFromObject(playerRef.current);
      lanesRef.current.forEach(lane => {
        if (lane.type === 'road' || lane.type === 'subway') {
          lane.vehicles.forEach(vehicle => {
            const vehicleBox = new THREE.Box3().setFromObject(vehicle);
            if (playerBox.intersectsBox(vehicleBox)) {
              onGameOver(scoreRef.current);
            }
          });
        }
      });

      rendererRef.current.render(sceneRef.current, cameraRef.current);
      glRef.current.endFrameEXP();
    };
    animate();
  };

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
    </View>
  );
}
