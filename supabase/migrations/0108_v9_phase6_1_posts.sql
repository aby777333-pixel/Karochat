-- Karochat — v9 Phase 6.1: Posts + Carousels (Instagram layer, part 1).
-- Wires the dormant posts + post_carousel_items tables (0042). Adds likes,
-- saves, comments (same pattern as shorts/videos), a visibility helper, and the
-- home feed (following / discover). Purely additive — shorts/videos/stories/
-- reels are untouched. Idempotent.

-- Dormant tables already have RLS from 0042; ensure role grants exist.
grant select, insert, update, delete on public.posts to authenticated;
grant select on public.post_carousel_items to authenticated;
grant insert, update, delete on public.post_carousel_items to authenticated;

-- =====================================================================
-- can_see_post — SECURITY DEFINER visibility test (avoids RLS-recursion when
-- referenced from other tables' policies / definer feeds).
-- =====================================================================
create or replace function public.can_see_post(p_post_id uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post_id and (
      p.audience_kind = 'public'
      or p.author_profile_id = auth.uid()
      or (p.audience_kind = 'followers' and exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid() and f.following_id = p.author_profile_id))
      or (p.audience_kind = 'close_friends' and exists (
            select 1 from public.close_friends cf
            where cf.owner_profile_id = p.author_profile_id
              and cf.friend_profile_id = auth.uid()))
    )
  );
$$;
grant execute on function public.can_see_post(uuid) to authenticated;

-- =====================================================================
-- Likes
-- =====================================================================
create table if not exists public.post_likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_likes enable row level security;
drop policy if exists "post_likes_read" on public.post_likes;
create policy "post_likes_read" on public.post_likes for select to authenticated using (true);
drop policy if exists "post_likes_insert" on public.post_likes;
create policy "post_likes_insert" on public.post_likes
  for insert to authenticated with check (user_id = auth.uid() and public.can_see_post(post_id));
drop policy if exists "post_likes_delete" on public.post_likes;
create policy "post_likes_delete" on public.post_likes
  for delete to authenticated using (user_id = auth.uid());
grant select, insert, delete on public.post_likes to authenticated;

create or replace function public.toggle_post_like(p_post_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.post_likes where post_id = p_post_id and user_id = auth.uid()) then
    delete from public.post_likes where post_id = p_post_id and user_id = auth.uid();
    update public.posts set like_count = greatest(like_count - 1, 0) where id = p_post_id;
  else
    if not public.can_see_post(p_post_id) then raise exception 'Post not available'; end if;
    insert into public.post_likes(post_id, user_id) values (p_post_id, auth.uid())
      on conflict do nothing;
    update public.posts set like_count = like_count + 1 where id = p_post_id;
  end if;
  select like_count into v_count from public.posts where id = p_post_id;
  return coalesce(v_count, 0);
end;
$$;
grant execute on function public.toggle_post_like(uuid) to authenticated;

-- =====================================================================
-- Saves (bookmarks)
-- =====================================================================
create table if not exists public.post_saves (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_saves enable row level security;
drop policy if exists "post_saves_owner" on public.post_saves;
create policy "post_saves_owner" on public.post_saves
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.post_saves to authenticated;

create or replace function public.toggle_post_save(p_post_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_saved boolean;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.post_saves where post_id = p_post_id and user_id = auth.uid()) then
    delete from public.post_saves where post_id = p_post_id and user_id = auth.uid();
    update public.posts set save_count = greatest(save_count - 1, 0) where id = p_post_id;
    v_saved := false;
  else
    if not public.can_see_post(p_post_id) then raise exception 'Post not available'; end if;
    insert into public.post_saves(post_id, user_id) values (p_post_id, auth.uid())
      on conflict do nothing;
    update public.posts set save_count = save_count + 1 where id = p_post_id;
    v_saved := true;
  end if;
  return v_saved;
end;
$$;
grant execute on function public.toggle_post_save(uuid) to authenticated;

-- =====================================================================
-- Comments (mirrors short_comments / video_comments so CommentSection reuses it)
-- =====================================================================
create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_idx on public.post_comments (post_id, created_at);
alter table public.post_comments enable row level security;

drop policy if exists "post_comments_read" on public.post_comments;
create policy "post_comments_read" on public.post_comments
  for select to authenticated using (author_id = auth.uid() or public.can_see_post(post_id));
drop policy if exists "post_comments_insert" on public.post_comments;
create policy "post_comments_insert" on public.post_comments
  for insert to authenticated with check (author_id = auth.uid() and public.can_see_post(post_id));
drop policy if exists "post_comments_delete" on public.post_comments;
create policy "post_comments_delete" on public.post_comments
  for delete to authenticated using (
    author_id = auth.uid()
    or exists (select 1 from public.posts p where p.id = post_id and p.author_profile_id = auth.uid())
  );
grant select, insert, delete on public.post_comments to authenticated;

drop view if exists public.post_comments_with_author;
create view public.post_comments_with_author
with (security_invoker = true) as
select c.id, c.post_id, c.author_id, c.body, c.created_at,
       p.username as author_username, p.display_name as author_display_name,
       p.is_guest as author_is_guest, p.presence_state as author_presence_state
from public.post_comments c
left join public.profiles p on p.id = c.author_id;
grant select on public.post_comments_with_author to authenticated;

create or replace function public.post_comments_count_tg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end$$;
drop trigger if exists post_comments_count on public.post_comments;
create trigger post_comments_count
  after insert or delete on public.post_comments
  for each row execute function public.post_comments_count_tg();

-- =====================================================================
-- Feed reads
-- =====================================================================
create or replace function public.list_feed(
  p_scope  text default 'following',
  p_limit  int  default 20,
  p_offset int  default 0
)
returns table(
  id                    uuid,
  author_profile_id     uuid,
  body_markdown         text,
  hashtags              text[],
  location              text,
  media_urls            text[],
  is_carousel           boolean,
  is_adult              boolean,
  audience_kind         text,
  like_count            int,
  comment_count         int,
  save_count            int,
  created_at            timestamptz,
  author_username       text,
  author_display_name   text,
  author_avatar_url     text,
  author_is_guest       boolean,
  author_presence_state text,
  viewer_liked          boolean,
  viewer_saved          boolean
)
language sql security definer stable set search_path = public as $$
  select
    p.id, p.author_profile_id, p.body_markdown, p.hashtags, p.location, p.media_urls,
    p.is_carousel, p.is_adult, p.audience_kind, p.like_count, p.comment_count, p.save_count,
    p.created_at,
    pr.username, pr.display_name, pr.avatar_url, pr.is_guest, pr.presence_state,
    exists (select 1 from public.post_likes pl where pl.post_id = p.id and pl.user_id = auth.uid()),
    exists (select 1 from public.post_saves ps where ps.post_id = p.id and ps.user_id = auth.uid())
  from public.posts p
  join public.profiles pr on pr.id = p.author_profile_id
  where case
    when p_scope = 'discover' then
      p.audience_kind = 'public' and p.author_profile_id <> auth.uid()
    else
      (p.author_profile_id = auth.uid()
       or p.author_profile_id in (select following_id from public.follows where follower_id = auth.uid()))
      and public.can_see_post(p.id)
  end
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;
grant execute on function public.list_feed(text, int, int) to authenticated;

create or replace function public.list_user_posts(
  p_user   uuid,
  p_limit  int default 30,
  p_offset int default 0
)
returns table(
  id            uuid,
  media_urls    text[],
  is_carousel   boolean,
  like_count    int,
  comment_count int,
  created_at    timestamptz
)
language sql security definer stable set search_path = public as $$
  select p.id, p.media_urls, p.is_carousel, p.like_count, p.comment_count, p.created_at
  from public.posts p
  where p.author_profile_id = p_user and public.can_see_post(p.id)
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 60))
  offset greatest(0, coalesce(p_offset, 0));
$$;
grant execute on function public.list_user_posts(uuid, int, int) to authenticated;
