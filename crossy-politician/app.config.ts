import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Crossy Trump",
  slug: "crossy-politician",
  scheme: "crossypolitician",
  version: "1.0.3",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#0b1220"
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.prismixlabs.crossypolitician",
    infoPlist: {
      "ITSAppUsesNonExemptEncryption": false
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
    "expo-asset",
    "expo-router",
    [
      "react-native-google-mobile-ads",
      {
        "androidAppId": "ca-app-pub-5901242452853695~3024314584",
        "iosAppId": "ca-app-pub-5901242452853695~3024314584"
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
