import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { SafeAreaView, StatusBar, Platform } from 'react-native';
import Game from './game/Game';
import mobileAds from 'react-native-google-mobile-ads';
// import { showAppOpenOnStart } from './ads/adManager';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as TrackingTransparency from 'expo-tracking-transparency';

export default function App() {
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'ios') {
        try { await TrackingTransparency.requestTrackingPermissionsAsync(); } catch {}
      }
      await mobileAds().initialize();
      // showAppOpenOnStart();
    })();
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
