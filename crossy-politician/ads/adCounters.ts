import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_OPEN_COUNT_KEY = '@crossy_politician_app_open_count';
const GAME_PLAY_COUNT_KEY = '@crossy_politician_game_play_count';

/**
 * Get the current app open count
 */
export async function getAppOpenCount(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(APP_OPEN_COUNT_KEY);
    return value !== null ? parseInt(value, 10) : 0;
  } catch (error) {
    console.error('Error reading app open count:', error);
    return 0;
  }
}

/**
 * Increment and save the app open count
 * Returns the new count
 */
export async function incrementAppOpenCount(): Promise<number> {
  try {
    const currentCount = await getAppOpenCount();
    const newCount = currentCount + 1;
    await AsyncStorage.setItem(APP_OPEN_COUNT_KEY, newCount.toString());
    console.log(`📱 App opened ${newCount} times`);
    return newCount;
  } catch (error) {
    console.error('Error incrementing app open count:', error);
    return 0;
  }
}

/**
 * Get the current game play count
 */
export async function getGamePlayCount(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(GAME_PLAY_COUNT_KEY);
    return value !== null ? parseInt(value, 10) : 0;
  } catch (error) {
    console.error('Error reading game play count:', error);
    return 0;
  }
}

/**
 * Increment and save the game play count
 * Returns the new count
 */
export async function incrementGamePlayCount(): Promise<number> {
  try {
    const currentCount = await getGamePlayCount();
    const newCount = currentCount + 1;
    await AsyncStorage.setItem(GAME_PLAY_COUNT_KEY, newCount.toString());
    console.log(`🎮 Game played ${newCount} times`);
    return newCount;
  } catch (error) {
    console.error('Error incrementing game play count:', error);
    return 0;
  }
}
