import { supabase } from './supabase';

export interface LeaderboardEntry {
  id?: number;
  username: string;
  score: number;
  created_at?: string;
}

/**
 * Save a new score to the leaderboard
 */
export async function saveScore(username: string, score: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('leaderboard')
      .insert([{ username, score }]);

    if (error) {
      console.error('Error saving score:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error saving score:', error);
    return false;
  }
}

/**
 * Get top scores from the leaderboard
 */
export async function getTopScores(limit: number = 10): Promise<LeaderboardEntry[]> {
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
}

/**
 * Get user's personal best score
 */
export async function getPersonalBest(username: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('score')
      .eq('username', username)
      .order('score', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return 0;
    }

    return data[0].score;
  } catch (error) {
    console.error('Error fetching personal best:', error);
    return 0;
  }
}
