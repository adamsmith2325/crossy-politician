// src/utils/remoteLeaderboard.ts
import { createClient } from '@supabase/supabase-js';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!URL || !KEY) {
  console.warn(
    '[leaderboard] Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY'
  );
}

export type RemoteRow = { username: string; score: number; created_at?: string };

const supabase = createClient(URL ?? '', KEY ?? '', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const TABLE = 'crossyTrump_scores';

export async function submitScore(username: string, score: number): Promise<boolean> {
  try {
    if (!URL || !KEY) return false;
    const name = (username || '').trim().slice(0, 18);
    const safeScore = Math.max(0, Math.floor(score));
    const { error } = await supabase.from(TABLE).insert([{ username: name, score: safeScore }]);
    if (error) {
      console.warn('[leaderboard] submitScore error:', error.message, error.details ?? '');
      return false;
    }
    return true;
  } catch (e: any) {
    console.warn('[leaderboard] submitScore error:', e?.message ?? e);
    return false;
  }
}

export async function fetchTopScores(limit = 25): Promise<RemoteRow[]> {
  try {
    if (!URL || !KEY) return [];
    const { data, error } = await supabase
      .from(TABLE)
      .select('username, score, created_at')
      .order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) {
      console.warn('[leaderboard] fetchTopScores error:', error.message, error.details ?? '');
      return [];
    }
    return (data ?? []) as RemoteRow[];
  } catch (e: any) {
    console.warn('[leaderboard] fetchTopScores error:', e?.message ?? e);
    return [];
  }
}
