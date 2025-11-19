// App.tsx
import 'react-native-gesture-handler';
import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import Game from './game/Game'; // <-- inside this file, use: `import { THREE } from 'expo-three'`

export default function App() {

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0b1220' }}>
        <StatusBar barStyle="light-content" />
        <Game />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
