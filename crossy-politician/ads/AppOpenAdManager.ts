import { AppOpenAd, AdEventType } from 'react-native-google-mobile-ads';
import { getAdUnitId } from './adConfig';

class AppOpenAdManager {
  private ad: AppOpenAd | null = null;
  private isLoaded = false;
  private isLoading = false;
  private isShowing = false;

  constructor() {
    this.loadAd();
  }

  private loadAd() {
    if (this.isLoading || this.isLoaded) {
      return;
    }

    this.isLoading = true;
    this.ad = AppOpenAd.createForAdRequest(getAdUnitId('appOpen'), {
      requestNonPersonalizedAdsOnly: false,
    });

    // Set up event listeners
    this.ad.addAdEventListener(AdEventType.LOADED, () => {
      this.isLoaded = true;
      this.isLoading = false;
      console.log('App open ad loaded');
    });

    this.ad.addAdEventListener(AdEventType.ERROR, (error) => {
      console.log('App open ad failed to load:', error);
      this.isLoaded = false;
      this.isLoading = false;

      // Retry loading after 30 seconds
      setTimeout(() => {
        this.loadAd();
      }, 30000);
    });

    this.ad.addAdEventListener(AdEventType.OPENED, () => {
      this.isShowing = true;
      console.log('App open ad opened');
    });

    this.ad.addAdEventListener(AdEventType.CLOSED, () => {
      this.isShowing = false;
      this.isLoaded = false;
      console.log('App open ad closed');
      // Load a new ad for next time
      this.loadAd();
    });

    // Load the ad
    this.ad.load();
  }

  /**
   * Show the app open ad if it's loaded and not already showing
   * Returns true if ad was shown
   */
  public showIfReady(): boolean {
    if (!this.isLoaded || this.isShowing || !this.ad) {
      return false;
    }

    this.ad.show().catch((error) => {
      console.log('Failed to show app open ad:', error);
      this.isShowing = false;
    });

    return true;
  }

  /**
   * Check if ad is currently loaded and ready
   */
  public isReady(): boolean {
    return this.isLoaded && !this.isShowing;
  }
}

// Export singleton instance
export const appOpenAdManager = new AppOpenAdManager();
