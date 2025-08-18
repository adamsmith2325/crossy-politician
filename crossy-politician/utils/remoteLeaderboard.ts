import { supabase } from '../lib/supabase';

export interface RemoteScore { id?: string; username: string; score: number; created_at?: string; }

const TABLE = 'crossyTrump_scores';

export async function fetchTopScores(limit = 25): Promise<RemoteScore[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select('username, score, created_at')
    .order('score', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('fetchTopScores error', error);
    return [];
  }
  return data ?? [];
}

export async function submitScore(username: string, score: number): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from(TABLE).insert({ username, score });
  if (error) {
    console.warn('submitScore error', error);
    return false;
  }
  return true;
}
