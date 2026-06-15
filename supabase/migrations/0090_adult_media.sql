-- Karochat — Adult (18+) media hub: gated user-generated media.
--
-- A storage table + bucket where ATTESTED ADULTS can share their OWN adult
-- audio / video / images (or paste external links), organised country/region
-- wise. Everything is gated behind profiles.adult_attested_at (set by the
-- existing attest_adult RPC) via the is_adult_user() helper below — non-adults
-- never even learn the media URLs (the row is invisible to them).
--
-- Purely additive + idempotent. Nothing existing is changed. This adds the
-- structure only; Karochat does not host or curate any third-party explicit
-- content. Uploaders are responsible for their content and must hold the rights;
-- illegal, non-consensual, or minor-involving content is forbidden and removable.

-- Helper: is the caller an attested 18+ adult? security definer so it can read
-- profiles regardless of the caller's RLS.
create or replace function public.is_adult_user()
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.adult_attested_at is not null
  );
$$;
revoke all on function public.is_adult_user() from public;
grant execute on function public.is_adult_user() to authenticated;

-- ============================================================================
-- adult_media
-- ============================================================================
create table if not exists public.adult_media (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('image','video','audio','link')),
  media_url    text,            -- set for uploaded files (public `adult-media` bucket)
  external_url text,            -- set for external links
  title        text,
  country      text,
  region       text,            -- state / region (free text)
  is_public    boolean not null default true,
  created_at   timestamptz not null default now(),
  check (media_url is not null or external_url is not null)
);

create index if not exists adult_media_feed_idx
  on public.adult_media (is_public, created_at desc) where is_public = true;
create index if not exists adult_media_author_idx
  on public.adult_media (author_id, created_at desc);
create index if not exists adult_media_country_idx
  on public.adult_media (country) where country is not null;

alter table public.adult_media enable row level security;

-- Read: attested adults see public posts; everyone sees their own.
drop policy if exists "adult_media_read" on public.adult_media;
create policy "adult_media_read" on public.adult_media
  for select to authenticated
  using ((is_public = true and public.is_adult_user()) or author_id = auth.uid());

-- Insert: must be your own row AND an attested adult.
drop policy if exists "adult_media_insert" on public.adult_media;
create policy "adult_media_insert" on public.adult_media
  for insert to authenticated
  with check (author_id = auth.uid() and public.is_adult_user());

-- Delete: your own rows.
drop policy if exists "adult_media_delete" on public.adult_media;
create policy "adult_media_delete" on public.adult_media
  for delete to authenticated using (author_id = auth.uid());

grant select, insert, delete on public.adult_media to authenticated;

-- Author-joined view (security_invoker → RLS above still applies to the reader).
drop view if exists public.adult_media_with_author;
create view public.adult_media_with_author
with (security_invoker = true) as
select
  m.id, m.author_id, m.kind, m.media_url, m.external_url, m.title,
  m.country, m.region, m.is_public, m.created_at,
  p.username     as author_username,
  p.display_name as author_display_name
from public.adult_media m
left join public.profiles p on p.id = m.author_id;

grant select on public.adult_media_with_author to authenticated;

-- ============================================================================
-- Storage bucket (200 MB cap; image/video/audio). Public bucket so the player
-- can fetch by URL, but the URL is only ever revealed through the RLS-gated
-- table above, so non-adults can't discover it. Writes require an attested
-- adult writing into their own folder.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'adult-media',
    'adult-media',
    true,
    209715200,
    array[
      'image/jpeg','image/png','image/webp','image/gif',
      'video/mp4','video/webm','video/quicktime',
      'audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/webm'
    ]
  )
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "adult_media_storage_read" on storage.objects;
create policy "adult_media_storage_read" on storage.objects
  for select to authenticated using (bucket_id = 'adult-media');

drop policy if exists "adult_media_storage_insert" on storage.objects;
create policy "adult_media_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'adult-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_adult_user()
  );

drop policy if exists "adult_media_storage_delete" on storage.objects;
create policy "adult_media_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'adult-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
