-- ==============================================================================
-- BINIBINI SCORING SYSTEM - COMPLETE DATABASE SCHEMA FOR SUPABASE
-- Run this script in your Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- ==============================================================================

-- Enable Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ==============================================================================
-- ENABLE REALTIME ON ALL TABLES
-- (Required for live updates without tab switching)
-- ==============================================================================
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.team_entries;
alter publication supabase_realtime add table public.candidates;
alter publication supabase_realtime add table public.criteria;
alter publication supabase_realtime add table public.scores;
alter publication supabase_realtime add table public.rankings;
alter publication supabase_realtime add table public.unlock_requests;

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

-- 4. CANDIDATES TABLE (Pageant Binibini)
create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  team_entry_id uuid not null references public.team_entries(id) on delete cascade,
  category text not null check (category in ('ginoo', 'binibini')),
  name text not null,
  photo_url text,
  candidate_number integer,
  created_at timestamptz default now()
);

-- Ensure candidate numbers are unique across all candidates
create unique index if not exists candidates_candidate_number_unique
  on public.candidates (candidate_number)
  where candidate_number is not null;

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
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  requested_at timestamptz default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

-- ==============================================================================
-- PERFORMANCE INDEXES (High Concurrency & Real-Time Optimization)
-- ==============================================================================
create index if not exists idx_scores_judge_id on public.scores (judge_id);
create index if not exists idx_scores_candidate_id on public.scores (candidate_id);
create index if not exists idx_scores_criterion_id on public.scores (criterion_id);
create index if not exists idx_scores_is_locked on public.scores (is_locked);
create index if not exists idx_scores_composite on public.scores (judge_id, candidate_id, criterion_id);

create index if not exists idx_candidates_team_entry on public.candidates (team_entry_id);
create index if not exists idx_team_entries_team on public.team_entries (team_id);
create index if not exists idx_unlock_requests_judge_status on public.unlock_requests (judge_id, status);
create index if not exists idx_unlock_requests_candidate on public.unlock_requests (candidate_id);
create index if not exists idx_rankings_candidate on public.rankings (candidate_id);

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
-- AUTO-CONFIRM & AUTO-CREATE PROFILE TRIGGER FOR NEW USERS
-- ==============================================================================
-- 1. Auto-confirm any existing unconfirmed users
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email_confirmed_at is null;

-- 2. Trigger to automatically confirm email upon creation (no email verification needed)
create or replace function public.auto_confirm_new_user()
returns trigger as $$
begin
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_confirm on auth.users;
create trigger on_auth_user_created_confirm
  before insert on auth.users
  for each row execute function public.auto_confirm_new_user();

-- 3. Whenever a user is created in Supabase Auth, automatically create their profile!
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

