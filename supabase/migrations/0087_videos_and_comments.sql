-- Karochat — long-form Videos (YouTube-style) + comment threads for Videos AND
-- Shorts.
--
-- Mirrors the proven `shorts` pattern (table + likes + toggle RPC + _with_author
-- view + public storage bucket scoped to the uploader's folder), but for
-- long-form videos that can be EITHER an uploaded file OR an external link
-- (YouTube / Vimeo / Dailymotion / any other video site). Adds threaded comments
-- to both videos and shorts, with a maintained comment_count.
--
-- Purely additive + idempotent. Nothing existing is removed or renamed; the only
-- change to an existing object is appending `comment_count` to shorts +
-- recreating `shorts_with_author` to expose it (its security mode is preserved).

-- ============================================================================
-- videos (long-form posts) + likes
-- ============================================================================
create table if not exists public.videos (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references auth.users(id) on delete cascade,
  kind          text not null default 'upload' check (kind in ('upload','link')),
  video_url     text,        -- set for uploaded files (public `videos` bucket)
  external_url  text,        -- set for links to other video sites
  embed_url     text,        -- iframe-embeddable URL when one is derivable
  thumb_url     text,
  title         text not null,
  description   text,
  is_public     boolean not null default true,
  view_count    integer not null default 0,
  like_count    integer not null default 0,
  comment_count integer not null default 0,
  created_at    timestamptz not null default now(),
  check (video_url is not null or external_url is not null)
);

create index if not exists videos_public_idx on public.videos (is_public, created_at desc)
  where is_public = true;
create index if not exists videos_author_idx on public.videos (author_id, created_at desc);

alter table public.videos enable row level security;

drop policy if exists "videos_read_visible" on public.videos;
create policy "videos_read_visible" on public.videos
  for select to authenticated using (is_public = true or author_id = auth.uid());

drop policy if exists "videos_insert_self" on public.videos;
create policy "videos_insert_self" on public.videos
  for insert to authenticated with check (author_id = auth.uid());

drop policy if exists "videos_update_own" on public.videos;
create policy "videos_update_own" on public.videos
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists "videos_delete_own" on public.videos;
create policy "videos_delete_own" on public.videos
  for delete to authenticated using (author_id = auth.uid());

grant select, insert, update, delete on public.videos to authenticated;

create table if not exists public.video_likes (
  video_id   uuid not null references public.videos(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, user_id)
);

alter table public.video_likes enable row level security;

drop policy if exists "video_likes_read" on public.video_likes;
create policy "video_likes_read" on public.video_likes
  for select to authenticated using (true);

drop policy if exists "video_likes_insert" on public.video_likes;
create policy "video_likes_insert" on public.video_likes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "video_likes_delete" on public.video_likes;
create policy "video_likes_delete" on public.video_likes
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, delete on public.video_likes to authenticated;

create or replace function public.toggle_video_like(p_video_id uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_exists    boolean;
  v_count     int;
  v_is_public boolean;
  v_author    uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select is_public, author_id into v_is_public, v_author
    from public.videos where id = p_video_id;
  if v_author is null then raise exception 'video not found'; end if;
  if not v_is_public and v_author <> v_user then
    raise exception 'video not visible';
  end if;

  select true into v_exists
    from public.video_likes
   where video_id = p_video_id and user_id = v_user;

  if v_exists then
    delete from public.video_likes
      where video_id = p_video_id and user_id = v_user;
    update public.videos
       set like_count = greatest(like_count - 1, 0)
     where id = p_video_id;
  else
    insert into public.video_likes (video_id, user_id)
      values (p_video_id, v_user)
      on conflict do nothing;
    update public.videos
       set like_count = like_count + 1
     where id = p_video_id;
  end if;

  select like_count into v_count from public.videos where id = p_video_id;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.toggle_video_like(uuid) from public;
grant execute on function public.toggle_video_like(uuid) to authenticated;

-- View with author info — RLS-respecting (security_invoker), so the feed only
-- ever sees public videos + the viewer's own.
drop view if exists public.videos_with_author;
create view public.videos_with_author
with (security_invoker = true) as
select
  v.id, v.author_id, v.kind, v.video_url, v.external_url, v.embed_url,
  v.thumb_url, v.title, v.description, v.is_public,
  v.view_count, v.like_count, v.comment_count, v.created_at,
  p.username       as author_username,
  p.display_name   as author_display_name,
  p.is_guest       as author_is_guest,
  p.presence_state as author_presence_state
from public.videos v
left join public.profiles p on p.id = v.author_id;

grant select on public.videos_with_author to authenticated;

-- ============================================================================
-- Storage bucket for long-form videos (200 MB cap, common video MIMEs).
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'videos',
    'videos',
    true,
    209715200,
    array['video/mp4','video/webm','video/quicktime','video/x-m4v','video/x-matroska']
  )
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "videos_storage_read" on storage.objects;
create policy "videos_storage_read" on storage.objects
  for select to authenticated using (bucket_id = 'videos');

drop policy if exists "videos_storage_insert" on storage.objects;
create policy "videos_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "videos_storage_delete" on storage.objects;
create policy "videos_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- Comments — for shorts AND videos. comment_count is maintained by triggers.
-- ============================================================================
alter table public.shorts add column if not exists comment_count integer not null default 0;

-- short_comments -------------------------------------------------------------
create table if not exists public.short_comments (
  id         uuid primary key default gen_random_uuid(),
  short_id   uuid not null references public.shorts(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists short_comments_idx on public.short_comments (short_id, created_at);

alter table public.short_comments enable row level security;

drop policy if exists "short_comments_read" on public.short_comments;
create policy "short_comments_read" on public.short_comments
  for select to authenticated using (
    author_id = auth.uid()
    or exists (
      select 1 from public.shorts s
       where s.id = short_id and (s.is_public = true or s.author_id = auth.uid())
    )
  );

drop policy if exists "short_comments_insert" on public.short_comments;
create policy "short_comments_insert" on public.short_comments
  for insert to authenticated with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.shorts s
       where s.id = short_id and (s.is_public = true or s.author_id = auth.uid())
    )
  );

drop policy if exists "short_comments_delete" on public.short_comments;
create policy "short_comments_delete" on public.short_comments
  for delete to authenticated using (
    author_id = auth.uid()
    or exists (select 1 from public.shorts s where s.id = short_id and s.author_id = auth.uid())
  );

grant select, insert, delete on public.short_comments to authenticated;

-- video_comments -------------------------------------------------------------
create table if not exists public.video_comments (
  id         uuid primary key default gen_random_uuid(),
  video_id   uuid not null references public.videos(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists video_comments_idx on public.video_comments (video_id, created_at);

alter table public.video_comments enable row level security;

drop policy if exists "video_comments_read" on public.video_comments;
create policy "video_comments_read" on public.video_comments
  for select to authenticated using (
    author_id = auth.uid()
    or exists (
      select 1 from public.videos v
       where v.id = video_id and (v.is_public = true or v.author_id = auth.uid())
    )
  );

drop policy if exists "video_comments_insert" on public.video_comments;
create policy "video_comments_insert" on public.video_comments
  for insert to authenticated with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.videos v
       where v.id = video_id and (v.is_public = true or v.author_id = auth.uid())
    )
  );

drop policy if exists "video_comments_delete" on public.video_comments;
create policy "video_comments_delete" on public.video_comments
  for delete to authenticated using (
    author_id = auth.uid()
    or exists (select 1 from public.videos v where v.id = video_id and v.author_id = auth.uid())
  );

grant select, insert, delete on public.video_comments to authenticated;

-- Author-joined comment views (RLS-respecting). ------------------------------
drop view if exists public.short_comments_with_author;
create view public.short_comments_with_author
with (security_invoker = true) as
select c.id, c.short_id, c.author_id, c.body, c.created_at,
       p.username as author_username, p.display_name as author_display_name,
       p.is_guest as author_is_guest, p.presence_state as author_presence_state
from public.short_comments c
left join public.profiles p on p.id = c.author_id;
grant select on public.short_comments_with_author to authenticated;

drop view if exists public.video_comments_with_author;
create view public.video_comments_with_author
with (security_invoker = true) as
select c.id, c.video_id, c.author_id, c.body, c.created_at,
       p.username as author_username, p.display_name as author_display_name,
       p.is_guest as author_is_guest, p.presence_state as author_presence_state
from public.video_comments c
left join public.profiles p on p.id = c.author_id;
grant select on public.video_comments_with_author to authenticated;

-- comment_count maintenance triggers ----------------------------------------
create or replace function public.short_comments_count_tg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.shorts set comment_count = comment_count + 1 where id = new.short_id;
  elsif tg_op = 'DELETE' then
    update public.shorts set comment_count = greatest(comment_count - 1, 0) where id = old.short_id;
  end if;
  return null;
end$$;

drop trigger if exists short_comments_count on public.short_comments;
create trigger short_comments_count
  after insert or delete on public.short_comments
  for each row execute function public.short_comments_count_tg();

create or replace function public.video_comments_count_tg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.videos set comment_count = comment_count + 1 where id = new.video_id;
  elsif tg_op = 'DELETE' then
    update public.videos set comment_count = greatest(comment_count - 1, 0) where id = old.video_id;
  end if;
  return null;
end$$;

drop trigger if exists video_comments_count on public.video_comments;
create trigger video_comments_count
  after insert or delete on public.video_comments
  for each row execute function public.video_comments_count_tg();

-- Expose comment_count on the existing shorts feed view. CREATE OR REPLACE only
-- adds the column at the end and PRESERVES the view's current security mode.
create or replace view public.shorts_with_author as
select
  s.id, s.author_id, s.video_url, s.thumb_url, s.caption,
  s.is_public, s.view_count, s.like_count, s.created_at,
  p.username       as author_username,
  p.display_name   as author_display_name,
  p.is_guest       as author_is_guest,
  p.presence_state as author_presence_state,
  s.comment_count
from public.shorts s
left join public.profiles p on p.id = s.author_id;
