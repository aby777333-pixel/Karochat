-- Karochat — Music / audio uploads.
--
-- Lets every user upload their own music (the Infotainment "upload your music"
-- promise, beyond room file-share). Mirrors the proven shorts pattern exactly:
-- a public `music` storage bucket with per-uploader folder write scope, plus a
-- `tracks` table with owner-scoped RLS and a public read view for the player.
-- Purely additive + idempotent. Nothing existing is changed.

-- ── tracks table ────────────────────────────────────────────────────────────
create table if not exists public.tracks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  audio_url   text not null,
  title       text not null,
  artist      text,
  cover_url   text,
  is_public   boolean not null default true,
  play_count  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists tracks_public_idx on public.tracks (is_public, created_at desc)
  where is_public = true;
create index if not exists tracks_owner_idx on public.tracks (owner_id, created_at desc);

alter table public.tracks enable row level security;

drop policy if exists tracks_read_visible on public.tracks;
create policy tracks_read_visible on public.tracks
  for select to authenticated using (is_public = true or owner_id = auth.uid());

drop policy if exists tracks_insert_self on public.tracks;
create policy tracks_insert_self on public.tracks
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists tracks_update_own on public.tracks;
create policy tracks_update_own on public.tracks
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists tracks_delete_own on public.tracks;
create policy tracks_delete_own on public.tracks
  for delete to authenticated using (owner_id = auth.uid());

grant select, insert, update, delete on public.tracks to authenticated;

-- Public read view with the uploader's display name.
drop view if exists public.tracks_with_author;
create view public.tracks_with_author
with (security_invoker = true) as
  select t.id, t.owner_id, t.audio_url, t.title, t.artist, t.cover_url,
         t.is_public, t.play_count, t.created_at,
         p.username  as owner_username,
         p.display_name as owner_display_name
    from public.tracks t
    join public.profiles p on p.id = t.owner_id;
grant select on public.tracks_with_author to authenticated;

-- ── music storage bucket (40 MB cap, audio MIMEs) ───────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'music',
    'music',
    true,
    41943040,
    array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg',
          'audio/webm','audio/aac','audio/mp4','audio/x-m4a','audio/flac']
  )
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "music_storage_read" on storage.objects;
create policy "music_storage_read" on storage.objects
  for select to authenticated using (bucket_id = 'music');

drop policy if exists "music_storage_insert" on storage.objects;
create policy "music_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'music'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "music_storage_delete" on storage.objects;
create policy "music_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'music'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
