-- Karochat — v1: rooms (public + private)
-- Run this in the Supabase SQL editor AFTER 0001_init.sql.
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- ===========================================================================
-- 1. Tables
-- ===========================================================================

create table if not exists public.rooms (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(name) between 1 and 60),
  description  text check (length(description) <= 240),
  is_public    boolean not null default true,
  invite_code  text unique,
  owner_id     uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists rooms_public_idx on public.rooms (is_public, created_at desc);

create table if not exists public.room_members (
  room_id   uuid not null references public.rooms(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists room_members_user_idx on public.room_members (user_id);

-- ===========================================================================
-- 2. Enable RLS (after both tables exist)
-- ===========================================================================

alter table public.rooms        enable row level security;
alter table public.room_members enable row level security;

-- ===========================================================================
-- 3. Policies on rooms
-- ===========================================================================

drop policy if exists "rooms_read_public_or_member" on public.rooms;
create policy "rooms_read_public_or_member" on public.rooms
  for select to authenticated using (
    is_public = true
    or exists (
      select 1 from public.room_members
      where room_members.room_id = rooms.id
        and room_members.user_id = auth.uid()
    )
  );

drop policy if exists "rooms_update_owner" on public.rooms;
create policy "rooms_update_owner" on public.rooms
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- writes go through SECURITY DEFINER RPCs; no INSERT policy on purpose.

-- ===========================================================================
-- 4. Policies on room_members
-- ===========================================================================

drop policy if exists "room_members_read_visible" on public.room_members;
create policy "room_members_read_visible" on public.room_members
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.room_members rm
      where rm.room_id = room_members.room_id
        and rm.user_id = auth.uid()
    )
  );

drop policy if exists "room_members_leave_self" on public.room_members;
create policy "room_members_leave_self" on public.room_members
  for delete to authenticated using (user_id = auth.uid());

-- ===========================================================================
-- 5. messages.room_id + scoped policies
-- ===========================================================================

alter table public.messages
  add column if not exists room_id uuid references public.rooms(id) on delete cascade;

-- ensure a default Lobby exists (fixed id so the URL is stable)
insert into public.rooms (id, name, description, is_public, owner_id)
  select '00000000-0000-0000-0000-00000000aaaa', 'Lobby',
         'The Karochat lobby. Everybody hangs here.', true, null
  where not exists (
    select 1 from public.rooms where id = '00000000-0000-0000-0000-00000000aaaa'
  );

-- backfill existing messages to the Lobby
update public.messages
   set room_id = '00000000-0000-0000-0000-00000000aaaa'
 where room_id is null;

alter table public.messages alter column room_id set not null;

create index if not exists messages_room_created_idx
  on public.messages (room_id, created_at desc);

drop policy if exists "messages_read_authenticated" on public.messages;
drop policy if exists "messages_read_member" on public.messages;
create policy "messages_read_member" on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.room_members
      where room_members.room_id = messages.room_id
        and room_members.user_id = auth.uid()
    )
  );

drop policy if exists "messages_insert_self" on public.messages;
drop policy if exists "messages_insert_member" on public.messages;
create policy "messages_insert_member" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.room_members
      where room_members.room_id = messages.room_id
        and room_members.user_id = auth.uid()
    )
  );

-- backfill: every existing profile becomes a Lobby member
insert into public.room_members (room_id, user_id, role)
  select '00000000-0000-0000-0000-00000000aaaa', id, 'member' from public.profiles
  on conflict (room_id, user_id) do nothing;

-- auto-join newly-onboarded profiles to the Lobby
create or replace function public.add_to_lobby()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.room_members (room_id, user_id, role)
  values ('00000000-0000-0000-0000-00000000aaaa', new.id, 'member')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_join_lobby on public.profiles;
create trigger profiles_join_lobby
after insert on public.profiles
for each row execute function public.add_to_lobby();

-- ===========================================================================
-- 6. Views
-- ===========================================================================

drop view if exists public.messages_with_sender;
create view public.messages_with_sender as
select
  m.id,
  m.room_id,
  m.sender_id,
  m.content,
  m.created_at,
  p.username     as sender_username,
  p.display_name as sender_display_name
from public.messages m
left join public.profiles p on p.id = m.sender_id;

grant select on public.messages_with_sender to authenticated;

create or replace view public.rooms_browse as
select
  r.id,
  r.name,
  r.description,
  r.is_public,
  r.owner_id,
  r.created_at,
  (select count(*) from public.room_members rm where rm.room_id = r.id) as member_count
from public.rooms r;

grant select on public.rooms_browse to authenticated;

-- ===========================================================================
-- 7. RPCs
-- ===========================================================================

create or replace function public.create_room(
  p_name        text,
  p_description text,
  p_is_public   boolean
) returns table (id uuid, invite_code text)
language plpgsql security definer set search_path = public
as $$
declare
  v_id   uuid := gen_random_uuid();
  v_code text;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if length(coalesce(trim(p_name), '')) = 0 then raise exception 'name required'; end if;

  if p_is_public then
    v_code := null;
  else
    loop
      v_code := upper(
        regexp_replace(encode(gen_random_bytes(8), 'base64'), '[^A-Za-z0-9]', '', 'g')
      );
      v_code := substr(v_code, 1, 8);
      exit when length(v_code) = 8
        and not exists (select 1 from public.rooms where invite_code = v_code);
    end loop;
  end if;

  insert into public.rooms (id, name, description, is_public, invite_code, owner_id)
    values (v_id, trim(p_name),
            nullif(trim(coalesce(p_description, '')), ''),
            p_is_public, v_code, v_user);

  insert into public.room_members (room_id, user_id, role)
    values (v_id, v_user, 'owner');

  return query select v_id, v_code;
end;
$$;

revoke all on function public.create_room(text, text, boolean) from public;
grant execute on function public.create_room(text, text, boolean) to authenticated;

create or replace function public.join_public_room(p_room_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_pub  boolean;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select is_public into v_pub from public.rooms where id = p_room_id;
  if v_pub is null then raise exception 'room not found'; end if;
  if not v_pub then raise exception 'room is private — use an invite code'; end if;

  insert into public.room_members (room_id, user_id, role)
    values (p_room_id, v_user, 'member')
    on conflict do nothing;
  return p_room_id;
end;
$$;

revoke all on function public.join_public_room(uuid) from public;
grant execute on function public.join_public_room(uuid) to authenticated;

create or replace function public.join_room_by_invite(p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_room uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'invite code required';
  end if;

  select id into v_room
    from public.rooms
    where invite_code = upper(trim(p_code));
  if v_room is null then raise exception 'invalid invite code'; end if;

  insert into public.room_members (room_id, user_id, role)
    values (v_room, v_user, 'member')
    on conflict do nothing;
  return v_room;
end;
$$;

revoke all on function public.join_room_by_invite(text) from public;
grant execute on function public.join_room_by_invite(text) to authenticated;
