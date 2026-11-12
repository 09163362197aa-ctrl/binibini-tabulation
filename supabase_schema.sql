-- ==============================================================================
-- BINIBINI SCORING SYSTEM - COMPLETE DATABASE SCHEMA FOR SUPABASE
-- Run this script in your Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- ==============================================================================

-- Enable Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 1. PROFILES TABLE (Admins and Judges)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  username text unique,
  role text not null default 'judge' check (role in ('admin', 'judge')),
  allowed_competitions text[] default array['cheerdance', 'pageant'],
  created_at timestamptz default now()
);

-- 2. TEAMS TABLE
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  created_at timestamptz default now()
);

-- 3. TEAM ENTRIES TABLE (Cheerdance / Pageant)
create table if not exists public.team_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  competition_type text not null check (competition_type in ('cheerdance', 'pageant')),
  photo_url text,
  created_at timestamptz default now()
);

-- 4. CANDIDATES TABLE (Pageant Ginoo / Binibini)
create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  team_entry_id uuid not null references public.team_entries(id) on delete cascade,
  category text not null check (category in ('ginoo', 'binibini')),
  name text not null,
  photo_url text,
  candidate_number integer,
  created_at timestamptz default now()
);

-- 5. CRITERIA TABLE
create table if not exists public.criteria (
  id text primary key,
  key text not null,
  label text not null,
  max_score numeric not null,
  display_order integer not null default 0,
  parent_id text references public.criteria(id) on delete cascade,
  competition_type text not null check (competition_type in ('cheerdance', 'pageant')),
  created_at timestamptz default now()
);

-- 6. SCORES TABLE
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid not null references public.profiles(id) on delete cascade,
  team_entry_id uuid references public.team_entries(id) on delete cascade,
  candidate_id uuid references public.candidates(id) on delete cascade,
  criterion_id text not null references public.criteria(id) on delete cascade,
  value numeric not null default 0,
  is_locked boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 7. RANKINGS TABLE
create table if not exists public.rankings (
  id uuid primary key default gen_random_uuid(),
  team_entry_id uuid references public.team_entries(id) on delete cascade,
  candidate_id uuid references public.candidates(id) on delete cascade,
  final_score numeric default 0,
  judges_scored integer default 0,
  updated_at timestamptz default now()
);

-- 8. UNLOCK REQUESTS TABLE
create table if not exists public.unlock_requests (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid not null references public.profiles(id) on delete cascade,
  team_entry_id uuid references public.team_entries(id) on delete cascade,
  candidate_id uuid references public.candidates(id) on delete cascade,
  stage_id text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ==============================================================================
-- DEFAULT CRITERIA SEED DATA (Binibining Palayan)
-- ==============================================================================

-- Pageant Parent Stages
insert into public.criteria (id, key, label, max_score, display_order, parent_id, competition_type)
values
  ('stage_sw', 'sportswear', 'Sports Wear Competition', 30, 1, null, 'pageant'),
  ('stage_tl', 'talent', 'Talent Competition', 35, 2, null, 'pageant'),
  ('stage_qa', 'qa', 'Q & A', 35, 3, null, 'pageant')
on conflict (id) do nothing;

-- Pageant Sub-Criteria (Children)
insert into public.criteria (id, key, label, max_score, display_order, parent_id, competition_type)
values
  ('sw_poise', 'sw_poise', 'Poise and Bearing', 15, 1, 'stage_sw', 'pageant'),
  ('sw_personality', 'sw_personality', 'Personality and Confidence', 15, 2, 'stage_sw', 'pageant'),
  ('tl_execution', 'tl_execution', 'Talent Execution', 20, 1, 'stage_tl', 'pageant'),
  ('tl_creativity', 'tl_creativity', 'Creativity and Originality', 10, 2, 'stage_tl', 'pageant'),
  ('tl_impact', 'tl_impact', 'Audience Impact', 5, 3, 'stage_tl', 'pageant'),
  ('qa_content', 'qa_content', 'Content of Answer', 15, 1, 'stage_qa', 'pageant'),
  ('qa_clarity', 'qa_clarity', 'Clarity of Thought', 10, 2, 'stage_qa', 'pageant'),
  ('qa_delivery', 'qa_delivery', 'Confidence and Delivery', 10, 3, 'stage_qa', 'pageant')
on conflict (id) do nothing;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_entries enable row level security;
alter table public.candidates enable row level security;
alter table public.criteria enable row level security;
alter table public.scores enable row level security;
alter table public.rankings enable row level security;
alter table public.unlock_requests enable row level security;

-- Open policies for authenticated and anon clients (competition scoring system)
create policy "Allow all access to profiles" on public.profiles for all using (true) with check (true);
create policy "Allow all access to teams" on public.teams for all using (true) with check (true);
create policy "Allow all access to team_entries" on public.team_entries for all using (true) with check (true);
create policy "Allow all access to candidates" on public.candidates for all using (true) with check (true);
create policy "Allow all access to criteria" on public.criteria for all using (true) with check (true);
create policy "Allow all access to scores" on public.scores for all using (true) with check (true);
create policy "Allow all access to rankings" on public.rankings for all using (true) with check (true);
create policy "Allow all access to unlock_requests" on public.unlock_requests for all using (true) with check (true);

-- Enable Realtime for live monitoring and scoring updates
alter publication supabase_realtime add table public.scores;
alter publication supabase_realtime add table public.unlock_requests;
alter publication supabase_realtime add table public.rankings;

-- ==============================================================================
-- STORAGE BUCKET: team-photos
-- ==============================================================================
insert into storage.buckets (id, name, public)
values ('team-photos', 'team-photos', true)
on conflict (id) do update set public = true;

create policy "Public Access to team-photos" on storage.objects
  for select using (bucket_id = 'team-photos');

create policy "Allow upload to team-photos" on storage.objects
  for insert with check (bucket_id = 'team-photos');

create policy "Allow update to team-photos" on storage.objects
  for update using (bucket_id = 'team-photos');

create policy "Allow delete from team-photos" on storage.objects
  for delete using (bucket_id = 'team-photos');

-- ==============================================================================
-- AUTO-CREATE PROFILE TRIGGER FOR NEW USERS
-- Whenever a user is created in Supabase Auth, automatically create their profile!
-- ==============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, username, role, allowed_competitions)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Administrator'),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    case when new.email like 'admin%' then 'admin' else 'judge' end,
    array['pageant']
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

