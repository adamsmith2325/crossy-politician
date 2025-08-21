// src/game/Game.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Button } from 'react-native';
import VoxelScene from './VoxelScene';
import UsernameModal from '../ui/UsernameModal';
import LeaderboardModal from '../ui/LeaderboardModal';
import { submitScore, fetchTopScores, RemoteRow } from '../utils/remoteLeaderboard';
import AsyncStorage from '@react-native-async-storage/async-storage';


export default function Game() {
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [username, setUsername] = useState('');
  const [isUsernameModalVisible, setIsUsernameModalVisible] = useState(false);
  const [isLeaderboardVisible, setIsLeaderboardVisible] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<RemoteRow[]>([]);
  const [lastScore, setLastScore] = useState(0);

  useEffect(() => {
    // Load best score and username from local storage
    const loadData = async () => {
      const storedBest = await AsyncStorage.getItem('bestScore');
      if (storedBest) setBest(parseInt(storedBest, 10));
      const storedUsername = await AsyncStorage.getItem('username');
      if (storedUsername) setUsername(storedUsername);
    };
    loadData();
  }, []);

  const startGame = () => {
    setScore(0);
    setStarted(true);
  };

  const handleGameOver = (finalScore: number) => {
    setStarted(false);
    setLastScore(finalScore);
    if (finalScore > best) {
      setBest(finalScore);
      AsyncStorage.setItem('bestScore', finalScore.toString());
    }
    if (username) {
      submitScore(username, finalScore);
    } else {
      setIsUsernameModalVisible(true);
    }
  };

  const handleSaveUsername = async (name: string) => {
    setUsername(name);
    await AsyncStorage.setItem('username', name);
    setIsUsernameModalVisible(false);
    await submitScore(name, lastScore);
  };

  const showLeaderboard = async () => {
    const topScores = await fetchTopScores();
    setLeaderboardData(topScores);
    setIsLeaderboardVisible(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0b1220' }}>
      {!started ? (
        <View style={styles.menu}>
          <Text style={styles.title}>Crossy Politician</Text>
          <TouchableOpacity style={styles.button} onPress={startGame}>
            <Text style={styles.buttonText}>Start</Text>
          </TouchableOpacity>
          <Button title="Leaderboard" onPress={showLeaderboard} />
          <Text style={styles.best}>Best: {best}</Text>
        </View>
      ) : (
        <VoxelScene score={score} setScore={setScore} onGameOver={handleGameOver} />
      )}
      <UsernameModal
        visible={isUsernameModalVisible}
        initial={username}
        onSave={handleSaveUsername}
        onCancel={() => setIsUsernameModalVisible(false)}
      />
      <LeaderboardModal
        visible={isLeaderboardVisible}
        onClose={() => setIsLeaderboardVisible(false)}
        title="Leaderboard"
        items={leaderboardData}
      />
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
