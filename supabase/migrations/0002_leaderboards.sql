-- Firestorm — leaderboards (Plan F)

create table if not exists public.leaderboard_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  map_id text not null,
  difficulty text not null check (difficulty in ('easy', 'hard')),
  rounds_completed int not null check (rounds_completed >= 0),
  lives_remaining int not null check (lives_remaining >= 0),
  duration_seconds numeric not null check (duration_seconds >= 0),
  run_id uuid not null references public.runs(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, map_id, difficulty)
);

create index if not exists leaderboard_map_diff_idx
  on public.leaderboard_entries(map_id, difficulty, rounds_completed desc, lives_remaining desc, duration_seconds asc);

alter table public.leaderboard_entries enable row level security;

-- Public read; writes only via /api/runs (server-side, with user's session).
create policy "leaderboard entries are readable by anyone"
  on public.leaderboard_entries for select
  using (true);

create policy "users can upsert their own leaderboard entry"
  on public.leaderboard_entries for insert
  with check (auth.uid() = user_id);

create policy "users can update their own leaderboard entry"
  on public.leaderboard_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
