create extension if not exists "pgcrypto";

create table if not exists diagnostic_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  started_at timestamptz default now(),
  finished_at timestamptz,
  question_set_version int not null default 1
);

create table if not exists answers (
  session_id uuid references diagnostic_sessions(id) on delete cascade,
  question_id text not null,
  choice_key text not null,
  created_at timestamptz default now()
);

create table if not exists scores (
  session_id uuid primary key references diagnostic_sessions(id) on delete cascade,
  mbti int not null,
  safety int not null,
  workstyle int not null,
  motivation int not null,
  ng int not null,
  sync int not null,
  total int not null
);

create type if not exists cluster_t as enum ('challenge','creative','support','strategy');

create table if not exists result_assignments (
  session_id uuid primary key references diagnostic_sessions(id) on delete cascade,
  cluster cluster_t not null,
  hero_slug text not null,
  decided_at timestamptz default now()
);

create table if not exists share_card_assets (
  hero_slug text primary key,
  image_url text,
  thumb_url text,
  updated_at timestamptz default now()
);
