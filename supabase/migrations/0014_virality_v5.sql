-- Karochat — v11 Wave 7: v5 virality MVP bundle.
-- Daily Karo prompt, personal invite slugs + attribution, public room
-- landing-page RPC. Run AFTER 0013_friendships.sql. Idempotent.

-- ============================================================================
-- Z1: daily prompts. One row per calendar day; generated on first read.
-- ============================================================================
create table if not exists public.daily_prompts (
  id          uuid primary key default gen_random_uuid(),
  prompt      text not null,
  posted_for  date not null unique,
  language    text not null default 'en',
  created_at  timestamptz not null default now()
);

alter table public.daily_prompts enable row level security;

drop policy if exists "daily_prompts_read_all" on public.daily_prompts;
create policy "daily_prompts_read_all" on public.daily_prompts
  for select to authenticated using (true);
-- writes only via the ensure_daily_prompt SECURITY DEFINER RPC below.

create or replace function public.ensure_daily_prompt(p_prompt text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_today    date := (now() at time zone 'UTC')::date;
  v_existing text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_prompt is null or length(trim(p_prompt)) = 0 then
    raise exception 'prompt required';
  end if;
  select prompt into v_existing from public.daily_prompts where posted_for = v_today;
  if v_existing is not null then return v_existing; end if;
  insert into public.daily_prompts (prompt, posted_for, language)
    values (trim(p_prompt), v_today, 'en')
    on conflict (posted_for) do nothing;
  select prompt into v_existing from public.daily_prompts where posted_for = v_today;
  return v_existing;
end;
$$;

revoke all on function public.ensure_daily_prompt(text) from public;
grant execute on function public.ensure_daily_prompt(text) to authenticated;

-- ============================================================================
-- AA1: personal invite slugs + attribution
-- ============================================================================
alter table public.profiles
  add column if not exists invite_slug  text,
  add column if not exists invited_by   uuid references public.profiles(id) on delete set null;

create unique index if not exists profiles_invite_slug_idx
  on public.profiles (invite_slug)
  where invite_slug is not null;

-- get_or_create_invite_slug: returns the caller's slug, minting one if missing.
create or replace function public.get_or_create_invite_slug()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_existing text;
  v_slug     text;
  v_attempt  int  := 0;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select invite_slug into v_existing from public.profiles where id = v_user;
  if v_existing is not null then return v_existing; end if;
  loop
    v_attempt := v_attempt + 1;
    v_slug := lower(
      regexp_replace(encode(gen_random_bytes(5), 'base64'), '[^a-zA-Z0-9]', '', 'g')
    );
    v_slug := substr(v_slug, 1, 6);
    exit when length(v_slug) = 6
      and not exists (select 1 from public.profiles where invite_slug = v_slug);
    if v_attempt > 20 then raise exception 'could not allocate invite slug'; end if;
  end loop;
  update public.profiles set invite_slug = v_slug where id = v_user;
  return v_slug;
end;
$$;

revoke all on function public.get_or_create_invite_slug() from public;
grant execute on function public.get_or_create_invite_slug() to authenticated;

-- record_inviter: called after sign-up when the user lands with an
-- ?invite=<slug> referrer. Idempotent — only sets invited_by if NULL.
create or replace function public.record_inviter(p_slug text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_inviter uuid;
begin
  if v_user is null then return; end if;
  if p_slug is null or length(trim(p_slug)) = 0 then return; end if;
  select id into v_inviter from public.profiles
    where invite_slug = lower(trim(p_slug));
  if v_inviter is null or v_inviter = v_user then return; end if;
  update public.profiles
     set invited_by = v_inviter
   where id = v_user and invited_by is null;
end;
$$;

revoke all on function public.record_inviter(text) from public;
grant execute on function public.record_inviter(text) to authenticated;

-- ============================================================================
-- AA7: get_public_room — exposes a minimal preview of public/listed rooms
-- to anon users so the /r/[id] landing page works without auth.
-- ============================================================================
create or replace function public.get_public_room(p_room_id uuid)
returns table (
  id            uuid,
  name          text,
  description   text,
  visibility    text,
  is_public     boolean,
  member_count  int,
  created_at    timestamptz
)
language sql security definer set search_path = public stable
as $$
  select
    r.id, r.name, r.description, r.visibility, r.is_public,
    (select count(*) from public.room_members rm where rm.room_id = r.id)::int,
    r.created_at
  from public.rooms r
  where r.id = p_room_id
    and r.visibility in ('public','listed')
    and r.is_dm    = false
    and r.is_saved = false;
$$;

revoke all on function public.get_public_room(uuid) from public;
grant execute on function public.get_public_room(uuid) to anon, authenticated;
