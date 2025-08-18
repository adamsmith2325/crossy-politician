# Crossy Trump (Expo + EAS + AdMob + Supabase Leaderboard)

> ⚠️ Legal note: This is an original lane-crossing game inspired by classic arcade mechanics. It does **not** copy Crossy Road code, assets, or branding. If you add a likeness of any public figure, ensure your art is original and consider parody/publicity rights where you ship.

## What’s included
- **Expo-managed** app (SDK 51) with **EAS** config
- **Google Mobile Ads** (`react-native-google-mobile-ads`)
  - **App Open** ad on launch
  - **Interstitial** ad after every **3 runs**
- **Gameplay**: grid-based, car lanes, swipe or button controls
- **Haptics** (`expo-haptics`) & **Sound effects** (`expo-av`)
- **Leaderboard**:
  - Local best (AsyncStorage)
  - **Cloud leaderboard via Supabase** table **`crossyTrump_scores`**
  - Username entry modal (stored locally) and **“Submit score”** button
- Clean separation of concerns and production checklist

## Quick start
```bash
npm install
# Set your env (or edit app.config.ts extra):
cp .env.example .env
# fill EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY

# Required once for native plugins
npx expo prebuild

# Run on device/simulator
npx expo run:ios
# or
npx expo run:android
```

### Environment (.env.example)
```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

### AdMob setup
- Replace **App IDs** in `app.config.ts` (currently Google test IDs via plugin).
- Replace **unit IDs** in `src/ads/adManager.ts` with your production units.
- Keep test IDs during development.

### Supabase schema
Create the table:
```sql
create table if not exists public.crossyTrump_scores (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  score int not null check (score >= 0),
  created_at timestamp with time zone default now()
);
-- Optional: index for sorting
create index on public.crossyTrump_scores (score desc, created_at desc);
-- Row Level Security
alter table public.crossyTrump_scores enable row level security;
create policy "insert scores anon" on public.crossyTrump_scores
  for insert to anon with check (true);
create policy "read scores anon" on public.crossyTrump_scores
  for select to anon using (true);
```

## Production readiness checklist
- [ ] Replace AdMob **App IDs** & **ad unit IDs**
- [ ] Configure **EXPO_PUBLIC_SUPABASE_URL** and **EXPO_PUBLIC_SUPABASE_ANON_KEY**
- [ ] `npx expo prebuild` after modifying config/plugins
- [ ] iOS: ATT permission string already set; verify your store privacy settings
- [ ] EAS: `eas build -p ios` / `-p android` (link your project/app IDs)
- [ ] Test interstitial cadence (every 3 runs) and app-open on real devices
- [ ] Add your own art/sfx if shipping publicly

## Controls
- **Swipe** up/left/right/down, or
- Tap the on-screen **UP/LEFT/DOWN/RIGHT** buttons

## Structure
```
.
├── app.config.ts
├── App.tsx
├── index.js
├── babel.config.js
├── eas.json
├── package.json
├── tsconfig.json
├── metro.config.js
├── assets/
│   ├── icon.png
│   ├── splash.png
│   ├── adaptive-icon.png
│   └── sounds/
│       ├── move.wav
│       ├── hit.wav
│       ├── win.wav
│       └── click.wav
└── src/
    ├── ads/adManager.ts
    ├── lib/supabase.ts
    ├── sound/soundManager.ts
    ├── utils/
    │   ├── leaderboard.ts
    │   └── remoteLeaderboard.ts
    ├── ui/
    │   ├── LeaderboardModal.tsx
    │   └── UsernameModal.tsx
    └── game/
        ├── Game.tsx
        ├── constants.ts
        ├── types.ts
        └── components/
            ├── Car.tsx
            ├── Character.tsx
            └── Tile.tsx
```

---
This project is ready for you to drop in ad unit IDs, Supabase creds, and ship. Have fun!
