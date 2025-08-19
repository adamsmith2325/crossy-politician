// src/game/Game.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import VoxelScene from './VoxelScene';
import { initSounds, play, unloadSounds } from '../sound/soundManager';
import { showInterstitialIfEligible } from '../ads/adManager';
import { addScore, loadLeaderboard } from '../utils/leaderboard';
import { submitScore, fetchTopScores } from '../utils/remoteLeaderboard';

// ✅ bring back the modals
import LeaderboardModal from '../ui/LeaderboardModal';
import UsernameModal from '../ui/UsernameModal';

const { width: SCREEN_W } = Dimensions.get('window');

// ---- base tuning ----
const COLS = 9;
const VISIBLE_ROWS = 14;

// ---- types ----
type Lane = {
  idx: number;                     // absolute world row
  type: 'grass' | 'road';
  dir: 1 | -1;
  speed: number;                   // tiles/sec
  cars: number[];                  // x positions (fractional)
};

// ---- helpers ----
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Difficulty curve based on how far you've progressed (global row index).
 * t grows with distance; we cap the effect so it doesn’t become impossible.
 */
function difficultyForRow(globalRow: number) {
  const t = Math.min(globalRow / 150, 1); // 0 → 1 over ~150 rows
  const roadProb   = clamp(0.45 + 0.40 * t, 0.45, 0.85);
  const speedMin   = 2 + 3.0 * t;       // 2 → 5
  const speedMax   = 3 + 4.0 * t;       // 3 → 7
  const minCarGap  = clamp(2.8 - 1.6 * t, 1.2, 2.8); // 2.8 → 1.2
  const truckEvery = Math.max(4, 10 - Math.floor(t * 6)); // 10 → 4
  return { roadProb, speedMin, speedMax, minCarGap, truckEvery };
}

// Generate one lane using difficulty for the given global row index.
function genLane(idx: number): Lane {
  const { roadProb, speedMin, speedMax, minCarGap } = difficultyForRow(idx);
  const isEdge = idx <= 1; // keep the first couple rows safe
  const isRoad = !isEdge && Math.random() < roadProb;
  const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  const speed = isRoad ? (Math.random() * (speedMax - speedMin) + speedMin) : 0;

  const cars: number[] = [];
  if (isRoad) {
    // Seed cars with a minimum spacing that gets tighter as you progress
    let x = Math.random() * (minCarGap + 1);
    while (x < COLS + 1) {
      cars.push(x);
      x += minCarGap + Math.random() * 3;
    }
  }

  return { idx, type: isRoad ? 'road' : 'grass', dir, speed, cars };
}

function seedLanes(startIdx = 0): Lane[] {
  const lanes: Lane[] = [];
  for (let i = 0; i < VISIBLE_ROWS; i++) lanes.push(genLane(startIdx + i));
  lanes[0].type = 'grass'; lanes[0].cars = [];
  lanes[1].type = 'grass'; lanes[1].cars = [];
  return lanes;
}

export default function Game() {
  // infinite world
  const [rowOffset, setRowOffset] = useState(0);
  const [lanes, setLanes] = useState<Lane[]>(() => seedLanes(0));
  const [player, setPlayer] = useState({ x: Math.floor(COLS / 2), y: 1 }); // visible at start (near/bottom)
  const [alive, setAlive] = useState(true);

  // meta / UI
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [runs, setRuns] = useState(0);
  const [overlay, setOverlay] = useState(true);
  const [username, setUsername] = useState('');
  const [showLB, setShowLB] = useState(false);
  const [showUN, setShowUN] = useState(false);
  const [remoteLB, setRemoteLB] = useState<{ username?: string; score: number; created_at?: string }[]>([]);

  // tick
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRef = useRef<number>(Date.now());

  // bootstrap
  useEffect(() => {
    initSounds();
    (async () => {
      const stored = await AsyncStorage.getItem('ct_username'); if (stored) setUsername(stored);
      const lb = await loadLeaderboard(); setBest(lb.best);
      setRemoteLB(await fetchTopScores(25));
    })();
    return () => { unloadSounds(); };
  }, []);

  // cars movement + collision
  useEffect(() => {
    if (!alive || overlay) return;
    if (timerRef.current) clearInterval(timerRef.current);
    lastRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const dt = Math.min((now - lastRef.current) / 1000, 0.05);
      lastRef.current = now;

      // Move cars using each lane's speed/direction
      setLanes(prev => prev.map(l => {
        if (l.type !== 'road') return l;
        const moved = l.cars.map(c => c + l.dir * l.speed * dt);
        const wrapped = moved.map(c => (c < -1 ? COLS + c : (c > COLS + 1 ? c - (COLS + 2) : c)));
        return { ...l, cars: wrapped };
      }));

      // Collision check against current snapshot
      setAlive(prevAlive => {
        if (!prevAlive) return prevAlive;
        const lane = lanes[player.y];
        if (lane?.type === 'road') {
          const hit = lane.cars.some(c => Math.abs(c - player.x) < 0.6);
          if (hit) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            play('hit');
            return false;
          }
        }
        return true;
      });
    }, 16);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [alive, overlay, lanes, player.x, player.y]);

  // Endless scroll when near the top of the window
  const pushRow = useCallback(() => {
    setLanes(prev => {
      const nextStart = rowOffset + 1;
      const next = prev.slice(1);
      next.push(genLane(nextStart + VISIBLE_ROWS - 1));
      return next;
    });
    setRowOffset(r => r + 1);
    setPlayer(p => ({ x: p.x, y: p.y - 1 }));
  }, [rowOffset]);

  // ✅ input: Forward is SWIPE UP (dy < 0)
  const moveBy = useCallback((dx: number, dy: number) => {
    if (!alive || overlay) return;

    setPlayer(p => {
      // lateral clamp
      let nx = Math.max(0, Math.min(COLS - 1, p.x + dx));
      // translate dy screen gesture to world forward/back:
      // dy < 0 => forward (increase y), dy > 0 => backward (decrease y)
      const deltaY = dy < 0 ? 1 : dy > 0 ? -1 : 0;
      let ny = Math.max(0, Math.min(VISIBLE_ROWS - 1, p.y + deltaY));

      // Only score when moving forward (dy < 0)
      if (deltaY === 1 && ny !== p.y) {
        setScore(s => s + 1);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        play('move');

        // When near top third, push a new row and keep the player in view
        if (ny >= Math.floor(VISIBLE_ROWS * 0.66)) {
          pushRow();
          ny = ny - 1; // compensate after pop
        }
      } else if (nx !== p.x) {
        Haptics.selectionAsync();
        play('move');
      }

      return { x: nx, y: ny };
    });
  }, [alive, overlay, pushRow]);

  // end-of-run handling
  useEffect(() => {
    if (!alive) {
      setRuns(r => r + 1);
      (async () => {
        const lb = await addScore(score);
        setBest(lb.best);
        setOverlay(true);
        setShowLB(true);
        setRemoteLB(await fetchTopScores(25));
      })();
    }
  }, [alive]);

  useEffect(() => { if (overlay && runs > 0) showInterstitialIfEligible(runs); }, [overlay, runs]);

  const resetRun = useCallback(() => {
    setRowOffset(0);
    setLanes(seedLanes(0));
    setPlayer({ x: Math.floor(COLS / 2), y: 1 }); // start near/bottom
    setScore(0);
    setAlive(true);
  }, []);

  // leaderboard helpers
  const submit = useCallback(async () => {
    if (!username) { setShowUN(true); return; }
    const ok = await submitScore(username, score);
    if (ok) setRemoteLB(await fetchTopScores(25));
  }, [username, score]);

  const saveUN = useCallback(async (name: string) => {
    if (!name) { setShowUN(false); return; }
    await AsyncStorage.setItem('ct_username', name);
    setUsername(name); setShowUN(false);
    const ok = await submitScore(name, score);
    if (ok) setRemoteLB(await fetchTopScores(25));
  }, [score]);

  // ---- render ----
  return (
    <View style={{ flex: 1, backgroundColor: '#0b1220', paddingTop: 8 }}>
      {/* header */}
      <View style={{ width: SCREEN_W, paddingHorizontal: 16, paddingVertical: 8,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Crossy Politician</Text>
        <Text style={{ color: '#9fd5ff', fontSize: 16 }}>Score: {score}  •  Best: {best}</Text>
      </View>

      {/* scene */}
      <View style={{ flex: 1 }}>
        <VoxelScene
          cols={COLS}
          visibleRows={VISIBLE_ROWS}
          lanes={lanes.map(l => {
            const { truckEvery } = difficultyForRow(l.idx);
            return {
              type: l.type,
              cars: l.cars.map((x, i) => ({
                x,
                // truck frequency ramps with difficulty
                kind: (i % truckEvery === 0
                        ? 'truck'
                        : ((l.idx + i) % 2 ? 'red' : 'yellow')) as 'truck' | 'red' | 'yellow'
              }))
            };
          })}
          player={player}
          rowOffset={rowOffset}
          onSwipe={moveBy}
        />
      </View>

      {/* overlay */}
      {overlay && (
        <View style={{
          position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center'
        }}>
          <View style={{
            backgroundColor: '#0f2033', padding: 20, borderRadius: 12, width: SCREEN_W * 0.88,
            borderWidth: 1, borderColor: '#2d4f79'
          }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>
              {runs === 0 ? 'Crossy Politician' : (alive ? 'Paused' : 'Game Over')}
            </Text>
            {runs > 0 && (
              <Text style={{ color: '#9fd5ff', textAlign: 'center', marginBottom: 16 }}>
                Runs: {runs} • Last Score: {score} • Best: {best}
              </Text>
            )}

            <Pressable
              onPress={() => { setOverlay(false); setShowLB(false); play('click'); resetRun(); }}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#1c3350' : '#11263c',
                paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: '#2d4f79', marginBottom: 10
              })}
            >
              <Text style={{ color: '#9fd5ff', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>
                {runs === 0 ? 'Start' : 'Play Again'}
              </Text>
            </Pressable>

            {runs > 0 && (
              <Pressable
                onPress={() => {
                  if (!username) { setShowUN(true); return; } // open username modal if missing
                  submit();
                }}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#17324f' : '#0e2942',
                  paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2d4f79', marginBottom: 10
                })}
              >
                <Text style={{ color: '#9fd5ff', textAlign: 'center', fontWeight: '700' }}>
                  Submit Score {username ? `as ${username}` : '(set username)'}
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => setShowLB(true)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#17324f' : '#0e2942',
                paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2d4f79'
              })}
            >
              <Text style={{ color: '#9fd5ff', textAlign: 'center', fontWeight: '700' }}>
                View Leaderboard
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ✅ Modals restored */}
      <LeaderboardModal
        visible={showLB}
        onClose={() => setShowLB(false)}
        title="Top Scores"
        items={remoteLB}
      />

      <UsernameModal
        visible={showUN}
        initial={username}
        onSave={saveUN}
        onCancel={() => setShowUN(false)}
      />
    </View>
  );
}