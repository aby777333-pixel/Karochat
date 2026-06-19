-- Karochat — v9 Phase 5.4: Karochat Map (privacy-first friend map).
-- Wires the dormant karochat_map_pins table (0042). Everyone is GHOST by
-- default; sharing is explicit, coordinates are fuzzed to a chosen precision,
-- and pins auto-expire. Reads go through a visibility-aware SECURITY DEFINER
-- RPC (the table only has an owner-write policy — no select policy for others).
-- Idempotent.

-- =====================================================================
-- 1) update_map_pin — share (or restate) my location. Coordinates are
--    snapped to a grid of ~precision_m so the stored point never reveals
--    more than the user chose, even on a DB leak.
-- =====================================================================
create or replace function public.update_map_pin(
  p_lat         double precision,
  p_lng         double precision,
  p_visibility  text default 'friends',
  p_precision_m int  default 1000,
  p_ttl_minutes int  default 480
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prec int;
  v_grid_lat double precision;
  v_grid_lng double precision;
  v_lat double precision;
  v_lng double precision;
  v_exp timestamptz;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_visibility not in ('ghost','close_friends','friends','public') then
    p_visibility := 'friends';
  end if;

  -- Ghost = stop sharing and wipe any stored coordinates.
  if p_visibility = 'ghost' or p_lat is null or p_lng is null then
    insert into public.karochat_map_pins(profile_id, latitude, longitude, visibility, expires_at, updated_at)
    values (auth.uid(), null, null, 'ghost', null, now())
    on conflict (profile_id) do update
      set latitude = null, longitude = null, visibility = 'ghost',
          expires_at = null, updated_at = now();
    return;
  end if;

  v_prec := greatest(100, least(coalesce(p_precision_m, 1000), 50000));

  -- Grid sizes in degrees. 1° lat ≈ 111_320 m; 1° lng ≈ that × cos(lat).
  v_grid_lat := v_prec::double precision / 111320.0;
  v_grid_lng := v_prec::double precision / (111320.0 * greatest(cos(radians(p_lat)), 0.01));
  v_lat := round((p_lat / v_grid_lat))::double precision * v_grid_lat;
  v_lng := round((p_lng / v_grid_lng))::double precision * v_grid_lng;

  v_exp := now() + make_interval(mins => greatest(5, least(coalesce(p_ttl_minutes, 480), 1440)));

  insert into public.karochat_map_pins(profile_id, latitude, longitude, precision_m, visibility, expires_at, updated_at)
  values (auth.uid(), v_lat, v_lng, v_prec, p_visibility, v_exp, now())
  on conflict (profile_id) do update
    set latitude = excluded.latitude,
        longitude = excluded.longitude,
        precision_m = excluded.precision_m,
        visibility = excluded.visibility,
        expires_at = excluded.expires_at,
        updated_at = now();
end;
$$;
grant execute on function public.update_map_pin(double precision, double precision, text, int, int) to authenticated;

-- =====================================================================
-- 2) go_ghost — instant off switch.
-- =====================================================================
create or replace function public.go_ghost()
returns void
language sql security definer set search_path = public as $$
  insert into public.karochat_map_pins(profile_id, latitude, longitude, visibility, expires_at, updated_at)
  values (auth.uid(), null, null, 'ghost', null, now())
  on conflict (profile_id) do update
    set latitude = null, longitude = null, visibility = 'ghost',
        expires_at = null, updated_at = now();
$$;
grant execute on function public.go_ghost() to authenticated;

-- =====================================================================
-- 3) list_map_pins — pins I'm allowed to see (+ my own), live only.
--    Hard-hides owners in invisible/stealth privacy modes as a safety net,
--    independent of their chosen map visibility.
-- =====================================================================
create or replace function public.list_map_pins()
returns table(
  profile_id   uuid,
  username     text,
  display_name text,
  avatar_url   text,
  latitude     double precision,
  longitude    double precision,
  precision_m  int,
  visibility   text,
  updated_at   timestamptz,
  is_me        boolean
)
language sql security definer stable set search_path = public as $$
  select
    mp.profile_id, pr.username, pr.display_name, pr.avatar_url,
    mp.latitude, mp.longitude, mp.precision_m, mp.visibility, mp.updated_at,
    (mp.profile_id = auth.uid()) as is_me
  from public.karochat_map_pins mp
  join public.profiles pr on pr.id = mp.profile_id
  where mp.latitude is not null
    and mp.longitude is not null
    and mp.visibility <> 'ghost'
    and (mp.expires_at is null or mp.expires_at > now())
    and (
      mp.profile_id = auth.uid()
      or (
        coalesce(pr.privacy_mode, 'open') not in ('invisible','stealth')
        and (
          mp.visibility = 'public'
          or (mp.visibility = 'friends'
              and public.are_friends(mp.profile_id, auth.uid()))
          or (mp.visibility = 'close_friends' and exists (
                select 1 from public.close_friends cf
                where cf.owner_profile_id = mp.profile_id
                  and cf.friend_profile_id = auth.uid()))
        )
      )
    );
$$;
grant execute on function public.list_map_pins() to authenticated;
