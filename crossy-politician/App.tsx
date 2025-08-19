// App.tsx
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { SafeAreaView, StatusBar, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as TrackingTransparency from 'expo-tracking-transparency';
import mobileAds from 'react-native-google-mobile-ads';

import Game from './game/Game'; // <-- inside this file, use: `import { THREE } from 'expo-three'`

export default function App() {
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'ios') {
          // Ask for App Tracking Transparency permission on iOS
          await TrackingTransparency.requestTrackingPermissionsAsync();
        }
      } catch {
        // ignore ATT errors
      }

      // Initialize Google Mobile Ads SDK
      try {
        await mobileAds().initialize();
      } catch {
        // ignore ad init errors to avoid blocking app launch
      }

      // If you have an app-open ad, you can call it here.
      // showAppOpenOnStart();
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0b1220' }}>
        <StatusBar barStyle="light-content" />
        <Game
          lanes={[]}
          player={{ x: 0, y: 0 }}
          onSwipe={() => {}}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
