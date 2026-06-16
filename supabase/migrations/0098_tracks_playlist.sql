-- Karochat — optional playlist name on user track uploads.
--
-- Additive and nullable: existing rows and the Infotainment music uploader
-- (which doesn't set it) are completely unaffected. Lets the Sleep music
-- uploader group a user's own tracks under a named playlist.

alter table public.tracks add column if not exists playlist text;

-- Helps "my uploads grouped by playlist" lookups; partial so it stays tiny.
create index if not exists tracks_owner_playlist_idx
  on public.tracks (owner_id, playlist)
  where playlist is not null;
