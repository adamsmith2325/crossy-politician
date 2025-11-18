// src/components/AchievementsModal.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal } from 'react-native';
import type { Achievement } from '../game/achievementsManager';

interface AchievementsModalProps {
  visible: boolean;
  achievements: Achievement[];
  unlockedThisSession: Achievement[];
  onClose: () => void;
}

export default function AchievementsModal({
  visible,
  achievements,
  unlockedThisSession,
  onClose,
}: AchievementsModalProps) {
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  const progressPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>Achievements</Text>

          {achievements.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Loading achievements...</Text>
            </View>
          ) : (
            <>
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                  {unlockedCount} / {totalCount} ({progressPercent}%)
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                </View>
              </View>

              {unlockedThisSession.length > 0 && (
                <View style={styles.newAchievementsContainer}>
                  <Text style={styles.newAchievementsTitle}>🎉 Unlocked This Session!</Text>
                  {unlockedThisSession.map(achievement => (
                    <View key={achievement.id} style={styles.newAchievementItem}>
                      <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                      <Text style={styles.newAchievementText}>{achievement.title}</Text>
                    </View>
                  ))}
                </View>
              )}

              <ScrollView style={styles.achievementsList} showsVerticalScrollIndicator={true}>
                {achievements.map(achievement => (
                  <View
                    key={achievement.id}
                    style={[
                      styles.achievementItem,
                      achievement.unlocked && styles.achievementUnlocked,
                    ]}
                  >
                    <View style={styles.achievementIconContainer}>
                      <Text style={[
                        styles.achievementIcon,
                        !achievement.unlocked && styles.achievementIconLocked
                      ]}>
                        {achievement.unlocked ? achievement.icon : '🔒'}
                      </Text>
                    </View>
                    <View style={styles.achievementTextContainer}>
                      <Text style={[
                        styles.achievementTitle,
                        !achievement.unlocked && styles.achievementTitleLocked
                      ]}>
                        {achievement.title}
                      </Text>
                      <Text style={styles.achievementDescription}>
                        {achievement.description}
                      </Text>
                      {achievement.progress !== undefined && achievement.maxProgress !== undefined && (
                        <View style={styles.achievementProgressBar}>
                          <View
                            style={[
                              styles.achievementProgressFill,
                              { width: `${(achievement.progress / achievement.maxProgress) * 100}%` }
                            ]}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </>
          )}

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 18, 32, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: '#0b1220',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#1e90ff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9db4d1',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 20,
    backgroundColor: '#1a2330',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1e90ff',
    borderRadius: 10,
  },
  newAchievementsContainer: {
    backgroundColor: '#2a3a50',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  newAchievementsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffd966',
    marginBottom: 8,
    textAlign: 'center',
  },
  newAchievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  newAchievementText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  achievementsList: {
    maxHeight: 400,
    marginBottom: 16,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a2330',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    opacity: 0.6,
  },
  achievementUnlocked: {
    opacity: 1,
    borderWidth: 2,
    borderColor: '#ffd966',
  },
  achievementIconContainer: {
    marginRight: 12,
  },
  achievementIcon: {
    fontSize: 36,
  },
  achievementIconLocked: {
    opacity: 0.3,
  },
  achievementTextContainer: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  achievementTitleLocked: {
    color: '#6b7888',
  },
  achievementDescription: {
    fontSize: 14,
    color: '#9db4d1',
  },
  achievementProgressBar: {
    height: 8,
    backgroundColor: '#2a3a50',
    borderRadius: 4,
    marginTop: 6,
    overflow: 'hidden',
  },
  achievementProgressFill: {
    height: '100%',
    backgroundColor: '#1e90ff',
    borderRadius: 4,
  },
  closeButton: {
    backgroundColor: '#1e90ff',
    padding: 14,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#9db4d1',
    fontSize: 16,
    textAlign: 'center',
  },
});
