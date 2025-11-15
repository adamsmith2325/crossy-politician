// src/game/Game.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import VoxelScene from './VoxelScene';
import Leaderboard from '../components/Leaderboard';
import AchievementsModal from '../components/AchievementsModal';
import { saveScore } from '../lib/leaderboard';
import BannerAd from '../ads/BannerAd';
import { interstitialAdManager } from '../ads/InterstitialAdManager';
import { useAchievements } from './achievementsManager';

type GameState = 'menu' | 'playing' | 'gameOver';

export default function Game() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [username, setUsername] = useState('');
  const [savedScore, setSavedScore] = useState(false);
  const [viewingLeaderboard, setViewingLeaderboard] = useState(false);
  const [viewingAchievements, setViewingAchievements] = useState(false);
  const [survivalTime, setSurvivalTime] = useState(0);
  const [bestTime, setBestTime] = useState(0);

  const [gameKey, setGameKey] = useState(0);

  // Achievements system
  const {
    achievements,
    unlockedThisSession,
    checkAchievements,
    resetSessionAchievements,
  } = useAchievements();

  const startGame = () => {
    console.log('Game: Starting new game');
    setScore(0);
    setSavedScore(false);
    setGameKey(prev => prev + 1); // Force remount of VoxelScene
    setGameState('playing');
  };

  const handleGameOver = (finalScore: number, time: number, gameStats?: {
    dodges: number;
    jumps: number;
    busesDodged: number;
    policeDodged: number;
    closeCall: boolean;
  }) => {
    setGameState('gameOver');
    setBest(Math.max(best, finalScore));
    setSurvivalTime(time);
    setBestTime(Math.max(bestTime, time));

    // Check achievements
    if (gameStats) {
      checkAchievements({
        score: finalScore,
        survivalTime: time,
        ...gameStats,
      });
    }

    // Show interstitial ad every 5 games
    interstitialAdManager.onGameEnd();
  };

  const handleSaveScore = async () => {
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }

    const success = await saveScore(username.trim(), score);
    if (success) {
      setSavedScore(true);
      setViewingLeaderboard(true);
    } else {
      alert('Failed to save score. Please try again.');
    }
  };

  const handleBackToMenu = () => {
    setGameState('menu');
    setViewingLeaderboard(false);
    setViewingAchievements(false);
    setSavedScore(false);
    setUsername('');
    resetSessionAchievements();
  };

  if (gameState === 'playing') {
    console.log('Game: Rendering playing state with key:', gameKey);
    return (
      <View style={{ flex: 1, backgroundColor: '#0b1220' }}>
        <VoxelScene key={gameKey} score={score} setScore={setScore} onGameOver={handleGameOver} />
        <View style={styles.scoreOverlay}>
          <Text style={styles.scoreText}>Score: {score}</Text>
        </View>
        <View style={styles.bannerContainer}>
          <BannerAd />
        </View>
      </View>
    );
  }

  if (gameState === 'gameOver') {
    if (viewingLeaderboard) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0b1220' }}>
          <Leaderboard currentScore={savedScore ? score : undefined} />
          <View style={styles.bottomButtonContainer}>
            <TouchableOpacity style={styles.button} onPress={handleBackToMenu}>
              <Text style={styles.buttonText}>Back to Menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#0b1220' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.menu}>
          <Text style={styles.title}>Game Over!</Text>
          <Text style={styles.finalScore}>Score: {score}</Text>
          <Text style={styles.survivalTime}>
            You survived {survivalTime.toFixed(1)} seconds
          </Text>
          <Text style={styles.bestTimeText}>
            Best: {bestTime.toFixed(1)} seconds
          </Text>
          {score > best && score > 0 && (
            <Text style={styles.newBest}>New Personal Best Score!</Text>
          )}
          {survivalTime > bestTime - 0.1 && survivalTime > 0 && (
            <Text style={styles.newBest}>New Best Time!</Text>
          )}

          {!savedScore ? (
            <>
              <Text style={styles.subtitle}>Save your score</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor="#6b7888"
                value={username}
                onChangeText={setUsername}
                maxLength={20}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.button} onPress={handleSaveScore}>
                <Text style={styles.buttonText}>Save & View Leaderboard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setViewingLeaderboard(true)}>
                <Text style={styles.secondaryButtonText}>View Leaderboard</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.button} onPress={() => setViewingLeaderboard(true)}>
              <Text style={styles.buttonText}>View Leaderboard</Text>
            </TouchableOpacity>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.button} onPress={startGame}>
              <Text style={styles.buttonText}>Try Again?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.achievementsButton}
              onPress={() => setViewingAchievements(true)}
            >
              <Text style={styles.buttonText}>
                🏆 Achievements
                {unlockedThisSession.length > 0 && ` (${unlockedThisSession.length} new!)`}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleBackToMenu}>
            <Text style={styles.secondaryButtonText}>Main Menu</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Menu state
  return (
    <View style={{ flex: 1, backgroundColor: '#0b1220' }}>
      <View style={styles.menu}>
        <Text style={styles.title}>Crossy Politician</Text>
        <Text style={styles.subtitle}>Navigate the city streets!</Text>
        <TouchableOpacity style={styles.button} onPress={startGame}>
          <Text style={styles.buttonText}>Start Game</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => setViewingLeaderboard(true)}>
          <Text style={styles.secondaryButtonText}>Leaderboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.achievementsButton}
          onPress={() => setViewingAchievements(true)}
        >
          <Text style={styles.buttonText}>🏆 Achievements</Text>
        </TouchableOpacity>
        {best > 0 && <Text style={styles.best}>Personal Best: {best}</Text>}
      </View>

      {viewingLeaderboard && (
        <View style={styles.leaderboardOverlay}>
          <View style={styles.leaderboardContainer}>
            <Leaderboard />
            <TouchableOpacity style={styles.closeButton} onPress={() => setViewingLeaderboard(false)}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <AchievementsModal
        visible={viewingAchievements}
        achievements={achievements}
        unlockedThisSession={unlockedThisSession}
        onClose={() => setViewingAchievements(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10
  },
  subtitle: {
    fontSize: 16,
    color: '#9db4d1',
    marginBottom: 30
  },
  finalScore: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1e90ff',
    marginBottom: 10,
  },
  survivalTime: {
    fontSize: 24,
    fontWeight: '600',
    color: '#9db4d1',
    marginBottom: 5,
  },
  bestTimeText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffd966',
    marginBottom: 10,
  },
  newBest: {
    fontSize: 20,
    color: '#ffd966',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#1a2330',
    color: '#fff',
    fontSize: 18,
    padding: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    maxWidth: 300,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#2a3a50',
  },
  button: {
    backgroundColor: '#1e90ff',
    padding: 14,
    paddingHorizontal: 40,
    borderRadius: 8,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  secondaryButton: {
    backgroundColor: '#2a3a50',
    padding: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#9db4d1',
    fontSize: 16,
    fontWeight: '600',
  },
  best: {
    fontSize: 18,
    color: '#ffd966',
    fontWeight: 'bold',
    marginTop: 20
  },
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
  bannerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  leaderboardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 18, 32, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaderboardContainer: {
    width: '90%',
    height: '80%',
    backgroundColor: '#0b1220',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#1e90ff',
  },
  closeButton: {
    backgroundColor: '#1e90ff',
    padding: 14,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  bottomButtonContainer: {
    padding: 20,
    backgroundColor: '#0b1220',
  },
  buttonRow: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  achievementsButton: {
    backgroundColor: '#ffd966',
    padding: 14,
    paddingHorizontal: 40,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
});
