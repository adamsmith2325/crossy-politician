// lib/analytics.ts
import { Mixpanel } from 'mixpanel-react-native';

const MIXPANEL_TOKEN = '3898825';

class Analytics {
  private mixpanel: Mixpanel | null = null;
  private initialized = false;

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      this.mixpanel = new Mixpanel(MIXPANEL_TOKEN, true);
      await this.mixpanel.init();
      this.initialized = true;
      console.log('Mixpanel initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Mixpanel:', error);
    }
  }

  // User Identification
  async identifyUser(username: string) {
    if (!this.mixpanel) return;
    try {
      await this.mixpanel.identify(username);
      await this.mixpanel.getPeople().set({
        $name: username,
        'Last Active': new Date().toISOString(),
      });
      console.log('User identified:', username);
    } catch (error) {
      console.error('Failed to identify user:', error);
    }
  }

  async setUserProperty(property: string, value: any) {
    if (!this.mixpanel) return;
    try {
      await this.mixpanel.getPeople().set({ [property]: value });
    } catch (error) {
      console.error('Failed to set user property:', error);
    }
  }

  async incrementUserProperty(property: string, value: number = 1) {
    if (!this.mixpanel) return;
    try {
      await this.mixpanel.getPeople().increment(property, value);
    } catch (error) {
      console.error('Failed to increment user property:', error);
    }
  }

  // Event Tracking
  async track(eventName: string, properties?: Record<string, any>) {
    if (!this.mixpanel) return;
    try {
      await this.mixpanel.track(eventName, properties);
      console.log('Event tracked:', eventName, properties);
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }

  // Game Lifecycle Events
  async trackAppOpen() {
    await this.track('App Opened');
  }

  async trackGameStart() {
    await this.track('Game Started', {
      timestamp: new Date().toISOString(),
    });
  }

  async trackGameOver(data: {
    score: number;
    survivalTime: number;
    dodges: number;
    jumps: number;
    busesDodged: number;
    policeDodged: number;
    closeCall: boolean;
  }) {
    await this.track('Game Over', {
      score: data.score,
      survival_time: data.survivalTime,
      dodges: data.dodges,
      jumps: data.jumps,
      buses_dodged: data.busesDodged,
      police_dodged: data.policeDodged,
      had_close_call: data.closeCall,
      timestamp: new Date().toISOString(),
    });

    // Update user properties with lifetime stats
    await this.incrementUserProperty('Total Games Played', 1);
    await this.incrementUserProperty('Total Score', data.score);
    await this.incrementUserProperty('Total Dodges', data.dodges);
    await this.incrementUserProperty('Total Jumps', data.jumps);
  }

  async trackMenuNavigation(destination: 'leaderboard' | 'achievements' | 'main_menu') {
    await this.track('Menu Navigation', {
      destination,
      timestamp: new Date().toISOString(),
    });
  }

  // User Actions
  async trackScoreSubmitted(score: number, username: string, leaderboardRank?: number) {
    await this.track('Score Submitted', {
      score,
      username,
      leaderboard_rank: leaderboardRank,
      timestamp: new Date().toISOString(),
    });
  }

  async trackAchievementUnlocked(achievement: {
    id: string;
    title: string;
    description: string;
  }) {
    await this.track('Achievement Unlocked', {
      achievement_id: achievement.id,
      achievement_title: achievement.title,
      achievement_description: achievement.description,
      timestamp: new Date().toISOString(),
    });

    await this.incrementUserProperty('Total Achievements Unlocked', 1);
  }

  async trackAchievementsViewed(totalAchievements: number, unlockedCount: number) {
    await this.track('Achievements Viewed', {
      total_achievements: totalAchievements,
      unlocked_count: unlockedCount,
      unlock_percentage: Math.round((unlockedCount / totalAchievements) * 100),
      timestamp: new Date().toISOString(),
    });
  }

  async trackLeaderboardViewed(userRank?: number) {
    await this.track('Leaderboard Viewed', {
      user_rank: userRank,
      timestamp: new Date().toISOString(),
    });
  }

  // Ad Events
  async trackAdDisplayed(adType: 'banner' | 'interstitial') {
    await this.track('Ad Displayed', {
      ad_type: adType,
      timestamp: new Date().toISOString(),
    });
  }

  async trackAdClicked(adType: 'banner' | 'interstitial') {
    await this.track('Ad Clicked', {
      ad_type: adType,
      timestamp: new Date().toISOString(),
    });
  }

  async trackAdError(adType: 'banner' | 'interstitial', errorMessage: string) {
    await this.track('Ad Error', {
      ad_type: adType,
      error_message: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }

  // Environment & Session
  async trackEnvironmentGenerated(environment: {
    season: string;
    timeOfDay: string;
    weather: string;
  }) {
    await this.track('Environment Generated', {
      season: environment.season,
      time_of_day: environment.timeOfDay,
      weather: environment.weather,
      timestamp: new Date().toISOString(),
    });
  }

  async trackUsernameSet(username: string) {
    await this.track('Username Set', {
      username,
      timestamp: new Date().toISOString(),
    });
  }

  // Performance & Errors
  async trackError(errorName: string, errorMessage: string, errorStack?: string) {
    await this.track('Error Occurred', {
      error_name: errorName,
      error_message: errorMessage,
      error_stack: errorStack,
      timestamp: new Date().toISOString(),
    });
  }

  // Flush events (call before app closes)
  async flush() {
    if (!this.mixpanel) return;
    try {
      await this.mixpanel.flush();
      console.log('Mixpanel events flushed');
    } catch (error) {
      console.error('Failed to flush Mixpanel:', error);
    }
  }

  // Reset user (for logout or new user)
  async reset() {
    if (!this.mixpanel) return;
    try {
      await this.mixpanel.reset();
      console.log('Mixpanel reset');
    } catch (error) {
      console.error('Failed to reset Mixpanel:', error);
    }
  }
}

// Export singleton instance
export const analytics = new Analytics();
