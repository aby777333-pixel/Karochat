-- Karochat — v12 Wave 15: one-shot bio drops, polylingual auto-translate
-- preference, and the report system (NCII priority queue groundwork).
-- Run AFTER 0019_vouches_and_profile.sql. Idempotent.

-- ============================================================================
-- profiles: bio_drop + auto_translate_to
-- ============================================================================
alter table public.profiles
  add column if not exists bio_drop              text,
  add column if not exists bio_drop_updated_at   timestamptz,
  add column if not exists auto_translate_to     text;

-- A bio "drop" — 280 chars, one paragraph, anonymous-friendly.
create or replace function public.set_bio_drop(p_bio text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_clean text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  v_clean := nullif(trim(coalesce(p_bio, '')), '');
  if v_clean is null then
    update public.profiles
       set bio_drop = null, bio_drop_updated_at = null
     where id = v_user;
    return;
  end if;
  if length(v_clean) > 280 then raise exception 'bio too long (280 max)'; end if;
  update public.profiles
     set bio_drop = v_clean, bio_drop_updated_at = now()
   where id = v_user;
end;
$$;

revoke all on function public.set_bio_drop(text) from public;
grant execute on function public.set_bio_drop(text) to authenticated;

-- Per-user auto-translate target — viewer picks which language they want
-- foreign messages rendered into. Stored as ISO 639-1 (or null = off).
create or replace function public.set_auto_translate(p_lang text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_clean text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  v_clean := nullif(trim(coalesce(p_lang, '')), '');
  -- We accept the same set as the existing TRANSLATE_LANGS — keep it
  -- permissive (any 2-5 char code) and let the client validate strictly.
  if v_clean is not null and length(v_clean) > 5 then
    raise exception 'invalid language';
  end if;
  update public.profiles
     set auto_translate_to = lower(v_clean)
   where id = v_user;
end;
$$;

revoke all on function public.set_auto_translate(text) from public;
grant execute on function public.set_auto_translate(text) to authenticated;

-- ============================================================================
-- reports: the safety queue. Every flag — message / user / room — funnels here.
-- NCII + minor categories are auto-prioritized in get_pending_reports.
-- ============================================================================
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid references public.profiles(id) on delete set null,
  target_kind   text not null check (target_kind in ('message','user','room')),
  target_id     text not null,
  category      text not null check (category in
                  ('minor','ncii','doxxing','violence','spam','hate','other')),
  body          text check (length(coalesce(body,'')) <= 1000),
  status        text not null default 'new'
                  check (status in ('new','triaged','actioned','dismissed')),
  reviewer_id   uuid references public.profiles(id) on delete set null,
  priority      int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists reports_pending_idx
  on public.reports (priority desc, created_at desc)
  where status in ('new','triaged');

create index if not exists reports_target_idx
  on public.reports (target_kind, target_id);

alter table public.reports enable row level security;

-- Reporters can read their own filings. Admins (handled outside RLS via
-- service-role) read all. Nobody else can read.
drop policy if exists "reports_read_own" on public.reports;
create policy "reports_read_own" on public.reports
  for select to authenticated using (reporter_id = auth.uid());

-- Insertion only happens through create_report (security definer).
-- Bare INSERT is blocked.

create or replace function public.create_report(
  p_target_kind text,
  p_target_id   text,
  p_category    text,
  p_body        text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_id       uuid;
  v_clean    text;
  v_priority int;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_target_kind not in ('message','user','room') then
    raise exception 'invalid target_kind';
  end if;
  if p_category not in ('minor','ncii','doxxing','violence','spam','hate','other') then
    raise exception 'invalid category';
  end if;
  if p_target_id is null or length(trim(p_target_id)) = 0 then
    raise exception 'target required';
  end if;
  v_clean := nullif(trim(coalesce(p_body,'')), '');
  if v_clean is not null and length(v_clean) > 1000 then
    raise exception 'note too long';
  end if;

  -- Priority: minor + ncii jump the queue (priority 100), doxxing/violence
  -- next (50), the rest at 0. Reviewers sort by priority desc, created asc.
  v_priority := case p_category
    when 'minor' then 100
    when 'ncii'  then 100
    when 'doxxing'  then 50
    when 'violence' then 50
    else 0
  end;

  v_id := gen_random_uuid();
  insert into public.reports
    (id, reporter_id, target_kind, target_id, category, body, priority)
  values
    (v_id, v_user, p_target_kind, p_target_id, p_category, v_clean, v_priority);
  return v_id;
end;
$$;

revoke all on function public.create_report(text, text, text, text) from public;
grant execute on function public.create_report(text, text, text, text) to authenticated;

-- ============================================================================
-- Refresh get_public_profile to include bio_drop fields. Drop first because
-- adding columns to the RETURNS TABLE shape isn't allowed via OR REPLACE.
-- ============================================================================
drop function if exists public.get_public_profile(text);

create or replace function public.get_public_profile(p_username text)
returns table (
  id                  uuid,
  username            text,
  display_name        text,
  is_guest            boolean,
  presence_state      text,
  status_text         text,
  status_emoji        text,
  mood                text,
  mood_expires_at     timestamptz,
  traveling_in_city   text,
  traveling_until     timestamptz,
  bio_drop            text,
  bio_drop_updated_at timestamptz,
  created_at          timestamptz,
  vibe_kindness       int,
  vibe_realness       int,
  vibe_quality        int,
  vouch_count         int
)
language sql security definer set search_path = public stable
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.is_guest,
    p.presence_state,
    p.status_text,
    p.status_emoji,
    p.mood,
    p.mood_expires_at,
    p.traveling_in_city,
    p.traveling_until,
    p.bio_drop,
    p.bio_drop_updated_at,
    p.created_at,
    coalesce((select count(*)::int from public.vibes v
               where v.ratee_profile_id = p.id and v.dimension = 'kindness'), 0),
    coalesce((select count(*)::int from public.vibes v
               where v.ratee_profile_id = p.id and v.dimension = 'realness'), 0),
    coalesce((select count(*)::int from public.vibes v
               where v.ratee_profile_id = p.id and v.dimension = 'quality'), 0),
    coalesce((select count(*)::int from public.vouches vv
               where vv.vouched_id = p.id and vv.revoked_at is null), 0)
  from public.profiles p
  where lower(p.username) = lower(trim(p_username))
  limit 1;
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;
