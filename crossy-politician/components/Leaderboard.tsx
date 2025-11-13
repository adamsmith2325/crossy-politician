import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { getTopScores, LeaderboardEntry } from '../lib/leaderboard';

interface LeaderboardProps {
  currentScore?: number;
}

export default function Leaderboard({ currentScore }: LeaderboardProps) {
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    setLoading(true);
    const topScores = await getTopScores(10);
    setScores(topScores);
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Leaderboard</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e90ff" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Leaderboard</Text>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {scores.length === 0 ? (
          <Text style={styles.emptyText}>No scores yet. Be the first!</Text>
        ) : (
          scores.map((entry, index) => {
            const isCurrentScore = currentScore !== undefined && entry.score === currentScore;
            return (
              <View
                key={entry.id || index}
                style={[
                  styles.row,
                  isCurrentScore && styles.highlightRow
                ]}
              >
                <View style={styles.rankContainer}>
                  {index < 3 ? (
                    <Text style={[styles.rankEmoji, index === 0 && styles.goldRank]}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                    </Text>
                  ) : (
                    <Text style={styles.rank}>{index + 1}</Text>
                  )}
                </View>
                <Text style={[styles.username, isCurrentScore && styles.highlightText]} numberOfLines={1}>
                  {entry.username}
                </Text>
                <Text style={[styles.score, isCurrentScore && styles.highlightText]}>
                  {entry.score}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9db4d1',
    textAlign: 'center',
    marginTop: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a2330',
    marginHorizontal: 20,
    marginVertical: 6,
    padding: 16,
    borderRadius: 10,
  },
  highlightRow: {
    backgroundColor: '#2a4560',
    borderWidth: 2,
    borderColor: '#1e90ff',
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rank: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#9db4d1',
  },
  rankEmoji: {
    fontSize: 24,
  },
  goldRank: {
    fontSize: 28,
  },
  username: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 12,
  },
  score: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffd966',
    marginLeft: 12,
  },
  highlightText: {
    color: '#1e90ff',
  },
});
