-- Run this once in Supabase: Project -> SQL Editor -> New query -> paste -> Run

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id text not null,
  predicted_result text not null check (predicted_result in ('home','draw','away')),
  created_at timestamptz not null default now(),
  unique (user_id, match_id)
);

alter table profiles enable row level security;
alter table predictions enable row level security;

-- Everyone (signed in) can read all display names and predictions,
-- but can only write their own row.
create policy "profiles are readable by everyone" on profiles
  for select using (true);
create policy "users insert their own profile" on profiles
  for insert with check (auth.uid() = id);
create policy "users update their own profile" on profiles
  for update using (auth.uid() = id);

create policy "predictions are readable by everyone" on predictions
  for select using (true);
create policy "users insert their own prediction" on predictions
  for insert with check (auth.uid() = user_id);
create policy "users update their own prediction" on predictions
  for update using (auth.uid() = user_id);
