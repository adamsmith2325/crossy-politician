import { AppOpenAd, InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';

// Replace for production:
export const APP_OPEN_AD_UNIT_ID = TestIds.APP_OPEN;       // e.g. 'ca-app-pub-xxx/yyy'
export const INTERSTITIAL_AD_UNIT_ID = TestIds.INTERSTITIAL;

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

export const showAppOpenOnStart = () => {
  prepareAds();
  if (appOpen && appOpenLoaded) {
    appOpen.show();
  } else {
    appOpen?.addAdEventListener(AdEventType.LOADED, () => appOpen?.show());
  }
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
      interstitial.addAdEventListener(AdEventType.CLOSED, onClosed);
      interstitial.show();
    });
  }
  return Promise.resolve();
};
