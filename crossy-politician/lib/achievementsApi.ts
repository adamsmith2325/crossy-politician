import { supabase } from './supabase';
import type { AchievementStats } from '../game/achievementsManager';

export interface UserProfile {
  id: string;
  username: string;
  created_at: string;
  updated_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
}

export interface UserStats extends AchievementStats {
  user_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get or create a user profile by username
 */
export async function getOrCreateUserProfile(username: string): Promise<UserProfile | null> {
  try {
    // First try to get existing profile
    const { data: existing, error: fetchError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (existing && !fetchError) {
      return existing;
    }

    // If not found, create new profile
    const { data: newProfile, error: insertError } = await supabase
      .from('user_profiles')
      .insert({ username })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating user profile:', insertError);
      return null;
    }

    // Initialize stats for new user
    if (newProfile) {
      await supabase.from('user_stats').insert({
        user_id: newProfile.id,
        total_dodges: 0,
        total_jumps: 0,
        max_score: 0,
        max_survival_time: 0,
        games_played: 0,
        total_deaths: 0,
        buses_dodged: 0,
        police_dodged: 0,
      });
    }

    return newProfile;
  } catch (error) {
    console.error('Error in getOrCreateUserProfile:', error);
    return null;
  }
}

/**
 * Get user's unlocked achievements
 */
export async function getUserAchievements(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user achievements:', error);
      return [];
    }

    return data?.map(a => a.achievement_id) || [];
  } catch (error) {
    console.error('Error in getUserAchievements:', error);
    return [];
  }
}

/**
 * Unlock an achievement for a user
 */
export async function unlockAchievement(userId: string, achievementId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_achievements')
      .insert({
        user_id: userId,
        achievement_id: achievementId,
      });

    if (error) {
      // Ignore duplicate key errors (achievement already unlocked)
      if (error.code === '23505') {
        return true;
      }
      console.error('Error unlocking achievement:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in unlockAchievement:', error);
    return false;
  }
}

/**
 * Unlock multiple achievements at once
 */
export async function unlockMultipleAchievements(userId: string, achievementIds: string[]): Promise<boolean> {
  try {
    const achievements = achievementIds.map(id => ({
      user_id: userId,
      achievement_id: id,
    }));

    const { error } = await supabase
      .from('user_achievements')
      .insert(achievements);

    if (error) {
      // Ignore duplicate key errors
      if (error.code === '23505') {
        return true;
      }
      console.error('Error unlocking multiple achievements:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in unlockMultipleAchievements:', error);
    return false;
  }
}

/**
 * Get user statistics
 */
export async function getUserStats(userId: string): Promise<Partial<AchievementStats> | null> {
  try {
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user stats:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      totalDodges: data.total_dodges,
      totalJumps: data.total_jumps,
      maxScore: data.max_score,
      maxSurvivalTime: data.max_survival_time,
      gamesPlayed: data.games_played,
      totalDeaths: data.total_deaths,
      vehiclesDodged: {
        cars: 0,
        trucks: 0,
        buses: data.buses_dodged || 0,
        police: data.police_dodged || 0,
        ambulances: 0,
        taxis: 0,
      },
    };
  } catch (error) {
    console.error('Error in getUserStats:', error);
    return null;
  }
}

/**
 * Update user statistics
 */
export async function updateUserStats(userId: string, stats: Partial<AchievementStats>): Promise<boolean> {
  try {
    const updateData: any = {
      user_id: userId,
    };

    if (stats.totalDodges !== undefined) updateData.total_dodges = stats.totalDodges;
    if (stats.totalJumps !== undefined) updateData.total_jumps = stats.totalJumps;
    if (stats.maxScore !== undefined) updateData.max_score = stats.maxScore;
    if (stats.maxSurvivalTime !== undefined) updateData.max_survival_time = stats.maxSurvivalTime;
    if (stats.gamesPlayed !== undefined) updateData.games_played = stats.gamesPlayed;
    if (stats.totalDeaths !== undefined) updateData.total_deaths = stats.totalDeaths;
    if (stats.vehiclesDodged?.buses !== undefined) updateData.buses_dodged = stats.vehiclesDodged.buses;
    if (stats.vehiclesDodged?.police !== undefined) updateData.police_dodged = stats.vehiclesDodged.police;

    const { error } = await supabase
      .from('user_stats')
      .upsert(updateData, {
        onConflict: 'user_id',
      });

    if (error) {
      console.error('Error updating user stats:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateUserStats:', error);
    return false;
  }
}

/**
 * Get leaderboard of top achievement earners
 */
export async function getAchievementLeaderboard(limit: number = 10): Promise<Array<{
  username: string;
  achievement_count: number;
}>> {
  try {
    const { data, error } = await supabase.rpc('get_achievement_leaderboard', {
      limit_count: limit,
    });

    if (error) {
      console.error('Error fetching achievement leaderboard:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getAchievementLeaderboard:', error);
    return [];
  }
}
