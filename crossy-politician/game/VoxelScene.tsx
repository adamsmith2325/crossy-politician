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

// ── Crossy Road lane colours ────────────────────────────────────────
const GRASS_A = 0x7dd956;
const GRASS_B = 0x68c73d;
const ROAD_A = 0x3c424a;
const ROAD_B = 0x353b43;

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
}

// ═════════════════════════════════════════════════════════════════════
export default function VoxelScene({ score, setScore, onGameOver }: VoxelSceneProps) {

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
  }, []);

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
  // LANE CREATION
  // ═══════════════════════════════════════════════════════════════════
  const createLane = (idx: number, currentScore: number): Lane => {
    if (idx === 0) return { idx, type: 'grass', dir: 0, speed: 0, cars: [] };

    const diff = Math.min(1 + currentScore / 40, 3.5);
    const roadProb = Math.min(0.65 + currentScore / 200, 0.75);
    const type: LaneType = Math.random() < roadProb ? 'road' : 'grass';
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const speed = type === 'road' ? (0.4 + Math.random() * 0.5) * diff : 0;

    const cars: number[] = [];
    if (type === 'road') {
      const max = Math.min(Math.floor(1 + currentScore / 25), 4);
      const num = Math.floor(Math.random() * max) + 1;
      for (let i = 0; i < num * 3 && cars.length < num; i++) {
        const pos = Math.random() * COLS;
        const gap = Math.max(MIN_CAR_GAP - currentScore / 80, 1.3);
        if (!cars.some(c => Math.abs(c - pos) < gap)) cars.push(pos);
      }
    }
    return { idx, type, dir, speed, cars };
  };

  // ═══════════════════════════════════════════════════════════════════
  // TILE BUILDING – Crossy Road style chunky coloured strips
  // ═══════════════════════════════════════════════════════════════════
  const buildTile = (type: LaneType, laneIdx: number): THREE.Group => {
    const g = new THREE.Group();
    const even = Math.abs(laneIdx) % 2 === 0;

    if (type === 'grass') {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(LANE_WIDTH, 0.5, 1.02),
        new THREE.MeshStandardMaterial({ color: even ? GRASS_A : GRASS_B })
      );
      base.position.y = -0.25;
      base.receiveShadow = true;
      g.add(base);
    } else {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(LANE_WIDTH, 0.5, 1.02),
        new THREE.MeshStandardMaterial({ color: even ? ROAD_A : ROAD_B })
      );
      base.position.y = -0.28;
      base.receiveShadow = true;
      g.add(base);

      // Dashed centre line
      const dashMat = new THREE.MeshStandardMaterial({ color: 0xf4d756 });
      for (let x = -10; x <= 10; x += 2.4) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.01, 0.06), dashMat);
        d.position.set(x, -0.02, 0);
        g.add(d);
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
      setScore(s => s + 1);
      statsRef.current.jumps++;
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
          smoothLookRef.current.x + CAM_OFF_X,
          CAM_OFF_Y,
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
        // ── Death camera: centre on player, no look-ahead ──
        const lx = P.position.x;
        const lz = P.position.z;
        smoothLookRef.current.x += (lx - smoothLookRef.current.x) * 0.05;
        smoothLookRef.current.z += (lz - smoothLookRef.current.z) * 0.05;

        cameraRef.current.position.set(
          smoothLookRef.current.x + CAM_OFF_X,
          CAM_OFF_Y,
          smoothLookRef.current.z + CAM_OFF_Z
        );
        cameraRef.current.lookAt(smoothLookRef.current.x, 0, smoothLookRef.current.z);
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
        }
      }

      // ── Death / ragdoll animation ──
      if (isHitRef.current) {
        hitTimeRef.current += delta;
        const t = hitTimeRef.current;
        const dur = 1.2;
        const bL = -3.5, bR = 3.5;

        if (t < dur) {
          // Phase 1: Impact (0–0.3s)
          if (t < 0.3) {
            const ip = t / 0.3;
            P.rotation.x = ip * Math.PI * 3;
            P.rotation.y = ip * Math.PI * 2;
            P.rotation.z = ip * Math.PI * 2.5;
            P.position.y = 0.5 + Math.sin(ip * Math.PI) * 2.5;

            let nx = P.position.x + hitDirRef.current.x * delta * 8;
            if (nx < bL) { nx = bL; hitDirRef.current.x *= -0.6; }
            else if (nx > bR) { nx = bR; hitDirRef.current.x *= -0.6; }
            P.position.x = nx;
            P.position.z += hitDirRef.current.z * delta * 8;

            const sq = 1 - ip * 0.4;
            P.scale.set(1.2, sq, 1.2);
          }
          // Phase 2: Airborne (0.3–0.8s)
          else if (t < 0.8) {
            const ap = (t - 0.3) / 0.5;
            P.rotation.x = Math.PI * 3 + ap * Math.PI * 2;
            P.rotation.y = Math.PI * 2 + ap * Math.PI;
            P.rotation.z = Math.PI * 2.5 + ap * Math.PI * 1.5;
            P.position.y = 0.5 + 2.5 * (1 - ap);

            let nx = P.position.x + hitDirRef.current.x * delta * (4 - ap * 3);
            if (nx < bL) { nx = bL; hitDirRef.current.x *= -0.5; }
            else if (nx > bR) { nx = bR; hitDirRef.current.x *= -0.5; }
            P.position.x = nx;
            P.position.z += hitDirRef.current.z * delta * (4 - ap * 3);
            P.scale.set(1, 1, 1);
          }
          // Phase 3: Landing (0.8–1.2s)
          else {
            const lp = (t - 0.8) / 0.4;
            P.rotation.x = Math.PI * 5 + lp * Math.PI * 0.5;
            P.rotation.y = Math.PI * 3 + lp * Math.PI * 0.3;
            P.rotation.z = Math.PI * 4 + lp * Math.PI * 0.4;

            const bounce = Math.max(0, Math.sin(lp * Math.PI * 2) * 0.3 * (1 - lp));
            P.position.y = Math.max(-0.2, bounce - lp * 0.5);

            let nx = P.position.x + hitDirRef.current.x * delta * (1 - lp);
            if (nx < bL) nx = bL;
            else if (nx > bR) nx = bR;
            P.position.x = nx;
            P.position.z += hitDirRef.current.z * delta * (1 - lp);

            if (lp < 0.5) {
              const s = Math.sin(lp * Math.PI * 2) * 0.3;
              P.scale.set(1 + s, 1 - s, 1 + s);
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
