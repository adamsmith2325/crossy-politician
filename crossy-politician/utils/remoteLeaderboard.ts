// src/utils/remoteLeaderboard.ts
import { supabase } from '../lib/supabase';

export type RemoteRow = { username: string; score: number; created_at?: string };

const TABLE = 'crossyTrump_scores';

export async function submitScore(username: string, score: number): Promise<boolean> {
  try {
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
