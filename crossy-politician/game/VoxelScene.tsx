// src/game/VoxelScene.tsx
import React, { useEffect, useRef } from 'react';
import { PanResponder, View, Text, StyleSheet } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { buildPlayer } from './components/VoxelPlayer';
import { buildCar } from './components/VoxelCar';
import { buildTruck } from './components/VoxelTruck';
import { COLS, MIN_CAR_GAP } from './constants';
import type { Lane, LaneType } from './types';
import { initSounds, play } from '../sound/soundManager';
import {
  generateRandomEnvironment,
  getLightingConfig,
  getBuildingColors,
  getSeasonalDecoration,
  createWeatherParticles,
  updateWeatherParticles,
  getEnvironmentDescription,
  type EnvironmentConfig,
  type BuildingColors,
} from './environment';

interface CarObject {
  mesh: THREE.Group;
  laneIdx: number;
  position: number;
  speed: number;
  direction: number;
}

interface BuildingObject {
  mesh: THREE.Object3D;
  zPosition: number;
}

interface VoxelSceneProps {
  score: number;
  setScore: (setter: (prevScore: number) => number) => void;
  onGameOver: (finalScore: number) => void;
}

export default function VoxelScene({ score, setScore, onGameOver }: VoxelSceneProps) {
  const glRef = useRef<any>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
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
  const laneObjectsRef = useRef<Map<number, THREE.Group>>(new Map());
  const buildingsRef = useRef<BuildingObject[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Jump animation state
  const jumpProgressRef = useRef(0);
  const jumpDirectionRef = useRef({ x: 0, z: 0 });

  // Hit animation state
  const isGettingHitRef = useRef(false);
  const hitAnimationTimeRef = useRef(0);
  const hitDirectionRef = useRef({ x: 0, z: 0 });

  // Track furthest lane generated
  const furthestLaneRef = useRef(-1);
  const furthestBuildingZRef = useRef(0);

  // Environment state
  const environmentRef = useRef<EnvironmentConfig>(generateRandomEnvironment());
  const buildingColorsRef = useRef<BuildingColors>(getBuildingColors(environmentRef.current));
  const weatherParticlesRef = useRef<THREE.Points | null>(null);

  // Initialize sounds and reset game state on mount
  useEffect(() => {
    initSounds();

    // Cleanup on unmount
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      gameOverRef.current = false;
      isMovingRef.current = false;
      isGettingHitRef.current = false;
      hitAnimationTimeRef.current = 0;
      playerRowRef.current = 0;
      playerColRef.current = Math.floor(COLS / 2);
      lanesRef.current = [];
      carsRef.current = [];
      laneObjectsRef.current.clear();
      buildingsRef.current = [];
      furthestLaneRef.current = -1;
      furthestBuildingZRef.current = 0;
    };
  }, []);

  // Swipe detection with increased sensitivity
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, g) => {
        if (gameOverRef.current || isMovingRef.current || isGettingHitRef.current) return;

        const dx = g.dx, dy = g.dy;
        const threshold = 15; // Reduced from 30 for faster response

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
    // First lane is always safe
    if (idx === 0) {
      return { idx, type: 'grass', dir: 0, speed: 0, cars: [] };
    }

    // City-themed: alternate between sidewalks and roads
    const isRoad = Math.random() < 0.65;
    const type: LaneType = isRoad ? 'road' : 'grass';
    const dir = Math.random() < 0.5 ? 1 : -1;
    const speed = isRoad ? 0.25 + Math.random() * 0.4 : 0;

    // Generate cars for road lanes
    const cars: number[] = [];
    if (isRoad) {
      const numCars = Math.floor(Math.random() * 2) + 1; // 1-2 cars per lane
      const attempts = numCars * 3; // Try multiple times to place cars

      for (let i = 0; i < attempts && cars.length < numCars; i++) {
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
    // Don't add if already exists
    if (laneObjectsRef.current.has(lane.idx)) {
      return;
    }

    const tile = buildCityTile(COLS, lane.type);
    tile.position.set(0, 0, -lane.idx);
    scene.add(tile);
    laneObjectsRef.current.set(lane.idx, tile);

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
          position: carPos,
          speed: lane.speed,
          direction: lane.dir
        });
      });
    }
  };

  const addBuilding = (scene: THREE.Scene, zPosition: number) => {
    const buildingDistance = 8;
    const colors = buildingColorsRef.current;
    const season = environmentRef.current.season;
    const timeOfDay = environmentRef.current.timeOfDay;

    // Create building for each side
    [-1, 1].forEach((side) => {
      const group = new THREE.Group();

      const height = 5 + Math.random() * 12;
      const width = 2.5 + Math.random() * 2;
      const depth = 2 + Math.random() * 2;

      // Choose random color from palette
      const primaryColor = colors.primary[Math.floor(Math.random() * colors.primary.length)];
      const accentColor = colors.accent[Math.floor(Math.random() * colors.accent.length)];

      // Main building body
      const mainBuilding = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({
          color: primaryColor,
          roughness: 0.7,
          metalness: 0.1
        })
      );
      mainBuilding.position.y = height / 2;
      mainBuilding.castShadow = true;
      mainBuilding.receiveShadow = true;
      group.add(mainBuilding);

      // Add architectural features randomly
      const buildingStyle = Math.floor(Math.random() * 3);

      // Top accent/crown
      if (buildingStyle === 0 || buildingStyle === 1) {
        const crownHeight = height * 0.15;
        const crown = new THREE.Mesh(
          new THREE.BoxGeometry(width + 0.2, crownHeight, depth + 0.2),
          new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.6 })
        );
        crown.position.y = height + crownHeight / 2 - 0.1;
        group.add(crown);
        buildingsRef.current.push({ mesh: crown, zPosition });
      }

      // Add stepped/terraced design
      if (buildingStyle === 2 && height > 8) {
        const stepHeight = height * 0.3;
        const step = new THREE.Mesh(
          new THREE.BoxGeometry(width * 0.7, stepHeight, depth * 0.7),
          new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.7 })
        );
        step.position.y = height + stepHeight / 2;
        group.add(step);
        buildingsRef.current.push({ mesh: step, zPosition });
      }

      // Windows - optimized (fewer windows, only front face)
      const floors = Math.min(Math.floor(height / 1.8), 5); // Max 5 floors
      const windowsPerFloor = Math.min(Math.floor(width / 1.5), 2); // Max 2 windows
      const windowLitProbability = timeOfDay === 'night' || timeOfDay === 'evening' ? 0.8 : 0.3;

      for (let floor = 0; floor < floors; floor++) {
        for (let w = 0; w < windowsPerFloor; w++) {
          const isLit = Math.random() < windowLitProbability;
          const windowColor = isLit ? colors.windowLit : colors.windowDark;
          const emissiveColor = isLit ? colors.windowEmissive : 0x000000;

          // Only front face window
          const window1 = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.5, 0.08),
            new THREE.MeshStandardMaterial({
              color: windowColor,
              emissive: emissiveColor,
              emissiveIntensity: isLit ? 0.4 : 0,
              roughness: 0.3
            })
          );
          const xOffset = -width / 2 + 0.6 + w * 1.5;
          const yOffset = 1 + floor * 1.8;
          window1.position.set(xOffset, yOffset, depth / 2 + 0.05);
          group.add(window1);
          buildingsRef.current.push({ mesh: window1, zPosition });
        }
      }

      // Add seasonal decoration on roof (reduced probability)
      const decoration = getSeasonalDecoration(season);
      if (decoration && Math.random() < 0.15) {
        const decor = new THREE.Mesh(
          new THREE.BoxGeometry(width, 0.1, depth),
          new THREE.MeshStandardMaterial({ color: decoration.color, roughness: 0.9 })
        );
        decor.position.y = height;
        group.add(decor);
        buildingsRef.current.push({ mesh: decor, zPosition });
      }

      // Add rooftop details (reduced probability for performance)
      if (Math.random() < 0.2) {
        const rooftopDetail = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 1.5, 0.3),
          new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 })
        );
        rooftopDetail.position.set(
          (Math.random() - 0.5) * width * 0.5,
          height + 0.75,
          (Math.random() - 0.5) * depth * 0.5
        );
        group.add(rooftopDetail);
        buildingsRef.current.push({ mesh: rooftopDetail, zPosition });
      }

      group.position.set(buildingDistance * side, 0, zPosition);
      scene.add(group);
      buildingsRef.current.push({ mesh: group, zPosition });
    });
  };

  const generateLanesAhead = (scene: THREE.Scene, playerRow: number) => {
    const lookAhead = 15; // Generate lanes 15 rows ahead
    const targetRow = playerRow + lookAhead;

    // Generate lanes up to target
    while (furthestLaneRef.current < targetRow) {
      furthestLaneRef.current++;
      const lane = createLane(furthestLaneRef.current);
      lanesRef.current.push(lane);
      addLaneToScene(lane, scene);
    }
  };

  const generateBuildingsAhead = (scene: THREE.Scene, playerZ: number) => {
    const lookAhead = 60; // Generate buildings 60 units ahead
    const targetZ = playerZ - lookAhead;
    const buildingSpacing = 3.5; // Increased spacing for fewer buildings

    // Generate buildings up to target
    while (furthestBuildingZRef.current > targetZ) {
      furthestBuildingZRef.current -= buildingSpacing;
      addBuilding(scene, furthestBuildingZRef.current);
    }
  };

  const cleanupOldObjects = (scene: THREE.Scene, playerRow: number, playerZ: number) => {
    const cleanupDistanceLanes = 10; // Remove lanes 10 rows behind
    const cleanupDistanceBuildings = 30; // Remove buildings 30 units behind

    // Cleanup old lanes
    lanesRef.current = lanesRef.current.filter(lane => {
      if (lane.idx < playerRow - cleanupDistanceLanes) {
        const laneObj = laneObjectsRef.current.get(lane.idx);
        if (laneObj) {
          scene.remove(laneObj);
          laneObjectsRef.current.delete(lane.idx);
        }
        return false;
      }
      return true;
    });

    // Cleanup old cars
    carsRef.current = carsRef.current.filter(car => {
      if (car.laneIdx < playerRow - cleanupDistanceLanes) {
        scene.remove(car.mesh);
        return false;
      }
      return true;
    });

    // Cleanup old buildings
    buildingsRef.current = buildingsRef.current.filter(building => {
      if (building.zPosition > playerZ + cleanupDistanceBuildings) {
        scene.remove(building.mesh);
        return false;
      }
      return true;
    });
  };

  const checkCollision = (): boolean => {
    if (!playerRef.current) return false;

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
        // Calculate hit direction
        const dx = playerX - carX;
        const dz = playerZ - carZ;
        const magnitude = Math.sqrt(dx * dx + dz * dz);
        if (magnitude > 0) {
          hitDirectionRef.current = {
            x: (dx / magnitude) * car.direction * 3,
            z: (dz / magnitude) * 0.5
          };
        }
        return true;
      }
    }

    return false;
  };

  const hop = (dir: 'up' | 'down' | 'left' | 'right') => {
    if (gameOverRef.current || isMovingRef.current || isGettingHitRef.current) return;

    const oldX = playerColRef.current - COLS / 2;
    const oldZ = -playerRowRef.current;

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

    // Calculate jump direction for animation
    jumpDirectionRef.current = {
      x: targetPosRef.current.x - oldX,
      z: targetPosRef.current.z - oldZ
    };
    jumpProgressRef.current = 0;

    isMovingRef.current = true;
    play('move');

    // Generate more lanes and buildings as needed
    if (sceneRef.current) {
      generateLanesAhead(sceneRef.current, playerRowRef.current);
      generateBuildingsAhead(sceneRef.current, -playerRowRef.current);
      cleanupOldObjects(sceneRef.current, playerRowRef.current, -playerRowRef.current);
    }
  };

  const onContextCreate = async (gl: any) => {
    glRef.current = gl;

    // Get environment and lighting configuration
    const env = environmentRef.current;
    const lighting = getLightingConfig(env);
    console.log('Environment:', getEnvironmentDescription(env));

    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(lighting.skyColor, 1);
    // Disable shadows for better performance
    renderer.shadowMap.enabled = false;
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(lighting.fogColor, lighting.fogDensity);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      1000
    );
    camera.position.set(4, 4, 5);
    camera.lookAt(0, 0, -2);
    cameraRef.current = camera;

    // Dynamic lighting based on environment
    const hemisphereLight = new THREE.HemisphereLight(
      lighting.skyColor,
      lighting.groundColor,
      lighting.hemisphereIntensity
    );
    scene.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(
      lighting.directionalColor,
      lighting.directionalIntensity
    );
    directionalLight.position.set(5, 10, 5);
    // Shadows disabled for performance
    directionalLight.castShadow = false;
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(
      lighting.ambientColor,
      lighting.ambientIntensity
    );
    scene.add(ambientLight);

    // Generate initial lanes
    generateLanesAhead(scene, 0);

    // Generate initial buildings
    furthestBuildingZRef.current = 5;
    generateBuildingsAhead(scene, 0);

    // Player using the detailed model
    const player = buildPlayer();
    const startX = playerColRef.current - COLS / 2;
    const startZ = -playerRowRef.current;
    player.position.set(startX, 0.5, startZ);
    targetPosRef.current = { x: startX, z: startZ };
    scene.add(player);
    playerRef.current = player;

    // Add weather particles
    const weatherParticles = createWeatherParticles(
      scene,
      env.weather,
      new THREE.Vector3(startX, 0, startZ)
    );
    weatherParticlesRef.current = weatherParticles;

    let lastTime = Date.now();

    const animate = () => {
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current || !playerRef.current) {
        return;
      }

      animationFrameRef.current = requestAnimationFrame(animate);

      const currentTime = Date.now();
      const delta = Math.min((currentTime - lastTime) / 1000, 0.1); // Cap delta to prevent huge jumps
      lastTime = currentTime;

      // Smooth player movement with Crossy Road style jump
      if (isMovingRef.current) {
        const moveSpeed = 8;
        jumpProgressRef.current += delta * moveSpeed;
        const progress = Math.min(jumpProgressRef.current, 1);

        // Horizontal movement
        playerRef.current.position.x = THREE.MathUtils.lerp(
          playerRef.current.position.x,
          targetPosRef.current.x,
          progress
        );
        playerRef.current.position.z = THREE.MathUtils.lerp(
          playerRef.current.position.z,
          targetPosRef.current.z,
          progress
        );

        // Jump arc animation - parabolic curve
        const jumpHeight = 0.6; // Peak of the jump
        const arcProgress = Math.sin(progress * Math.PI); // Creates smooth arc
        playerRef.current.position.y = 0.5 + arcProgress * jumpHeight;

        // Slight forward tilt during jump
        const tiltAmount = Math.sin(progress * Math.PI) * 0.15;
        if (jumpDirectionRef.current.z !== 0) {
          playerRef.current.rotation.x = tiltAmount * (jumpDirectionRef.current.z > 0 ? 1 : -1);
        }
        if (jumpDirectionRef.current.x !== 0) {
          playerRef.current.rotation.z = -tiltAmount * (jumpDirectionRef.current.x > 0 ? 1 : -1);
        }

        // Slight squash and stretch
        const squashStretch = 1 + Math.sin(progress * Math.PI) * 0.1;
        playerRef.current.scale.y = squashStretch;
        playerRef.current.scale.x = 1 / Math.sqrt(squashStretch);
        playerRef.current.scale.z = 1 / Math.sqrt(squashStretch);

        // Check if movement is complete
        if (progress >= 1) {
          isMovingRef.current = false;
          jumpProgressRef.current = 0;

          // Reset rotation and scale
          playerRef.current.rotation.x = 0;
          playerRef.current.rotation.z = 0;
          playerRef.current.scale.set(1, 1, 1);
          playerRef.current.position.y = 0.5;

          // Snap to final position
          playerRef.current.position.x = targetPosRef.current.x;
          playerRef.current.position.z = targetPosRef.current.z;

          // Check collision after movement
          if (checkCollision() && !gameOverRef.current && !isGettingHitRef.current) {
            isGettingHitRef.current = true;
            hitAnimationTimeRef.current = 0;
            play('hit');
          }
        }
      }

      // Update camera to follow player with side angle
      const targetCamZ = playerRef.current.position.z + 5;
      const targetCamX = playerRef.current.position.x + 4;
      const targetCamY = 4;

      cameraRef.current.position.x += (targetCamX - cameraRef.current.position.x) * 0.1;
      cameraRef.current.position.z += (targetCamZ - cameraRef.current.position.z) * 0.1;
      cameraRef.current.position.y += (targetCamY - cameraRef.current.position.y) * 0.1;

      const lookAtX = playerRef.current.position.x;
      const lookAtZ = playerRef.current.position.z - 2;
      cameraRef.current.lookAt(lookAtX, 0.5, lookAtZ);

      // Update cars
      carsRef.current.forEach(car => {
        car.position += car.direction * car.speed * delta * 3;
        car.mesh.position.x = car.position - COLS / 2;

        // Wrap around
        if (car.position > COLS + 2) {
          car.position = -2;
        } else if (car.position < -2) {
          car.position = COLS + 2;
        }
      });

      // Update weather particles
      if (weatherParticlesRef.current) {
        updateWeatherParticles(
          weatherParticlesRef.current,
          environmentRef.current.weather,
          delta,
          playerRef.current.position.z
        );
      }

      // Check collision continuously when not moving
      if (!gameOverRef.current && !isMovingRef.current && !isGettingHitRef.current) {
        if (checkCollision()) {
          isGettingHitRef.current = true;
          hitAnimationTimeRef.current = 0;
          play('hit');
        }
      }

      // Handle violent hit animation
      if (isGettingHitRef.current) {
        hitAnimationTimeRef.current += delta;
        const animTime = hitAnimationTimeRef.current;
        const animDuration = 1.2; // Longer for more dramatic effect

        if (animTime < animDuration) {
          const progress = Math.min(animTime / animDuration, 1);

          // Phase 1: Initial impact (0-0.3s) - violent spin and launch
          if (animTime < 0.3) {
            const impactProgress = animTime / 0.3;

            // Violent spinning in multiple axes
            playerRef.current.rotation.x = impactProgress * Math.PI * 3; // Multiple flips
            playerRef.current.rotation.y = impactProgress * Math.PI * 2; // Spin
            playerRef.current.rotation.z = impactProgress * Math.PI * 2.5; // Roll

            // Launch upward violently
            const launchHeight = Math.sin(impactProgress * Math.PI) * 2.5;
            playerRef.current.position.y = 0.5 + launchHeight;

            // Fly backwards from impact
            playerRef.current.position.x += hitDirectionRef.current.x * delta * 8;
            playerRef.current.position.z += hitDirectionRef.current.z * delta * 8;

            // Squash on impact
            const squash = 1 - impactProgress * 0.4;
            playerRef.current.scale.set(1.2, squash, 1.2);
          }
          // Phase 2: Airborne rotation (0.3-0.8s) - continue spinning while flying
          else if (animTime < 0.8) {
            const airProgress = (animTime - 0.3) / 0.5;

            // Continue spinning but slowing down
            playerRef.current.rotation.x = Math.PI * 3 + airProgress * Math.PI * 2;
            playerRef.current.rotation.y = Math.PI * 2 + airProgress * Math.PI;
            playerRef.current.rotation.z = Math.PI * 2.5 + airProgress * Math.PI * 1.5;

            // Arc trajectory - go up then start falling
            const arc = 2.5 * (1 - airProgress); // Fall from peak
            playerRef.current.position.y = 0.5 + arc;

            // Continue flying but slowing down
            playerRef.current.position.x += hitDirectionRef.current.x * delta * (4 - airProgress * 3);
            playerRef.current.position.z += hitDirectionRef.current.z * delta * (4 - airProgress * 3);

            // Return to normal scale
            playerRef.current.scale.set(1, 1, 1);
          }
          // Phase 3: Crash landing (0.8-1.2s) - tumble and settle
          else {
            const landProgress = (animTime - 0.8) / 0.4;

            // Final tumbles
            playerRef.current.rotation.x = Math.PI * 5 + landProgress * Math.PI * 0.5;
            playerRef.current.rotation.y = Math.PI * 3 + landProgress * Math.PI * 0.3;
            playerRef.current.rotation.z = Math.PI * 4 + landProgress * Math.PI * 0.4;

            // Hit ground and bounce slightly
            const bounce = Math.max(0, Math.sin(landProgress * Math.PI * 2) * 0.3 * (1 - landProgress));
            playerRef.current.position.y = Math.max(-0.2, bounce - landProgress * 0.5);

            // Slide to stop
            playerRef.current.position.x += hitDirectionRef.current.x * delta * (1 - landProgress);
            playerRef.current.position.z += hitDirectionRef.current.z * delta * (1 - landProgress);

            // Squash on landing
            if (landProgress < 0.5) {
              const squashAmount = Math.sin(landProgress * Math.PI * 2) * 0.3;
              playerRef.current.scale.set(1 + squashAmount, 1 - squashAmount, 1 + squashAmount);
            } else {
              playerRef.current.scale.set(1, 1, 1);
            }
          }
        } else {
          // Animation complete
          if (!gameOverRef.current) {
            gameOverRef.current = true;
            onGameOver(score);
          }
        }
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
      gl.endFrameEXP();
    };

    animate();
  };

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
      <View style={styles.environmentOverlay}>
        <Text style={styles.environmentText}>
          {getEnvironmentDescription(environmentRef.current)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  environmentOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 8,
    borderRadius: 8,
  },
  environmentText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
