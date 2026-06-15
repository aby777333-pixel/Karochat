-- Karochat — Adult hub: per-post category + bigger storage.
--
-- Adds a free-form `category` to adult_media (caption is the existing `title`),
-- exposes it on the author-joined view, and raises the adult-media bucket file
-- size limit to 512 MB so longer videos fit. Public/private is the existing
-- is_public flag (RLS already hides private posts from everyone but the author).
--
-- Purely additive + idempotent. No existing column, policy, RLS rule or row is
-- changed; the view is recreated with one extra column (security mode preserved).

alter table public.adult_media add column if not exists category text;

create index if not exists adult_media_category_idx
  on public.adult_media (category) where category is not null;

-- More room for videos/shorts.
update storage.buckets set file_size_limit = 536870912 where id = 'adult-media';

-- Recreate the author-joined view with `category` (security_invoker preserved so
-- RLS still gates who can read which rows).
drop view if exists public.adult_media_with_author;
create view public.adult_media_with_author
with (security_invoker = true) as
select
  m.id, m.author_id, m.kind, m.media_url, m.external_url, m.title, m.category,
  m.country, m.region, m.is_public, m.created_at,
  p.username     as author_username,
  p.display_name as author_display_name
from public.adult_media m
left join public.profiles p on p.id = m.author_id;

grant select on public.adult_media_with_author to authenticated;
