// App.tsx
import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { SafeAreaView, StatusBar, Platform, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as TrackingTransparency from 'expo-tracking-transparency';
import mobileAds from 'react-native-google-mobile-ads';

import Game from './game/Game'; // <-- inside this file, use: `import { THREE } from 'expo-three'`
import { appOpenAdManager } from './ads/AppOpenAdManager';

export default function App() {
  const appState = useRef(AppState.currentState);

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
    })();
  }, []);

  // Show app open ad when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        appOpenAdManager.showIfReady();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0b1220' }}>
        <StatusBar barStyle="light-content" />
        <Game />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
