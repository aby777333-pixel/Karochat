-- Karochat — v3: presence, custom status, nudges, replies, edits, deletes, reactions
-- Run AFTER 0003_legal_anon_images.sql. Idempotent.

-- ===========================================================================
-- 1. profiles: presence + custom status
-- ===========================================================================
alter table public.profiles
  add column if not exists presence_state    text not null default 'online',
  add column if not exists status_text       text,
  add column if not exists status_emoji      text,
  add column if not exists status_expires_at timestamptz,
  add column if not exists last_seen         timestamptz not null default now();

alter table public.profiles drop constraint if exists profiles_presence_state_check;
alter table public.profiles
  add constraint profiles_presence_state_check
  check (presence_state in ('online','away','busy','invisible','offline'));

alter table public.profiles drop constraint if exists profiles_status_text_check;
alter table public.profiles
  add constraint profiles_status_text_check
  check (status_text is null or length(status_text) <= 80);

alter table public.profiles drop constraint if exists profiles_status_emoji_check;
alter table public.profiles
  add constraint profiles_status_emoji_check
  check (status_emoji is null or length(status_emoji) <= 16);

create index if not exists profiles_presence_idx
  on public.profiles (presence_state)
  where presence_state <> 'offline';

-- ===========================================================================
-- 2. messages: type, reply, edits, deletes, reactions
-- ===========================================================================
alter table public.messages
  add column if not exists type           text not null default 'text',
  add column if not exists reply_to_id    uuid references public.messages(id) on delete set null,
  add column if not exists edited_at      timestamptz,
  add column if not exists edited_history jsonb not null default '[]'::jsonb,
  add column if not exists deleted_at     timestamptz,
  add column if not exists reactions      jsonb not null default '{}'::jsonb;

alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages
  add constraint messages_type_check
  check (type in ('text','image','nudge','system'));

-- Replace the content_or_image constraint to allow nudges/system with no payload.
alter table public.messages drop constraint if exists messages_content_or_image;
alter table public.messages drop constraint if exists messages_payload_valid;
alter table public.messages
  add constraint messages_payload_valid check (
    type in ('nudge','system')
    or (content is not null and length(content) between 1 and 2000)
    or image_url is not null
  );

-- Allow owners to UPDATE their own messages (edits, soft delete).
-- Reactions go through a SECURITY DEFINER RPC so any member can react.
drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own" on public.messages
  for update to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

-- ===========================================================================
-- 3. messages_with_sender view — extended with new fields
-- ===========================================================================
drop view if exists public.messages_with_sender;
create view public.messages_with_sender as
select
  m.id,
  m.room_id,
  m.sender_id,
  m.type,
  m.content,
  m.image_url,
  m.reply_to_id,
  m.edited_at,
  m.deleted_at,
  m.reactions,
  m.created_at,
  p.username       as sender_username,
  p.display_name   as sender_display_name,
  p.is_guest       as sender_is_guest,
  p.presence_state as sender_presence_state
from public.messages m
left join public.profiles p on p.id = m.sender_id;

grant select on public.messages_with_sender to authenticated;

-- ===========================================================================
-- 4. room_members_view — for the member sidebar
-- ===========================================================================
create or replace view public.room_members_view as
select
  rm.room_id,
  rm.user_id,
  rm.role,
  rm.joined_at,
  p.username,
  p.display_name,
  p.is_guest,
  p.presence_state,
  p.status_text,
  p.status_emoji,
  p.last_seen
from public.room_members rm
join public.profiles p on p.id = rm.user_id;

grant select on public.room_members_view to authenticated;

-- ===========================================================================
-- 5. RPCs: heartbeat, status, nudge, reactions
-- ===========================================================================

-- Heartbeat: clients call this every ~30s while focused.
create or replace function public.touch_presence(p_state text default 'online')
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_state text := p_state;
begin
  if v_user is null then return; end if;
  if v_state not in ('online','away','busy','invisible','offline') then
    v_state := 'online';
  end if;
  update public.profiles
    set last_seen = now(),
        presence_state = v_state
    where id = v_user;
end;
$$;
revoke all on function public.touch_presence(text) from public;
grant execute on function public.touch_presence(text) to authenticated;

-- set_status: user-facing status text + emoji + optional expiry.
create or replace function public.set_status(
  p_text       text default null,
  p_emoji      text default null,
  p_expires_at timestamptz default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.profiles
     set status_text       = nullif(trim(coalesce(p_text, '')), ''),
         status_emoji      = nullif(trim(coalesce(p_emoji, '')), ''),
         status_expires_at = p_expires_at
   where id = auth.uid();
end;
$$;
revoke all on function public.set_status(text, text, timestamptz) from public;
grant execute on function public.set_status(text, text, timestamptz) to authenticated;

-- send_nudge: rate-limited to 1/min per (sender, room).
create or replace function public.send_nudge(p_room_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_msg  uuid := gen_random_uuid();
  v_last timestamptz;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = v_user
  ) then
    raise exception 'not a member of this room';
  end if;

  select max(created_at) into v_last
    from public.messages
   where room_id = p_room_id and sender_id = v_user and type = 'nudge';
  if v_last is not null and now() - v_last < interval '60 seconds' then
    raise exception 'cool down: wait a moment before nudging again';
  end if;

  insert into public.messages (id, room_id, sender_id, type, content)
       values (v_msg, p_room_id, v_user, 'nudge', null);
  return v_msg;
end;
$$;
revoke all on function public.send_nudge(uuid) from public;
grant execute on function public.send_nudge(uuid) to authenticated;

-- toggle_reaction: any room member can react.
create or replace function public.toggle_reaction(p_message_id uuid, p_emoji text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_room uuid;
  v_reactions jsonb;
  v_arr jsonb;
  v_has boolean;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_emoji is null or length(trim(p_emoji)) = 0 then raise exception 'emoji required'; end if;
  if length(p_emoji) > 16 then raise exception 'emoji too long'; end if;

  select room_id, reactions into v_room, v_reactions
    from public.messages where id = p_message_id;
  if v_room is null then raise exception 'message not found'; end if;
  if not exists (
    select 1 from public.room_members
    where room_id = v_room and user_id = v_user
  ) then
    raise exception 'not a member of this room';
  end if;

  v_reactions := coalesce(v_reactions, '{}'::jsonb);
  v_arr := coalesce(v_reactions -> p_emoji, '[]'::jsonb);
  v_has := exists (
    select 1 from jsonb_array_elements_text(v_arr) e where e = v_user::text
  );

  if v_has then
    select coalesce(jsonb_agg(e), '[]'::jsonb) into v_arr
      from jsonb_array_elements_text(v_arr) e
     where e <> v_user::text;
  else
    v_arr := v_arr || to_jsonb(v_user::text);
  end if;

  if jsonb_array_length(v_arr) = 0 then
    v_reactions := v_reactions - p_emoji;
  else
    v_reactions := v_reactions || jsonb_build_object(p_emoji, v_arr);
  end if;

  update public.messages set reactions = v_reactions where id = p_message_id;
  return v_reactions;
end;
$$;
revoke all on function public.toggle_reaction(uuid, text) from public;
grant execute on function public.toggle_reaction(uuid, text) to authenticated;

-- ===========================================================================
-- 6. Realtime: ensure UPDATE events carry full row so reactions/edits broadcast
-- ===========================================================================
alter table public.messages replica identity full;
alter table public.profiles replica identity full;

-- Add profiles to the realtime publication (presence broadcasts).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    execute 'alter publication supabase_realtime add table public.profiles';
  end if;
end$$;
