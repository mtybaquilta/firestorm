-- Firestorm — auth + runs schema (Plan E)
-- Run this in your Supabase project (SQL editor or `supabase db push`).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by anyone"
  on public.profiles for select
  using (true);

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  map_id text not null,
  difficulty text not null check (difficulty in ('easy', 'hard')),
  result text not null check (result in ('win', 'lose')),
  rounds_completed int not null check (rounds_completed >= 0),
  total_rounds int not null check (total_rounds > 0),
  lives_remaining int not null check (lives_remaining >= 0),
  duration_seconds numeric not null check (duration_seconds >= 0),
  seed bigint not null,
  input_log jsonb,
  created_at timestamptz not null default now()
);

create index if not exists runs_user_id_idx on public.runs(user_id);
create index if not exists runs_map_difficulty_idx on public.runs(map_id, difficulty);

alter table public.runs enable row level security;

create policy "users can read their own runs"
  on public.runs for select
  using (auth.uid() = user_id);

-- Inserts go through the /api/runs route handler (uses the user's session),
-- so we still gate on auth.uid() = user_id here.
create policy "users can insert their own runs"
  on public.runs for insert
  with check (auth.uid() = user_id);

-- Auto-create a profile on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
