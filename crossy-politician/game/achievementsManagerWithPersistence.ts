import { useState, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getOrCreateUserProfile,
  getUserAchievements,
  unlockMultipleAchievements,
  getUserStats,
  updateUserStats,
} from '../lib/achievementsApi';
import type { Achievement, AchievementStats } from './achievementsManager';

const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, 'unlocked'>[] = [
  { id: 'first_steps', title: 'First Steps', description: 'Complete your first hop', icon: '🐣' },
  { id: 'survivor_10', title: 'Survivor', description: 'Survive for 10 seconds', icon: '⏱️' },
  { id: 'survivor_30', title: 'Seasoned Survivor', description: 'Survive for 30 seconds', icon: '🏃' },
  { id: 'survivor_60', title: 'Marathon Runner', description: 'Survive for 60 seconds', icon: '🏆' },
  { id: 'dodger_10', title: 'Traffic Weaver', description: 'Dodge 10 vehicles in one game', icon: '🚗' },
  { id: 'dodger_25', title: 'Fake News Dodger', description: 'Dodge 25 vehicles in one game', icon: '📰' },
  { id: 'dodger_50', title: 'Traffic Master', description: 'Dodge 50 vehicles in one game', icon: '🎯' },
  { id: 'score_10', title: 'Getting Started', description: 'Reach a score of 10', icon: '🌟' },
  { id: 'score_25', title: 'Rising Star', description: 'Reach a score of 25', icon: '⭐' },
  { id: 'score_50', title: 'Political Powerhouse', description: 'Reach a score of 50', icon: '👑' },
  { id: 'jumper_100', title: 'Hop Hop Hop!', description: 'Make 100 total jumps', icon: '🦘' },
  { id: 'bus_dodger', title: 'Bus Dodger', description: 'Dodge 5 buses in one game', icon: '🚌' },
  { id: 'police_evader', title: 'Police Evader', description: 'Dodge 10 police cars in one game', icon: '🚓' },
  { id: 'veteran', title: 'Veteran Politician', description: 'Play 10 games', icon: '🎮' },
  { id: 'dedicated', title: 'Dedicated Player', description: 'Play 50 games', icon: '💪' },
  { id: 'close_call', title: 'Close Call', description: 'Dodge a vehicle by less than 0.5 units', icon: '😰' },
  { id: 'speed_demon', title: 'Speed Demon', description: 'Reach score 20 in under 15 seconds', icon: '⚡' },
];

const STORAGE_KEY_USERNAME = '@crossy_politician_username';

export function useAchievementsWithPersistence() {
  const [achievements, setAchievements] = useState<Achievement[]>(
    ACHIEVEMENT_DEFINITIONS.map(def => ({ ...def, unlocked: false }))
  );
  const [unlockedThisSession, setUnlockedThisSession] = useState<Achievement[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const statsRef = useRef<AchievementStats>({
    totalDodges: 0,
    totalJumps: 0,
    maxScore: 0,
    maxSurvivalTime: 0,
    gamesPlayed: 0,
    totalDeaths: 0,
    vehiclesDodged: {
      cars: 0,
      trucks: 0,
      buses: 0,
      police: 0,
      ambulances: 0,
      taxis: 0,
    },
  });

  // Load saved username and achievements on mount
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setIsLoading(true);

      // Load saved username
      const savedUsername = await AsyncStorage.getItem(STORAGE_KEY_USERNAME);

      if (savedUsername) {
        setUsername(savedUsername);
        await initializeUserProfile(savedUsername);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeUserProfile = async (username: string) => {
    try {
      // Get or create user profile
      const profile = await getOrCreateUserProfile(username);
      if (!profile) {
        console.error('Failed to get or create user profile');
        return;
      }

      setUserId(profile.id);

      // Load user's unlocked achievements
      const unlockedIds = await getUserAchievements(profile.id);

      setAchievements(prev =>
        prev.map(a => ({
          ...a,
          unlocked: unlockedIds.includes(a.id),
        }))
      );

      // Load user stats
      const stats = await getUserStats(profile.id);
      if (stats) {
        statsRef.current = stats as AchievementStats;
      }
    } catch (error) {
      console.error('Error initializing user profile:', error);
    }
  };

  const saveUsername = async (newUsername: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_USERNAME, newUsername);
      setUsername(newUsername);
      await initializeUserProfile(newUsername);
    } catch (error) {
      console.error('Error saving username:', error);
    }
  };

  const checkAchievement = (id: string, condition: boolean) => {
    if (condition) {
      setAchievements(prev => {
        const achievement = prev.find(a => a.id === id);
        if (achievement && !achievement.unlocked) {
          const updated = prev.map(a =>
            a.id === id ? { ...a, unlocked: true } : a
          );
          const unlockedAchievement = { ...achievement, unlocked: true };
          setUnlockedThisSession(current => [...current, unlockedAchievement]);

          return updated;
        }
        return prev;
      });
    }
  };

  const updateStats = (updates: Partial<AchievementStats>) => {
    statsRef.current = { ...statsRef.current, ...updates };
  };

  const checkAchievements = async (gameStats: {
    score: number;
    survivalTime: number;
    dodges: number;
    jumps: number;
    busesDodged: number;
    policeDodged: number;
    closeCall: boolean;
  }) => {
    // Update global stats
    updateStats({
      maxScore: Math.max(statsRef.current.maxScore, gameStats.score),
      maxSurvivalTime: Math.max(statsRef.current.maxSurvivalTime, gameStats.survivalTime),
      totalDodges: statsRef.current.totalDodges + gameStats.dodges,
      totalJumps: statsRef.current.totalJumps + gameStats.jumps,
      gamesPlayed: statsRef.current.gamesPlayed + 1,
      totalDeaths: statsRef.current.totalDeaths + 1,
      vehiclesDodged: {
        ...statsRef.current.vehiclesDodged,
        buses: statsRef.current.vehiclesDodged.buses + gameStats.busesDodged,
        police: statsRef.current.vehiclesDodged.police + gameStats.policeDodged,
      },
    });

    // Check achievements
    const newAchievementIds: string[] = [];

    const checkAndTrack = (id: string, condition: boolean) => {
      if (condition && !achievements.find(a => a.id === id)?.unlocked) {
        newAchievementIds.push(id);
        checkAchievement(id, condition);
      }
    };

    checkAndTrack('first_steps', gameStats.jumps >= 1);
    checkAndTrack('survivor_10', gameStats.survivalTime >= 10);
    checkAndTrack('survivor_30', gameStats.survivalTime >= 30);
    checkAndTrack('survivor_60', gameStats.survivalTime >= 60);
    checkAndTrack('dodger_10', gameStats.dodges >= 10);
    checkAndTrack('dodger_25', gameStats.dodges >= 25);
    checkAndTrack('dodger_50', gameStats.dodges >= 50);
    checkAndTrack('score_10', gameStats.score >= 10);
    checkAndTrack('score_25', gameStats.score >= 25);
    checkAndTrack('score_50', gameStats.score >= 50);
    checkAndTrack('jumper_100', statsRef.current.totalJumps >= 100);
    checkAndTrack('bus_dodger', gameStats.busesDodged >= 5);
    checkAndTrack('police_evader', gameStats.policeDodged >= 10);
    checkAndTrack('veteran', statsRef.current.gamesPlayed >= 10);
    checkAndTrack('dedicated', statsRef.current.gamesPlayed >= 50);
    checkAndTrack('close_call', gameStats.closeCall);
    checkAndTrack('speed_demon', gameStats.score >= 20 && gameStats.survivalTime <= 15);

    // Save to Supabase if user is set up
    if (userId && newAchievementIds.length > 0) {
      await unlockMultipleAchievements(userId, newAchievementIds);
    }

    if (userId) {
      await updateUserStats(userId, statsRef.current);
    }
  };

  const resetSessionAchievements = () => {
    setUnlockedThisSession([]);
  };

  return {
    achievements,
    unlockedThisSession,
    checkAchievements,
    resetSessionAchievements,
    stats: statsRef.current,
    username,
    saveUsername,
    isLoading,
  };
}
