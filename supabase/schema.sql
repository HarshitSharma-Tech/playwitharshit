-- Optional Supabase PostgreSQL Schema for BLUFFED
-- Run in your Supabase SQL Editor if deploying with Supabase Postgres + Auth.
-- Note: By default, BLUFFED runs out-of-the-box using the authoritative Node.js server + SQLite.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar text not null default 'ace',
  games_played integer not null default 0,
  wins integer not null default 0,
  successful_bluffs integer not null default 0,
  failed_bluffs integer not null default 0,
  correct_challenges integer not null default 0,
  wrong_challenges integer not null default 0,
  weekly_score integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table if not exists public.rooms (
  code text primary key,
  host_id uuid not null references public.profiles(id),
  room_name text not null,
  mode text not null default 'private',
  status text not null default 'lobby',
  max_players integer not null default 4,
  cards_per_player integer not null default 0,
  difficulty text not null default 'casual',
  turn_timer integer not null default 30,
  allow_spectators boolean not null default true,
  enable_bots boolean not null default true,
  password_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  mode text not null,
  winner_id uuid references public.profiles(id),
  player_count integer not null,
  rounds integer not null,
  duration_sec integer not null,
  played_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.user_achievements enable row level security;
alter table public.rooms enable row level security;
alter table public.matches enable row level security;

create policy "Public profiles readable" on public.profiles for select using (true);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Public achievements readable" on public.user_achievements for select using (true);
create policy "Public rooms readable" on public.rooms for select using (true);
create policy "Public matches readable" on public.matches for select using (true);
