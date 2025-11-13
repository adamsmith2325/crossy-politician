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
    console.log('Attempting to save score:', { username, score });

    // Check if supabase is initialized
    if (!supabase) {
      console.error('Supabase client not initialized');
      return false;
    }

    const { data, error } = await supabase
      .from('crossytrump_scores')
      .insert({ username, score })
      .select();

    if (error) {
      console.error('Supabase error saving score:', {
        fullError: JSON.stringify(error),
        message: error?.message || 'No message',
        details: error?.details || 'No details',
        hint: error?.hint || 'No hint',
        code: error?.code || 'No code'
      });
      return false;
    }

    console.log('Score saved successfully:', data);
    return true;
  } catch (error: any) {
    console.error('Exception saving score:', {
      error: error,
      message: error?.message,
      stack: error?.stack
    });
    return false;
  }
}

/**
 * Get top scores from the leaderboard
 */
export async function getTopScores(limit: number = 10): Promise<LeaderboardEntry[]> {
  try {
    console.log('Fetching top scores, limit:', limit);

    const { data, error } = await supabase
      .from('crossytrump_scores')
      .select('*')
      .order('score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Supabase error fetching leaderboard:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return [];
    }

    console.log('Fetched scores:', data?.length || 0, 'entries');
    return data || [];
  } catch (error) {
    console.error('Exception fetching leaderboard:', error);
    return [];
  }
}

/**
 * Get user's personal best score
 */
export async function getPersonalBest(username: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('crossytrump_scores')
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
