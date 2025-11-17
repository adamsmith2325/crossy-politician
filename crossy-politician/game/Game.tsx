// src/game/Game.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import VoxelScene from './VoxelScene';
import Leaderboard from '../components/Leaderboard';
import AchievementsModal from '../components/AchievementsModal';
import { saveScore } from '../lib/leaderboard';
import BannerAd from '../ads/BannerAd';
import { interstitialAdManager } from '../ads/InterstitialAdManager';
import { useAchievementsWithPersistence } from './achievementsManagerWithPersistence';
import { analytics } from '../lib/analytics';

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

  // Achievements system with Supabase persistence
  const {
    achievements,
    unlockedThisSession,
    checkAchievements,
    resetSessionAchievements,
    username: savedUsername,
    saveUsername,
    isLoading: achievementsLoading,
  } = useAchievementsWithPersistence();

  // Initialize username from saved value
  React.useEffect(() => {
    if (savedUsername && !username) {
      setUsername(savedUsername);
    }
  }, [savedUsername]);

  const startGame = () => {
    console.log('Game: Starting new game');
    setScore(0);
    setSavedScore(false);
    setGameKey(prev => prev + 1); // Force remount of VoxelScene
    setGameState('playing');

    // Track game start
    analytics.trackGameStart();
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

    // Track game over event with stats
    if (gameStats) {
      analytics.trackGameOver({
        score: finalScore,
        survivalTime: time,
        dodges: gameStats.dodges,
        jumps: gameStats.jumps,
        busesDodged: gameStats.busesDodged,
        policeDodged: gameStats.policeDodged,
        closeCall: gameStats.closeCall,
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

    // Save username for future use and initialize profile
    await saveUsername(username.trim());

    // Identify user in analytics
    await analytics.identifyUser(username.trim());
    await analytics.trackUsernameSet(username.trim());

    const success = await saveScore(username.trim(), score);
    if (success) {
      setSavedScore(true);
      setViewingLeaderboard(true);

      // Track score submission
      await analytics.trackScoreSubmitted(score, username.trim());
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

    // Track menu navigation
    analytics.trackMenuNavigation('main_menu');
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
          <AchievementsModal
            visible={viewingAchievements}
            achievements={achievements}
            unlockedThisSession={unlockedThisSession}
            onClose={() => setViewingAchievements(false)}
          />
        </View>
      );
    }

    const isNewBestScore = score > best && score > 0;
    const isNewBestTime = survivalTime > bestTime - 0.1 && survivalTime > 0;

    return (
      <KeyboardAvoidingView
        style={styles.gameOverContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.gameOverScroll}
          contentContainerStyle={styles.gameOverContent}
          showsVerticalScrollIndicator={true}
        >
          {/* Header */}
          <View style={styles.gameOverHeader}>
            <Text style={styles.gameOverTitle}>Game Over</Text>
            {(isNewBestScore || isNewBestTime) && (
              <View style={styles.newRecordBanner}>
                <Text style={styles.newRecordText}>✨ NEW RECORD! ✨</Text>
              </View>
            )}
          </View>

          {/* Score Card */}
          <View style={styles.scoreCard}>
            <View style={styles.scoreRow}>
              <View style={styles.scoreStat}>
                <Text style={styles.scoreLabel}>Final Score</Text>
                <Text style={styles.scoreValue}>{score}</Text>
                {isNewBestScore && <Text style={styles.bestBadge}>BEST!</Text>}
              </View>
              <View style={styles.scoreDivider} />
              <View style={styles.scoreStat}>
                <Text style={styles.scoreLabel}>Survival Time</Text>
                <Text style={styles.scoreValue}>{survivalTime.toFixed(1)}s</Text>
                {isNewBestTime && <Text style={styles.bestBadge}>BEST!</Text>}
              </View>
            </View>

            <View style={styles.personalBestRow}>
              <View style={styles.personalBestItem}>
                <Text style={styles.personalBestLabel}>Best Score</Text>
                <Text style={styles.personalBestValue}>{Math.max(best, score)}</Text>
              </View>
              <View style={styles.personalBestItem}>
                <Text style={styles.personalBestLabel}>Best Time</Text>
                <Text style={styles.personalBestValue}>{Math.max(bestTime, survivalTime).toFixed(1)}s</Text>
              </View>
            </View>
          </View>

          {/* New Achievements Banner */}
          {unlockedThisSession.length > 0 && (
            <View style={styles.achievementsBanner}>
              <Text style={styles.achievementsBannerIcon}>🏆</Text>
              <View style={styles.achievementsBannerText}>
                <Text style={styles.achievementsBannerTitle}>
                  {unlockedThisSession.length} New Achievement{unlockedThisSession.length > 1 ? 's' : ''}!
                </Text>
                <Text style={styles.achievementsBannerSubtitle}>
                  {unlockedThisSession.map(a => a.title).join(', ')}
                </Text>
              </View>
            </View>
          )}

          {/* Username Input Section */}
          {!savedScore && (
            <View style={styles.leaderboardSection}>
              <Text style={styles.leaderboardPrompt}>Save to Leaderboard</Text>
              <TextInput
                style={styles.usernameInput}
                placeholder="Enter your name"
                placeholderTextColor="#6b7888"
                value={username}
                onChangeText={setUsername}
                maxLength={20}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {!savedScore ? (
              <>
                <TouchableOpacity
                  style={[styles.primaryButton, !username.trim() && styles.buttonDisabled]}
                  onPress={handleSaveScore}
                  disabled={!username.trim()}
                >
                  <Text style={styles.primaryButtonText}>💾 Save & View Leaderboard</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButtonAlt} onPress={() => setViewingLeaderboard(true)}>
                  <Text style={styles.secondaryButtonAltText}>View Leaderboard</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.primaryButton} onPress={() => setViewingLeaderboard(true)}>
                <Text style={styles.primaryButtonText}>View Leaderboard</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.playAgainButton} onPress={startGame}>
              <Text style={styles.playAgainButtonText}>🎮 Play Again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.achievementsButtonAlt}
              onPress={() => {
                setViewingAchievements(true);
                analytics.trackAchievementsViewed(achievements.length, achievements.filter(a => a.unlocked).length);
              }}
            >
              <Text style={styles.achievementsButtonAltText}>
                View All Achievements
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuButton} onPress={handleBackToMenu}>
              <Text style={styles.menuButtonText}>Main Menu</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <AchievementsModal
          visible={viewingAchievements}
          achievements={achievements}
          unlockedThisSession={unlockedThisSession}
          onClose={() => setViewingAchievements(false)}
        />
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
        <TouchableOpacity style={styles.secondaryButton} onPress={() => {
          setViewingLeaderboard(true);
          analytics.trackMenuNavigation('leaderboard');
          analytics.trackLeaderboardViewed();
        }}>
          <Text style={styles.secondaryButtonText}>Leaderboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.achievementsButton}
          onPress={() => {
            setViewingAchievements(true);
            analytics.trackMenuNavigation('achievements');
            analytics.trackAchievementsViewed(achievements.length, achievements.filter(a => a.unlocked).length);
          }}
        >
          <Text style={styles.achievementsButtonText}>Achievements</Text>
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
  best: {
    fontSize: 18,
    color: '#ffd966',
    fontWeight: 'bold',
    marginTop: 20
  },
  // Game Over Screen Styles
  gameOverContainer: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  gameOverScroll: {
    flex: 1,
  },
  gameOverContent: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  gameOverHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  gameOverTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  newRecordBanner: {
    backgroundColor: '#ffd966',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newRecordText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0b1220',
  },
  scoreCard: {
    backgroundColor: '#1a2330',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#2a3a50',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a3a50',
  },
  scoreStat: {
    alignItems: 'center',
    flex: 1,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#9db4d1',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scoreValue: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#1e90ff',
  },
  bestBadge: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffd966',
    backgroundColor: 'rgba(255, 217, 102, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreDivider: {
    width: 1,
    backgroundColor: '#2a3a50',
    marginHorizontal: 16,
  },
  personalBestRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  personalBestItem: {
    alignItems: 'center',
    flex: 1,
  },
  personalBestLabel: {
    fontSize: 12,
    color: '#6b7888',
    fontWeight: '600',
    marginBottom: 4,
  },
  personalBestValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffd966',
  },
  achievementsBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 217, 102, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#ffd966',
    alignItems: 'center',
  },
  achievementsBannerIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  achievementsBannerText: {
    flex: 1,
  },
  achievementsBannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffd966',
    marginBottom: 4,
  },
  achievementsBannerSubtitle: {
    fontSize: 13,
    color: '#9db4d1',
  },
  leaderboardSection: {
    marginBottom: 20,
  },
  leaderboardPrompt: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9db4d1',
    marginBottom: 12,
    textAlign: 'center',
  },
  usernameInput: {
    backgroundColor: '#1a2330',
    color: '#fff',
    fontSize: 18,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2a3a50',
    textAlign: 'center',
  },
  actionsContainer: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#1e90ff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonAlt: {
    backgroundColor: '#2a3a50',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonAltText: {
    color: '#9db4d1',
    fontSize: 15,
    fontWeight: '600',
  },
  playAgainButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  playAgainButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  achievementsButtonAlt: {
    backgroundColor: 'rgba(255, 217, 102, 0.2)',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffd966',
  },
  achievementsButtonAltText: {
    color: '#ffd966',
    fontSize: 15,
    fontWeight: 'bold',
  },
  menuButton: {
    backgroundColor: 'transparent',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  menuButtonText: {
    color: '#6b7888',
    fontSize: 15,
    fontWeight: '600',
  },
  // Legacy Styles (for menu and other screens)
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
    padding: 14,
    paddingHorizontal: 40,
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
  achievementsButton: {
    backgroundColor: '#2a3a50',
    padding: 14,
    paddingHorizontal: 40,
    borderRadius: 8,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  achievementsButtonText: {
    color: '#9db4d1',
    fontSize: 16,
    fontWeight: '600',
  },
});
