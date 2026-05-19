-- Karochat — v2: anonymous users, terms gate, image attachments, storage bucket
-- Run this AFTER 0002_rooms.sql. Idempotent.

-- ===========================================================================
-- 1. profiles: terms acceptance + guest flag
-- ===========================================================================

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version     smallint not null default 0,
  add column if not exists is_guest          boolean not null default false;

-- ===========================================================================
-- 2. messages: image attachment + relaxed content check
-- ===========================================================================

alter table public.messages
  add column if not exists image_url text;

-- Drop the original NOT NULL + length constraint, replace with a combined one.
alter table public.messages alter column content drop not null;

alter table public.messages
  drop constraint if exists messages_content_check;

alter table public.messages
  drop constraint if exists messages_content_or_image;
alter table public.messages
  add constraint messages_content_or_image check (
    (content is not null and length(content) between 1 and 2000)
    or image_url is not null
  );

-- ===========================================================================
-- 3. Auto-profile creation for anonymous users
--    Email users still pick their own name on /onboarding.
-- ===========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_suffix   text;
  v_username text;
  v_display  text;
begin
  -- only auto-create profiles for anonymous sessions
  if coalesce(new.is_anonymous, false) = true then
    v_suffix := substr(replace(new.id::text, '-', ''), 1, 6);
    v_username := 'guest_' || v_suffix;
    v_display  := 'Guest ' || upper(v_suffix);

    insert into public.profiles (id, username, display_name, is_guest)
    values (new.id, v_username, v_display, true)
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ===========================================================================
-- 4. messages_with_sender view: now includes image_url + sender is_guest
-- ===========================================================================

drop view if exists public.messages_with_sender;
create view public.messages_with_sender as
select
  m.id,
  m.room_id,
  m.sender_id,
  m.content,
  m.image_url,
  m.created_at,
  p.username     as sender_username,
  p.display_name as sender_display_name,
  p.is_guest     as sender_is_guest
from public.messages m
left join public.profiles p on p.id = m.sender_id;

grant select on public.messages_with_sender to authenticated;

-- ===========================================================================
-- 5. Storage bucket for chat images
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images', 'chat-images', true, 8388608,
  array['image/png','image/jpeg','image/webp','image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS policies: authenticated users can upload; everyone can read.
drop policy if exists "chat_images_authed_upload"  on storage.objects;
create policy "chat_images_authed_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-images');

drop policy if exists "chat_images_authed_update"  on storage.objects;
create policy "chat_images_authed_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'chat-images' and owner = auth.uid())
  with check (bucket_id = 'chat-images');

drop policy if exists "chat_images_owner_delete" on storage.objects;
create policy "chat_images_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-images' and owner = auth.uid());

drop policy if exists "chat_images_public_read" on storage.objects;
create policy "chat_images_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'chat-images');
