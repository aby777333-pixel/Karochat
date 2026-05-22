-- Karochat — Wave 18: chat window upgrades.
-- Additive only. Safe to re-run.
--
-- Adds:
--   1. messages columns: pinned_at, expires_at, audio_url, duration_ms,
--      mentions (jsonb of user_ids), forwarded_from_id.
--   2. 'voice' as a valid message type.
--   3. message_reads table — per-user-per-room last-read pointer.
--   4. voice-notes storage bucket (audio/* up to 15 MB).
--   5. RPCs: pin_message, unpin_message, mark_room_read, forward_message.
--   6. View rebuild for messages_with_sender to expose new columns.
--   7. Realtime publication on message_reads.

-- ============================================================================
-- 1) messages: new columns. All additive, all nullable / defaulted.
-- ============================================================================
alter table public.messages
  add column if not exists pinned_at         timestamptz,
  add column if not exists pinned_by         uuid references public.profiles(id) on delete set null,
  add column if not exists expires_at        timestamptz,
  add column if not exists audio_url         text,
  add column if not exists duration_ms       int,
  add column if not exists mentions          jsonb not null default '[]'::jsonb,
  add column if not exists forwarded_from_id uuid references public.messages(id) on delete set null;

create index if not exists messages_pinned_idx
  on public.messages (room_id, pinned_at desc)
  where pinned_at is not null and deleted_at is null;

create index if not exists messages_expires_idx
  on public.messages (expires_at)
  where expires_at is not null;

-- Allow 'voice' in the type CHECK constraint. Drop/re-add (covers older DBs).
alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages
  add constraint messages_type_check
  check (type in ('text','image','nudge','system','poll','voice'));

-- Extend payload validity so voice messages don't need text content.
alter table public.messages drop constraint if exists messages_payload_valid;
alter table public.messages
  add constraint messages_payload_valid check (
    type in ('nudge','system','poll')
    or (type = 'voice' and audio_url is not null)
    or (content is not null and length(content) between 1 and 2000)
    or image_url is not null
  );

-- ============================================================================
-- 2) message_reads: one row per user per room — points at the last seen msg.
--    Updated by mark_room_read RPC. Realtime-broadcast so peers see receipts.
-- ============================================================================
create table if not exists public.message_reads (
  room_id              uuid not null references public.rooms(id) on delete cascade,
  user_id              uuid not null references public.profiles(id) on delete cascade,
  last_read_message_id uuid references public.messages(id) on delete set null,
  last_read_at         timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists message_reads_room_idx on public.message_reads (room_id, last_read_at desc);

alter table public.message_reads enable row level security;

-- Anyone in the room can see read receipts for that room.
drop policy if exists "mr_read_room_members" on public.message_reads;
create policy "mr_read_room_members" on public.message_reads
  for select to authenticated using (
    exists (
      select 1 from public.room_members rm
       where rm.room_id = message_reads.room_id and rm.user_id = auth.uid()
    )
  );

-- Inserts/updates only via RPC (security definer) — block direct writes.
-- (Selects above remain open to room members.)

-- ============================================================================
-- 3) Storage bucket: voice-notes (private — signed URL or anon path).
--    Kept public=true to match chat-images pattern (the obscure UUID path is
--    the access control). 15 MB, audio MIME types only.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-notes', 'voice-notes', true, 15728640,
  array['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/x-m4a']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "voice_notes_authed_upload" on storage.objects;
create policy "voice_notes_authed_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'voice-notes');

drop policy if exists "voice_notes_owner_delete" on storage.objects;
create policy "voice_notes_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'voice-notes' and owner = auth.uid());

drop policy if exists "voice_notes_public_read" on storage.objects;
create policy "voice_notes_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'voice-notes');

-- ============================================================================
-- 4) RPC: pin_message / unpin_message — room owner or admin only.
-- ============================================================================
create or replace function public.pin_message(p_message_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_room uuid;
  v_owner uuid;
  v_role text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select m.room_id into v_room from public.messages m where m.id = p_message_id;
  if v_room is null then raise exception 'message not found'; end if;
  select r.owner_id into v_owner from public.rooms r where r.id = v_room;
  select rm.role into v_role
    from public.room_members rm
   where rm.room_id = v_room and rm.user_id = v_user;
  if not (v_user = v_owner or v_role in ('owner','admin','moderator')) then
    raise exception 'pin requires owner / admin / moderator';
  end if;
  update public.messages
     set pinned_at = now(),
         pinned_by = v_user
   where id = p_message_id;
end;
$$;
revoke all on function public.pin_message(uuid) from public;
grant execute on function public.pin_message(uuid) to authenticated;

create or replace function public.unpin_message(p_message_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_room uuid;
  v_owner uuid;
  v_role text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select m.room_id into v_room from public.messages m where m.id = p_message_id;
  if v_room is null then raise exception 'message not found'; end if;
  select r.owner_id into v_owner from public.rooms r where r.id = v_room;
  select rm.role into v_role
    from public.room_members rm
   where rm.room_id = v_room and rm.user_id = v_user;
  if not (v_user = v_owner or v_role in ('owner','admin','moderator')) then
    raise exception 'unpin requires owner / admin / moderator';
  end if;
  update public.messages
     set pinned_at = null,
         pinned_by = null
   where id = p_message_id;
end;
$$;
revoke all on function public.unpin_message(uuid) from public;
grant execute on function public.unpin_message(uuid) to authenticated;

-- ============================================================================
-- 5) RPC: mark_room_read — caller bumps their last_read pointer.
-- ============================================================================
create or replace function public.mark_room_read(
  p_room_id    uuid,
  p_message_id uuid
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  -- Only members can mark a room as read.
  if not exists (
    select 1 from public.room_members
     where room_id = p_room_id and user_id = v_user
  ) then
    raise exception 'not a member';
  end if;
  insert into public.message_reads (room_id, user_id, last_read_message_id, last_read_at)
    values (p_room_id, v_user, p_message_id, now())
  on conflict (room_id, user_id) do update
    set last_read_message_id = excluded.last_read_message_id,
        last_read_at         = excluded.last_read_at;
end;
$$;
revoke all on function public.mark_room_read(uuid, uuid) from public;
grant execute on function public.mark_room_read(uuid, uuid) to authenticated;

-- ============================================================================
-- 6) RPC: forward_message — copy the message into a destination room the
--    caller is a member of. Stores forwarded_from_id for the trail.
-- ============================================================================
create or replace function public.forward_message(
  p_message_id uuid,
  p_dest_room_id uuid
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_src  public.messages%rowtype;
  v_new  uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  -- Caller must be a member of the destination room.
  if not exists (
    select 1 from public.room_members
     where room_id = p_dest_room_id and user_id = v_user
  ) then
    raise exception 'not a member of destination';
  end if;
  -- Caller must be able to see the source (member of source room).
  select * into v_src from public.messages where id = p_message_id;
  if v_src.id is null then raise exception 'source message not found'; end if;
  if not exists (
    select 1 from public.room_members
     where room_id = v_src.room_id and user_id = v_user
  ) then
    raise exception 'cannot read source';
  end if;
  -- Don't allow forwarding system/poll/nudge — keeps the schema clean.
  if v_src.type not in ('text','image','voice') then
    raise exception 'forwarding only supports text / image / voice';
  end if;
  v_new := gen_random_uuid();
  insert into public.messages
    (id, sender_id, room_id, type, content, image_url, audio_url, duration_ms,
     forwarded_from_id)
  values
    (v_new, v_user, p_dest_room_id, v_src.type,
     v_src.content, v_src.image_url, v_src.audio_url, v_src.duration_ms,
     v_src.id);
  return v_new;
end;
$$;
revoke all on function public.forward_message(uuid, uuid) from public;
grant execute on function public.forward_message(uuid, uuid) to authenticated;

-- ============================================================================
-- 7) Rebuild messages_with_sender to include the new columns.
--    (Reuses the 0009/0011 column set + new Wave 18 columns.)
-- ============================================================================
drop view if exists public.messages_with_sender;
create view public.messages_with_sender as
select
  m.id,
  m.room_id,
  m.sender_id,
  m.type,
  m.content,
  m.image_url,
  m.audio_url,
  m.duration_ms,
  m.reply_to_id,
  m.edited_at,
  m.deleted_at,
  m.reactions,
  m.intent,
  m.regretted_at,
  m.poll_data,
  m.pinned_at,
  m.pinned_by,
  m.expires_at,
  m.mentions,
  m.forwarded_from_id,
  m.created_at,
  p.username       as sender_username,
  p.display_name   as sender_display_name,
  p.is_guest       as sender_is_guest,
  p.presence_state as sender_presence_state
from public.messages m
left join public.profiles p on p.id = m.sender_id;

grant select on public.messages_with_sender to authenticated;

-- ============================================================================
-- 8) Realtime publication for message_reads.
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reads'
  ) then
    execute 'alter publication supabase_realtime add table public.message_reads';
  end if;
end$$;
