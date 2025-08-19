// src/game/Game.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import VoxelScene from '../game/VoxelScene';
import { initSounds, play, unloadSounds } from '../sound/soundManager';
import { showInterstitialIfEligible } from '../ads/adManager';
import { addScore, loadLeaderboard } from '../utils/leaderboard';
import { submitScore, fetchTopScores } from '../utils/remoteLeaderboard';

import LeaderboardModal from '../ui/LeaderboardModal';
import UsernameModal from '../ui/UsernameModal';

// ---- Game tuning ----
const COLS = 9;
const ROWS = 14;
const ROAD_PROBABILITY = 0.6;
const MIN_CAR_GAP = 2;

// ---- Types ----
type Lane = {
  idx: number;
  type: 'grass' | 'road';
  dir: 1 | -1;
  speed: number;       // tiles per second
  cars: number[];      // car X positions (in tile space, fractional)
};

// ---- Helpers ----
const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

function generateLane(idx: number): Lane {
  const isRoad =
    Math.random() < ROAD_PROBABILITY && idx !== 0 && idx !== ROWS - 1;
  const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  const speed = isRoad ? randomInt(2, 4) : 0;
  const cars: number[] = [];

  if (isRoad) {
    // seed a few cars with some minimal spacing
    let x = Math.random() * (MIN_CAR_GAP + 1);
    while (x < COLS) {
      cars.push(x);
      x += MIN_CAR_GAP + Math.random() * 3;
    }
  }

  return { idx, type: isRoad ? 'road' : 'grass', dir, speed, cars };
}

function regenerateLanes(): Lane[] {
  const lanes: Lane[] = [];
  for (let i = 0; i < ROWS; i++) lanes.push(generateLane(i));
  lanes[0].type = 'grass'; lanes[0].cars = [];
  lanes[ROWS - 1].type = 'grass'; lanes[ROWS - 1].cars = [];
  return lanes;
}

export default function Game() {
  const [lanes, setLanes] = useState<Lane[]>(() => regenerateLanes());
  const [player, setPlayer] = useState({ x: Math.floor(COLS / 2), y: 0 });
  const [alive, setAlive] = useState(true);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [runCount, setRunCount] = useState(0);

  // overlay + leaderboard UI
  const [showOverlay, setShowOverlay] = useState(true);
  const [showLB, setShowLB] = useState(false);
  const [username, setUsername] = useState<string>('');
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [lbItemsRemote, setLbItemsRemote] = useState<
    { username?: string; score: number; created_at?: string }[]
  >([]);

  const rafRef = useRef<number | null>(null);
  const lastTick = useRef<number>(Date.now());

  // ----- bootstrap -----
  useEffect(() => {
    (async () => {
      // username
      try {
        const stored = await AsyncStorage.getItem('ct_username');
        if (stored) setUsername(stored);
      } catch {}
      // local best
      const lb = await loadLeaderboard();
      setBest(lb.best);
      // remote board
      try {
        const top = await fetchTopScores(25);
        setLbItemsRemote(top);
      } catch (e) {
        console.warn('fetchTopScores error', e);
      }
    })();
  }, []);

  // sounds
  useEffect(() => {
    initSounds();
    return () => { unloadSounds(); };
  }, []);

  // ----- main loop (cars movement & collision) -----
  useEffect(() => {
    if (!alive || showOverlay) return;

    const tick = () => {
      const now = Date.now();
      const dt = Math.min((now - lastTick.current) / 1000, 0.05);
      lastTick.current = now;

      // move cars
      setLanes(prev =>
        prev.map(l => {
          if (l.type !== 'road' || l.speed <= 0) return l;
          const moved = l.cars.map(c => c + l.dir * l.speed * dt);
          const wrapped = moved.map(c =>
            c < -1 ? COLS + c : (c > COLS + 1 ? c - (COLS + 2) : c)
          );
          return { ...l, cars: wrapped };
        })
      );

      // collision test (lane under player)
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

      rafRef.current = requestAnimationFrame(tick);
    };

    lastTick.current = Date.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [alive, showOverlay, lanes, player.x, player.y]);

  // win condition (reach last row)
  useEffect(() => {
    if (player.y >= ROWS - 1 && alive) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      play('win');
      setAlive(false);
    }
  }, [player.y, alive]);

  // when a run ends
  useEffect(() => {
    if (!alive) {
      setRunCount(rc => rc + 1);
      (async () => {
        const lb = await addScore(score);
        setBest(lb.best);
        setShowOverlay(true);
        setShowLB(true);
        try {
          const top = await fetchTopScores(25);
          setLbItemsRemote(top);
        } catch {}
      })();
    }
  }, [alive, score]);

  // show interstitial after every 3 runs (and when overlay is visible)
  useEffect(() => {
    if (showOverlay && runCount > 0) {
      (async () => { await showInterstitialIfEligible(runCount); })();
    }
  }, [showOverlay, runCount]);

  // ----- input (swipe) -> moveBy -----
  const moveBy = (dx: number, dy: number) => {
    if (!alive || showOverlay) return;

    setPlayer(p => {
      const nx = Math.max(0, Math.min(COLS - 1, p.x + dx));
      const ny = Math.max(0, Math.min(ROWS - 1, p.y + dy));
      // forward progress increases score; give haptic + sound
      if (ny !== p.y && dy > 0) {
        setScore(s => s + 1);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        play('move');
      } else if (nx !== p.x) {
        Haptics.selectionAsync();
        play('move');
      }
      return { x: nx, y: ny };
    });
  };

  const resetRun = () => {
    setLanes(regenerateLanes());
    setPlayer({ x: Math.floor(COLS / 2), y: 0 });
    setScore(0);
    setAlive(true);
  };

  const handleSubmitScore = async () => {
    if (!username) { setShowUsernameModal(true); return; }
    const ok = await submitScore(username, score);
    if (ok) setLbItemsRemote(await fetchTopScores(25));
  };

  const handleSaveUsername = async (name: string) => {
    if (!name) { setShowUsernameModal(false); return; }
    await AsyncStorage.setItem('ct_username', name);
    setUsername(name);
    setShowUsernameModal(false);
    const ok = await submitScore(name, score);
    if (ok) setLbItemsRemote(await fetchTopScores(25));
  };

  // ---- UI ----
  const { width: SCREEN_W } = Dimensions.get('window');

  return (
    <View style={{ flex: 1, backgroundColor: '#0b1220' }}>
      {/* header */}
      <View
        style={{
          width: SCREEN_W,
          paddingHorizontal: 16,
          paddingVertical: 8,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
          Crossy Politician
        </Text>
        <Text style={{ color: '#9fd5ff', fontSize: 16 }}>
          Score: {score}  •  Best: {best}
        </Text>
      </View>

      {/* 3D scene (expo-three + expo-gl) */}
      <View style={{ flex: 1 }}>
        <VoxelScene
          cols={COLS}
          rows={ROWS}
          lanes={lanes.map((l) => ({
            type: l.type,
            cars: (l.cars || []).map((x, i) => ({
              x,
              // simple variety for visuals only
              kind: ((i % 6) === 0 ? 'truck' : (i % 2 ? 'red' : 'yellow')) as
                | 'red'
                | 'yellow'
                | 'truck',
            })),
          }))}
          player={player}
          onSwipe={(dx: number, dy: number) => moveBy(dx, dy)}
        />
      </View>

      {/* overlay */}
      {showOverlay && (
        <View
          style={{
            position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: '#0f2033',
              padding: 20,
              borderRadius: 12,
              width: SCREEN_W * 0.88,
              borderWidth: 1,
              borderColor: '#2d4f79',
            }}
          >
            <Text
              style={{
                color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8,
              }}
            >
              {runCount === 0 ? 'Crossy Politician' : (alive ? 'You Win!' : 'Game Over')}
            </Text>

            {runCount > 0 && (
              <Text style={{ color: '#9fd5ff', textAlign: 'center', marginBottom: 16 }}>
                Runs: {runCount} • Last Score: {score} • Best: {best}
              </Text>
            )}

            <Pressable
              onPress={() => { setShowOverlay(false); setShowLB(false); play('click'); resetRun(); }}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#1c3350' : '#11263c',
                paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: '#2d4f79', marginBottom: 10,
              })}
            >
              <Text style={{ color: '#9fd5ff', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>
                {runCount === 0 ? 'Start' : 'Play Again'}
              </Text>
            </Pressable>

            {runCount > 0 && (
              <Pressable
                onPress={handleSubmitScore}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#17324f' : '#0e2942',
                  paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2d4f79', marginBottom: 10,
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
                paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2d4f79',
              })}
            >
              <Text style={{ color: '#9fd5ff', textAlign: 'center', fontWeight: '700' }}>
                View Leaderboard
              </Text>
            </Pressable>

            <Text style={{ color: '#6faee0', fontSize: 12, textAlign: 'center', marginTop: 10 }}>
              Swipe anywhere to move. Interstitial after every 3 runs. App‑Open ad on launch.
            </Text>
          </View>
        </View>
      )}

      {/* Modals */}
      <LeaderboardModal
        visible={showLB}
        onClose={() => setShowLB(false)}
        title="Top Scores"
        items={lbItemsRemote}
        footer={
          <Pressable
            onPress={() => setShowUsernameModal(true)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#1c3350' : '#11263c',
              paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2d4f79',
            })}
          >
            <Text style={{ color: '#9fd5ff', textAlign: 'center', fontWeight: '700' }}>
              {username ? `Change Username (${username})` : 'Set Username'}
            </Text>
          </Pressable>
        }
      />

      <UsernameModal
        visible={showUsernameModal}
        initial={username}
        onSave={handleSaveUsername}
        onCancel={() => setShowUsernameModal(false)}
      />
    </View>
  );
}
