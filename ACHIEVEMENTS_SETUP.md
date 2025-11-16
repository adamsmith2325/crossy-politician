# Achievements System Setup Guide

This guide explains how to set up and use the persistent achievements system in Crossy Politician.

## Overview

The game now features a complete achievement tracking system that persists to Supabase, allowing players to:
- Track 17 different achievements
- Save progress across sessions
- View achievement leaderboards
- See detailed stats

## Setup Instructions

### 1. Apply Database Migrations

You need to create the necessary tables in your Supabase database.

**Option A: Using Supabase Dashboard (Easiest)**

1. Log in to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor**
4. Copy and paste the contents of each migration file in order:
   - `supabase/migrations/20241116000001_create_user_achievements.sql`
   - `supabase/migrations/20241116000002_add_achievement_leaderboard_function.sql`
5. Click **Run** for each migration

**Option B: Using Supabase CLI**

```bash
# Install Supabase CLI (if not already installed)
npm install supabase --save-dev

# Link to your project
npx supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
npx supabase db push
```

### 2. Verify Environment Variables

Make sure your `.env` file has the correct Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Test the System

1. Start the app: `npm start`
2. Play a game and complete some achievements
3. Enter a username when prompted
4. Your achievements will be saved automatically!
5. Check the Achievements screen to see your progress

## Features

### Automatic Achievement Tracking

Achievements are automatically checked and unlocked based on game performance:

- **First Steps**: Complete your first hop
- **Survivor** (3 tiers): Survive for 10/30/60 seconds
- **Traffic Weaver** (3 tiers): Dodge 10/25/50 vehicles
- **Score Milestones**: Reach scores of 10/25/50
- **Hop Master**: Make 100 total jumps
- **Vehicle-Specific**: Dodge buses and police cars
- **Dedication**: Play 10 or 50 games
- **Skill-Based**: Close calls and speed runs

### Persistence

- **Local Storage**: Username is saved locally using AsyncStorage
- **Supabase**: Achievements and stats are synced to the cloud
- **Automatic Sync**: New achievements are saved immediately
- **Resume Progress**: Achievements persist across app restarts

### Game Over Screen Improvements

The game over screen now features:
- Beautiful card-based layout
- Clear score and time statistics
- Personal best tracking
- New achievement notifications
- Streamlined leaderboard saving
- Professional design with proper spacing and colors

## Database Schema

### Tables Created

1. **user_profiles**
   - Stores username and basic user info
   - Primary key: `id` (UUID)

2. **user_achievements**
   - Links users to unlocked achievements
   - Unique constraint prevents duplicates

3. **user_stats**
   - Tracks cumulative player statistics
   - One record per user

### Security

- Row Level Security (RLS) is enabled on all tables
- Anonymous users can read and write (suitable for mobile games)
- No authentication required - users identified by username

## Usage in Code

### Get Achievement Data

```typescript
import { useAchievementsWithPersistence } from './game/achievementsManagerWithPersistence';

const {
  achievements,        // Array of all achievements with unlock status
  unlockedThisSession, // Newly unlocked achievements
  checkAchievements,   // Function to check and unlock achievements
  username,            // Current saved username
  saveUsername,        // Save username and initialize profile
  isLoading,          // Loading state
} = useAchievementsWithPersistence();
```

### Save Achievements

Achievements are automatically saved when `checkAchievements()` is called with game stats.

### Query Functions

The `lib/achievementsApi.ts` file provides functions for:
- `getOrCreateUserProfile()` - Get or create user by username
- `getUserAchievements()` - Fetch user's unlocked achievements
- `unlockAchievement()` - Unlock a single achievement
- `getUserStats()` - Get user's cumulative stats
- `updateUserStats()` - Update user statistics
- `getAchievementLeaderboard()` - Get top achievement earners

## Troubleshooting

### Achievements Not Saving

1. Check Supabase connection in logs
2. Verify migrations were applied correctly
3. Check RLS policies in Supabase dashboard
4. Ensure username is set before playing

### Duplicate Entries

The database schema prevents duplicate achievements automatically using unique constraints.

### Performance

- Achievements are checked locally first
- Only new achievements trigger database writes
- Stats are updated in batches
- Leaderboard queries are optimized with indexes

## Future Enhancements

Possible improvements:
- User authentication (email/social login)
- Achievement categories and rarities
- Daily/weekly challenges
- Social features (compare with friends)
- Achievement notifications with animations
- Cloud save for all game data

## Support

For issues or questions:
1. Check the Supabase logs in the dashboard
2. Review the browser/app console for errors
3. Verify database migrations in SQL Editor
4. Check the `achievementsManagerWithPersistence.ts` file for logic

Enjoy tracking your achievements!
