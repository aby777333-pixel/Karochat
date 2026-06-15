-- Karochat — Adult hub: allow a 'channel' media kind (live TV / stream links).
--
-- Widens adult_media.kind to include 'channel' so attested adults can add live
-- adult TV channels / streams (HLS .m3u8 or direct URLs in external_url),
-- organised country/region wise, played via the same HLS player as the TV &
-- Radio / Sports hubs. Purely additive: only relaxes the CHECK constraint to
-- permit one more value; existing rows, RLS, the bucket and the view are
-- unchanged. Karochat curates no channels — entries are user-submitted.

alter table public.adult_media drop constraint if exists adult_media_kind_check;
alter table public.adult_media
  add constraint adult_media_kind_check
  check (kind in ('image', 'video', 'audio', 'link', 'channel'));
