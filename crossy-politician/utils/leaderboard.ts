import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ct_leaderboard_v1';

export interface ScoreEntry { score: number; date: string; }
export interface Leaderboard { best: number; top: ScoreEntry[]; }

const DEFAULT: Leaderboard = { best: 0, top: [] };

export async function loadLeaderboard(): Promise<Leaderboard> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.best !== 'number' || !Array.isArray(parsed?.top)) return DEFAULT;
    return parsed as Leaderboard;
  } catch { return DEFAULT; }
}

export async function addScore(score: number): Promise<Leaderboard> {
  const lb = await loadLeaderboard();
  const now = new Date().toISOString();
  const next: Leaderboard = { best: Math.max(lb.best, score), top: [...lb.top, { score, date: now }].sort((a,b)=>b.score-a.score).slice(0,10) };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
