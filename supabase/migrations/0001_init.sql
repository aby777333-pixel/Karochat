-- Karochat — v0 schema (single global lobby + profiles)
-- Run this in the Supabase SQL editor on project dxgduusbdvslusbushxi
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles: 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  display_name  text not null,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists profiles_username_idx on public.profiles (username);

alter table public.profiles enable row level security;

drop policy if exists "profiles_read_authenticated" on public.profiles;
create policy "profiles_read_authenticated" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- messages: single global lobby for v0
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references auth.users(id) on delete cascade,
  content     text not null check (length(content) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index if not exists messages_created_at_idx on public.messages (created_at desc);

alter table public.messages enable row level security;

drop policy if exists "messages_read_authenticated" on public.messages;
create policy "messages_read_authenticated" on public.messages
  for select to authenticated using (true);

drop policy if exists "messages_insert_self" on public.messages;
create policy "messages_insert_self" on public.messages
  for insert to authenticated with check (sender_id = auth.uid());

-- ---------------------------------------------------------------------------
-- View joining sender profile to messages (used for initial server render)
-- ---------------------------------------------------------------------------
create or replace view public.messages_with_sender as
select
  m.id,
  m.sender_id,
  m.content,
  m.created_at,
  p.username      as sender_username,
  p.display_name  as sender_display_name
from public.messages m
left join public.profiles p on p.id = m.sender_id;

-- Views inherit RLS from base tables, but be explicit about access.
grant select on public.messages_with_sender to authenticated;

-- ---------------------------------------------------------------------------
-- updated_at trigger for profiles
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Realtime: publish messages so the lobby gets INSERT events
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end$$;
