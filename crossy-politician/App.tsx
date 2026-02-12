// App.tsx
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import Game from './game/Game'; // <-- inside this file, use: `import { THREE } from 'expo-three'`
import { showAppOpenIfEligible } from './ads/adManager';
import { incrementAppOpenCount } from './ads/adCounters';

export default function App() {
  // Show AppOpen ad if eligible (every 5 app opens)
  useEffect(() => {
    const handleAppOpen = async () => {
      const openCount = await incrementAppOpenCount();
      await showAppOpenIfEligible(openCount);
    };
    handleAppOpen();
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
