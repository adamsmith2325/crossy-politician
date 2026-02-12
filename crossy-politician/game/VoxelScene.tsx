import React, { useEffect, useRef } from 'react';
import { PanResponder, View } from 'react-native';
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
  createWeatherParticles,
  updateWeatherParticles,
  type EnvironmentConfig,
} from './environment';

// ── Isometric Camera Constants ──────────────────────────────────────
const VIEW_SIZE = 16;
const DEG = Math.PI / 180;
const CAM_ELEVATION = 55 * DEG;
const CAM_YAW = 15 * DEG;
const CAM_DISTANCE = 50;
const CAM_LOOK_AHEAD = 3;
const LANE_WIDTH = 26;

const CAM_OFF_X = CAM_DISTANCE * Math.cos(CAM_ELEVATION) * Math.sin(CAM_YAW);
const CAM_OFF_Y = CAM_DISTANCE * Math.sin(CAM_ELEVATION);
const CAM_OFF_Z = CAM_DISTANCE * Math.cos(CAM_ELEVATION) * Math.cos(CAM_YAW);

// ── NYC Urban lane colors ───────────────────────────────────────────
const GRASS_A = 0x3d5a3f; // Muted urban park green (less vibrant)
const GRASS_B = 0x344d36; // Darker muted park green
const ROAD_A = 0x3a3a3a; // NYC asphalt
const ROAD_B = 0x343434; // Slightly darker asphalt
const SIDEWALK_A = 0x8b8680; // Concrete sidewalk
const SIDEWALK_B = 0x757270; // Darker concrete

// ── Interfaces ──────────────────────────────────────────────────────
interface CarObject {
  mesh: THREE.Group;
  laneIdx: number;
  position: number;
  speed: number;
  direction: number;
  type?: 'car' | 'truck' | 'bus' | 'police' | 'taxi' | 'ambulance';
}

interface ObstacleObject {
  mesh: THREE.Group;
  laneIdx: number;
  col: number;
}

interface VoxelSceneProps {
  score: number;
  setScore: (setter: (prev: number) => number) => void;
  onGameOver: (finalScore: number, survivalTime: number, gameStats?: {
    dodges: number; jumps: number; busesDodged: number;
    policeDodged: number; closeCall: boolean;
  }) => void;
  difficultyIndex: number; // 0-100, controls how aggressively difficulty scales
}

// ═════════════════════════════════════════════════════════════════════
export default function VoxelScene({ score, setScore, onGameOver, difficultyIndex }: VoxelSceneProps) {

  // ── Core refs ─────────────────────────────────────────────────────
  const glRef = useRef<any>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const playerRef = useRef<THREE.Group | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);

  // ── Game-state refs ───────────────────────────────────────────────
  const lanesRef = useRef<Lane[]>([]);
  const carsRef = useRef<CarObject[]>([]);
  const obstaclesRef = useRef<ObstacleObject[]>([]);
  const playerRowRef = useRef(0);
  const playerColRef = useRef(Math.floor(COLS / 2));
  const gameOverRef = useRef(false);
  const isMovingRef = useRef(false);
  const targetPosRef = useRef({ x: 0, z: 0 });
  const laneObjectsRef = useRef<Map<number, THREE.Group>>(new Map());
  const animFrameRef = useRef<number | null>(null);

  // ── Animation refs ────────────────────────────────────────────────
  const jumpProgressRef = useRef(0);
  const jumpDirRef = useRef({ x: 0, z: 0 });
  const isHitRef = useRef(false);
  const hitTimeRef = useRef(0);
  const hitDirRef = useRef({ x: 0, z: 0 });
  const smoothLookRef = useRef({ x: 0, z: 0 });
  const deathParticlesRef = useRef<THREE.Points | null>(null);
  const screenShakeRef = useRef({ x: 0, y: 0, intensity: 0 });

  // ── Generation tracking ───────────────────────────────────────────
  const furthestLaneRef = useRef(-1);
  const earliestLaneRef = useRef(1);

  // ── Environment ───────────────────────────────────────────────────
  const envRef = useRef<EnvironmentConfig>(generateRandomEnvironment());
  const weatherRef = useRef<THREE.Points | null>(null);

  // ── Timing & stats ────────────────────────────────────────────────
  const startTimeRef = useRef(Date.now());
  const survivalRef = useRef(0);
  const statsRef = useRef({
    dodges: 0, jumps: 0, busesDodged: 0, policeDodged: 0, closeCall: false,
  });

  // ── Lifecycle ─────────────────────────────────────────────────────
  useEffect(() => {
    initSounds();
    startTimeRef.current = Date.now();
    console.log(`🎮 Game started with difficulty index: ${difficultyIndex}`);
    return () => {
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
      gameOverRef.current = false;
      isMovingRef.current = false;
      isHitRef.current = false;
      playerRowRef.current = 0;
      playerColRef.current = Math.floor(COLS / 2);
      lanesRef.current = [];
      carsRef.current = [];
      obstaclesRef.current = [];
      laneObjectsRef.current.clear();
    };
  }, [difficultyIndex]);

  // ── Swipe Controls ────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, g) => {
        if (gameOverRef.current || isMovingRef.current || isHitRef.current) return;
        const { dx, dy } = g;
        const t = 15;
        if (Math.abs(dx) > t || Math.abs(dy) > t) {
          if (Math.abs(dx) > Math.abs(dy)) hop(dx > 0 ? 'right' : 'left');
          else hop(dy > 0 ? 'down' : 'up');
        }
      },
    })
  ).current;

  // ═══════════════════════════════════════════════════════════════════
  // DIFFICULTY CALCULATION
  // ═══════════════════════════════════════════════════════════════════
  const calculateDifficultyMultipliers = (currentScore: number) => {
    // Calculate which difficulty tier we're in (every 5 moves)
    const tier = Math.floor(currentScore / 5);

    // Base progression rate depends on difficulty index
    // 0 = no progression, 100 = very aggressive progression
    const progressionRate = difficultyIndex / 100;

    return {
      // Speed multiplier for vehicles (increases speed significantly at high difficulty)
      speedMultiplier: 1 + (tier * 0.25 * progressionRate),

      // Probability of road lanes (more roads = harder)
      roadProbabilityIncrease: tier * 0.08 * progressionRate,

      // Car density multiplier (more cars per lane)
      carDensityMultiplier: 1 + (tier * 0.3 * progressionRate),

      // Minimum gap between cars (smaller = harder)
      minGapReduction: tier * 0.2 * progressionRate,

      // Overall difficulty tier (for reference)
      tier,
    };
  };

  // ═══════════════════════════════════════════════════════════════════
  // LANE CREATION (with progressive difficulty)
  // ═══════════════════════════════════════════════════════════════════
  const createLane = (idx: number, currentScore: number): Lane => {
    if (idx === 0) return { idx, type: 'grass', dir: 0, speed: 0, cars: [] };

    // Get difficulty multipliers based on current score and difficulty index
    const diffMultipliers = calculateDifficultyMultipliers(currentScore);

    // Base difficulty increases with score
    const baseDiff = Math.min(1 + currentScore / 40, 3.5);
    // Apply speed multiplier from difficulty system
    const diff = baseDiff * diffMultipliers.speedMultiplier;

    // Road probability increases with difficulty - NYC is mostly roads!
    const baseRoadProb = 0.85 + currentScore / 200; // Start at 85% roads for urban feel
    const roadProb = Math.min(baseRoadProb + diffMultipliers.roadProbabilityIncrease, 0.95); // Cap at 95%

    const type: LaneType = Math.random() < roadProb ? 'road' : 'grass';
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const speed = type === 'road' ? (0.4 + Math.random() * 0.5) * diff : 0;

    const cars: number[] = [];
    if (type === 'road') {
      // More cars per lane as difficulty increases
      const baseMax = Math.floor(1 + currentScore / 25);
      const max = Math.min(
        Math.floor(baseMax * diffMultipliers.carDensityMultiplier),
        6 // Cap at 6 cars per lane
      );
      const num = Math.floor(Math.random() * max) + 1;

      // Smaller gaps between cars as difficulty increases
      const baseGap = MIN_CAR_GAP - currentScore / 80;
      const gap = Math.max(
        baseGap - diffMultipliers.minGapReduction,
        0.8 // Minimum gap to keep it playable
      );

      for (let i = 0; i < num * 3 && cars.length < num; i++) {
        const pos = Math.random() * COLS;
        if (!cars.some(c => Math.abs(c - pos) < gap)) cars.push(pos);
      }
    }
    return { idx, type, dir, speed, cars };
  };

  // ═══════════════════════════════════════════════════════════════════
  // TILE BUILDING – NYC style streets with sidewalks and buildings
  // ═══════════════════════════════════════════════════════════════════
  const buildTile = (type: LaneType, laneIdx: number): THREE.Group => {
    const g = new THREE.Group();
    const even = Math.abs(laneIdx) % 2 === 0;

    if (type === 'grass') {
      // Park/green space
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(LANE_WIDTH, 0.5, 1.02),
        new THREE.MeshStandardMaterial({ color: even ? GRASS_A : GRASS_B })
      );
      base.position.y = -0.25;
      base.receiveShadow = true;
      g.add(base);
    } else {
      // NYC street with sidewalks
      const roadWidth = 14;
      const sidewalkWidth = 6;

      // Main road surface
      const road = new THREE.Mesh(
        new THREE.BoxGeometry(roadWidth, 0.5, 1.02),
        new THREE.MeshStandardMaterial({ color: even ? ROAD_A : ROAD_B })
      );
      road.position.y = -0.28;
      road.receiveShadow = true;
      g.add(road);

      // Sidewalks on both sides
      const leftSidewalk = new THREE.Mesh(
        new THREE.BoxGeometry(sidewalkWidth, 0.48, 1.02),
        new THREE.MeshStandardMaterial({ color: even ? SIDEWALK_A : SIDEWALK_B })
      );
      leftSidewalk.position.set(-(roadWidth / 2 + sidewalkWidth / 2), -0.27, 0);
      leftSidewalk.receiveShadow = true;
      g.add(leftSidewalk);

      const rightSidewalk = new THREE.Mesh(
        new THREE.BoxGeometry(sidewalkWidth, 0.48, 1.02),
        new THREE.MeshStandardMaterial({ color: even ? SIDEWALK_A : SIDEWALK_B })
      );
      rightSidewalk.position.set(roadWidth / 2 + sidewalkWidth / 2, -0.27, 0);
      rightSidewalk.receiveShadow = true;
      g.add(rightSidewalk);

      // Dashed centre line (yellow)
      const dashMat = new THREE.MeshStandardMaterial({ color: 0xf4d756 });
      for (let x = -6; x <= 6; x += 2.4) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.01, 0.06), dashMat);
        d.position.set(x, -0.02, 0);
        g.add(d);
      }

      // Add buildings on sidewalks (randomly)
      if (laneIdx > 2 && Math.random() < 0.6) {
        // Left side building
        const leftBldg = buildNYCBuilding();
        leftBldg.position.set(-11.5, 0, 0);
        g.add(leftBldg);
      }

      if (laneIdx > 2 && Math.random() < 0.6) {
        // Right side building
        const rightBldg = buildNYCBuilding();
        rightBldg.position.set(11.5, 0, 0);
        g.add(rightBldg);
      }
    }
    return g;
  };

  // ═══════════════════════════════════════════════════════════════════
  // NYC BUILDING HELPER
  // ═══════════════════════════════════════════════════════════════════
  const buildNYCBuilding = (): THREE.Group => {
    const g = new THREE.Group();
    const height = 2 + Math.random() * 4;
    const width = 2 + Math.random() * 2;

    // Choose building style
    const isBrick = Math.random() < 0.3;
    const buildingColor = isBrick ? 0xa0522d : (Math.random() < 0.5 ? 0xb8b8b8 : 0x8a8a8a);

    // Main building body
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 0.9),
      new THREE.MeshStandardMaterial({ color: buildingColor })
    );
    building.position.y = height / 2 - 0.2;
    building.castShadow = true;
    building.receiveShadow = true;
    g.add(building);

    // Add windows
    const windowRows = Math.floor(height * 1.5);
    const windowCols = Math.floor(width * 1.5);
    const windowSize = 0.15;
    const windowSpacing = 0.35;

    for (let row = 0; row < windowRows; row++) {
      for (let col = 0; col < windowCols; col++) {
        const isLit = Math.random() < 0.4;
        const windowMat = new THREE.MeshStandardMaterial({
          color: isLit ? 0xffd966 : 0x2a2f3a,
          emissive: isLit ? 0x664400 : 0x000000,
          emissiveIntensity: isLit ? 0.3 : 0,
        });

        const window = new THREE.Mesh(
          new THREE.BoxGeometry(windowSize, windowSize, 0.05),
          windowMat
        );

        const xPos = (col - windowCols / 2 + 0.5) * windowSpacing;
        const yPos = (row - windowRows / 2 + 0.5) * windowSpacing + height / 2 - 0.2;

        window.position.set(xPos, yPos, 0.48);
        g.add(window);
      }
    }

    return g;
  };

  // ═══════════════════════════════════════════════════════════════════
  // SCENE POPULATION
  // ═══════════════════════════════════════════════════════════════════
  const addLaneToScene = (lane: Lane, scene: THREE.Scene) => {
    if (laneObjectsRef.current.has(lane.idx)) return;

    const tile = buildTile(lane.type, lane.idx);
    tile.position.set(0, 0, -lane.idx);
    scene.add(tile);
    laneObjectsRef.current.set(lane.idx, tile);

    // ── Vehicles on road lanes ──
    if (lane.type === 'road' && lane.cars.length > 0) {
      lane.cars.forEach(carPos => {
        const r = Math.random();
        let mesh: THREE.Group;
        let vType: CarObject['type'];
        if (r < 0.05)      { mesh = buildBus();       vType = 'bus'; }
        else if (r < 0.15) { mesh = buildTruck();     vType = 'truck'; }
        else if (r < 0.25) { mesh = buildAmbulance(); vType = 'ambulance'; }
        else if (r < 0.35) { mesh = buildPoliceCar(); vType = 'police'; }
        else if (r < 0.55) { mesh = buildTaxi();      vType = 'taxi'; }
        else { mesh = buildCar(Math.random() < 0.5 ? 'red' : 'yellow'); vType = 'car'; }

        mesh.position.set(carPos - COLS / 2, 0.15, -lane.idx);
        if (lane.dir === -1) mesh.rotation.y = Math.PI;
        scene.add(mesh);
        carsRef.current.push({
          mesh, laneIdx: lane.idx, position: carPos,
          speed: lane.speed, direction: lane.dir, type: vType,
        });
      });
    }

    // ── Obstacles on grass lanes ──
    if (lane.type === 'grass' && lane.idx > 0 && Math.random() < 0.85) {
      const n = Math.floor(Math.random() * 4) + 3;
      for (let i = 0; i < n; i++) {
        const col = Math.floor(Math.random() * COLS);
        if (lane.idx < 5 && col === Math.floor(COLS / 2)) continue;
        const m = buildRandomObstacle();
        m.position.set(col - COLS / 2, 0, -lane.idx);
        scene.add(m);
        obstaclesRef.current.push({ mesh: m, laneIdx: lane.idx, col });
      }
    }

    // ── Parked cars on sidewalks ──
    if (lane.type === 'grass' && lane.idx > 0 && Math.random() < 0.5) {
      const n = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < n; i++) {
        const r = Math.random();
        let m: THREE.Group;
        if (r < 0.7) m = buildCar(Math.random() < 0.5 ? 'red' : 'yellow');
        else if (r < 0.85) m = buildTaxi();
        else m = buildPoliceCar();
        const left = Math.random() < 0.5;
        m.position.set(left ? -COLS / 2 + 0.8 : COLS / 2 - 0.8, 0.1, -lane.idx);
        m.rotation.y = left ? Math.PI / 2 : -Math.PI / 2;
        scene.add(m);
        obstaclesRef.current.push({ mesh: m, laneIdx: lane.idx, col: left ? 0 : COLS - 1 });
      }
    }
  };

  // ── Infinite-scroll generation ──
  const genAhead = (scene: THREE.Scene, row: number) => {
    const target = row + 30;
    while (furthestLaneRef.current < target) {
      furthestLaneRef.current++;
      const lane = createLane(furthestLaneRef.current, score);
      lanesRef.current.push(lane);
      addLaneToScene(lane, scene);
    }
  };
  const genBehind = (scene: THREE.Scene, row: number) => {
    const target = row - 10;
    while (earliestLaneRef.current > target) {
      earliestLaneRef.current--;
      const lane = createLane(earliestLaneRef.current, score);
      lanesRef.current.push(lane);
      addLaneToScene(lane, scene);
    }
  };

  // ── Cleanup off-screen objects ──
  const cleanup = (scene: THREE.Scene, row: number) => {
    const d = 15;
    lanesRef.current = lanesRef.current.filter(l => {
      if (l.idx < row - d) {
        const o = laneObjectsRef.current.get(l.idx);
        if (o) { scene.remove(o); laneObjectsRef.current.delete(l.idx); }
        return false;
      }
      return true;
    });
    carsRef.current = carsRef.current.filter(c => {
      if (c.laneIdx < row - d) { scene.remove(c.mesh); return false; }
      return true;
    });
    obstaclesRef.current = obstaclesRef.current.filter(o => {
      if (o.laneIdx < row - d) { scene.remove(o.mesh); return false; }
      return true;
    });
  };

  // ═══════════════════════════════════════════════════════════════════
  // DEATH PARTICLE EXPLOSION
  // ═══════════════════════════════════════════════════════════════════
  const createDeathExplosion = (scene: THREE.Scene, position: THREE.Vector3) => {
    const particleCount = 150;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities: THREE.Vector3[] = [];
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Start at impact position
      positions[i3] = position.x;
      positions[i3 + 1] = position.y;
      positions[i3 + 2] = position.z;

      // Random velocity in all directions (explosion effect)
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        Math.random() * 12 + 5, // Upward bias
        (Math.random() - 0.5) * 15
      );
      velocities.push(velocity);

      // Random colors: red, yellow, orange (violent impact colors)
      const colorChoice = Math.random();
      if (colorChoice < 0.4) {
        // Red
        colors[i3] = 1.0;
        colors[i3 + 1] = 0.0;
        colors[i3 + 2] = 0.0;
      } else if (colorChoice < 0.7) {
        // Orange
        colors[i3] = 1.0;
        colors[i3 + 1] = 0.5;
        colors[i3 + 2] = 0.0;
      } else {
        // Yellow
        colors[i3] = 1.0;
        colors[i3 + 1] = 1.0;
        colors[i3 + 2] = 0.0;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    (geometry as any).velocities = velocities;

    const material = new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    deathParticlesRef.current = particles;
  };

  // ═══════════════════════════════════════════════════════════════════
  // COLLISION
  // ═══════════════════════════════════════════════════════════════════
  const checkCollision = (): boolean => {
    if (!playerRef.current) return false;
    const px = playerRef.current.position.x;
    const pz = playerRef.current.position.z;
    const R = 0.4;

    for (const car of carsRef.current) {
      const dx = px - car.mesh.position.x;
      const dz = pz - car.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < R) {
        const m = dist || 1;
        hitDirRef.current = { x: (dx / m) * car.direction * 3, z: (dz / m) * 0.5 };
        return true;
      }
    }
    for (const obs of obstaclesRef.current) {
      const dx = px - obs.mesh.position.x;
      const dz = pz - obs.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < R) {
        const m = dist || 1;
        hitDirRef.current = { x: (dx / m) * 1.5, z: (dz / m) * 0.5 };
        return true;
      }
    }
    return false;
  };

  // ═══════════════════════════════════════════════════════════════════
  // HOP
  // ═══════════════════════════════════════════════════════════════════
  const hop = (dir: 'up' | 'down' | 'left' | 'right') => {
    if (gameOverRef.current || isMovingRef.current || isHitRef.current) return;
    const oldX = playerColRef.current - COLS / 2;
    const oldZ = -playerRowRef.current;

    if (dir === 'up') {
      playerRowRef.current++;
      targetPosRef.current.z = -playerRowRef.current;
      const newScore = score + 1;
      setScore(s => s + 1);
      statsRef.current.jumps++;

      // Log difficulty tier changes every 5 moves
      if (newScore > 0 && newScore % 5 === 0) {
        const multipliers = calculateDifficultyMultipliers(newScore);
        console.log(`📈 Difficulty Tier ${multipliers.tier} reached (Score: ${newScore})`);
        console.log(`  Speed: ${(multipliers.speedMultiplier * 100).toFixed(0)}%`);
        console.log(`  Car Density: ${(multipliers.carDensityMultiplier * 100).toFixed(0)}%`);
        console.log(`  Road Probability: +${(multipliers.roadProbabilityIncrease * 100).toFixed(1)}%`);
      }
    } else if (dir === 'down') {
      if (playerRowRef.current <= 0) return;
      playerRowRef.current--;
      targetPosRef.current.z = -playerRowRef.current;
      statsRef.current.jumps++;
    } else if (dir === 'left') {
      playerColRef.current--;
      targetPosRef.current.x = playerColRef.current - COLS / 2;
      statsRef.current.jumps++;
    } else {
      playerColRef.current++;
      targetPosRef.current.x = playerColRef.current - COLS / 2;
      statsRef.current.jumps++;
    }

    jumpDirRef.current = {
      x: targetPosRef.current.x - oldX,
      z: targetPosRef.current.z - oldZ,
    };
    jumpProgressRef.current = 0;
    isMovingRef.current = true;
    play('move');

    if (sceneRef.current) {
      genAhead(sceneRef.current, playerRowRef.current);
      genBehind(sceneRef.current, playerRowRef.current);
      cleanup(sceneRef.current, playerRowRef.current);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // GL CONTEXT CREATION
  // ═══════════════════════════════════════════════════════════════════
  const onContextCreate = async (gl: any) => {
    glRef.current = gl;
    const env = envRef.current;
    const lighting = getLightingConfig(env);
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const aspect = w / h;

    // ── Renderer ──
    const renderer = new Renderer({ gl });
    renderer.setSize(w, h);
    renderer.setClearColor(lighting.skyColor, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    rendererRef.current = renderer;

    // ── Scene ──
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(lighting.fogColor, lighting.fogDensity * 0.6);
    sceneRef.current = scene;

    // ── Orthographic Camera (isometric) ──
    const camera = new THREE.OrthographicCamera(
      -VIEW_SIZE * aspect / 2, VIEW_SIZE * aspect / 2,
      VIEW_SIZE / 2, -VIEW_SIZE / 2,
      0.1, 200
    );
    cameraRef.current = camera;

    // ── Lighting ──
    const hemi = new THREE.HemisphereLight(
      lighting.skyColor, lighting.groundColor, lighting.hemisphereIntensity
    );
    scene.add(hemi);

    const dirLight = new THREE.DirectionalLight(
      lighting.directionalColor, lighting.directionalIntensity
    );
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 80;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    scene.add(dirLight);
    scene.add(dirLight.target);
    dirLightRef.current = dirLight;

    scene.add(new THREE.AmbientLight(lighting.ambientColor, lighting.ambientIntensity));

    // ── World ──
    genAhead(scene, 0);
    genBehind(scene, 0);

    // ── Player ──
    const player = buildPlayer();
    const sx = playerColRef.current - COLS / 2;
    const sz = -playerRowRef.current;
    player.position.set(sx, 0.5, sz);
    targetPosRef.current = { x: sx, z: sz };
    scene.add(player);
    playerRef.current = player;

    // ── Smooth-look init ──
    smoothLookRef.current = { x: sx, z: sz - CAM_LOOK_AHEAD };

    // ── Camera init position ──
    camera.position.set(
      sx + CAM_OFF_X, CAM_OFF_Y, sz - CAM_LOOK_AHEAD + CAM_OFF_Z
    );
    camera.lookAt(sx, 0, sz - CAM_LOOK_AHEAD);

    // ── Dir-light init ──
    dirLight.position.set(sx + 8, 15, sz - CAM_LOOK_AHEAD + 8);
    dirLight.target.position.set(sx, 0, sz - CAM_LOOK_AHEAD);

    // ── Weather ──
    weatherRef.current = createWeatherParticles(
      scene, env.weather, new THREE.Vector3(sx, 0, sz)
    );

    // ═════════════════════════════════════════════════════════════════
    // ANIMATION LOOP
    // ═════════════════════════════════════════════════════════════════
    let lastTime = Date.now();

    const animate = () => {
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current || !playerRef.current) return;
      animFrameRef.current = requestAnimationFrame(animate);

      const now = Date.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const P = playerRef.current;

      // ── Player hop animation ──
      if (isMovingRef.current) {
        jumpProgressRef.current += delta * 8;
        const p = Math.min(jumpProgressRef.current, 1);

        P.position.x = THREE.MathUtils.lerp(P.position.x, targetPosRef.current.x, p);
        P.position.z = THREE.MathUtils.lerp(P.position.z, targetPosRef.current.z, p);

        const arc = Math.sin(p * Math.PI);
        P.position.y = 0.5 + arc * 0.6;

        const tilt = arc * 0.15;
        if (jumpDirRef.current.z !== 0)
          P.rotation.x = tilt * (jumpDirRef.current.z > 0 ? 1 : -1);
        if (jumpDirRef.current.x !== 0)
          P.rotation.z = -tilt * (jumpDirRef.current.x > 0 ? 1 : -1);

        const ss = 1 + arc * 0.1;
        P.scale.set(1 / Math.sqrt(ss), ss, 1 / Math.sqrt(ss));

        if (p >= 1) {
          isMovingRef.current = false;
          jumpProgressRef.current = 0;
          P.rotation.set(0, 0, 0);
          P.scale.set(1, 1, 1);
          P.position.set(targetPosRef.current.x, 0.5, targetPosRef.current.z);
          if (checkCollision() && !gameOverRef.current && !isHitRef.current) {
            isHitRef.current = true;
            hitTimeRef.current = 0;
            play('hit');
            // Create death explosion
            if (sceneRef.current) {
              createDeathExplosion(sceneRef.current, P.position.clone());
            }
            // Trigger screen shake
            screenShakeRef.current.intensity = 1.0;
          }
        }
      }

      // ── Camera follow (smooth isometric) ──
      if (!isHitRef.current) {
        const lx = P.position.x;
        const lz = P.position.z - CAM_LOOK_AHEAD;
        smoothLookRef.current.x += (lx - smoothLookRef.current.x) * 0.08;
        smoothLookRef.current.z += (lz - smoothLookRef.current.z) * 0.08;

        cameraRef.current.position.set(
          smoothLookRef.current.x + CAM_OFF_X + screenShakeRef.current.x,
          CAM_OFF_Y + screenShakeRef.current.y,
          smoothLookRef.current.z + CAM_OFF_Z
        );
        cameraRef.current.lookAt(smoothLookRef.current.x, 0, smoothLookRef.current.z);

        if (dirLightRef.current) {
          dirLightRef.current.position.set(
            smoothLookRef.current.x + 8, 15, smoothLookRef.current.z + 8
          );
          dirLightRef.current.target.position.set(
            smoothLookRef.current.x, 0, smoothLookRef.current.z
          );
        }
      } else {
        // ── Death camera: centre on player, no look-ahead WITH INTENSE SHAKE ──
        const lx = P.position.x;
        const lz = P.position.z;
        smoothLookRef.current.x += (lx - smoothLookRef.current.x) * 0.05;
        smoothLookRef.current.z += (lz - smoothLookRef.current.z) * 0.05;

        cameraRef.current.position.set(
          smoothLookRef.current.x + CAM_OFF_X + screenShakeRef.current.x,
          CAM_OFF_Y + screenShakeRef.current.y,
          smoothLookRef.current.z + CAM_OFF_Z
        );
        cameraRef.current.lookAt(
          smoothLookRef.current.x + screenShakeRef.current.x * 0.5,
          0,
          smoothLookRef.current.z
        );
      }

      // ── Move cars & track stats ──
      carsRef.current.forEach(car => {
        car.position += car.direction * car.speed * delta * 3;
        car.mesh.position.x = car.position - COLS / 2;

        if (!gameOverRef.current && !isMovingRef.current) {
          const dx = P.position.x - car.mesh.position.x;
          const dz = P.position.z - car.mesh.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 0.7 && dist > 0.4) statsRef.current.closeCall = true;

          const prev = car.position - car.direction * car.speed * delta * 3;
          const pxg = playerColRef.current - COLS / 2;
          if (car.laneIdx === playerRowRef.current) {
            if ((car.direction > 0 && prev < pxg && car.position >= pxg) ||
                (car.direction < 0 && prev > pxg && car.position <= pxg)) {
              statsRef.current.dodges++;
              if (car.type === 'bus') statsRef.current.busesDodged++;
              if (car.type === 'police') statsRef.current.policeDodged++;
            }
          }
        }

        // Wrap
        if (car.position > COLS + 2) car.position = -2;
        else if (car.position < -2) car.position = COLS + 2;
      });

      // ── Weather ──
      if (weatherRef.current) {
        updateWeatherParticles(weatherRef.current, envRef.current.weather, delta, P.position.z);
      }

      // ── Continuous collision check ──
      if (!gameOverRef.current && !isMovingRef.current && !isHitRef.current) {
        if (checkCollision()) {
          isHitRef.current = true;
          hitTimeRef.current = 0;
          play('hit');
          // Create death explosion
          if (sceneRef.current) {
            createDeathExplosion(sceneRef.current, P.position.clone());
          }
          // Trigger screen shake
          screenShakeRef.current.intensity = 1.0;
        }
      }

      // ── Death / ragdoll animation (VIOLENT VERSION) ──
      if (isHitRef.current) {
        hitTimeRef.current += delta;
        const t = hitTimeRef.current;
        const dur = 1.5;
        const bL = -3.5, bR = 3.5;

        // Update death particles
        if (deathParticlesRef.current) {
          const particlePositions = deathParticlesRef.current.geometry.attributes.position.array as Float32Array;
          const velocities = (deathParticlesRef.current.geometry as any).velocities as THREE.Vector3[];
          const material = deathParticlesRef.current.material as THREE.PointsMaterial;

          for (let i = 0; i < velocities.length; i++) {
            const i3 = i * 3;
            // Apply gravity and velocity
            velocities[i].y -= 20 * delta; // Gravity
            particlePositions[i3] += velocities[i].x * delta;
            particlePositions[i3 + 1] += velocities[i].y * delta;
            particlePositions[i3 + 2] += velocities[i].z * delta;

            // Fade out over time
            material.opacity = Math.max(0, 1 - t / 1.2);
          }

          deathParticlesRef.current.geometry.attributes.position.needsUpdate = true;

          // Remove particles when faded
          if (t > 1.2 && sceneRef.current) {
            sceneRef.current.remove(deathParticlesRef.current);
            deathParticlesRef.current = null;
          }
        }

        // Screen shake with decay
        if (screenShakeRef.current.intensity > 0) {
          screenShakeRef.current.intensity -= delta * 2.5;
          screenShakeRef.current.x = (Math.random() - 0.5) * screenShakeRef.current.intensity * 0.8;
          screenShakeRef.current.y = (Math.random() - 0.5) * screenShakeRef.current.intensity * 0.8;
        }

        if (t < dur) {
          // Phase 1: VIOLENT Impact (0–0.2s) - Instant brutal hit
          if (t < 0.2) {
            const ip = t / 0.2;
            // Extreme spinning
            P.rotation.x = ip * Math.PI * 8;
            P.rotation.y = ip * Math.PI * 6;
            P.rotation.z = ip * Math.PI * 7;
            // Explosive upward launch
            P.position.y = 0.5 + Math.sin(ip * Math.PI) * 5.5;

            // Faster, more violent sideways motion
            let nx = P.position.x + hitDirRef.current.x * delta * 18;
            if (nx < bL) { nx = bL; hitDirRef.current.x *= -0.8; }
            else if (nx > bR) { nx = bR; hitDirRef.current.x *= -0.8; }
            P.position.x = nx;
            P.position.z += hitDirRef.current.z * delta * 18;

            // Extreme squash on impact
            const sq = 1 - ip * 0.7;
            P.scale.set(1.5, sq, 1.5);
          }
          // Phase 2: Tumbling flight (0.2–0.9s) - Chaotic airborne
          else if (t < 0.9) {
            const ap = (t - 0.2) / 0.7;
            // Uncontrolled tumbling with more rotations
            P.rotation.x = Math.PI * 8 + ap * Math.PI * 12 + Math.sin(ap * Math.PI * 4) * 2;
            P.rotation.y = Math.PI * 6 + ap * Math.PI * 8 + Math.cos(ap * Math.PI * 3) * 2;
            P.rotation.z = Math.PI * 7 + ap * Math.PI * 10 + Math.sin(ap * Math.PI * 5) * 2;

            // High arc trajectory
            P.position.y = 0.5 + 5.5 * (1 - ap * ap); // Parabolic arc

            // Violent horizontal motion with wobble
            let nx = P.position.x + hitDirRef.current.x * delta * (10 - ap * 8);
            nx += Math.sin(t * 30) * 0.3; // Erratic wobble
            if (nx < bL) { nx = bL; hitDirRef.current.x *= -0.7; }
            else if (nx > bR) { nx = bR; hitDirRef.current.x *= -0.7; }
            P.position.x = nx;
            P.position.z += hitDirRef.current.z * delta * (10 - ap * 8);

            // Random scale variations (body flailing)
            const wobble = Math.sin(t * 20) * 0.2;
            P.scale.set(1 + wobble, 1 - wobble * 0.5, 1 + wobble);
          }
          // Phase 3: Brutal Landing (0.9–1.5s) - Hard impact and multiple bounces
          else {
            const lp = (t - 0.9) / 0.6;
            // Slower tumbling as energy dissipates
            P.rotation.x = Math.PI * 20 + lp * Math.PI * 3;
            P.rotation.y = Math.PI * 14 + lp * Math.PI * 2;
            P.rotation.z = Math.PI * 17 + lp * Math.PI * 2.5;

            // Multiple violent bounces
            const bounceCount = 3;
            const bounceProgress = lp * bounceCount;
            const currentBounce = Math.floor(bounceProgress);
            const bouncePhase = bounceProgress - currentBounce;
            const bounceHeight = Math.max(0,
              Math.sin(bouncePhase * Math.PI) * 1.2 * Math.pow(0.4, currentBounce)
            );
            P.position.y = Math.max(-0.3, bounceHeight - lp * 0.6);

            // Sliding motion with friction
            let nx = P.position.x + hitDirRef.current.x * delta * (3 - lp * 2.5);
            if (nx < bL) nx = bL;
            else if (nx > bR) nx = bR;
            P.position.x = nx;
            P.position.z += hitDirRef.current.z * delta * (3 - lp * 2.5);

            // Impact squash on each bounce
            if (bouncePhase < 0.2) {
              const impactSquash = (1 - bouncePhase / 0.2) * 0.5 * Math.pow(0.5, currentBounce);
              P.scale.set(1 + impactSquash, 1 - impactSquash, 1 + impactSquash);
            } else {
              P.scale.set(1, 1, 1);
            }
          }
        } else if (!gameOverRef.current) {
          gameOverRef.current = true;
          survivalRef.current = (Date.now() - startTimeRef.current) / 1000;
          onGameOver(score, survivalRef.current, statsRef.current);
        }
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
      gl.endFrameEXP();
    };

    animate();
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
    </View>
  );
}
