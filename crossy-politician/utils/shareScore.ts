import { Share, Platform } from 'react-native';

// Download link for the game
const GAME_DOWNLOAD_LINK = 'https://crossypolitician.com/download'; // Update with actual link
const APP_STORE_LINK = 'https://apps.apple.com/app/crossy-politician'; // Update when published
const PLAY_STORE_LINK = 'https://play.google.com/store/apps/details?id=com.crossypolitician'; // Update when published

/**
 * Get the appropriate download link based on platform
 */
export function getDownloadLink(): string {
  if (Platform.OS === 'ios') {
    return APP_STORE_LINK;
  } else if (Platform.OS === 'android') {
    return PLAY_STORE_LINK;
  }
  return GAME_DOWNLOAD_LINK;
}

/**
 * Share score via native share dialog (SMS, WhatsApp, social media, etc.)
 * @param score The player's score
 * @param username Optional username to personalize the message
 * @param survivalTime Optional survival time in seconds
 * @returns Promise that resolves to share result
 */
export async function shareScore(
  score: number,
  username?: string,
  survivalTime?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const downloadLink = getDownloadLink();

    // Create personalized message
    const playerName = username ? username : 'I';
    const timeText = survivalTime
      ? ` and survived for ${survivalTime.toFixed(1)} seconds`
      : '';

    const message = `🎮 ${playerName} just scored ${score} points${timeText} in Crossy Politician!\n\n` +
      `Think you can beat that? 🏆\n\n` +
      `Download now: ${downloadLink}`;

    const result = await Share.share({
      message: message,
      title: 'Crossy Politician - Challenge!',
      // URL is separate on iOS
      url: Platform.OS === 'ios' ? downloadLink : undefined,
    });

    if (result.action === Share.sharedAction) {
      if (result.activityType) {
        // Shared via specific activity (iOS)
        console.log(`✅ Score shared via ${result.activityType}`);
        return { success: true };
      } else {
        // Shared (Android or iOS without specific activity)
        console.log('✅ Score shared successfully');
        return { success: true };
      }
    } else if (result.action === Share.dismissedAction) {
      // User dismissed the share dialog
      console.log('❌ Share dismissed by user');
      return { success: false, error: 'dismissed' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error sharing score:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Share score with custom message
 * @param customMessage Custom message to share
 * @param includeLink Whether to include download link
 */
export async function shareCustomMessage(
  customMessage: string,
  includeLink: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    const downloadLink = getDownloadLink();
    const message = includeLink
      ? `${customMessage}\n\nDownload: ${downloadLink}`
      : customMessage;

    const result = await Share.share({
      message: message,
      title: 'Crossy Politician',
      url: Platform.OS === 'ios' && includeLink ? downloadLink : undefined,
    });

    return { success: result.action === Share.sharedAction };
  } catch (error) {
    console.error('Error sharing custom message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Share high score achievement
 * @param score The high score achieved
 * @param previousBest The previous best score
 * @param username Optional username
 */
export async function shareHighScore(
  score: number,
  previousBest: number,
  username?: string
): Promise<{ success: boolean; error?: string }> {
  const playerName = username ? username : 'I';
  const improvement = score - previousBest;
  const downloadLink = getDownloadLink();

  const message = `🏆 NEW HIGH SCORE! 🏆\n\n` +
    `${playerName} just set a new record in Crossy Politician:\n` +
    `${score} points (+${improvement} from previous best!)\n\n` +
    `Can you beat it? Download now:\n${downloadLink}`;

  try {
    const result = await Share.share({
      message: message,
      title: 'Crossy Politician - New High Score!',
      url: Platform.OS === 'ios' ? downloadLink : undefined,
    });

    return { success: result.action === Share.sharedAction };
  } catch (error) {
    console.error('Error sharing high score:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate shareable text for copying to clipboard
 * @param score Player's score
 * @param username Optional username
 * @param survivalTime Optional survival time
 */
export function generateShareText(
  score: number,
  username?: string,
  survivalTime?: number
): string {
  const playerName = username ? username : 'I';
  const timeText = survivalTime
    ? ` and survived for ${survivalTime.toFixed(1)} seconds`
    : '';
  const downloadLink = getDownloadLink();

  return `🎮 ${playerName} just scored ${score} points${timeText} in Crossy Politician!\n\n` +
    `Think you can beat that? 🏆\n\n` +
    `Download now: ${downloadLink}`;
}
