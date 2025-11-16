-- Create user_profiles table to store user data
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create user_achievements table to track unlocked achievements
create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete cascade not null,
  achievement_id text not null,
  unlocked_at timestamp with time zone default now(),
  unique(user_id, achievement_id)
);

-- Create user_stats table to track player statistics
create table if not exists public.user_stats (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  total_dodges int default 0,
  total_jumps int default 0,
  max_score int default 0,
  max_survival_time numeric default 0,
  games_played int default 0,
  total_deaths int default 0,
  buses_dodged int default 0,
  police_dodged int default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create indexes for performance
create index on public.user_achievements (user_id);
create index on public.user_achievements (achievement_id);
create index on public.user_profiles (username);
create index on public.user_stats (user_id);

-- Enable Row Level Security
alter table public.user_profiles enable row level security;
alter table public.user_achievements enable row level security;
alter table public.user_stats enable row level security;

-- RLS Policies for user_profiles
create policy "Users can view all profiles"
  on public.user_profiles for select
  to anon using (true);

create policy "Users can insert their own profile"
  on public.user_profiles for insert
  to anon with check (true);

create policy "Users can update their own profile"
  on public.user_profiles for update
  to anon using (true);

-- RLS Policies for user_achievements
create policy "Users can view all achievements"
  on public.user_achievements for select
  to anon using (true);

create policy "Users can insert their own achievements"
  on public.user_achievements for insert
  to anon with check (true);

-- RLS Policies for user_stats
create policy "Users can view all stats"
  on public.user_stats for select
  to anon using (true);

create policy "Users can insert their own stats"
  on public.user_stats for insert
  to anon with check (true);

create policy "Users can update their own stats"
  on public.user_stats for update
  to anon using (true);

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers to auto-update updated_at
create trigger update_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function update_updated_at_column();

create trigger update_user_stats_updated_at
  before update on public.user_stats
  for each row execute function update_updated_at_column();
