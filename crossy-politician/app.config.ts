import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Crossy Politician",
  slug: "crossy-politician",
  scheme: "crossypolitician",
  version: "2.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#0b1220"
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.prismixlabs.crossytrump",
    infoPlist: {
      NSUserTrackingUsageDescription: "We use your device identifier to deliver more relevant ads and to support the app."
    }
  },
  android: {
    package: "com.prismixlabs.crossytrump",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0b1220"
    }
  },
  plugins: [
    [
      "react-native-google-mobile-ads",
      {
        ios_app_id: "ca-app-pub-3940256099942544~1458002511",
        android_app_id: "ca-app-pub-3940256099942544~3347511713"
      }
    ]
  ],
  extra: {
    // Fill these via EXPO_PUBLIC_* env vars at build time or edit here.
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
        projectId: '4db62c2c-59ef-479f-9e95-7266d4f754e1',
      },
  }
});
