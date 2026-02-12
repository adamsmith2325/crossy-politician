# Difficulty System Documentation

## Overview

The game now features a dynamic difficulty scaling system that progressively increases the challenge every 5 moves. The difficulty is controlled by a `difficulty_index` value (0-100) stored in Supabase.

## How It Works

### Difficulty Index (0-100)

- **0**: No difficulty increase - game stays at base difficulty throughout
- **50**: Moderate difficulty scaling (default)
- **100**: Extreme difficulty scaling - game becomes nearly impossible by moves 6-10

### Progressive Scaling (Every 5 Moves)

The game calculates a "difficulty tier" based on the player's score:
- Tier 0: Score 0-4
- Tier 1: Score 5-9
- Tier 2: Score 10-14
- Tier 3: Score 15-19
- And so on...

Each tier increases the following parameters:

1. **Vehicle Speed**: Cars and trucks move faster
2. **Road Probability**: More lanes become roads (fewer safe grass areas)
3. **Car Density**: More vehicles per lane
4. **Gap Reduction**: Smaller gaps between vehicles

### Difficulty Formulas

For a given score and difficulty_index:

```typescript
tier = Math.floor(score / 5)
progressionRate = difficultyIndex / 100

speedMultiplier = 1 + (tier × 0.25 × progressionRate)
roadProbabilityIncrease = tier × 0.08 × progressionRate
carDensityMultiplier = 1 + (tier × 0.3 × progressionRate)
minGapReduction = tier × 0.2 × progressionRate
```

### Examples

**Difficulty Index = 0 (No Scaling)**
- Score 0-4: Base difficulty
- Score 5-9: Still base difficulty
- Score 10+: Still base difficulty
- Result: Game never gets harder

**Difficulty Index = 50 (Moderate - Default)**
- Score 0-4 (Tier 0): Base difficulty
- Score 5-9 (Tier 1): 12.5% faster, 4% more roads, 15% more cars
- Score 10-14 (Tier 2): 25% faster, 8% more roads, 30% more cars
- Score 15-19 (Tier 3): 37.5% faster, 12% more roads, 45% more cars

**Difficulty Index = 100 (Extreme)**
- Score 0-4 (Tier 0): Base difficulty
- Score 5-9 (Tier 1): 25% faster, 8% more roads, 30% more cars, smaller gaps
- Score 10-14 (Tier 2): 50% faster, 16% more roads, 60% more cars, tiny gaps
- Result: Nearly impossible by score 10

## Setup Instructions

### 1. Apply the Database Migration

Run the SQL migration to create the `difficulty_index` table:

```bash
# From the project root
cd supabase
```

Then in your Supabase dashboard (https://supabase.com):
1. Go to your project
2. Navigate to **SQL Editor**
3. Open the file: `migrations/20250211000001_create_difficulty_index.sql`
4. Copy the contents and run it in the SQL Editor

Or if you have Supabase CLI installed:
```bash
supabase db push
```

### 2. Verify the Table

The migration creates a table with:
- Default difficulty value of 50
- Public read access (for the game)
- Update access for authenticated users

Check in Supabase Dashboard → Database → Tables → `difficulty_index`

### 3. No Code Changes Needed

The game automatically:
- Fetches the difficulty_index when starting
- Applies scaling every 5 moves
- Logs difficulty changes to console

## Adjusting Difficulty

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Table Editor**
3. Find the `difficulty_index` table
4. Edit the `value` column (set between 0-100)
5. Next game will use the new value

### Option 2: SQL Editor

```sql
UPDATE difficulty_index
SET value = 75, updated_at = now()
WHERE id IN (SELECT id FROM difficulty_index LIMIT 1);
```

### Option 3: Programmatically (Advanced)

Use the provided API function:

```typescript
import { updateDifficultyIndex } from './lib/difficultyApi';

// Set difficulty to 75
await updateDifficultyIndex(75);
```

## Console Logging

The game logs difficulty information to help you tune the values:

**On game start:**
```
🎮 Game started with difficulty index: 50
```

**Every 5 moves:**
```
📈 Difficulty Tier 1 reached (Score: 5)
  Speed: 112%
  Car Density: 115%
  Road Probability: +4.0%
```

## Recommended Difficulty Values

| Difficulty Index | Use Case | Description |
|-----------------|----------|-------------|
| 0 | Tutorial/Kids | No difficulty increase, stays easy |
| 25 | Casual | Very gradual increase, forgiving |
| 50 | Normal | Balanced progression (default) |
| 75 | Hard | Aggressive scaling, challenging |
| 90 | Expert | Very aggressive, only for pros |
| 100 | Impossible | Extreme scaling, nearly unbeatable |

## Testing the System

1. Set difficulty_index to 100 in Supabase
2. Start a new game
3. Watch console logs as you progress
4. At score 5-9, you should notice significantly faster cars
5. At score 10+, the game should be extremely difficult

## Files Modified/Created

### New Files
- `supabase/migrations/20250211000001_create_difficulty_index.sql` - Database schema
- `lib/difficultyApi.ts` - API functions for difficulty management

### Modified Files
- `game/Game.tsx` - Fetches and passes difficulty_index to VoxelScene
- `game/VoxelScene.tsx` - Implements progressive difficulty scaling
- `game/types.ts` - Updated interfaces (if needed)

## Troubleshooting

### Game always uses difficulty 50
- Check that the migration was applied successfully
- Verify the `difficulty_index` table exists in Supabase
- Check console for error messages when fetching difficulty

### Difficulty not changing during gameplay
- Difficulty is calculated when lanes are created
- Changes apply to newly generated lanes ahead of the player
- The current visible area won't change immediately

### Game is too hard/easy
- Adjust the difficulty_index value in Supabase
- Recommended range: 25-75 for most players
- Values above 90 are extremely challenging

## Future Enhancements

Potential improvements to the system:
- UI to show current difficulty tier in-game
- Difficulty settings in the game menu
- Different difficulty presets (Easy/Medium/Hard)
- Achievement for beating the game at difficulty 100
- Adaptive difficulty based on player performance
