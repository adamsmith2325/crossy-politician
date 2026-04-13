import { AppOpenAd, InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';

// Production Ad Unit IDs
export const APP_OPEN_AD_UNIT_ID = 'ca-app-pub-5901242452853695/4578355515';
export const INTERSTITIAL_AD_UNIT_ID = 'ca-app-pub-5901242452853695/8501837397';

let interstitialLoaded = false;
let interstitial: InterstitialAd | null = null;

let appOpenLoaded = false;
let appOpen: AppOpenAd | null = null;

export const prepareAds = () => {
  if (!interstitial) {
    interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, { requestNonPersonalizedAdsOnly: true });
    interstitial.addAdEventListener(AdEventType.LOADED, () => (interstitialLoaded = true));
    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      interstitialLoaded = false;
      interstitial?.load();
    });
    interstitial.load();
  }

  if (!appOpen) {
    appOpen = AppOpenAd.createForAdRequest(APP_OPEN_AD_UNIT_ID, { requestNonPersonalizedAdsOnly: true });
    appOpen.addAdEventListener(AdEventType.LOADED, () => (appOpenLoaded = true));
    appOpen.addAdEventListener(AdEventType.CLOSED, () => {
      appOpenLoaded = false;
      appOpen?.load();
    });
    appOpen.load();
  }
};

export const showAppOpenIfEligible = async (appOpenCount: number) => {
  prepareAds();
  if (appOpenCount > 0 && appOpenCount % 5 === 0 && appOpenLoaded && appOpen) {
    return new Promise<void>((resolve) => {
      const onClosed = () => {
        appOpen?.removeAllListeners();
        appOpenLoaded = false;
        appOpen?.load();
        resolve();
      };
      if (appOpen) {
        appOpen.addAdEventListener(AdEventType.CLOSED, onClosed);
        appOpen.show();
      }
    });
  }
  return Promise.resolve();
};

export const showInterstitialIfEligible = async (runCount: number) => {
  prepareAds();
  if (runCount > 0 && runCount % 3 === 0 && interstitialLoaded && interstitial) {
    return new Promise<void>((resolve) => {
      const onClosed = () => {
        interstitial?.removeAllListeners();
        interstitialLoaded = false;
        interstitial?.load();
        resolve();
      };
      if (interstitial) {
        interstitial.addAdEventListener(AdEventType.CLOSED, onClosed);
        interstitial.show();
      }
    });
  }
  return Promise.resolve();
};
