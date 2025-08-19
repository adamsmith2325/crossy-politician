import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, Text, View } from 'react-native';
import { COLS, ROWS, ROAD_PROBABILITY, MIN_CAR_GAP } from './constants';
import { Lane } from './types';
import Tile from './components/Tile';
import Car from './components/Car';
import Character from './components/Character';
import { showInterstitialIfEligible } from '../ads/adManager';
import * as Haptics from 'expo-haptics';
import { initSounds, play, unloadSounds } from '../sound/soundManager';
import { addScore, loadLeaderboard } from '../utils/leaderboard';
import LeaderboardModal from '../ui/LeaderboardModal';
import UsernameModal from '../ui/UsernameModal';
import { Gesture, GestureDetector, Directions } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { submitScore, fetchTopScores } from '../utils/remoteLeaderboard';

const { width: SCREEN_W } = Dimensions.get('window');
const TILE = Math.floor(SCREEN_W / COLS);

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateLane(idx: number): Lane {
  const isRoad = Math.random() < ROAD_PROBABILITY && idx !== 0 && idx !== ROWS - 1;
  const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  const speed = isRoad ? randomInt(2, 4) : 0;
  const cars: number[] = [];
  if (isRoad) {
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
  const [runCount, setRunCount] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showLB, setShowLB] = useState(false);
  const [best, setBest] = useState(0);
  const [lbItemsRemote, setLbItemsRemote] = useState<{username?:string; score:number; created_at?:string}[]>([]);
  const [username, setUsername] = useState<string>('');
  const [showUsernameModal, setShowUsernameModal] = useState(false);

  const lastTick = useRef<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load username / best / remote scores on mount
  useEffect(() => {
    (async () => {
      try {
        const storedName = await AsyncStorage.getItem('ct_username');
        if (storedName) setUsername(storedName);
      } catch {}
      const lb = await loadLeaderboard();
      setBest(lb.best);
      const remote = await fetchTopScores(25);
      setLbItemsRemote(remote);
    })();
  }, []);

  // Sounds
  useEffect(() => { initSounds(); return () => { unloadSounds(); }; }, []);

  // Main game loop
  useEffect(() => {
    if (!alive || showOverlay) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    lastTick.current = Date.now();
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const dt = Math.min((now - lastTick.current) / 1000, 0.05);
      lastTick.current = now;

      setLanes(prev => prev.map(l => {
        if (l.type !== 'road') return l;
        const moved = l.cars.map(c => c + l.dir * l.speed * dt);
        const wrapped = moved.map(c => (c < -1 ? COLS + c : (c > COLS + 1 ? c - (COLS + 2) : c)));
        return { ...l, cars: wrapped };
      }));

      setAlive(prevAlive => {
        if (!prevAlive) return prevAlive;
        const lane = lanes[player.y];
        if (lane?.type === 'road') {
          const collided = lane.cars.some(c => Math.abs(c - player.x) < 0.6);
          if (collided) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            play('hit');
            return false;
          }
        }
        return true;
      });
    }, 16);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [alive, showOverlay, lanes, player.x, player.y]);

  // Handle win
  useEffect(() => {
    if (player.y >= ROWS - 1 && alive) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      play('win');
      setAlive(false);
    }
  }, [player.y, alive]);

  // On run end
  useEffect(() => {
    if (!alive) {
      setRunCount(rc => rc + 1);
      (async () => {
        const lb = await addScore(score);
        setBest(lb.best);
        setShowOverlay(true);
        setShowLB(true);
        // Refresh remote leaderboards
        const remote = await fetchTopScores(25);
        setLbItemsRemote(remote);
      })();
    }
  }, [alive]);

  // Interstitial
  useEffect(() => { if (showOverlay && runCount > 0) { (async () => { await showInterstitialIfEligible(runCount); })(); } }, [showOverlay, runCount]);

  const reset = () => { setLanes(regenerateLanes()); setPlayer({ x: Math.floor(COLS / 2), y: 0 }); setAlive(true); setScore(0); };

  const move = (dx: number, dy: number) => {
    if (!alive || showOverlay) return;
    setPlayer(p => {
      let nx = Math.max(0, Math.min(COLS - 1, p.x + dx));
      let ny = Math.max(0, Math.min(ROWS - 1, p.y + dy));
      if (ny !== p.y && dy > 0) { setScore(s => s + 1); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); play('move'); }
      else if (nx !== p.x) { Haptics.selectionAsync(); play('move'); }
      return { x: nx, y: ny };
    });
  };

  // Swipe controls
  const flingUp = Gesture.Fling().direction(Directions.UP).onEnd(() => move(0, 1));
  const flingDown = Gesture.Fling().direction(Directions.DOWN).onEnd(() => move(0, -1));
  const flingLeft = Gesture.Fling().direction(Directions.LEFT).onEnd(() => move(-1, 0));
  const flingRight = Gesture.Fling().direction(Directions.RIGHT).onEnd(() => move(1, 0));
  const gestures = Gesture.Simultaneous(flingUp, flingDown, flingLeft, flingRight);

  const laneHeight = TILE;

  // Submit score to Supabase, prompting for username if needed
  const handleSubmitScore = async () => {
    if (!username) {
      setShowUsernameModal(true);
      return;
    }
    const ok = await submitScore(username, score);
    if (ok) {
      const remote = await fetchTopScores(25);
      setLbItemsRemote(remote);
    }
  };

  const handleSaveUsername = async (name: string) => {
    if (!name) { setShowUsernameModal(false); return; }
    await AsyncStorage.setItem('ct_username', name);
    setUsername(name);
    setShowUsernameModal(false);
    // Attempt submit again after saving
    const ok = await submitScore(name, score);
    if (ok) {
      const remote = await fetchTopScores(25);
      setLbItemsRemote(remote);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0b1220', paddingTop: 8, alignItems: 'center' }}>
      {/* Header */}
      <View style={{ width: SCREEN_W, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Crossy Trump</Text>
        <Text style={{ color: '#9fd5ff', fontSize: 16 }}>Score: {score}  •  Best: {best}</Text>
      </View>

      {/* Playfield with swipe detector */}
      <GestureDetector gesture={gestures}>
        <View style={{ width: SCREEN_W, height: laneHeight * ROWS, backgroundColor: '#0b1220' }}>
          {lanes.map((lane, i) => (
            <View key={i} style={{ position: 'absolute', left: 0, top: (ROWS - 1 - lane.idx) * laneHeight, width: '100%' }}>
              <Tile laneType={lane.type} size={laneHeight} />
              {lane.type === 'road' && lane.cars.map((c, idx) => (
                <View key={idx} style={{ position: 'absolute', left: c * TILE, top: laneHeight * 0.2 }}>
                  <Car size={TILE} />
                </View>
              ))}
            </View>
          ))}

          {/* Player */}
          <View style={{ position: 'absolute', left: player.x * TILE + TILE*0.1, top: (ROWS - 1 - player.y) * laneHeight + laneHeight*0.1 }}>
            <Character size={TILE} />
          </View>
        </View>
      </GestureDetector>

      {/* On-screen Buttons (also accessible) */}
      <View style={{ flex: 1, width: SCREEN_W, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <Pressable onPress={() => { move(0, 1); play('click'); }} style={({pressed}) => ({
            backgroundColor: pressed ? '#1c3350' : '#11263c',
            paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#264a74'
          })}>
            <Text style={{ color: '#9fd5ff', fontWeight: '700' }}>UP</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable onPress={() => { move(-1, 0); play('click'); }} style={({pressed}) => ({
            backgroundColor: pressed ? '#1c3350' : '#11263c',
            paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#264a74'
          })}>
            <Text style={{ color: '#9fd5ff', fontWeight: '700' }}>LEFT</Text>
          </Pressable>
          <Pressable onPress={() => { move(0, -1); play('click'); }} style={({pressed}) => ({
            backgroundColor: pressed ? '#1c3350' : '#11263c',
            paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#264a74'
          })}>
            <Text style={{ color: '#9fd5ff', fontWeight: '700' }}>DOWN</Text>
          </Pressable>
          <Pressable onPress={() => { move(1, 0); play('click'); }} style={({pressed}) => ({
            backgroundColor: pressed ? '#1c3350' : '#11263c',
            paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#264a74'
          })}>
            <Text style={{ color: '#9fd5ff', fontWeight: '700' }}>RIGHT</Text>
          </Pressable>
        </View>
      </View>

      {/* Overlay */}
      {showOverlay && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: '#0f2033', padding: 20, borderRadius: 12, width: SCREEN_W * 0.88, borderWidth: 1, borderColor: '#2d4f79' }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>
              {runCount === 0 ? 'Crossy Trump' : (alive ? 'You Win!' : 'Game Over')}
            </Text>
            {runCount > 0 && (
              <Text style={{ color: '#9fd5ff', textAlign: 'center', marginBottom: 16 }}>
                Runs: {runCount} • Last Score: {score} • Best: {best}
              </Text>
            )}

            <Pressable
              onPress={() => { setShowOverlay(false); setShowLB(false); play('click'); reset(); }}
              style={({pressed}) => ({
                backgroundColor: pressed ? '#1c3350' : '#11263c',
                paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: '#2d4f79', marginBottom: 10
              })}>
              <Text style={{ color: '#9fd5ff', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>
                {runCount === 0 ? 'Start' : 'Play Again'}
              </Text>
            </Pressable>

            {runCount > 0 && (
              <Pressable
                onPress={handleSubmitScore}
                style={({pressed}) => ({
                  backgroundColor: pressed ? '#17324f' : '#0e2942',
                  paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2d4f79', marginBottom: 10
                })}>
                <Text style={{ color: '#9fd5ff', textAlign: 'center', fontWeight: '700' }}>
                  Submit Score {username ? `as ${username}` : '(set username)'}
                </Text>
              </Pressable>
            )}

            <Pressable onPress={() => setShowLB(true)} style={({ pressed }) => ({
              backgroundColor: pressed ? '#17324f' : '#0e2942',
              paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2d4f79'
            })}>
              <Text style={{ color: '#9fd5ff', textAlign: 'center', fontWeight: '700' }}>View Leaderboard</Text>
            </Pressable>

            <Text style={{ color: '#6faee0', fontSize: 12, textAlign: 'center', marginTop: 10 }}>
              Swipe or tap buttons. Interstitial after every 3 runs. App Open ad on launch.
            </Text>
          </View>
        </View>
      )}

      <LeaderboardModal
        visible={showLB}
        onClose={() => setShowLB(false)}
        title="Top Scores"
        items={lbItemsRemote}
        footer={
          <Pressable onPress={() => setShowUsernameModal(true)} style={({ pressed }) => ({
            backgroundColor: pressed ? '#1c3350' : '#11263c',
            paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2d4f79'
          })}>
            <Text style={{ color: '#9fd5ff', textAlign: 'center', fontWeight: '700' }}>{username ? `Change Username (${username})` : 'Set Username'}</Text>
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
