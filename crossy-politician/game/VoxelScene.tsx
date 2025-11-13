// src/game/VoxelScene.tsx
import React, { useEffect, useRef } from 'react';
import { PanResponder, View } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { buildPlayer } from './components/VoxelPlayer';
import { buildCar } from './components/VoxelCar';
import { buildTruck } from './components/VoxelTruck';
import { COLS, MIN_CAR_GAP } from './constants';
import type { Lane, LaneType } from './types';
import { initSounds, play } from '../sound/soundManager';

interface CarObject {
  mesh: THREE.Group;
  laneIdx: number;
  position: number; // position along the lane
}

interface VoxelSceneProps {
  score: number;
  setScore: (setter: (prevScore: number) => number) => void;
  onGameOver: (finalScore: number) => void;
}

export default function VoxelScene({ score, setScore, onGameOver }: VoxelSceneProps) {
  const glRef = useRef<any>(null);
  const sceneRef = useRef<THREE.Scene>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const playerRef = useRef<THREE.Group | null>(null);

  // Game state
  const lanesRef = useRef<Lane[]>([]);
  const carsRef = useRef<CarObject[]>([]);
  const playerRowRef = useRef(0);
  const playerColRef = useRef(Math.floor(COLS / 2));
  const gameOverRef = useRef(false);
  const isMovingRef = useRef(false);
  const targetPosRef = useRef({ x: 0, z: 0 });
  const laneObjectsRef = useRef<THREE.Group[]>([]);
  const buildingsRef = useRef<THREE.Object3D[]>([]);

  // Hit animation state
  const isGettingHitRef = useRef(false);
  const hitAnimationTimeRef = useRef(0);
  const hitDirectionRef = useRef({ x: 0, z: 0 });
  const hitCarRef = useRef<CarObject | null>(null);

  // Initialize sounds and reset game state on mount
  useEffect(() => {
    initSounds();

    // Reset game state when component mounts
    return () => {
      // Cleanup on unmount
      gameOverRef.current = false;
      isMovingRef.current = false;
      isGettingHitRef.current = false;
      hitAnimationTimeRef.current = 0;
      playerRowRef.current = 0;
      playerColRef.current = Math.floor(COLS / 2);
      lanesRef.current = [];
      carsRef.current = [];
      laneObjectsRef.current = [];
      buildingsRef.current = [];
    };
  }, []);

  // Swipe detection
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, g) => {
        if (gameOverRef.current || isMovingRef.current || isGettingHitRef.current) return;

        const dx = g.dx, dy = g.dy;
        const threshold = 30;

        if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
          if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) hop('right');
            else hop('left');
          } else {
            if (dy > 0) hop('down');
            else hop('up');
          }
        }
      },
    })
  ).current;

  const createLane = (idx: number): Lane => {
    // City-themed: alternate between sidewalks and roads
    // More roads than sidewalks for challenge
    const isRoad = idx > 0 && Math.random() < 0.65;
    const type: LaneType = isRoad ? 'road' : 'grass';
    const dir = Math.random() < 0.5 ? 1 : -1;
    const speed = isRoad ? 0.3 + Math.random() * 0.5 : 0;

    // Generate cars for road lanes
    const cars: number[] = [];
    if (isRoad) {
      const numCars = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < numCars; i++) {
        const pos = Math.random() * COLS;
        // Check minimum gap from other cars
        const tooClose = cars.some(c => Math.abs(c - pos) < MIN_CAR_GAP);
        if (!tooClose) {
          cars.push(pos);
        }
      }
    }

    return { idx, type, dir, speed, cars };
  };

  const buildCityTile = (width: number, type: LaneType): THREE.Group => {
    const g = new THREE.Group();

    if (type === 'grass') {
      // Sidewalk - light gray with texture
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.02, 1),
        new THREE.MeshStandardMaterial({ color: 0xc0c5cc })
      );
      base.receiveShadow = true;
      g.add(base);

      // Add edge detail
      const edgeLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.03, 1),
        new THREE.MeshStandardMaterial({ color: 0xa0a5ac })
      );
      edgeLeft.position.set(-width / 2 + 0.05, 0.01, 0);
      g.add(edgeLeft);

      const edgeRight = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.03, 1),
        new THREE.MeshStandardMaterial({ color: 0xa0a5ac })
      );
      edgeRight.position.set(width / 2 - 0.05, 0.01, 0);
      g.add(edgeRight);

    } else {
      // Road - dark asphalt
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.02, 1),
        new THREE.MeshStandardMaterial({ color: 0x2c3238 })
      );
      base.receiveShadow = true;
      g.add(base);

      // Center dashed line
      const dashMat = new THREE.MeshStandardMaterial({ color: 0xf4d756 });
      for (let i = 0; i < 4; i++) {
        const dash = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.01, 0.4),
          dashMat
        );
        dash.position.set(0, 0.011, -0.4 + i * 0.3);
        g.add(dash);
      }
    }

    return g;
  };

  const addLaneToScene = (lane: Lane, scene: THREE.Scene) => {
    const tile = buildCityTile(COLS, lane.type);
    tile.position.set(0, 0, -lane.idx);
    scene.add(tile);
    laneObjectsRef.current.push(tile);

    // Add cars for road lanes
    if (lane.type === 'road' && lane.cars.length > 0) {
      lane.cars.forEach(carPos => {
        const isLargeTruck = Math.random() < 0.2;
        const carMesh = isLargeTruck
          ? buildTruck()
          : buildCar(Math.random() < 0.5 ? 'red' : 'yellow');

        const x = carPos - COLS / 2;
        const z = -lane.idx;
        carMesh.position.set(x, 0.2, z);

        // Rotate based on direction
        if (lane.dir === -1) {
          carMesh.rotation.y = Math.PI;
        }

        scene.add(carMesh);
        carsRef.current.push({
          mesh: carMesh,
          laneIdx: lane.idx,
          position: carPos
        });
      });
    }
  };

  const generateInitialLanes = (scene: THREE.Scene) => {
    // Generate lanes ahead
    for (let i = 0; i < 20; i++) {
      const lane = createLane(i);
      lanesRef.current.push(lane);
      addLaneToScene(lane, scene);
    }
  };

  const generateMoreLanes = (scene: THREE.Scene) => {
    // Generate lanes ahead of the player
    const furthestLane = lanesRef.current.length > 0
      ? lanesRef.current[lanesRef.current.length - 1].idx
      : 0;

    const playerFurthestRow = playerRowRef.current + 15;

    while (furthestLane < playerFurthestRow) {
      const newIdx = furthestLane + 1;
      const lane = createLane(newIdx);
      lanesRef.current.push(lane);
      addLaneToScene(lane, scene);
    }

    // Remove old lanes behind the player
    const playerOldestRow = playerRowRef.current - 10;
    lanesRef.current = lanesRef.current.filter(lane => lane.idx >= playerOldestRow);

    // Clean up old lane objects and cars
    laneObjectsRef.current = laneObjectsRef.current.filter(obj => {
      if (obj.position.z > playerRowRef.current + 10) {
        scene.remove(obj);
        return false;
      }
      return true;
    });

    carsRef.current = carsRef.current.filter(car => {
      if (car.laneIdx < playerOldestRow) {
        scene.remove(car.mesh);
        return false;
      }
      return true;
    });
  };

  const lastBuildingZRef = useRef(0);

  const addBuilding = (scene: THREE.Scene, zPosition: number) => {
    const buildingDistance = 6;
    const height = 3 + Math.random() * 8;
    const width = 1.5 + Math.random() * 2;
    const depth = 1.5 + Math.random() * 2;

    // Buildings on left side
    const buildingL = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color: 0x1a2330 })
    );
    buildingL.position.set(-buildingDistance, height / 2, zPosition);
    buildingL.castShadow = true;
    scene.add(buildingL);
    buildingsRef.current.push(buildingL);

    // Buildings on right side
    const buildingR = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color: 0x242f3f })
    );
    buildingR.position.set(buildingDistance, height / 2, zPosition);
    buildingR.castShadow = true;
    scene.add(buildingR);
    buildingsRef.current.push(buildingR);

    // Add window details
    if (Math.random() < 0.7) {
      const windowCount = Math.floor(height / 0.8);
      for (let w = 0; w < windowCount; w++) {
        const isLit = Math.random() < 0.6;
        const windowColor = isLit ? 0xffd966 : 0x1a1f2a;

        const windowL = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.4, 0.05),
          new THREE.MeshStandardMaterial({ color: windowColor, emissive: isLit ? 0x664400 : 0x000000 })
        );
        windowL.position.set(-buildingDistance + width / 2 + 0.05, 0.5 + w * 0.8, zPosition);
        scene.add(windowL);
        buildingsRef.current.push(windowL);

        const windowR = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.4, 0.05),
          new THREE.MeshStandardMaterial({ color: windowColor, emissive: isLit ? 0x664400 : 0x000000 })
        );
        windowR.position.set(buildingDistance - width / 2 - 0.05, 0.5 + w * 0.8, zPosition);
        scene.add(windowR);
        buildingsRef.current.push(windowR);
      }
    }
  };

  const createCityBuildings = (scene: THREE.Scene) => {
    // Create initial buildings
    for (let i = 0; i < 30; i++) {
      addBuilding(scene, -i * 3);
    }
    lastBuildingZRef.current = -29 * 3;
  };

  const generateMoreBuildings = (scene: THREE.Scene) => {
    // Generate buildings ahead of the player
    const playerZ = playerRef.current?.position.z || 0;
    const targetZ = playerZ - 60; // Generate 60 units ahead

    while (lastBuildingZRef.current > targetZ) {
      lastBuildingZRef.current -= 3;
      addBuilding(scene, lastBuildingZRef.current);
    }

    // Clean up old buildings behind the player
    buildingsRef.current = buildingsRef.current.filter(building => {
      if (building.position.z > playerZ + 30) {
        scene.remove(building);
        return false;
      }
      return true;
    });
  };

  const checkCollision = (): CarObject | null => {
    if (!playerRef.current) return null;

    const playerX = playerRef.current.position.x;
    const playerZ = playerRef.current.position.z;
    const collisionRadius = 0.4;

    for (const car of carsRef.current) {
      const carX = car.mesh.position.x;
      const carZ = car.mesh.position.z;

      const distance = Math.sqrt(
        Math.pow(playerX - carX, 2) + Math.pow(playerZ - carZ, 2)
      );

      if (distance < collisionRadius) {
        return car;
      }
    }

    return null;
  };

  const hop = (dir: 'up' | 'down' | 'left' | 'right') => {
    if (gameOverRef.current || isMovingRef.current || isGettingHitRef.current) return;

    const newCol = playerColRef.current;
    const newRow = playerRowRef.current;

    if (dir === 'up') {
      playerRowRef.current++;
      targetPosRef.current.z = -playerRowRef.current;
      setScore((s) => s + 1);
    } else if (dir === 'down') {
      if (playerRowRef.current > 0) {
        playerRowRef.current--;
        targetPosRef.current.z = -playerRowRef.current;
      }
    } else if (dir === 'left') {
      if (playerColRef.current > 0) {
        playerColRef.current--;
        targetPosRef.current.x = playerColRef.current - COLS / 2;
      }
    } else if (dir === 'right') {
      if (playerColRef.current < COLS - 1) {
        playerColRef.current++;
        targetPosRef.current.x = playerColRef.current - COLS / 2;
      }
    }

    isMovingRef.current = true;
    play('move');

    // Generate more lanes and buildings as needed
    if (sceneRef.current) {
      generateMoreLanes(sceneRef.current);
      generateMoreBuildings(sceneRef.current);
    }
  };

  const onContextCreate = async (gl: any) => {
    glRef.current = gl;
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x0b1220, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      50,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      1000
    );
    camera.position.set(0, 8, 8);
    camera.lookAt(0, 0, -5);
    cameraRef.current = camera;

    // Lighting - city atmosphere
    const hemisphereLight = new THREE.HemisphereLight(0x9db4d1, 0x1a2330, 0.8);
    scene.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);

    // Ambient light for city at night
    const ambientLight = new THREE.AmbientLight(0x404866, 0.4);
    scene.add(ambientLight);

    // Generate initial lanes
    generateInitialLanes(scene);

    // Create city buildings
    createCityBuildings(scene);

    // Player using the detailed model
    const player = buildPlayer();
    const startX = playerColRef.current - COLS / 2;
    const startZ = -playerRowRef.current;
    player.position.set(startX, 0.5, startZ);
    targetPosRef.current = { x: startX, z: startZ };
    scene.add(player);
    playerRef.current = player;

    let lastTime = Date.now();

    const animate = () => {
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

      requestAnimationFrame(animate);

      const currentTime = Date.now();
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Smooth player movement
      if (playerRef.current && isMovingRef.current) {
        const moveSpeed = 8;
        const dx = targetPosRef.current.x - playerRef.current.position.x;
        const dz = targetPosRef.current.z - playerRef.current.position.z;

        if (Math.abs(dx) > 0.01) {
          playerRef.current.position.x += dx * moveSpeed * delta;
        } else {
          playerRef.current.position.x = targetPosRef.current.x;
        }

        if (Math.abs(dz) > 0.01) {
          playerRef.current.position.z += dz * moveSpeed * delta;
        } else {
          playerRef.current.position.z = targetPosRef.current.z;
        }

        // Check if movement is complete
        if (Math.abs(dx) <= 0.01 && Math.abs(dz) <= 0.01) {
          isMovingRef.current = false;

          // Check collision after movement
          const hitCar = checkCollision();
          if (hitCar && !gameOverRef.current && !isGettingHitRef.current) {
            // Start hit animation
            isGettingHitRef.current = true;
            hitAnimationTimeRef.current = 0;
            hitCarRef.current = hitCar;

            // Calculate hit direction from car to player
            const lane = lanesRef.current.find(l => l.idx === hitCar.laneIdx);
            if (lane) {
              hitDirectionRef.current = { x: lane.dir * 2, z: 0.5 };
            }

            play('hit');
          }
        }
      }

      // Update camera to follow player
      if (playerRef.current && cameraRef.current) {
        const targetCamZ = playerRef.current.position.z + 8;
        const targetCamX = playerRef.current.position.x * 0.3;

        cameraRef.current.position.x += (targetCamX - cameraRef.current.position.x) * 0.05;
        cameraRef.current.position.z += (targetCamZ - cameraRef.current.position.z) * 0.1;

        const lookAtZ = playerRef.current.position.z - 2;
        cameraRef.current.lookAt(0, 0, lookAtZ);
      }

      // Update cars
      carsRef.current.forEach(car => {
        const lane = lanesRef.current.find(l => l.idx === car.laneIdx);
        if (!lane || lane.type !== 'road') return;

        car.position += lane.dir * lane.speed * delta * 3;
        car.mesh.position.x = car.position - COLS / 2;

        // Wrap around
        if (car.position > COLS + 2) {
          car.position = -2;
        } else if (car.position < -2) {
          car.position = COLS + 2;
        }
      });

      // Check collision continuously
      if (!gameOverRef.current && !isMovingRef.current && !isGettingHitRef.current) {
        const hitCar = checkCollision();
        if (hitCar) {
          // Start hit animation
          isGettingHitRef.current = true;
          hitAnimationTimeRef.current = 0;
          hitCarRef.current = hitCar;

          // Calculate hit direction from car to player
          const lane = lanesRef.current.find(l => l.idx === hitCar.laneIdx);
          if (lane) {
            hitDirectionRef.current = { x: lane.dir * 2, z: 0.5 };
          }

          play('hit');
        }
      }

      // Handle hit animation
      if (isGettingHitRef.current && playerRef.current) {
        hitAnimationTimeRef.current += delta;
        const animTime = hitAnimationTimeRef.current;
        const animDuration = 0.8; // Animation lasts 0.8 seconds

        if (animTime < animDuration) {
          // Rotate player (getting knocked over)
          const rotationProgress = Math.min(animTime / animDuration, 1);
          playerRef.current.rotation.x = rotationProgress * Math.PI * 0.5; // Rotate 90 degrees
          playerRef.current.rotation.z = rotationProgress * Math.PI * 0.3; // Slight tilt

          // Move player in hit direction (getting pushed by car)
          const pushDistance = rotationProgress * 0.5;
          playerRef.current.position.x += hitDirectionRef.current.x * delta * 2;
          playerRef.current.position.z += hitDirectionRef.current.z * delta * 2;

          // Make player fall down
          const fallAmount = Math.sin(rotationProgress * Math.PI) * 0.3;
          playerRef.current.position.y = 0.5 - fallAmount;
        } else {
          // Animation complete - trigger game over
          if (!gameOverRef.current) {
            gameOverRef.current = true;
            onGameOver(score);
          }
        }
      }

      rendererRef.current.render(scene, cameraRef.current);
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
