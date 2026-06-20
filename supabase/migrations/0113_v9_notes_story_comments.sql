-- Karochat — Comments on Notes (6.3) and Stories (5.1).
-- Mirrors the post_comments / short_comments / video_comments pattern so the
-- shared <CommentSection kind="note"|"story"> component reuses it verbatim:
--   table   = `${kind}_comments`
--   view    = `${kind}_comments_with_author`  (security_invoker)
--   id col  = `${kind}_id`
-- Visibility rides the existing audience model — note comments via can_see_note,
-- story comments via a new can_see_story helper. Additive + idempotent.

alter table public.notes   add column if not exists comment_count int not null default 0;
alter table public.stories add column if not exists comment_count int not null default 0;

-- can_see_story — SECURITY DEFINER visibility test mirroring the 0102 stories
-- read policy (public / own / friends / close_friends, live only).
create or replace function public.can_see_story(p_story_id uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.stories s
    where s.id = p_story_id and (
      s.author_id = auth.uid()
      or (s.expires_at > now() and (
        s.audience_kind = 'public'
        or (s.audience_kind = 'friends' and public.are_friends(s.author_id, auth.uid()))
        or (s.audience_kind = 'close_friends' and exists (
              select 1 from public.close_friends cf
              where cf.owner_profile_id = s.author_id
                and cf.friend_profile_id = auth.uid()))
      ))
    )
  );
$$;
grant execute on function public.can_see_story(uuid) to authenticated;

-- =====================================================================
-- Note comments
-- =====================================================================
create table if not exists public.note_comments (
  id         uuid primary key default gen_random_uuid(),
  note_id    uuid not null references public.notes(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists note_comments_idx on public.note_comments (note_id, created_at);
alter table public.note_comments enable row level security;

drop policy if exists "note_comments_read" on public.note_comments;
create policy "note_comments_read" on public.note_comments
  for select to authenticated using (author_id = auth.uid() or public.can_see_note(note_id));
drop policy if exists "note_comments_insert" on public.note_comments;
create policy "note_comments_insert" on public.note_comments
  for insert to authenticated with check (author_id = auth.uid() and public.can_see_note(note_id));
drop policy if exists "note_comments_delete" on public.note_comments;
create policy "note_comments_delete" on public.note_comments
  for delete to authenticated using (
    author_id = auth.uid()
    or exists (select 1 from public.notes n where n.id = note_id and n.author_profile_id = auth.uid())
  );
grant select, insert, delete on public.note_comments to authenticated;

drop view if exists public.note_comments_with_author;
create view public.note_comments_with_author
with (security_invoker = true) as
select c.id, c.note_id, c.author_id, c.body, c.created_at,
       p.username as author_username, p.display_name as author_display_name,
       p.is_guest as author_is_guest, p.presence_state as author_presence_state
from public.note_comments c
left join public.profiles p on p.id = c.author_id;
grant select on public.note_comments_with_author to authenticated;

create or replace function public.note_comments_count_tg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.notes set comment_count = comment_count + 1 where id = new.note_id;
  elsif tg_op = 'DELETE' then
    update public.notes set comment_count = greatest(comment_count - 1, 0) where id = old.note_id;
  end if;
  return null;
end$$;
drop trigger if exists note_comments_count on public.note_comments;
create trigger note_comments_count
  after insert or delete on public.note_comments
  for each row execute function public.note_comments_count_tg();

-- =====================================================================
-- Story comments
-- =====================================================================
create table if not exists public.story_comments (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references public.stories(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists story_comments_idx on public.story_comments (story_id, created_at);
alter table public.story_comments enable row level security;

drop policy if exists "story_comments_read" on public.story_comments;
create policy "story_comments_read" on public.story_comments
  for select to authenticated using (author_id = auth.uid() or public.can_see_story(story_id));
drop policy if exists "story_comments_insert" on public.story_comments;
create policy "story_comments_insert" on public.story_comments
  for insert to authenticated with check (author_id = auth.uid() and public.can_see_story(story_id));
drop policy if exists "story_comments_delete" on public.story_comments;
create policy "story_comments_delete" on public.story_comments
  for delete to authenticated using (
    author_id = auth.uid()
    or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid())
  );
grant select, insert, delete on public.story_comments to authenticated;

drop view if exists public.story_comments_with_author;
create view public.story_comments_with_author
with (security_invoker = true) as
select c.id, c.story_id, c.author_id, c.body, c.created_at,
       p.username as author_username, p.display_name as author_display_name,
       p.is_guest as author_is_guest, p.presence_state as author_presence_state
from public.story_comments c
left join public.profiles p on p.id = c.author_id;
grant select on public.story_comments_with_author to authenticated;

create or replace function public.story_comments_count_tg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.stories set comment_count = comment_count + 1 where id = new.story_id;
  elsif tg_op = 'DELETE' then
    update public.stories set comment_count = greatest(comment_count - 1, 0) where id = old.story_id;
  end if;
  return null;
end$$;
drop trigger if exists story_comments_count on public.story_comments;
create trigger story_comments_count
  after insert or delete on public.story_comments
  for each row execute function public.story_comments_count_tg();
