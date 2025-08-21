// src/game/Game.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import VoxelScene from './VoxelScene';

export default function Game() {
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  const startGame = () => {
    setScore(0);
    setStarted(true);
  };

  const handleGameOver = (finalScore: number) => {
    setStarted(false);
    setBest(Math.max(best, finalScore));
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0b1220' }}>
      {!started ? (
        <View style={styles.menu}>
          <Text style={styles.title}>Crossy Politician</Text>
          <TouchableOpacity style={styles.button} onPress={startGame}>
            <Text style={styles.buttonText}>Start</Text>
          </TouchableOpacity>
          <Text style={styles.best}>Best: {best}</Text>
        </View>
      ) : (
        <VoxelScene score={score} setScore={setScore} onGameOver={handleGameOver} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  button: { backgroundColor: '#1e90ff', padding: 12, borderRadius: 8, marginBottom: 12 },
  buttonText: { color: '#fff', fontSize: 18 },
  best: { fontSize: 16, color: '#aaa' },
});
