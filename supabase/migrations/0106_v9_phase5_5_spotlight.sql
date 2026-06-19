-- Karochat — v9 Phase 5.5: Spotlight (ranked public short-video discovery).
-- A discovery layer over the existing public `shorts` (0010) / shorts_with_author
-- view + short_likes + toggle_short_like. Adds engagement-ranked feed reads and
-- view counting. No new content type. Idempotent.

-- =====================================================================
-- 1) increment_short_view — count a watch (public shorts only, never your
--    own). Plain counter; good enough for v1 ranking signal.
-- =====================================================================
create or replace function public.increment_short_view(p_short_id uuid)
returns void
language sql security definer set search_path = public as $$
  update public.shorts
     set view_count = view_count + 1
   where id = p_short_id
     and is_public = true
     and author_id <> auth.uid();
$$;
grant execute on function public.increment_short_view(uuid) to authenticated;

-- =====================================================================
-- 2) list_spotlight — public shorts ranked by an HN-style score that blends
--    likes / comments / a little view weight against a recency decay, so fresh
--    + engaging content rises and old content sinks. Paged via limit/offset.
-- =====================================================================
create or replace function public.list_spotlight(
  p_limit  int default 20,
  p_offset int default 0
)
returns table(
  id                    uuid,
  author_id             uuid,
  video_url             text,
  thumb_url             text,
  caption               text,
  is_public             boolean,
  view_count            integer,
  like_count            integer,
  comment_count         bigint,
  created_at            timestamptz,
  author_username       text,
  author_display_name   text,
  author_is_guest       boolean,
  author_presence_state text,
  viewer_liked          boolean
)
language sql security definer stable set search_path = public as $$
  select
    swa.id, swa.author_id, swa.video_url, swa.thumb_url, swa.caption,
    swa.is_public, swa.view_count, swa.like_count, swa.comment_count, swa.created_at,
    swa.author_username, swa.author_display_name, swa.author_is_guest,
    swa.author_presence_state,
    exists (select 1 from public.short_likes sl
            where sl.short_id = swa.id and sl.user_id = auth.uid()) as viewer_liked
  from public.shorts_with_author swa
  where swa.is_public = true
  order by
    (swa.like_count * 3 + swa.comment_count * 4 + swa.view_count * 0.15 + 1)
      / power(extract(epoch from (now() - swa.created_at)) / 3600.0 + 2, 1.3) desc,
    swa.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;
grant execute on function public.list_spotlight(int, int) to authenticated;
