-- Karochat — Wave 22: general file sharing in chat (with compression metadata).
-- Adds a 'file' message type + file_* columns, a chat-files storage bucket,
-- updates the messages_with_sender view and forward_message RPC.
-- Idempotent and additive. Safe to re-run.

-- 1) Columns
alter table public.messages
  add column if not exists file_url        text,
  add column if not exists file_name       text,
  add column if not exists file_size       bigint,
  add column if not exists file_mime       text,
  add column if not exists file_compressed boolean not null default false;

-- 2) Allow the new 'file' type + a valid payload for it.
alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages add constraint messages_type_check
  check (type = any (array['text','image','nudge','system','poll','voice','file']));

alter table public.messages drop constraint if exists messages_payload_valid;
alter table public.messages add constraint messages_payload_valid check (
  (type = any (array['nudge','system','poll']))
  or (type = 'voice' and audio_url is not null)
  or (type = 'file'  and file_url is not null)
  or (content is not null and length(content) between 1 and 2000)
  or (image_url is not null)
);

-- 3) Storage bucket: chat-files (public path-secret pattern, 50 MB, any type).
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-files', 'chat-files', true, 52428800)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

drop policy if exists "chat_files_authed_upload" on storage.objects;
create policy "chat_files_authed_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-files');

drop policy if exists "chat_files_owner_delete" on storage.objects;
create policy "chat_files_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-files' and owner = auth.uid());

drop policy if exists "chat_files_public_read" on storage.objects;
create policy "chat_files_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'chat-files');

-- 4) Recreate the sender view with the file columns.
drop view if exists public.messages_with_sender;
create view public.messages_with_sender as
select
  m.id, m.room_id, m.sender_id, m.type, m.content, m.image_url,
  m.audio_url, m.duration_ms,
  m.file_url, m.file_name, m.file_size, m.file_mime, m.file_compressed,
  m.reply_to_id, m.edited_at, m.deleted_at, m.reactions, m.intent,
  m.regretted_at, m.poll_data, m.pinned_at, m.pinned_by, m.expires_at,
  m.mentions, m.forwarded_from_id, m.created_at,
  p.username       as sender_username,
  p.display_name   as sender_display_name,
  p.is_guest       as sender_is_guest,
  p.presence_state as sender_presence_state
from public.messages m
left join public.profiles p on p.id = m.sender_id;

grant select on public.messages_with_sender to authenticated;

-- 5) Let forward_message carry file messages too.
create or replace function public.forward_message(p_message_id uuid, p_dest_room_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_src  public.messages%rowtype;
  v_new  uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from public.room_members
     where room_id = p_dest_room_id and user_id = v_user
  ) then
    raise exception 'not a member of destination';
  end if;
  select * into v_src from public.messages where id = p_message_id;
  if v_src.id is null then raise exception 'source message not found'; end if;
  if not exists (
    select 1 from public.room_members
     where room_id = v_src.room_id and user_id = v_user
  ) then
    raise exception 'cannot read source';
  end if;
  if v_src.type not in ('text','image','voice','file') then
    raise exception 'forwarding only supports text / image / voice / file';
  end if;
  v_new := gen_random_uuid();
  insert into public.messages
    (id, sender_id, room_id, type, content, image_url, audio_url, duration_ms,
     file_url, file_name, file_size, file_mime, file_compressed,
     forwarded_from_id)
  values
    (v_new, v_user, p_dest_room_id, v_src.type,
     v_src.content, v_src.image_url, v_src.audio_url, v_src.duration_ms,
     v_src.file_url, v_src.file_name, v_src.file_size, v_src.file_mime,
     v_src.file_compressed,
     v_src.id);
  return v_new;
end;
$function$;
revoke all on function public.forward_message(uuid, uuid) from public;
grant execute on function public.forward_message(uuid, uuid) to authenticated;
