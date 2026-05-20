-- Karochat — v8 Wave 3: shorts/reels, username search, room visibility editor.
-- Run AFTER 0009_rules_regret_polls.sql. Idempotent.

-- ============================================================================
-- Username search (used by the lobby UserSearch component)
-- ============================================================================
create or replace function public.search_users(p_query text)
returns table (
  id              uuid,
  username        text,
  display_name    text,
  is_guest        boolean,
  presence_state  text
)
language sql security definer set search_path = public
as $$
  with q as (select trim(coalesce(p_query, '')) as q)
  select p.id, p.username, p.display_name, p.is_guest, p.presence_state
    from public.profiles p, q
   where length(q.q) >= 1
     and p.username is not null
     and (p.username ilike '%' || q.q || '%'
          or coalesce(p.display_name, '') ilike '%' || q.q || '%')
     and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
   order by
     (case when p.username ilike q.q || '%' then 0 else 1 end),
     (case p.presence_state
        when 'online' then 0 when 'busy' then 1
        when 'away'   then 2 when 'invisible' then 3
        else 4 end),
     p.display_name nulls last,
     p.username
   limit 20;
$$;

revoke all on function public.search_users(text) from public;
grant execute on function public.search_users(text) to authenticated;

-- ============================================================================
-- set_room_visibility — owner-only; auto-mints a code when switching to
-- unlisted/secret if one doesn't exist yet.
-- ============================================================================
create or replace function public.set_room_visibility(
  p_room_id    uuid,
  p_visibility text
) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_owner     uuid;
  v_is_dm     boolean;
  v_is_saved  boolean;
  v_code      text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_visibility not in ('public','listed','unlisted','secret') then
    raise exception 'invalid visibility';
  end if;
  select owner_id, is_dm, is_saved, invite_code
    into v_owner, v_is_dm, v_is_saved, v_code
    from public.rooms where id = p_room_id;
  if v_owner is null then raise exception 'room not found'; end if;
  if v_is_dm or v_is_saved then
    raise exception 'cannot change visibility of DM or Saved rooms';
  end if;
  if v_owner <> v_user then
    raise exception 'only the owner can change visibility';
  end if;

  if p_visibility in ('unlisted','secret') and v_code is null then
    loop
      v_code := upper(
        regexp_replace(encode(gen_random_bytes(8), 'base64'), '[^A-Za-z0-9]', '', 'g')
      );
      v_code := substr(v_code, 1, 8);
      exit when length(v_code) = 8
        and not exists (select 1 from public.rooms where invite_code = v_code);
    end loop;
    update public.rooms
       set visibility = p_visibility, invite_code = v_code
     where id = p_room_id;
  else
    update public.rooms set visibility = p_visibility where id = p_room_id;
  end if;
  return p_visibility;
end;
$$;

revoke all on function public.set_room_visibility(uuid, text) from public;
grant execute on function public.set_room_visibility(uuid, text) to authenticated;

-- ============================================================================
-- Shorts (video posts) + likes
-- ============================================================================
create table if not exists public.shorts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references auth.users(id) on delete cascade,
  video_url   text not null,
  thumb_url   text,
  caption     text,
  is_public   boolean not null default true,
  view_count  integer not null default 0,
  like_count  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists shorts_public_idx on public.shorts (is_public, created_at desc)
  where is_public = true;
create index if not exists shorts_author_idx on public.shorts (author_id, created_at desc);

alter table public.shorts enable row level security;

drop policy if exists "shorts_read_visible" on public.shorts;
create policy "shorts_read_visible" on public.shorts
  for select to authenticated using (
    is_public = true or author_id = auth.uid()
  );

drop policy if exists "shorts_insert_self" on public.shorts;
create policy "shorts_insert_self" on public.shorts
  for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists "shorts_update_own" on public.shorts;
create policy "shorts_update_own" on public.shorts
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "shorts_delete_own" on public.shorts;
create policy "shorts_delete_own" on public.shorts
  for delete to authenticated
  using (author_id = auth.uid());

create table if not exists public.short_likes (
  short_id   uuid not null references public.shorts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (short_id, user_id)
);

alter table public.short_likes enable row level security;

drop policy if exists "short_likes_read" on public.short_likes;
create policy "short_likes_read" on public.short_likes
  for select to authenticated using (true);

drop policy if exists "short_likes_insert" on public.short_likes;
create policy "short_likes_insert" on public.short_likes
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "short_likes_delete" on public.short_likes;
create policy "short_likes_delete" on public.short_likes
  for delete to authenticated
  using (user_id = auth.uid());

-- toggle_short_like — flips this user's like and keeps like_count in sync.
create or replace function public.toggle_short_like(p_short_id uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_exists   boolean;
  v_count    int;
  v_is_public boolean;
  v_author   uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select is_public, author_id into v_is_public, v_author
    from public.shorts where id = p_short_id;
  if v_author is null then raise exception 'short not found'; end if;
  if not v_is_public and v_author <> v_user then
    raise exception 'short not visible';
  end if;

  select true into v_exists
    from public.short_likes
   where short_id = p_short_id and user_id = v_user;

  if v_exists then
    delete from public.short_likes
      where short_id = p_short_id and user_id = v_user;
    update public.shorts
       set like_count = greatest(like_count - 1, 0)
     where id = p_short_id;
  else
    insert into public.short_likes (short_id, user_id)
      values (p_short_id, v_user)
      on conflict do nothing;
    update public.shorts
       set like_count = like_count + 1
     where id = p_short_id;
  end if;

  select like_count into v_count from public.shorts where id = p_short_id;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.toggle_short_like(uuid) from public;
grant execute on function public.toggle_short_like(uuid) to authenticated;

-- View with author info — used by the feed.
drop view if exists public.shorts_with_author;
create view public.shorts_with_author as
select
  s.id, s.author_id, s.video_url, s.thumb_url, s.caption,
  s.is_public, s.view_count, s.like_count, s.created_at,
  p.username       as author_username,
  p.display_name   as author_display_name,
  p.is_guest       as author_is_guest,
  p.presence_state as author_presence_state
from public.shorts s
left join public.profiles p on p.id = s.author_id;

grant select on public.shorts_with_author to authenticated;

-- ============================================================================
-- Storage bucket for shorts (50 MB cap, common video MIMEs only).
-- The bucket itself is public so videos can be streamed without signed URLs;
-- write/delete are scoped to the uploader's folder.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'shorts',
    'shorts',
    true,
    52428800,
    array['video/mp4','video/webm','video/quicktime','video/x-m4v']
  )
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "shorts_storage_read" on storage.objects;
create policy "shorts_storage_read" on storage.objects
  for select to authenticated using (bucket_id = 'shorts');

drop policy if exists "shorts_storage_insert" on storage.objects;
create policy "shorts_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'shorts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "shorts_storage_delete" on storage.objects;
create policy "shorts_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'shorts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
