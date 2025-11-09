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
          <Text style={styles.subtitle}>Navigate the city streets!</Text>
          <TouchableOpacity style={styles.button} onPress={startGame}>
            <Text style={styles.buttonText}>Start</Text>
          </TouchableOpacity>
          {best > 0 && <Text style={styles.best}>Best Score: {best}</Text>}
          {score > 0 && <Text style={styles.lastScore}>Last Score: {score}</Text>}
        </View>
      ) : (
        <>
          <VoxelScene score={score} setScore={setScore} onGameOver={handleGameOver} />
          <View style={styles.scoreOverlay}>
            <Text style={styles.scoreText}>Score: {score}</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#9db4d1', marginBottom: 30 },
  button: { backgroundColor: '#1e90ff', padding: 14, paddingHorizontal: 40, borderRadius: 8, marginBottom: 20 },
  buttonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  best: { fontSize: 18, color: '#ffd966', fontWeight: 'bold', marginBottom: 8 },
  lastScore: { fontSize: 16, color: '#aaa' },
  scoreOverlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
});
