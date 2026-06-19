-- Karochat — v9 Phase 5.1: Stories upgrade (Snapchat/IG layer, part 1).
-- Adds video stories, audience tiers (public / friends / close_friends),
-- per-story view tracking ("seen by"), Close Friends management, and the
-- Memories archive (your own past stories persist — no cron deletes them).
--
-- Builds on:
--   0011_mood_vibes_stories.sql  (public.stories, stories_with_author view)
--   0013_friendships.sql         (public.friendships — accepted = "friends")
--   0042_v9_phase1_foundations   (public.close_friends, dormant until now)
-- Idempotent. Safe to re-run.

-- =====================================================================
-- 1) Extend public.stories: video kind + media columns + audience tiers
-- =====================================================================
alter table public.stories add column if not exists media_url  text; -- video src
alter table public.stories add column if not exists poster_url text; -- video thumb

-- Existing inline CHECKs from 0011 (names confirmed against live schema):
--   stories_kind_check, stories_audience_kind_check, stories_check
alter table public.stories drop constraint if exists stories_kind_check;
alter table public.stories drop constraint if exists stories_audience_kind_check;
alter table public.stories drop constraint if exists stories_check;
alter table public.stories drop constraint if exists stories_payload_check;

alter table public.stories
  add constraint stories_kind_check
  check (kind in ('text','image','video'));

alter table public.stories
  add constraint stories_audience_kind_check
  check (audience_kind in ('public','friends','close_friends'));

alter table public.stories
  add constraint stories_payload_check
  check (
       (kind = 'text'  and body is not null and length(body) <= 280)
    or (kind = 'image' and image_url is not null)
    or (kind = 'video' and media_url is not null)
  );

-- =====================================================================
-- 2) are_friends(a,b) — SECURITY DEFINER so policies/RPCs can test the
--    accepted-friendship relation without tripping friendships RLS
--    (and without the RLS-recursion that bit us before).
-- =====================================================================
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ( (f.requester_id = a and f.recipient_id = b)
         or (f.requester_id = b and f.recipient_id = a) )
  );
$$;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- =====================================================================
-- 3) Audience-aware read policy on stories.
--    Author always sees own (any expiry → powers Memories). Everyone else
--    sees only LIVE stories whose audience admits them.
-- =====================================================================
drop policy if exists "stories_read_live_or_own" on public.stories;
create policy "stories_read_live_or_own" on public.stories
  for select to authenticated using (
    author_id = auth.uid()
    or (
      expires_at > now()
      and (
        audience_kind = 'public'
        or (audience_kind = 'friends'
            and public.are_friends(author_id, auth.uid()))
        or (audience_kind = 'close_friends' and exists (
              select 1 from public.close_friends cf
              where cf.owner_profile_id = author_id
                and cf.friend_profile_id = auth.uid()))
      )
    )
  );

-- =====================================================================
-- 4) story_views — who has seen each story ("seen by N")
-- =====================================================================
create table if not exists public.story_views (
  story_id  uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
create index if not exists story_views_story_idx on public.story_views(story_id);
alter table public.story_views enable row level security;

drop policy if exists "story_views_insert_self" on public.story_views;
create policy "story_views_insert_self" on public.story_views
  for insert to authenticated with check (viewer_id = auth.uid());

-- A viewer reads their own view rows; a story author reads all views on theirs.
drop policy if exists "story_views_read" on public.story_views;
create policy "story_views_read" on public.story_views
  for select to authenticated using (
    viewer_id = auth.uid()
    or exists (select 1 from public.stories s
               where s.id = story_id and s.author_id = auth.uid())
  );

-- mark_story_viewed — idempotent; never records self-views; only records a
-- view when the caller is actually permitted to see the story.
create or replace function public.mark_story_viewed(p_story_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if not exists (
    select 1 from public.stories s
    where s.id = p_story_id
      and s.author_id <> auth.uid()
      and s.expires_at > now()
      and (
        s.audience_kind = 'public'
        or (s.audience_kind = 'friends'
            and public.are_friends(s.author_id, auth.uid()))
        or (s.audience_kind = 'close_friends' and exists (
              select 1 from public.close_friends cf
              where cf.owner_profile_id = s.author_id
                and cf.friend_profile_id = auth.uid()))
      )
  ) then
    return;
  end if;
  insert into public.story_views(story_id, viewer_id)
  values (p_story_id, auth.uid())
  on conflict (story_id, viewer_id) do nothing;
end;
$$;
grant execute on function public.mark_story_viewed(uuid) to authenticated;

-- =====================================================================
-- 5) Rebuild stories_with_author with media + audience + view counts.
--    security_invoker = on → the audience RLS above governs row visibility
--    through the view (the old view ran as owner and bypassed RLS, which was
--    fine while every story was public; it is NOT fine now).
-- =====================================================================
drop view if exists public.stories_with_author;
create view public.stories_with_author
  with (security_invoker = on) as
select
  s.id, s.author_id, s.kind, s.body, s.image_url, s.media_url, s.poster_url,
  s.audience_kind, s.expires_at, s.is_adult, s.created_at,
  p.username       as author_username,
  p.display_name   as author_display_name,
  p.avatar_url     as author_avatar_url,
  p.is_guest       as author_is_guest,
  p.presence_state as author_presence_state,
  (select count(*) from public.story_views v where v.story_id = s.id) as view_count,
  exists (select 1 from public.story_views v
          where v.story_id = s.id and v.viewer_id = auth.uid()) as viewer_seen
from public.stories s
left join public.profiles p on p.id = s.author_id;

-- security_invoker needs the caller to hold base-table SELECT.
grant select on public.stories       to authenticated;
grant select on public.profiles      to authenticated;
grant select on public.story_views   to authenticated;
grant select on public.stories_with_author to authenticated;

-- =====================================================================
-- 6) Close Friends management (table + RLS already shipped in 0042).
--    Adds the guarded RPCs the UI calls.
-- =====================================================================
create or replace function public.add_close_friend(p_friend uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_friend = auth.uid() then return; end if;
  if not public.are_friends(auth.uid(), p_friend) then
    raise exception 'You can only add accepted friends to your close friends list.';
  end if;
  insert into public.close_friends(owner_profile_id, friend_profile_id)
  values (auth.uid(), p_friend)
  on conflict do nothing;
end;
$$;
grant execute on function public.add_close_friend(uuid) to authenticated;

create or replace function public.remove_close_friend(p_friend uuid)
returns void
language sql security definer set search_path = public as $$
  delete from public.close_friends
  where owner_profile_id = auth.uid() and friend_profile_id = p_friend;
$$;
grant execute on function public.remove_close_friend(uuid) to authenticated;

-- list_my_friends_for_close — accepted friends + whether each is a close
-- friend, for the manager UI. (OUT col is friend_id, never "id" — avoids the
-- plpgsql RETURNS TABLE(id …) ambiguity gotcha.)
create or replace function public.list_my_friends_for_close()
returns table(
  friend_id    uuid,
  username     text,
  display_name text,
  avatar_url   text,
  is_close     boolean
)
language sql security definer stable set search_path = public as $$
  select
    pr.id, pr.username, pr.display_name, pr.avatar_url,
    exists (select 1 from public.close_friends cf
            where cf.owner_profile_id = auth.uid()
              and cf.friend_profile_id = pr.id) as is_close
  from public.friendships f
  join public.profiles pr
    on pr.id = case when f.requester_id = auth.uid()
                    then f.recipient_id else f.requester_id end
  where f.status = 'accepted'
    and (f.requester_id = auth.uid() or f.recipient_id = auth.uid())
  order by is_close desc, lower(coalesce(pr.display_name, pr.username, ''));
$$;
grant execute on function public.list_my_friends_for_close() to authenticated;

-- Memories need no new objects: the author-reads-own branch of the stories
-- RLS already exposes every past story (expired included) to its author, and
-- no job deletes them. The /memories page queries stories_with_author
-- filtered to the current author.
