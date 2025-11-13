import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

// Ad Unit IDs configuration
export const AdConfig = {
  banner: {
    ios: __DEV__ ? TestIds.BANNER : 'ca-app-pub-5901242452853695/7551717804',
    android: __DEV__ ? TestIds.BANNER : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  },
  interstitial: {
    ios: __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-5901242452853695/8501837397',
    android: __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  },
  appOpen: {
    ios: __DEV__ ? TestIds.APP_OPEN : 'ca-app-pub-5901242452853695/4578355515',
    android: __DEV__ ? TestIds.APP_OPEN : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  },
};

// Helper to get the correct ad unit ID for the current platform
export const getAdUnitId = (adType: 'banner' | 'interstitial' | 'appOpen'): string => {
  const platform = Platform.OS as 'ios' | 'android';
  return AdConfig[adType][platform];
};
