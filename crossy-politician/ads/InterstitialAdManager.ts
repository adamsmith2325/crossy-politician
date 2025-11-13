import { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';
import { getAdUnitId } from './adConfig';

class InterstitialAdManager {
  private ad: InterstitialAd | null = null;
  private isLoaded = false;
  private isLoading = false;
  private gameCount = 0;
  private readonly GAMES_BETWEEN_ADS = 5;

  constructor() {
    this.loadAd();
  }

  private loadAd() {
    if (this.isLoading || this.isLoaded) {
      return;
    }

    this.isLoading = true;
    this.ad = InterstitialAd.createForAdRequest(getAdUnitId('interstitial'), {
      requestNonPersonalizedAdsOnly: false,
    });

    // Set up event listeners
    this.ad.addAdEventListener(AdEventType.LOADED, () => {
      this.isLoaded = true;
      this.isLoading = false;
      console.log('Interstitial ad loaded');
    });

    this.ad.addAdEventListener(AdEventType.ERROR, (error) => {
      console.log('Interstitial ad failed to load:', error);
      this.isLoaded = false;
      this.isLoading = false;

      // Retry loading after 30 seconds
      setTimeout(() => {
        this.loadAd();
      }, 30000);
    });

    this.ad.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('Interstitial ad closed');
      this.isLoaded = false;
      // Load a new ad for next time
      this.loadAd();
    });

    // Load the ad
    this.ad.load();
  }

  /**
   * Call this when a game ends
   * Returns true if an ad was shown
   */
  public onGameEnd(): boolean {
    this.gameCount++;

    if (this.gameCount >= this.GAMES_BETWEEN_ADS && this.isLoaded && this.ad) {
      this.gameCount = 0;
      this.showAd();
      return true;
    }

    return false;
  }

  private showAd() {
    if (!this.ad || !this.isLoaded) {
      console.log('Interstitial ad not ready');
      return;
    }

    this.ad.show().catch((error) => {
      console.log('Failed to show interstitial ad:', error);
    });
  }

  /**
   * Get the current game count
   */
  public getGameCount(): number {
    return this.gameCount;
  }

  /**
   * Get games remaining until next ad
   */
  public getGamesUntilNextAd(): number {
    return this.GAMES_BETWEEN_ADS - this.gameCount;
  }
}

// Export singleton instance
export const interstitialAdManager = new InterstitialAdManager();
