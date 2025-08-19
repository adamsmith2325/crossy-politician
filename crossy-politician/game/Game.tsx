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

// ✅ Modals
import LeaderboardModal from '../ui/LeaderboardModal';
import UsernameModal from '../ui/UsernameModal';

const { width: SCREEN_W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Orientation toggle
// Most setups render row 0 at the BOTTOM (increasing y goes "forward").
// If your build renders row 0 at the TOP instead, flip this to false.
const Y_ZERO_AT_BOTTOM = true;
// ─────────────────────────────────────────────────────────────────────────────

const COLS = 9;
const VISIBLE_ROWS = 14;

type Lane = {
  idx: number;                     // absolute world row
  type: 'grass' | 'road';
  dir: 1 | -1;
  speed: number;                   // tiles/sec
  cars: number[];                  // fractional x positions
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function difficultyForRow(globalRow: number) {
  const t = Math.min(globalRow / 150, 1);
  const roadProb   = clamp(0.45 + 0.40 * t, 0.45, 0.85);
  const speedMin   = 2 + 3.0 * t;         // 2 → 5
  const speedMax   = 3 + 4.0 * t;         // 3 → 7
  const minCarGap  = clamp(2.8 - 1.6 * t, 1.2, 2.8);
  const truckEvery = Math.max(4, 10 - Math.floor(t * 6)); // every N cars: 10 → 4
  return { roadProb, speedMin, speedMax, minCarGap, truckEvery };
}

function genLane(idx: number): Lane {
  const { roadProb, speedMin, speedMax, minCarGap } = difficultyForRow(idx);
  const isEdge = idx <= 1;
  const isRoad = !isEdge && Math.random() < roadProb;
  const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  const speed = isRoad ? (Math.random() * (speedMax - speedMin) + speedMin) : 0;

  const cars: number[] = [];
  if (isRoad) {
    let x = Math.random() * (minCarGap + 1);
    while (x < COLS + 1) {
      cars.push(x);
      x += minCarGap + Math.random() * 3;
    }
  }
  return { idx, type: isRoad ? 'road' : 'grass', dir, speed, cars };
}

function seedLanes(startIdx = 0): Lane[] {
  const arr: Lane[] = [];
  for (let i = 0; i < VISIBLE_ROWS; i++) arr.push(genLane(startIdx + i));

  if (Y_ZERO_AT_BOTTOM) {
    // bottom two safe
    arr[0].type = 'grass'; arr[0].cars = [];
    arr[1].type = 'grass'; arr[1].cars = [];
  } else {
    // top two safe
    arr[VISIBLE_ROWS - 1].type = 'grass'; arr[VISIBLE_ROWS - 1].cars = [];
    arr[VISIBLE_ROWS - 2].type = 'grass'; arr[VISIBLE_ROWS - 2].cars = [];
  }
  return arr;
}

export default function Game() {
  const [rowOffset, setRowOffset] = useState(0);
  const [lanes, setLanes] = useState<Lane[]>(() => seedLanes(0));

  // Start near the bottom or top depending on orientation
  const startY = Y_ZERO_AT_BOTTOM ? 1 : VISIBLE_ROWS - 2;
  const [player, setPlayer] = useState({ x: Math.floor(COLS / 2), y: startY });
  const [alive, setAlive] = useState(true);

  // UI/meta
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [runs, setRuns] = useState(0);
  const [overlay, setOverlay] = useState(true);
  const [username, setUsername] = useState('');
  const [showLB, setShowLB] = useState(false);
  const [showUN, setShowUN] = useState(false);
  const [remoteLB, setRemoteLB] = useState<{ username?: string; score: number; created_at?: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // tick
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRef = useRef<number>(Date.now());

  // bootstrap
  useEffect(() => {
    initSounds();
    (async () => {
      const stored = await AsyncStorage.getItem('ct_username');
      if (stored) setUsername(stored);
      const lb = await loadLeaderboard(); setBest(lb.best);
      setRemoteLB(await fetchTopScores(25));
    })();
    return () => { unloadSounds(); };
  }, []);

  // move cars + collision
  useEffect(() => {
    if (!alive || overlay) return;
    if (timerRef.current) clearInterval(timerRef.current);
    lastRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const dt = Math.min((now - lastRef.current) / 1000, 0.05);
      lastRef.current = now;

      setLanes(prev => prev.map(l => {
        if (l.type !== 'road') return l;
        const moved = l.cars.map(c => c + l.dir * l.speed * dt);
        const wrapped = moved.map(c => (c < -1 ? COLS + c : (c > COLS + 1 ? c - (COLS + 2) : c)));
        return { ...l, cars: wrapped };
      }));

      // collision against current snapshot
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

  // forward/backward mapping (swipe-up is forward)
  const forwardStep = Y_ZERO_AT_BOTTOM ? +1 : -1;
  const backwardStep = -forwardStep;

  // push a new row "ahead" of the player (endless)
  const pushRow = useCallback(() => {
    setLanes(prev => {
      const nextStart = rowOffset + 1;
      if (Y_ZERO_AT_BOTTOM) {
        // bottom -> top: drop bottom, add to top (end)
        const next = prev.slice(1);
        next.push(genLane(nextStart + VISIBLE_ROWS - 1));
        return next;
      } else {
        // top -> bottom: drop bottom (last), add to top (start)
        const next = prev.slice(0, prev.length - 1);
        next.unshift(genLane(nextStart + VISIBLE_ROWS - 1));
        return next;
      }
    });
    setRowOffset(r => r + 1);

    // keep player in view after shifting rows
    setPlayer(p => ({ x: p.x, y: Y_ZERO_AT_BOTTOM ? p.y - 1 : p.y + 1 }));
  }, [rowOffset]);

  // ✅ SWIPE HANDLER: up = forward
  const moveBy = useCallback((dx: number, dy: number) => {
    if (!alive || overlay) return;

    setPlayer(p => {
      let nx = Math.max(0, Math.min(COLS - 1, p.x + dx));

      const deltaY = dy < 0 ? forwardStep : dy > 0 ? backwardStep : 0;
      let ny = Math.max(0, Math.min(VISIBLE_ROWS - 1, p.y + deltaY));

      // score only when moving forward
      if (deltaY === forwardStep && ny !== p.y) {
        setScore(s => s + 1);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        play('move');

        // when near the forward edge, extend world
        const forwardEdgeHit = Y_ZERO_AT_BOTTOM
          ? ny >= Math.floor(VISIBLE_ROWS * 0.66)   // moving upward (higher y) toward top
          : ny <= Math.floor(VISIBLE_ROWS * 0.33);  // moving upward (lower y) toward top
        if (forwardEdgeHit) {
          pushRow();
          ny = ny - forwardStep; // compensate after list shift
        }
      } else if (nx !== p.x) {
        Haptics.selectionAsync();
        play('move');
      }

      return { x: nx, y: ny };
    });
  }, [alive, overlay, forwardStep, pushRow]);

  // end-of-run → show modals and update scores
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
    setPlayer({ x: Math.floor(COLS / 2), y: startY });
    setScore(0);
    setAlive(true);
  }, []);

  // ── Leaderboard helpers (fix Submit flow) ──────────────────────────────────
  const submit = useCallback(async () => {
    if (!username) { setShowUN(true); return; }
    try {
      setSubmitting(true);
      const ok = await submitScore(username, score);
      if (ok) {
        const data = await fetchTopScores(25);
        setRemoteLB(data);
        setShowLB(true); // show the board after submit
      }
    } finally {
      setSubmitting(false);
    }
  }, [username, score]);

  const saveUN = useCallback(async (name: string) => {
    if (!name) { setShowUN(false); return; }
    await AsyncStorage.setItem('ct_username', name);
    setUsername(name);
    setShowUN(false);
    // Immediately submit after saving (this fixes the "second modal didn't work" issue)
    try {
      setSubmitting(true);
      const ok = await submitScore(name, score);
      if (ok) {
        const data = await fetchTopScores(25);
        setRemoteLB(data);
        setShowLB(true);
      }
    } finally {
      setSubmitting(false);
    }
  }, [score]);

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#0b1220', paddingTop: 8 }}>
      {/* header */}
      <View style={{ width: SCREEN_W, paddingHorizontal: 16, paddingVertical: 8,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Crossy Politician</Text>
        <Text style={{ color: '#9fd5ff', fontSize: 16 }}>
          Score: {score}  •  Best: {best}
        </Text>
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
                onPress={submit}
                disabled={submitting}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#17324f' : '#0e2942',
                  opacity: submitting ? 0.6 : 1,
                  paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2d4f79', marginBottom: 10
                })}
              >
                <Text style={{ color: '#9fd5ff', textAlign: 'center', fontWeight: '700' }}>
                  {username ? `Submit Score as ${username}` : 'Submit Score (set username)'}
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

      {/* Modals */}
      <LeaderboardModal
        visible={showLB}
        onClose={() => setShowLB(false)}
        title="Top Scores"
        items={remoteLB}
      />

      <UsernameModal
        visible={showUN}
        initial={username}
        onSave={saveUN}          // ← saving username now immediately submits
        onCancel={() => setShowUN(false)}
      />
    </View>
  );
}
