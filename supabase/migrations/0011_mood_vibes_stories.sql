-- Karochat — v9 Wave 4: mood/expiry, vibes (E1), stories MVP (A1 starter).
-- Run AFTER 0010_shorts_search_visibility.sql. Idempotent.

-- ============================================================================
-- Mood (I1)
-- ============================================================================
alter table public.profiles
  add column if not exists mood            text,
  add column if not exists mood_expires_at timestamptz;

create or replace function public.set_mood(
  p_mood              text,
  p_expires_in_minutes int default 240
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_clean   text;
  v_expires timestamptz;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  v_clean := nullif(trim(coalesce(p_mood, '')), '');
  if v_clean is null then
    update public.profiles
       set mood = null, mood_expires_at = null
     where id = v_user;
    return;
  end if;
  v_expires := case
    when p_expires_in_minutes is null or p_expires_in_minutes <= 0 then null
    else now() + (p_expires_in_minutes * interval '1 minute')
  end;
  update public.profiles
     set mood = v_clean, mood_expires_at = v_expires
   where id = v_user;
end;
$$;

revoke all on function public.set_mood(text, int) from public;
grant execute on function public.set_mood(text, int) to authenticated;

-- ============================================================================
-- Vibes (E1) — only positive, three dimensions, rate-limited 1/day/dim/recipient
-- ============================================================================
create table if not exists public.vibes (
  id                uuid primary key default gen_random_uuid(),
  ratee_profile_id  uuid not null references public.profiles(id) on delete cascade,
  rater_profile_id  uuid not null references public.profiles(id) on delete cascade,
  dimension         text not null check (dimension in ('kindness','realness','quality')),
  created_at        timestamptz not null default now()
);

create index if not exists vibes_ratee_idx
  on public.vibes (ratee_profile_id, dimension, created_at desc);

-- Daily-rate limit ("one vibe per dimension per recipient per day") is
-- enforced inside give_vibe() — date_trunc() isn't IMMUTABLE so it can't
-- live in a unique index expression.

alter table public.vibes enable row level security;

drop policy if exists "vibes_read_all" on public.vibes;
create policy "vibes_read_all" on public.vibes
  for select to authenticated using (true);

-- give_vibe: returns the recipient's running count for that dimension.
-- Daily rate-limit (1/dim/recipient/day) is enforced inside the function.
create or replace function public.give_vibe(p_ratee_id uuid, p_dimension text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_count       int;
  v_today_count int;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_ratee_id is null then raise exception 'recipient required'; end if;
  if v_user = p_ratee_id then raise exception 'cannot vibe yourself'; end if;
  if p_dimension not in ('kindness','realness','quality') then
    raise exception 'invalid dimension';
  end if;

  select count(*) into v_today_count
    from public.vibes
   where rater_profile_id = v_user
     and ratee_profile_id = p_ratee_id
     and dimension        = p_dimension
     and created_at >= date_trunc('day', now());
  if v_today_count > 0 then
    raise exception 'already gave this vibe today';
  end if;

  insert into public.vibes (ratee_profile_id, rater_profile_id, dimension)
    values (p_ratee_id, v_user, p_dimension);

  select count(*) into v_count
    from public.vibes
   where ratee_profile_id = p_ratee_id and dimension = p_dimension;
  return v_count;
end;
$$;

revoke all on function public.give_vibe(uuid, text) from public;
grant execute on function public.give_vibe(uuid, text) to authenticated;

-- Per-profile vibe totals (read-only). Useful for the popover + future profile page.
create or replace view public.profile_vibes_view as
select
  p.id              as profile_id,
  p.username,
  p.display_name,
  p.is_guest,
  p.presence_state,
  p.status_text,
  p.status_emoji,
  p.mood,
  p.mood_expires_at,
  p.last_seen,
  coalesce((select count(*) from public.vibes v
             where v.ratee_profile_id = p.id and v.dimension = 'kindness'), 0) as vibe_kindness,
  coalesce((select count(*) from public.vibes v
             where v.ratee_profile_id = p.id and v.dimension = 'realness'), 0) as vibe_realness,
  coalesce((select count(*) from public.vibes v
             where v.ratee_profile_id = p.id and v.dimension = 'quality'),  0) as vibe_quality
from public.profiles p;

grant select on public.profile_vibes_view to authenticated;

-- ============================================================================
-- Stories (A1 — MVP). Public audience, optional image, 24h auto-expire.
-- ============================================================================
create table if not exists public.stories (
  id                uuid primary key default gen_random_uuid(),
  author_id         uuid not null references auth.users(id) on delete cascade,
  kind              text not null check (kind in ('text','image')),
  body              text,
  image_url         text,
  audience_kind     text not null default 'public'
                    check (audience_kind in ('public')),
  expires_at        timestamptz not null default (now() + interval '24 hours'),
  is_adult          boolean not null default false,
  created_at        timestamptz not null default now(),
  check (
    (kind = 'text'  and body is not null and length(body) <= 280) or
    (kind = 'image' and image_url is not null)
  )
);

create index if not exists stories_live_idx
  on public.stories (expires_at desc, created_at desc);

create index if not exists stories_author_idx
  on public.stories (author_id, created_at desc);

alter table public.stories enable row level security;

drop policy if exists "stories_read_live_or_own" on public.stories;
create policy "stories_read_live_or_own" on public.stories
  for select to authenticated using (
    expires_at > now() or author_id = auth.uid()
  );

drop policy if exists "stories_insert_self" on public.stories;
create policy "stories_insert_self" on public.stories
  for insert to authenticated with check (author_id = auth.uid());

drop policy if exists "stories_delete_own" on public.stories;
create policy "stories_delete_own" on public.stories
  for delete to authenticated using (author_id = auth.uid());

-- View with author info.
drop view if exists public.stories_with_author;
create view public.stories_with_author as
select
  s.id, s.author_id, s.kind, s.body, s.image_url, s.audience_kind,
  s.expires_at, s.is_adult, s.created_at,
  p.username       as author_username,
  p.display_name   as author_display_name,
  p.is_guest       as author_is_guest,
  p.presence_state as author_presence_state
from public.stories s
left join public.profiles p on p.id = s.author_id;

grant select on public.stories_with_author to authenticated;

-- Re-issue room_members_view so the member sidebar can read mood + expiry.
drop view if exists public.room_members_view;
create view public.room_members_view as
select
  rm.room_id,
  rm.user_id,
  rm.role,
  rm.joined_at,
  rm.rules_acknowledged_at,
  p.username,
  p.display_name,
  p.is_guest,
  p.presence_state,
  p.status_text,
  p.status_emoji,
  p.mood,
  p.mood_expires_at,
  p.last_seen
from public.room_members rm
join public.profiles p on p.id = rm.user_id;

grant select on public.room_members_view to authenticated;

-- Reuse the chat-images bucket for story images so we don't multiply buckets.
-- chat-images is already 8 MB / image MIMEs only with owner-scoped writes.
