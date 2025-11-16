// src/game/VoxelScene.tsx
import React, { useEffect, useRef } from 'react';
import { PanResponder, View, Text, StyleSheet, Alert } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { buildPlayer } from './components/VoxelPlayer';
import { buildCar } from './components/VoxelCar';
import { buildTruck } from './components/VoxelTruck';
import { buildPoliceCar } from './components/VoxelPoliceCar';
import { buildTaxi } from './components/VoxelTaxi';
import { buildBus } from './components/VoxelBus';
import { buildAmbulance } from './components/VoxelAmbulance';
import { buildRandomObstacle } from './components/VoxelObstacles';
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
  type?: 'car' | 'truck' | 'bus' | 'police' | 'taxi' | 'ambulance';
}

interface BuildingObject {
  mesh: THREE.Object3D;
  zPosition: number;
}

interface ObstacleObject {
  mesh: THREE.Group;
  laneIdx: number;
  col: number;
}

interface VoxelSceneProps {
  score: number;
  setScore: (setter: (prevScore: number) => number) => void;
  onGameOver: (finalScore: number, survivalTime: number, gameStats?: {
    dodges: number;
    jumps: number;
    busesDodged: number;
    policeDodged: number;
    closeCall: boolean;
  }) => void;
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
  const obstaclesRef = useRef<ObstacleObject[]>([]);
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

  // Time tracking
  const gameStartTimeRef = useRef<number>(Date.now());
  const survivalTimeRef = useRef<number>(0);

  // Game statistics for achievements
  const gameStatsRef = useRef({
    dodges: 0,
    jumps: 0,
    busesDodged: 0,
    policeDodged: 0,
    closeCall: false,
  });

  // Initialize sounds and reset game state on mount
  useEffect(() => {
    console.log('VoxelScene: Component mounted');
    initSounds();
    gameStartTimeRef.current = Date.now();
    console.log('VoxelScene: Sounds initialized');

    // Cleanup on unmount
    return () => {
      console.log('VoxelScene: Component unmounting');
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
      obstaclesRef.current = [];
      laneObjectsRef.current.clear();
      buildingsRef.current = [];
      furthestLaneRef.current = -1;
      furthestBuildingZRef.current = 0;
      gameStartTimeRef.current = Date.now();
      survivalTimeRef.current = 0;
      gameStatsRef.current = {
        dodges: 0,
        jumps: 0,
        busesDodged: 0,
        policeDodged: 0,
        closeCall: false,
      };
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

  const createLane = (idx: number, currentScore: number): Lane => {
    // First lane is always safe
    if (idx === 0) {
      return { idx, type: 'grass', dir: 0, speed: 0, cars: [] };
    }

    // Progressive difficulty scaling based on score (increased for more challenge)
    const difficultyMultiplier = Math.min(1 + (currentScore / 40), 3.5); // Max 3.5x difficulty at score 100+ (faster ramp-up)

    // City-themed: alternate between sidewalks and roads
    // Increase road probability slightly as score increases (max 75% roads)
    const roadProbability = Math.min(0.65 + (currentScore / 200), 0.75);
    const isRoad = Math.random() < roadProbability;
    const type: LaneType = isRoad ? 'road' : 'grass';
    const dir = Math.random() < 0.5 ? 1 : -1;

    // Progressive speed increase: base speed increases with score (increased base speed for difficulty)
    const baseSpeed = 0.4 + Math.random() * 0.5; // Increased from 0.25-0.65 to 0.4-0.9
    const speed = isRoad ? baseSpeed * difficultyMultiplier : 0;

    // Generate cars for road lanes
    const cars: number[] = [];
    if (isRoad) {
      // Increase number of cars based on score (1-4 cars for more difficulty)
      const maxCars = Math.min(Math.floor(1 + currentScore / 25), 4); // Increased from 3 to 4, faster ramp-up
      const numCars = Math.floor(Math.random() * maxCars) + 1;
      const attempts = numCars * 3; // Try multiple times to place cars

      for (let i = 0; i < attempts && cars.length < numCars; i++) {
        const pos = Math.random() * COLS;
        // Check minimum gap from other cars (gap decreases more aggressively with difficulty)
        const minGap = Math.max(MIN_CAR_GAP - (currentScore / 80), 1.3); // Reduced min gap from 1.5 to 1.3
        const tooClose = cars.some(c => Math.abs(c - pos) < minGap);
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

      // Add curbs on both edges (raised edge)
      const curbHeight = 0.08;
      const curbLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, curbHeight, 1),
        new THREE.MeshStandardMaterial({ color: 0x909599 })
      );
      curbLeft.position.set(-width / 2 + 0.075, curbHeight / 2, 0);
      g.add(curbLeft);

      const curbRight = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, curbHeight, 1),
        new THREE.MeshStandardMaterial({ color: 0x909599 })
      );
      curbRight.position.set(width / 2 - 0.075, curbHeight / 2, 0);
      g.add(curbRight);

      // OPTIMIZED: Removed edge details for better performance

      // OPTIMIZED: Reduced manhole frequency and complexity
      if (Math.random() < 0.08) {
        const manhole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.25, 0.02, 8), // OPTIMIZED: 8 segments instead of 16
          new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.5, roughness: 0.7 })
        );
        manhole.rotation.x = Math.PI / 2;
        manhole.position.set((Math.random() - 0.5) * width * 0.6, 0.011, 0);
        g.add(manhole);
      }

    } else {
      // Road - dark asphalt
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.02, 1),
        new THREE.MeshStandardMaterial({ color: 0x2c3238 })
      );
      base.receiveShadow = true;
      g.add(base);

      // Center dashed line (OPTIMIZED: 3 dashes instead of 4)
      const dashMat = new THREE.MeshStandardMaterial({ color: 0xf4d756 });
      for (let i = 0; i < 3; i++) {
        const dash = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.01, 0.4),
          dashMat
        );
        dash.position.set(0, 0.011, -0.3 + i * 0.3);
        g.add(dash);
      }

      // OPTIMIZED: Reduced crosswalk frequency
      if (Math.random() < 0.06) {
        const crosswalkMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        for (let i = 0; i < 5; i++) {
          const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.7, 0.01, 0.15),
            crosswalkMat
          );
          stripe.position.set(0, 0.011, -0.4 + i * 0.2);
          g.add(stripe);
        }
      }

      // OPTIMIZED: Reduced manhole frequency and complexity
      if (Math.random() < 0.04) {
        const manhole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.25, 0.02, 8), // OPTIMIZED: 8 segments instead of 16
          new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.5, roughness: 0.7 })
        );
        manhole.rotation.x = Math.PI / 2;
        manhole.position.set((Math.random() - 0.5) * width * 0.4, 0.011, 0);
        g.add(manhole);
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
        // Randomly select vehicle type with weighted probabilities
        const rand = Math.random();
        let carMesh: THREE.Group;
        let vehicleType: 'car' | 'truck' | 'bus' | 'police' | 'taxi' | 'ambulance';

        if (rand < 0.05) {
          // 5% chance for bus (largest)
          carMesh = buildBus();
          vehicleType = 'bus';
        } else if (rand < 0.15) {
          // 10% chance for truck
          carMesh = buildTruck();
          vehicleType = 'truck';
        } else if (rand < 0.25) {
          // 10% chance for ambulance
          carMesh = buildAmbulance();
          vehicleType = 'ambulance';
        } else if (rand < 0.35) {
          // 10% chance for police car
          carMesh = buildPoliceCar();
          vehicleType = 'police';
        } else if (rand < 0.55) {
          // 20% chance for taxi
          carMesh = buildTaxi();
          vehicleType = 'taxi';
        } else {
          // 45% chance for regular cars
          carMesh = buildCar(Math.random() < 0.5 ? 'red' : 'yellow');
          vehicleType = 'car';
        }

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
          direction: lane.dir,
          type: vehicleType,
        });
      });
    }

    // Add obstacles and parked cars for grass lanes (not the first lane)
    if (lane.type === 'grass' && lane.idx > 0) {
      // 70% chance to have obstacles on a grass lane (increased from 40%)
      if (Math.random() < 0.7) {
        const numObstacles = Math.floor(Math.random() * 4) + 2; // 2-5 obstacles per lane (increased from 1-2)

        for (let i = 0; i < numObstacles; i++) {
          const col = Math.floor(Math.random() * COLS);

          // Don't place obstacle in center column if it's a low-index lane
          if (lane.idx < 5 && col === Math.floor(COLS / 2)) {
            continue;
          }

          const obstacleMesh = buildRandomObstacle();
          const x = col - COLS / 2;
          const z = -lane.idx;
          obstacleMesh.position.set(x, 0, z);

          scene.add(obstacleMesh);
          obstaclesRef.current.push({
            mesh: obstacleMesh,
            laneIdx: lane.idx,
            col: col
          });
        }
      }

      // Add parked cars along the edges of sidewalks (35% chance)
      if (Math.random() < 0.35) {
        const numParkedCars = Math.floor(Math.random() * 2) + 1; // 1-2 parked cars

        for (let i = 0; i < numParkedCars; i++) {
          // Randomly select vehicle type (prefer regular cars for parked cars)
          const rand = Math.random();
          let carMesh: THREE.Group;

          if (rand < 0.7) {
            // 70% chance for regular cars
            carMesh = buildCar(Math.random() < 0.5 ? 'red' : 'yellow');
          } else if (rand < 0.85) {
            // 15% chance for taxi
            carMesh = buildTaxi();
          } else {
            // 15% chance for police car
            carMesh = buildPoliceCar();
          }

          // Park on left or right edge
          const parkOnLeft = Math.random() < 0.5;
          const x = parkOnLeft ? -COLS / 2 + 0.8 : COLS / 2 - 0.8;
          const z = -lane.idx;
          carMesh.position.set(x, 0.1, z);

          // Rotate to face along the street
          carMesh.rotation.y = parkOnLeft ? Math.PI / 2 : -Math.PI / 2;

          scene.add(carMesh);
          obstaclesRef.current.push({
            mesh: carMesh,
            laneIdx: lane.idx,
            col: parkOnLeft ? 0 : COLS - 1
          });
        }
      }
    }
  };

  const addBuilding = (scene: THREE.Scene, zPosition: number) => {
    const colors = buildingColorsRef.current;
    const season = environmentRef.current.season;
    const timeOfDay = environmentRef.current.timeOfDay;
    const fogColor = getLightingConfig(environmentRef.current).fogColor;

    // Create multiple layers of buildings for depth
    // OPTIMIZED: Reduced from 4 to 2 layers for better performance
    // Layer 1 (Foreground): Close to street at x = ±5.5
    // Layer 2 (Background): At x = ±11
    const buildingLayers = [
      { distance: 5.5, heightRange: [8, 18], widthRange: [2, 4], depthRange: [2, 4], opacity: 1.0, colorShift: 0 },
      { distance: 11, heightRange: [12, 25], widthRange: [3, 6], depthRange: [3, 7], opacity: 0.8, colorShift: 0.15 },
    ];

    // Create buildings for each layer
    buildingLayers.forEach((layer) => {
      [-1, 1].forEach((side) => {
        const group = new THREE.Group();

        // Varied building dimensions based on layer
        const height = layer.heightRange[0] + Math.random() * (layer.heightRange[1] - layer.heightRange[0]);
        const width = layer.widthRange[0] + Math.random() * (layer.widthRange[1] - layer.widthRange[0]);
        const depth = layer.depthRange[0] + Math.random() * (layer.depthRange[1] - layer.depthRange[0]);

        // Choose random color from palette with atmospheric perspective
        const primaryColor = colors.primary[Math.floor(Math.random() * colors.primary.length)];
        const accentColor = colors.accent[Math.floor(Math.random() * colors.accent.length)];

        // Apply atmospheric perspective (shift colors toward fog color for distant buildings)
        const shiftedPrimaryColor = new THREE.Color(primaryColor).lerp(new THREE.Color(fogColor), layer.colorShift);
        const shiftedAccentColor = new THREE.Color(accentColor).lerp(new THREE.Color(fogColor), layer.colorShift);

        // Main building body
        const mainBuilding = new THREE.Mesh(
          new THREE.BoxGeometry(width, height, depth),
          new THREE.MeshStandardMaterial({
            color: shiftedPrimaryColor,
            roughness: 0.7,
            metalness: 0.1,
            transparent: layer.opacity < 1,
            opacity: layer.opacity
          })
        );
        mainBuilding.position.y = height / 2;
        mainBuilding.castShadow = layer.distance < 10; // Only close buildings cast shadows
        mainBuilding.receiveShadow = true;
        group.add(mainBuilding);

        // Add architectural features randomly
        const buildingStyle = Math.floor(Math.random() * 5); // More style variety

        // Top accent/crown (modern style)
        if (buildingStyle === 0) {
          const crownHeight = height * 0.12;
          const crown = new THREE.Mesh(
            new THREE.BoxGeometry(width + 0.3, crownHeight, depth + 0.3),
            new THREE.MeshStandardMaterial({
              color: shiftedAccentColor,
              roughness: 0.5,
              metalness: 0.2,
              transparent: layer.opacity < 1,
              opacity: layer.opacity
            })
          );
          crown.position.y = height + crownHeight / 2 - 0.1;
          group.add(crown);
        }

        // Stepped/terraced design (classic)
        else if (buildingStyle === 1 && height > 10) {
          const stepHeight = height * 0.25;
          const step = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.75, stepHeight, depth * 0.75),
            new THREE.MeshStandardMaterial({
              color: shiftedAccentColor,
              roughness: 0.7,
              transparent: layer.opacity < 1,
              opacity: layer.opacity
            })
          );
          step.position.y = height + stepHeight / 2;
          group.add(step);

          // Add another smaller step
          const step2 = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.5, stepHeight * 0.5, depth * 0.5),
            new THREE.MeshStandardMaterial({
              color: shiftedPrimaryColor,
              roughness: 0.7,
              transparent: layer.opacity < 1,
              opacity: layer.opacity
            })
          );
          step2.position.y = height + stepHeight + stepHeight * 0.25;
          group.add(step2);
        }

        // Glass tower style (modern)
        else if (buildingStyle === 2) {
          const glassColor = new THREE.Color(0x88ccff).lerp(new THREE.Color(fogColor), layer.colorShift);
          const glassSection = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.95, height * 0.3, depth * 0.95),
            new THREE.MeshStandardMaterial({
              color: glassColor,
              roughness: 0.1,
              metalness: 0.8,
              transparent: true,
              opacity: 0.6 * layer.opacity
            })
          );
          glassSection.position.y = height - (height * 0.15);
          group.add(glassSection);
        }

        // Antenna/spire (tall buildings)
        else if (buildingStyle === 3 && height > 12) {
          const spireColor = new THREE.Color(0x888888).lerp(new THREE.Color(fogColor), layer.colorShift);
          const spire = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.15, height * 0.25, 6),
            new THREE.MeshStandardMaterial({
              color: spireColor,
              metalness: 0.8,
              transparent: layer.opacity < 1,
              opacity: layer.opacity
            })
          );
          spire.position.y = height + (height * 0.125);
          group.add(spire);
        }

        // Art deco style
        else if (buildingStyle === 4 && height > 8) {
          const levels = 3;
          for (let i = 0; i < levels; i++) {
            const levelHeight = height * 0.15;
            const levelWidth = width * (0.9 - i * 0.15);
            const levelDepth = depth * (0.9 - i * 0.15);
            const level = new THREE.Mesh(
              new THREE.BoxGeometry(levelWidth, levelHeight, levelDepth),
              new THREE.MeshStandardMaterial({
                color: i % 2 === 0 ? shiftedAccentColor : shiftedPrimaryColor,
                roughness: 0.6,
                transparent: layer.opacity < 1,
                opacity: layer.opacity
              })
            );
            level.position.y = height + (i * levelHeight) + levelHeight / 2;
            group.add(level);
          }
        }

        // Windows - only add to foreground buildings for performance (OPTIMIZED)
        if (layer.distance <= 6) {
          const floors = Math.min(Math.floor(height / 2.2), 5); // OPTIMIZED: Reduced floors
          const windowsPerFloor = Math.min(Math.floor(width / 1.5), 3); // OPTIMIZED: Fewer windows
          const windowLitProbability = timeOfDay === 'night' || timeOfDay === 'evening' ? 0.8 : 0.3;

          for (let floor = 0; floor < floors; floor++) {
            for (let w = 0; w < windowsPerFloor; w++) {
              const isLit = Math.random() < windowLitProbability;
              const windowColor = isLit ? colors.windowLit : colors.windowDark;
              const emissiveColor = isLit ? colors.windowEmissive : 0x000000;

              // Front face window
              const window1 = new THREE.Mesh(
                new THREE.BoxGeometry(0.35, 0.45, 0.08),
                new THREE.MeshStandardMaterial({
                  color: windowColor,
                  emissive: emissiveColor,
                  emissiveIntensity: isLit ? 0.4 : 0,
                  roughness: 0.3,
                  transparent: layer.opacity < 1,
                  opacity: layer.opacity
                })
              );
              const xOffset = -width / 2 + 0.5 + w * (width / (windowsPerFloor + 0.5));
              const yOffset = 2 + floor * 1.8;
              window1.position.set(xOffset, yOffset, depth / 2 + 0.05);
              group.add(window1);
            }
          }

          // Add storefront on ground floor (foreground buildings only)
          if (layer.distance <= 6 && Math.random() < 0.6) {
            const storefrontHeight = 2.5;
            const storefront = new THREE.Mesh(
              new THREE.BoxGeometry(width * 0.8, storefrontHeight, 0.1),
              new THREE.MeshStandardMaterial({
                color: 0x2a2a2a,
                metalness: 0.6,
                roughness: 0.2,
                transparent: true,
                opacity: 0.7
              })
            );
            storefront.position.set(0, storefrontHeight / 2, depth / 2 + 0.06);
            group.add(storefront);

            // Storefront sign/awning
            if (Math.random() < 0.7) {
              const awning = new THREE.Mesh(
                new THREE.BoxGeometry(width * 0.85, 0.15, 0.4),
                new THREE.MeshStandardMaterial({
                  color: [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3][Math.floor(Math.random() * 4)],
                  roughness: 0.8
                })
              );
              awning.position.set(0, storefrontHeight + 0.1, depth / 2 + 0.3);
              group.add(awning);
            }
          }

          // OPTIMIZED: Reduced fire escape frequency
          if (layer.distance <= 6 && height > 10 && Math.random() < 0.2) {
            const fireEscapeLevels = Math.min(Math.floor(height / 4), 3); // OPTIMIZED: Fewer levels
            for (let i = 0; i < fireEscapeLevels; i++) {
              const platform = new THREE.Mesh(
                new THREE.BoxGeometry(0.8, 0.05, 0.6),
                new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5 })
              );
              platform.position.set(width / 2 + 0.3, 3 + i * 3, 0);
              group.add(platform);
            }
          }
        }

        // Add seasonal decoration on roof (foreground only)
        if (layer.distance <= 6) {
          const decoration = getSeasonalDecoration(season);
          if (decoration && Math.random() < 0.15) {
            const decor = new THREE.Mesh(
              new THREE.BoxGeometry(width, 0.1, depth),
              new THREE.MeshStandardMaterial({
                color: decoration.color,
                roughness: 0.9,
                transparent: layer.opacity < 1,
                opacity: layer.opacity
              })
            );
            decor.position.y = height;
            group.add(decor);
          }
        }

        // OPTIMIZED: Reduced rooftop details (foreground only, fewer items)
        const rooftopDetailCount = layer.distance <= 6 ? Math.floor(Math.random() * 2) : 0;
        for (let i = 0; i < rooftopDetailCount; i++) {
          const detailType = Math.floor(Math.random() * 5);

          // Water tower
          if (detailType === 0) {
            const waterTower = new THREE.Group();
            const tank = new THREE.Mesh(
              new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8),
              new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.4 })
            );
            tank.position.y = height + 0.8;
            waterTower.add(tank);

            const legs = new THREE.Mesh(
              new THREE.BoxGeometry(0.4, 0.5, 0.4),
              new THREE.MeshStandardMaterial({ color: 0x444444 })
            );
            legs.position.y = height + 0.25;
            waterTower.add(legs);

            waterTower.position.set(
              (Math.random() - 0.5) * width * 0.6,
              0,
              (Math.random() - 0.5) * depth * 0.6
            );
            group.add(waterTower);
          }
          // AC unit
          else if (detailType === 1) {
            const acUnit = new THREE.Mesh(
              new THREE.BoxGeometry(0.4, 0.3, 0.5),
              new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.3 })
            );
            acUnit.position.set(
              (Math.random() - 0.5) * width * 0.7,
              height + 0.15,
              (Math.random() - 0.5) * depth * 0.7
            );
            group.add(acUnit);
          }
          // Antenna
          else if (detailType === 2) {
            const antenna = new THREE.Mesh(
              new THREE.CylinderGeometry(0.03, 0.03, 2, 6),
              new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.7 })
            );
            antenna.position.set(
              (Math.random() - 0.5) * width * 0.5,
              height + 1,
              (Math.random() - 0.5) * depth * 0.5
            );
            group.add(antenna);
          }
          // Chimney
          else if (detailType === 3) {
            const chimney = new THREE.Mesh(
              new THREE.BoxGeometry(0.3, 1.2, 0.3),
              new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 })
            );
            chimney.position.set(
              (Math.random() - 0.5) * width * 0.6,
              height + 0.6,
              (Math.random() - 0.5) * depth * 0.6
            );
            group.add(chimney);
          }
          // Satellite dish
          else {
            const dish = new THREE.Mesh(
              new THREE.CylinderGeometry(0.25, 0.1, 0.1, 12),
              new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 })
            );
            dish.rotation.x = Math.PI / 3;
            dish.position.set(
              (Math.random() - 0.5) * width * 0.7,
              height + 0.3,
              (Math.random() - 0.5) * depth * 0.7
            );
            group.add(dish);
          }
        }

        group.position.set(layer.distance * side, 0, zPosition);
        scene.add(group);
        buildingsRef.current.push({ mesh: group, zPosition });
      });
    });
  };

  const generateLanesAhead = (scene: THREE.Scene, playerRow: number) => {
    const lookAhead = 15; // Generate lanes 15 rows ahead
    const targetRow = playerRow + lookAhead;

    // Generate lanes up to target
    while (furthestLaneRef.current < targetRow) {
      furthestLaneRef.current++;
      const lane = createLane(furthestLaneRef.current, score);
      lanesRef.current.push(lane);
      addLaneToScene(lane, scene);
    }
  };

  const generateBuildingsAhead = (scene: THREE.Scene, playerZ: number) => {
    const lookAhead = 60; // Generate buildings 60 units ahead
    const targetZ = playerZ - lookAhead;
    const buildingSpacing = 1.5; // Reduced spacing for denser cityscape (was 3.5)

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

    // Cleanup old obstacles
    obstaclesRef.current = obstaclesRef.current.filter(obstacle => {
      if (obstacle.laneIdx < playerRow - cleanupDistanceLanes) {
        scene.remove(obstacle.mesh);
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

    // Check collision with cars
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

    // Check collision with obstacles
    for (const obstacle of obstaclesRef.current) {
      const obstacleX = obstacle.mesh.position.x;
      const obstacleZ = obstacle.mesh.position.z;

      const distance = Math.sqrt(
        Math.pow(playerX - obstacleX, 2) + Math.pow(playerZ - obstacleZ, 2)
      );

      if (distance < collisionRadius) {
        // Calculate hit direction from obstacle
        const dx = playerX - obstacleX;
        const dz = playerZ - obstacleZ;
        const magnitude = Math.sqrt(dx * dx + dz * dz);
        if (magnitude > 0) {
          hitDirectionRef.current = {
            x: (dx / magnitude) * 1.5,
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
      gameStatsRef.current.jumps++;
    } else if (dir === 'down') {
      if (playerRowRef.current > 0) {
        playerRowRef.current--;
        targetPosRef.current.z = -playerRowRef.current;
        gameStatsRef.current.jumps++;
      }
    } else if (dir === 'left') {
      if (playerColRef.current > 0) {
        playerColRef.current--;
        targetPosRef.current.x = playerColRef.current - COLS / 2;
        gameStatsRef.current.jumps++;
      }
    } else if (dir === 'right') {
      if (playerColRef.current < COLS - 1) {
        playerColRef.current++;
        targetPosRef.current.x = playerColRef.current - COLS / 2;
        gameStatsRef.current.jumps++;
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
    try {
      console.log('VoxelScene: onContextCreate called');
      glRef.current = gl;

      // Get environment and lighting configuration
      const env = environmentRef.current;
      const lighting = getLightingConfig(env);
      console.log('Environment:', getEnvironmentDescription(env));

      console.log('VoxelScene: Creating renderer');
      const renderer = new Renderer({ gl });
      // Use reduced resolution for better performance (0.75x scale)
      const renderWidth = gl.drawingBufferWidth * 0.75;
      const renderHeight = gl.drawingBufferHeight * 0.75;
      renderer.setSize(renderWidth, renderHeight);
      renderer.setClearColor(lighting.skyColor, 1);
      // Disable shadows for better performance
      renderer.shadowMap.enabled = false;
      rendererRef.current = renderer;
      console.log('VoxelScene: Renderer created successfully');

      console.log('VoxelScene: Creating scene');
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(lighting.fogColor, lighting.fogDensity);
      sceneRef.current = scene;
      console.log('VoxelScene: Scene created');

      console.log('VoxelScene: Creating camera');
      const camera = new THREE.PerspectiveCamera(
        60,
        renderWidth / renderHeight, // Use optimized render dimensions
        0.1,
        1000
      );
      // Adjusted camera position to prevent seeing through buildings
      camera.position.set(3, 5, 6);
      camera.lookAt(0, 0, -2);
      cameraRef.current = camera;
      console.log('VoxelScene: Camera created');

      // Dynamic lighting based on environment
      console.log('VoxelScene: Creating lights');
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
      console.log('VoxelScene: Lights created');

      // Generate initial lanes
      console.log('VoxelScene: Generating lanes');
      generateLanesAhead(scene, 0);
      console.log('VoxelScene: Lanes generated');

      // Generate initial buildings
      console.log('VoxelScene: Generating buildings');
      furthestBuildingZRef.current = 5;
      generateBuildingsAhead(scene, 0);
      console.log('VoxelScene: Buildings generated');

      // Player using the detailed model
      console.log('VoxelScene: Creating player');
      const player = buildPlayer();
      const startX = playerColRef.current - COLS / 2;
      const startZ = -playerRowRef.current;
      player.position.set(startX, 0.5, startZ);
      targetPosRef.current = { x: startX, z: startZ };
      scene.add(player);
      playerRef.current = player;
      console.log('VoxelScene: Player created');

      // Add weather particles
      console.log('VoxelScene: Creating weather particles');
      const weatherParticles = createWeatherParticles(
        scene,
        env.weather,
        new THREE.Vector3(startX, 0, startZ)
      );
      weatherParticlesRef.current = weatherParticles;
      console.log('VoxelScene: Weather particles created');

      let lastTime = Date.now();

      const animate = () => {
        try {
          if (!sceneRef.current || !cameraRef.current || !rendererRef.current || !playerRef.current) {
            console.warn('VoxelScene: Missing refs in animate loop');
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

      // Update camera to follow player
      if (!isGettingHitRef.current) {
        // Normal camera follow
        const targetCamZ = playerRef.current.position.z + 6;
        const targetCamX = playerRef.current.position.x + 3;
        const targetCamY = 5;

        cameraRef.current.position.x += (targetCamX - cameraRef.current.position.x) * 0.1;
        cameraRef.current.position.z += (targetCamZ - cameraRef.current.position.z) * 0.1;
        cameraRef.current.position.y += (targetCamY - cameraRef.current.position.y) * 0.1;

        const lookAtX = playerRef.current.position.x;
        const lookAtZ = playerRef.current.position.z - 2;
        cameraRef.current.lookAt(lookAtX, 0.5, lookAtZ);
      } else {
        // Death camera - orbit around the dead player
        const deathCamProgress = Math.min(hitAnimationTimeRef.current / 1.2, 1);

        // Move camera to focus on player
        const targetCamX = playerRef.current.position.x + 2 + Math.cos(deathCamProgress * Math.PI * 0.5) * 2;
        const targetCamZ = playerRef.current.position.z + 3 + Math.sin(deathCamProgress * Math.PI * 0.5) * 2;
        const targetCamY = 3 + deathCamProgress * 1;

        cameraRef.current.position.x += (targetCamX - cameraRef.current.position.x) * 0.15;
        cameraRef.current.position.z += (targetCamZ - cameraRef.current.position.z) * 0.15;
        cameraRef.current.position.y += (targetCamY - cameraRef.current.position.y) * 0.15;

        // Look directly at the player's body
        cameraRef.current.lookAt(
          playerRef.current.position.x,
          playerRef.current.position.y,
          playerRef.current.position.z
        );
      }

      // Update cars and check for near misses
      carsRef.current.forEach(car => {
        car.position += car.direction * car.speed * delta * 3;
        car.mesh.position.x = car.position - COLS / 2;

        // Check for close calls (near misses)
        if (!gameOverRef.current && !isMovingRef.current) {
          const playerX = playerRef.current.position.x;
          const playerZ = playerRef.current.position.z;
          const carX = car.mesh.position.x;
          const carZ = car.mesh.position.z;

          const distance = Math.sqrt(
            Math.pow(playerX - carX, 2) + Math.pow(playerZ - carZ, 2)
          );

          // Close call: distance less than 0.7 but greater than collision radius (0.4)
          if (distance < 0.7 && distance > 0.4) {
            gameStatsRef.current.closeCall = true;
          }

          // Track dodges (vehicle passed by the player)
          const prevPosition = car.position - car.direction * car.speed * delta * 3;
          const playerCol = playerColRef.current;
          const playerXGrid = playerCol - COLS / 2;

          // Check if vehicle just passed the player's position
          if (car.laneIdx === playerRowRef.current) {
            if (
              (car.direction > 0 && prevPosition < playerXGrid && car.position >= playerXGrid) ||
              (car.direction < 0 && prevPosition > playerXGrid && car.position <= playerXGrid)
            ) {
              gameStatsRef.current.dodges++;
              if (car.type === 'bus') gameStatsRef.current.busesDodged++;
              if (car.type === 'police') gameStatsRef.current.policeDodged++;
            }
          }
        }

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

      // Handle violent hit animation with boundary collision
      if (isGettingHitRef.current) {
        hitAnimationTimeRef.current += delta;
        const animTime = hitAnimationTimeRef.current;
        const animDuration = 1.2;

        // Play area boundaries (based on building distance)
        const boundaryLeft = -3.5;
        const boundaryRight = 3.5;

        if (animTime < animDuration) {
          const progress = Math.min(animTime / animDuration, 1);

          // Phase 1: Initial impact (0-0.3s) - violent spin and launch
          if (animTime < 0.3) {
            const impactProgress = animTime / 0.3;

            // Violent spinning in multiple axes
            playerRef.current.rotation.x = impactProgress * Math.PI * 3;
            playerRef.current.rotation.y = impactProgress * Math.PI * 2;
            playerRef.current.rotation.z = impactProgress * Math.PI * 2.5;

            // Launch upward violently
            const launchHeight = Math.sin(impactProgress * Math.PI) * 2.5;
            playerRef.current.position.y = 0.5 + launchHeight;

            // Fly backwards from impact with boundary check
            const newX = playerRef.current.position.x + hitDirectionRef.current.x * delta * 8;

            // Check for building collision and bounce
            if (newX < boundaryLeft) {
              playerRef.current.position.x = boundaryLeft;
              hitDirectionRef.current.x = -hitDirectionRef.current.x * 0.6; // Reverse and reduce
            } else if (newX > boundaryRight) {
              playerRef.current.position.x = boundaryRight;
              hitDirectionRef.current.x = -hitDirectionRef.current.x * 0.6;
            } else {
              playerRef.current.position.x = newX;
            }

            playerRef.current.position.z += hitDirectionRef.current.z * delta * 8;

            // Squash on impact
            const squash = 1 - impactProgress * 0.4;
            playerRef.current.scale.set(1.2, squash, 1.2);
          }
          // Phase 2: Airborne rotation (0.3-0.8s)
          else if (animTime < 0.8) {
            const airProgress = (animTime - 0.3) / 0.5;

            // Continue spinning
            playerRef.current.rotation.x = Math.PI * 3 + airProgress * Math.PI * 2;
            playerRef.current.rotation.y = Math.PI * 2 + airProgress * Math.PI;
            playerRef.current.rotation.z = Math.PI * 2.5 + airProgress * Math.PI * 1.5;

            // Arc trajectory
            const arc = 2.5 * (1 - airProgress);
            playerRef.current.position.y = 0.5 + arc;

            // Continue flying with boundary check
            const newX = playerRef.current.position.x + hitDirectionRef.current.x * delta * (4 - airProgress * 3);

            if (newX < boundaryLeft) {
              playerRef.current.position.x = boundaryLeft;
              hitDirectionRef.current.x = -hitDirectionRef.current.x * 0.5;
            } else if (newX > boundaryRight) {
              playerRef.current.position.x = boundaryRight;
              hitDirectionRef.current.x = -hitDirectionRef.current.x * 0.5;
            } else {
              playerRef.current.position.x = newX;
            }

            playerRef.current.position.z += hitDirectionRef.current.z * delta * (4 - airProgress * 3);
            playerRef.current.scale.set(1, 1, 1);
          }
          // Phase 3: Crash landing (0.8-1.2s)
          else {
            const landProgress = (animTime - 0.8) / 0.4;

            // Final tumbles
            playerRef.current.rotation.x = Math.PI * 5 + landProgress * Math.PI * 0.5;
            playerRef.current.rotation.y = Math.PI * 3 + landProgress * Math.PI * 0.3;
            playerRef.current.rotation.z = Math.PI * 4 + landProgress * Math.PI * 0.4;

            // Hit ground and bounce
            const bounce = Math.max(0, Math.sin(landProgress * Math.PI * 2) * 0.3 * (1 - landProgress));
            playerRef.current.position.y = Math.max(-0.2, bounce - landProgress * 0.5);

            // Slide to stop with boundary check
            const newX = playerRef.current.position.x + hitDirectionRef.current.x * delta * (1 - landProgress);

            if (newX < boundaryLeft) {
              playerRef.current.position.x = boundaryLeft;
            } else if (newX > boundaryRight) {
              playerRef.current.position.x = boundaryRight;
            } else {
              playerRef.current.position.x = newX;
            }

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
            survivalTimeRef.current = (Date.now() - gameStartTimeRef.current) / 1000;
            onGameOver(score, survivalTimeRef.current, gameStatsRef.current);
          }
        }
      }

          rendererRef.current.render(sceneRef.current, cameraRef.current);
          gl.endFrameEXP();
        } catch (animateError) {
          console.error('VoxelScene: Error in animate loop:', animateError);
          // Continue animation loop despite errors
        }
      };

      console.log('VoxelScene: Starting animation loop');
      animate();
      console.log('VoxelScene: Initialization complete');
    } catch (error) {
      console.error('VoxelScene: Error in onContextCreate:', error);
      console.error('VoxelScene: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      // Display error to user
      Alert.alert('Game Error', 'Failed to initialize game: ' + (error instanceof Error ? error.message : String(error)));
    }
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
