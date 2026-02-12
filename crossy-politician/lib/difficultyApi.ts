import { supabase } from './supabase';

/**
 * Fetch the current difficulty index from Supabase
 * Returns a value between 0-100:
 * - 0: No difficulty increase over time
 * - 50: Moderate difficulty scaling (default)
 * - 100: Extreme difficulty scaling
 *
 * @returns The difficulty index value, or 50 as default if fetch fails
 */
export async function getDifficultyIndex(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('difficulty_index')
      .select('value')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching difficulty index:', error);
      return 50; // Default difficulty
    }

    if (!data || typeof data.value !== 'number') {
      console.warn('No difficulty index found, using default value of 50');
      return 50;
    }

    // Ensure value is within bounds
    const value = Math.max(0, Math.min(100, data.value));
    console.log(`✅ Difficulty index loaded: ${value}`);

    return value;
  } catch (err) {
    console.error('Exception fetching difficulty index:', err);
    return 50; // Default difficulty on error
  }
}

/**
 * Update the difficulty index (admin function)
 * @param value New difficulty value (0-100)
 */
export async function updateDifficultyIndex(value: number): Promise<boolean> {
  try {
    // Clamp value to valid range
    const clampedValue = Math.max(0, Math.min(100, Math.round(value)));

    const { error } = await supabase
      .from('difficulty_index')
      .update({ value: clampedValue, updated_at: new Date().toISOString() })
      .eq('id', (await supabase.from('difficulty_index').select('id').limit(1).single()).data?.id);

    if (error) {
      console.error('Error updating difficulty index:', error);
      return false;
    }

    console.log(`✅ Difficulty index updated to: ${clampedValue}`);
    return true;
  } catch (err) {
    console.error('Exception updating difficulty index:', err);
    return false;
  }
}

/**
 * Calculate difficulty multiplier based on score and difficulty index
 * This is applied every 5 moves to progressively increase difficulty
 *
 * @param score Current player score (number of moves forward)
 * @param difficultyIndex The base difficulty setting (0-100)
 * @returns An object with various difficulty multipliers
 */
export function calculateDifficultyMultipliers(score: number, difficultyIndex: number) {
  // Calculate which difficulty tier we're in (every 5 moves)
  const tier = Math.floor(score / 5);

  // Base progression rate depends on difficulty index
  // 0 = no progression, 100 = very aggressive progression
  const progressionRate = difficultyIndex / 100;

  // Calculate multipliers with exponential growth
  const baseMultiplier = 1 + (tier * 0.15 * progressionRate);

  return {
    // Speed multiplier for vehicles
    speedMultiplier: 1 + (tier * 0.2 * progressionRate),

    // Probability of road lanes (more roads = harder)
    roadProbabilityIncrease: tier * 0.05 * progressionRate,

    // Car density multiplier (more cars per lane)
    carDensityMultiplier: 1 + (tier * 0.25 * progressionRate),

    // Minimum gap between cars (smaller = harder)
    minGapReduction: tier * 0.15 * progressionRate,

    // Overall difficulty tier (for reference)
    tier,

    // Base multiplier
    baseMultiplier,
  };
}
