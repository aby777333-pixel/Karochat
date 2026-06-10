-- Karochat — Meet-now Radar / Scanner.
--
-- A location-aware "scanner" for the Meet-now section. A user presses the
-- scanner, the browser shares their location, and we (a) put them on the radar
-- (opt-in, auto-expiring) with a short "what I'm looking for" note, (b) find
-- other people currently on the radar within a chosen mile-radius (worldwide),
-- and (c) drop a notification ping on each nearby person so they know someone
-- close by is looking. From the results list a user can wave, message, or
-- start a voice/video call — all of which route into a 1:1 DM room where the
-- existing call + audio/video-clip + file features already live.
--
-- Privacy by design:
--   * You only appear to others after YOU press scan (explicit opt-in).
--   * Raw coordinates never leave the row — RLS keeps radar_presence
--     owner-only and discovery happens through a SECURITY DEFINER RPC that
--     returns rounded distance, never lat/lng.
--   * Presence auto-expires after 60 minutes; "Go offline" clears it instantly.
--   * Blocks (user_blocks) are honoured in both directions, everywhere.
--
-- Idempotent and additive. Nothing existing is touched. No PostGIS needed —
-- distance is a plain-SQL Haversine, fine for the small set of live radar rows.

-- ============================================================================
-- 0) Haversine distance in miles (immutable helper)
-- ============================================================================
create or replace function public._radar_miles(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision
language sql immutable parallel safe as $$
  select 3958.7559 * 2 * asin(least(1.0, sqrt(
    power(sin(radians((lat2 - lat1) / 2)), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians((lng2 - lng1) / 2)), 2)
  )));
$$;

-- ============================================================================
-- 1) radar_presence — one row per user currently broadcasting
-- ============================================================================
create table if not exists public.radar_presence (
  profile_id   uuid primary key references public.profiles(id) on delete cascade,
  lat          double precision not null,
  lng          double precision not null,
  looking_for  text check (looking_for is null or length(looking_for) <= 200),
  vibe         text check (vibe is null or length(vibe) <= 24),
  radius_miles int  not null default 10 check (radius_miles between 1 and 50),
  is_active    boolean not null default true,
  updated_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '60 minutes')
);
alter table public.radar_presence enable row level security;
-- Owner-only: exact coordinates stay private; discovery is via radar_scan().
drop policy if exists radar_presence_owner on public.radar_presence;
create policy radar_presence_owner on public.radar_presence
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
create index if not exists radar_presence_live_idx on public.radar_presence (is_active, expires_at);
create index if not exists radar_presence_lat_idx  on public.radar_presence (lat);
create index if not exists radar_presence_lng_idx  on public.radar_presence (lng);

-- ============================================================================
-- 2) radar_pings — scan / wave / call notifications between users
-- ============================================================================
create table if not exists public.radar_pings (
  id           uuid primary key default gen_random_uuid(),
  from_profile uuid not null references public.profiles(id) on delete cascade,
  to_profile   uuid not null references public.profiles(id) on delete cascade,
  kind         text not null check (kind in ('scan','wave','call')),
  message      text check (message is null or length(message) <= 200),
  room_id      uuid references public.rooms(id) on delete set null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
alter table public.radar_pings enable row level security;
-- Either party can read; only the recipient can mark read. Inserts happen
-- exclusively through the SECURITY DEFINER RPCs below (no direct insert grant),
-- so pings can't be spoofed.
drop policy if exists radar_pings_party_select on public.radar_pings;
create policy radar_pings_party_select on public.radar_pings
  for select to authenticated
  using (to_profile = auth.uid() or from_profile = auth.uid());
drop policy if exists radar_pings_recipient_update on public.radar_pings;
create policy radar_pings_recipient_update on public.radar_pings
  for update to authenticated
  using (to_profile = auth.uid())
  with check (to_profile = auth.uid());
create index if not exists radar_pings_to_idx   on public.radar_pings (to_profile, created_at desc);
create index if not exists radar_pings_from_idx on public.radar_pings (from_profile, to_profile, kind, created_at desc);

-- ============================================================================
-- 3) Grants (explicit — required for new tables ahead of the 2026-10-30
--    public-schema grant flip).
-- ============================================================================
grant select, insert, update, delete on public.radar_presence to authenticated;
grant select, update on public.radar_pings to authenticated;

-- ============================================================================
-- 4) Realtime — recipients get live INSERT events for incoming pings
-- ============================================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.radar_pings;
  exception
    when duplicate_object then null;
    when others then null;
  end;
end $$;

-- ============================================================================
-- 5) RPCs
-- ============================================================================

-- radar_scan: go live (upsert own presence), notify nearby live users, and
-- return the nearby list with rounded distance. The one call the scanner makes.
create or replace function public.radar_scan(
  p_lat double precision,
  p_lng double precision,
  p_radius_miles int default 10,
  p_looking_for text default null,
  p_vibe text default null
) returns table(
  profile_id uuid, username text, display_name text, avatar_url text,
  presence_state text, last_seen timestamptz,
  looking_for text, vibe text, distance_miles double precision
)
language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := auth.uid();
  v_radius int  := greatest(1, least(coalesce(p_radius_miles, 10), 50));
  v_look   text := nullif(btrim(coalesce(p_looking_for, '')), '');
  v_vibe   text := nullif(btrim(coalesce(p_vibe, '')), '');
  v_dlat   double precision;
  v_dlng   double precision;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_lat is null or p_lng is null then raise exception 'location required'; end if;
  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'invalid coordinates';
  end if;

  -- 1) go live / refresh own presence
  insert into public.radar_presence(profile_id, lat, lng, looking_for, vibe,
                                     radius_miles, is_active, updated_at, expires_at)
  values (v_user, p_lat, p_lng, v_look, v_vibe, v_radius, true, now(),
          now() + interval '60 minutes')
  on conflict (profile_id) do update
    set lat = excluded.lat, lng = excluded.lng,
        looking_for = excluded.looking_for, vibe = excluded.vibe,
        radius_miles = excluded.radius_miles, is_active = true,
        updated_at = now(), expires_at = now() + interval '60 minutes';

  -- bounding box for an index-friendly pre-filter (1° lat ≈ 69 miles)
  v_dlat := v_radius / 69.0;
  v_dlng := v_radius / (69.0 * greatest(cos(radians(p_lat)), 0.01));

  -- 2) notify nearby live users (deduped: one scan-ping per pair per 30 min)
  insert into public.radar_pings(from_profile, to_profile, kind, message)
  select v_user, rp.profile_id, 'scan', v_look
  from public.radar_presence rp
  where rp.profile_id <> v_user
    and rp.is_active = true
    and rp.expires_at > now()
    and rp.lat between p_lat - v_dlat and p_lat + v_dlat
    and rp.lng between p_lng - v_dlng and p_lng + v_dlng
    and public._radar_miles(p_lat, p_lng, rp.lat, rp.lng) <= v_radius
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = v_user and b.blocked_id = rp.profile_id)
         or (b.blocker_id = rp.profile_id and b.blocked_id = v_user)
    )
    and not exists (
      select 1 from public.radar_pings pg
      where pg.from_profile = v_user and pg.to_profile = rp.profile_id
        and pg.kind = 'scan' and pg.created_at > now() - interval '30 minutes'
    )
  limit 100;

  -- 3) return the nearby list (rounded distance only — never raw coords)
  return query
  select rp.profile_id, pr.username, pr.display_name, pr.avatar_url,
         pr.presence_state, pr.last_seen, rp.looking_for, rp.vibe,
         round(public._radar_miles(p_lat, p_lng, rp.lat, rp.lng)::numeric, 1)::double precision
  from public.radar_presence rp
  join public.profiles pr on pr.id = rp.profile_id
  where rp.profile_id <> v_user
    and rp.is_active = true
    and rp.expires_at > now()
    and rp.lat between p_lat - v_dlat and p_lat + v_dlat
    and rp.lng between p_lng - v_dlng and p_lng + v_dlng
    and public._radar_miles(p_lat, p_lng, rp.lat, rp.lng) <= v_radius
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = v_user and b.blocked_id = rp.profile_id)
         or (b.blocker_id = rp.profile_id and b.blocked_id = v_user)
    )
  order by public._radar_miles(p_lat, p_lng, rp.lat, rp.lng) asc
  limit 100;
end; $$;

-- radar_go_offline: stop broadcasting immediately.
create or replace function public.radar_go_offline()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.radar_presence
     set is_active = false, updated_at = now()
   where profile_id = auth.uid();
end; $$;

-- radar_wave: a lightweight "👋 I see you" to one nearby person.
create or replace function public.radar_wave(p_to uuid, p_message text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_to is null or p_to = v_user then return; end if;
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = v_user and b.blocked_id = p_to)
       or (b.blocker_id = p_to and b.blocked_id = v_user)
  ) then raise exception 'cannot reach this person'; end if;
  insert into public.radar_pings(from_profile, to_profile, kind, message)
  values (v_user, p_to, 'wave', nullif(btrim(coalesce(p_message, '')), ''));
end; $$;

-- radar_request_call: open (or reuse) a 1:1 DM and ping the callee so they can
-- jump in for a voice/video call. Returns the DM room id for the caller.
create or replace function public.radar_request_call(p_to uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_room uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_to is null or p_to = v_user then raise exception 'invalid target'; end if;
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = v_user and b.blocked_id = p_to)
       or (b.blocker_id = p_to and b.blocked_id = v_user)
  ) then raise exception 'cannot reach this person'; end if;
  v_room := public.get_or_create_dm(p_to);
  insert into public.radar_pings(from_profile, to_profile, kind, room_id)
  values (v_user, p_to, 'call', v_room);
  return v_room;
end; $$;

-- radar_my_pings: recent incoming pings (last 2h) with sender info.
create or replace function public.radar_my_pings()
returns table(
  id uuid, from_profile uuid, username text, display_name text, avatar_url text,
  kind text, message text, room_id uuid, created_at timestamptz, read_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select pg.id, pg.from_profile, pr.username, pr.display_name, pr.avatar_url,
         pg.kind, pg.message, pg.room_id, pg.created_at, pg.read_at
  from public.radar_pings pg
  join public.profiles pr on pr.id = pg.from_profile
  where pg.to_profile = auth.uid()
    and pg.created_at > now() - interval '2 hours'
  order by pg.created_at desc
  limit 50;
$$;

-- radar_mark_pings_read: clear the unread badge.
create or replace function public.radar_mark_pings_read()
returns void language sql security definer set search_path = public as $$
  update public.radar_pings set read_at = now()
  where to_profile = auth.uid() and read_at is null;
$$;

-- ============================================================================
-- 6) Function grants
-- ============================================================================
revoke all on function public.radar_scan(double precision, double precision, int, text, text) from public;
revoke all on function public.radar_go_offline() from public;
revoke all on function public.radar_wave(uuid, text) from public;
revoke all on function public.radar_request_call(uuid) from public;
revoke all on function public.radar_my_pings() from public;
revoke all on function public.radar_mark_pings_read() from public;

grant execute on function public.radar_scan(double precision, double precision, int, text, text) to authenticated;
grant execute on function public.radar_go_offline() to authenticated;
grant execute on function public.radar_wave(uuid, text) to authenticated;
grant execute on function public.radar_request_call(uuid) to authenticated;
grant execute on function public.radar_my_pings() to authenticated;
grant execute on function public.radar_mark_pings_read() to authenticated;
