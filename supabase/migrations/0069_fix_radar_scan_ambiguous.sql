-- Karochat — fix: radar_scan() "column reference profile_id is ambiguous".
--
-- radar_scan RETURNS TABLE(profile_id uuid, ...) creates OUT-parameter names
-- that collide with the same-named columns inside the body (notably the
-- `on conflict (profile_id)` target). plpgsql's default variable_conflict =
-- error then aborts at runtime. The canonical fix is to tell plpgsql to
-- resolve such names to the COLUMN, via `#variable_conflict use_column`.
-- All our locals are v_*/p_* prefixed, so this is safe.
--
-- Pure function-body replacement; signature + behaviour unchanged.

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
#variable_conflict use_column
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

  insert into public.radar_presence(profile_id, lat, lng, looking_for, vibe,
                                     radius_miles, is_active, updated_at, expires_at)
  values (v_user, p_lat, p_lng, v_look, v_vibe, v_radius, true, now(),
          now() + interval '60 minutes')
  on conflict (profile_id) do update
    set lat = excluded.lat, lng = excluded.lng,
        looking_for = excluded.looking_for, vibe = excluded.vibe,
        radius_miles = excluded.radius_miles, is_active = true,
        updated_at = now(), expires_at = now() + interval '60 minutes';

  v_dlat := v_radius / 69.0;
  v_dlng := v_radius / (69.0 * greatest(cos(radians(p_lat)), 0.01));

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

revoke all on function public.radar_scan(double precision, double precision, int, text, text) from public;
grant execute on function public.radar_scan(double precision, double precision, int, text, text) to authenticated;
