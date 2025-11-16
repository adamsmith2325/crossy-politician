# Supabase Database Setup

This directory contains the database migrations for the Crossy Politician game.

## Running Migrations

You can apply these migrations in several ways:

### Option 1: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI
npm install supabase --save-dev

# Link to your Supabase project
npx supabase link --project-ref your-project-ref

# Apply migrations
npx supabase db push
```

### Option 2: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of each migration file in order:
   - `20241116000001_create_user_achievements.sql`
   - `20241116000002_add_achievement_leaderboard_function.sql`
4. Execute each migration

### Option 3: Manual SQL Execution

Connect to your Supabase database using your preferred SQL client and execute the migration files in order.

## Database Schema

### Tables

#### `user_profiles`
Stores user account information.
- `id` (uuid, primary key)
- `username` (text, unique)
- `created_at` (timestamp)
- `updated_at` (timestamp)

#### `user_achievements`
Tracks which achievements users have unlocked.
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key to user_profiles)
- `achievement_id` (text)
- `unlocked_at` (timestamp)

#### `user_stats`
Stores player statistics.
- `user_id` (uuid, primary key, foreign key to user_profiles)
- `total_dodges` (int)
- `total_jumps` (int)
- `max_score` (int)
- `max_survival_time` (numeric)
- `games_played` (int)
- `total_deaths` (int)
- `buses_dodged` (int)
- `police_dodged` (int)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### Functions

#### `get_achievement_leaderboard(limit_count int)`
Returns the top users ranked by number of unlocked achievements.

## Security

All tables have Row Level Security (RLS) enabled with policies that allow:
- Public read access (for leaderboards and achievement viewing)
- Public write access (for anonymous users to create profiles and track achievements)

This is suitable for a mobile game where users don't have traditional authentication but want to track progress by username.
