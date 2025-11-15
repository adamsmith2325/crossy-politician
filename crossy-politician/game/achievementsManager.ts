// src/game/achievementsManager.ts
import { useState, useRef } from 'react';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number;
  maxProgress?: number;
}

export interface AchievementStats {
  totalDodges: number;
  totalJumps: number;
  maxScore: number;
  maxSurvivalTime: number;
  gamesPlayed: number;
  totalDeaths: number;
  vehiclesDodged: {
    cars: number;
    trucks: number;
    buses: number;
    police: number;
    ambulances: number;
    taxis: number;
  };
}

const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, 'unlocked'>[] = [
  {
    id: 'first_steps',
    title: 'First Steps',
    description: 'Complete your first hop',
    icon: '🐣',
  },
  {
    id: 'survivor_10',
    title: 'Survivor',
    description: 'Survive for 10 seconds',
    icon: '⏱️',
  },
  {
    id: 'survivor_30',
    title: 'Seasoned Survivor',
    description: 'Survive for 30 seconds',
    icon: '🏃',
  },
  {
    id: 'survivor_60',
    title: 'Marathon Runner',
    description: 'Survive for 60 seconds',
    icon: '🏆',
  },
  {
    id: 'dodger_10',
    title: 'Traffic Weaver',
    description: 'Dodge 10 vehicles in one game',
    icon: '🚗',
  },
  {
    id: 'dodger_25',
    title: 'Fake News Dodger',
    description: 'Dodge 25 vehicles in one game',
    icon: '📰',
  },
  {
    id: 'dodger_50',
    title: 'Traffic Master',
    description: 'Dodge 50 vehicles in one game',
    icon: '🎯',
  },
  {
    id: 'score_10',
    title: 'Getting Started',
    description: 'Reach a score of 10',
    icon: '🌟',
  },
  {
    id: 'score_25',
    title: 'Rising Star',
    description: 'Reach a score of 25',
    icon: '⭐',
  },
  {
    id: 'score_50',
    title: 'Political Powerhouse',
    description: 'Reach a score of 50',
    icon: '👑',
  },
  {
    id: 'jumper_100',
    title: 'Hop Hop Hop!',
    description: 'Make 100 total jumps',
    icon: '🦘',
  },
  {
    id: 'bus_dodger',
    title: 'Bus Dodger',
    description: 'Dodge 5 buses in one game',
    icon: '🚌',
  },
  {
    id: 'police_evader',
    title: 'Police Evader',
    description: 'Dodge 10 police cars in one game',
    icon: '🚓',
  },
  {
    id: 'veteran',
    title: 'Veteran Politician',
    description: 'Play 10 games',
    icon: '🎮',
  },
  {
    id: 'dedicated',
    title: 'Dedicated Player',
    description: 'Play 50 games',
    icon: '💪',
  },
  {
    id: 'close_call',
    title: 'Close Call',
    description: 'Dodge a vehicle by less than 0.5 units',
    icon: '😰',
  },
  {
    id: 'speed_demon',
    title: 'Speed Demon',
    description: 'Reach score 20 in under 15 seconds',
    icon: '⚡',
  },
];

export function useAchievements() {
  const [achievements, setAchievements] = useState<Achievement[]>(
    ACHIEVEMENT_DEFINITIONS.map(def => ({ ...def, unlocked: false }))
  );

  const [unlockedThisSession, setUnlockedThisSession] = useState<Achievement[]>([]);

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

  const checkAchievement = (id: string, condition: boolean) => {
    if (condition) {
      setAchievements(prev => {
        const achievement = prev.find(a => a.id === id);
        if (achievement && !achievement.unlocked) {
          const updated = prev.map(a =>
            a.id === id ? { ...a, unlocked: true } : a
          );
          setUnlockedThisSession(current => [...current, { ...achievement, unlocked: true }]);
          return updated;
        }
        return prev;
      });
    }
  };

  const updateStats = (updates: Partial<AchievementStats>) => {
    statsRef.current = { ...statsRef.current, ...updates };
  };

  const checkAchievements = (gameStats: {
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
    });

    // Check achievements
    checkAchievement('first_steps', gameStats.jumps >= 1);
    checkAchievement('survivor_10', gameStats.survivalTime >= 10);
    checkAchievement('survivor_30', gameStats.survivalTime >= 30);
    checkAchievement('survivor_60', gameStats.survivalTime >= 60);
    checkAchievement('dodger_10', gameStats.dodges >= 10);
    checkAchievement('dodger_25', gameStats.dodges >= 25);
    checkAchievement('dodger_50', gameStats.dodges >= 50);
    checkAchievement('score_10', gameStats.score >= 10);
    checkAchievement('score_25', gameStats.score >= 25);
    checkAchievement('score_50', gameStats.score >= 50);
    checkAchievement('jumper_100', statsRef.current.totalJumps >= 100);
    checkAchievement('bus_dodger', gameStats.busesDodged >= 5);
    checkAchievement('police_evader', gameStats.policeDodged >= 10);
    checkAchievement('veteran', statsRef.current.gamesPlayed >= 10);
    checkAchievement('dedicated', statsRef.current.gamesPlayed >= 50);
    checkAchievement('close_call', gameStats.closeCall);
    checkAchievement('speed_demon', gameStats.score >= 20 && gameStats.survivalTime <= 15);
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
  };
}
