-- Karochat — v9 Phase 5.3: Streaks (Snapchat-style snap streaks 🔥).
-- Streaks are driven by snaps (5.2): a streak advances one "day" when BOTH
-- friends have snapped each other within the keep-alive window. Includes a
-- one-time Streak Mercy revive. Builds on the dormant 0042 streaks table.
-- Idempotent.

-- =====================================================================
-- 1) Per-direction timestamps + the day-advance marker.
--    (current_streak / longest_streak / mercy_used_at / last_message_at
--     already exist from 0042.)
-- =====================================================================
alter table public.streaks add column if not exists a_last_at       timestamptz;
alter table public.streaks add column if not exists b_last_at       timestamptz;
alter table public.streaks add column if not exists last_extended_at timestamptz;

-- Tunables (kept inline for clarity):
--   keep-alive window   = 24h  (both must snap within this of "now")
--   advance gate        = 20h  (count rises at most ~once/day)
--   deadline            = last_extended_at + 48h (miss it → streak dies)
--   mercy grace         = +24h after the deadline

-- =====================================================================
-- 2) touch_streak — called by the sender each time a snap goes out.
-- =====================================================================
create or replace function public.touch_streak(p_other uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me  uuid := auth.uid();
  v_a   uuid;
  v_b   uuid;
  v_me_is_a boolean;
  r     public.streaks%rowtype;
  n     timestamptz := now();
  v_a_last timestamptz;
  v_b_last timestamptz;
  mutual boolean;
begin
  if v_me is null or p_other is null or p_other = v_me then return; end if;
  v_a := least(v_me, p_other);
  v_b := greatest(v_me, p_other);
  v_me_is_a := (v_me = v_a);

  insert into public.streaks(profile_a_id, profile_b_id)
  values (v_a, v_b)
  on conflict (profile_a_id, profile_b_id) do nothing;

  select * into r from public.streaks
   where profile_a_id = v_a and profile_b_id = v_b
   for update;

  v_a_last := case when v_me_is_a then n else r.a_last_at end;
  v_b_last := case when v_me_is_a then r.b_last_at else n end;

  mutual := v_a_last is not null and v_b_last is not null
        and v_a_last >= n - interval '24 hours'
        and v_b_last >= n - interval '24 hours';

  if mutual then
    if r.last_extended_at is null then
      r.current_streak := 1;
      r.last_extended_at := n;
    elsif n > r.last_extended_at + interval '48 hours' then
      r.current_streak := 1;            -- streak had lapsed → restart
      r.last_extended_at := n;
    elsif n >= r.last_extended_at + interval '20 hours' then
      r.current_streak := r.current_streak + 1;  -- a new mutual day
      r.last_extended_at := n;
    end if;
    r.longest_streak := greatest(coalesce(r.longest_streak, 0), r.current_streak);
  end if;

  update public.streaks set
    a_last_at        = v_a_last,
    b_last_at        = v_b_last,
    current_streak   = r.current_streak,
    longest_streak   = r.longest_streak,
    last_extended_at = r.last_extended_at,
    last_message_at  = n
  where profile_a_id = v_a and profile_b_id = v_b;
end;
$$;
grant execute on function public.touch_streak(uuid) to authenticated;

-- =====================================================================
-- 3) send_snap now feeds the streak engine (otherwise unchanged from 0103).
-- =====================================================================
create or replace function public.send_snap(
  p_recipient   uuid,
  p_media_url   text,
  p_media_kind  text default 'photo',
  p_caption     text default null,
  p_duration_ms int  default 10000
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_recipient = auth.uid() then raise exception 'You cannot snap yourself.'; end if;
  if not public.are_friends(auth.uid(), p_recipient) then
    raise exception 'You can only send snaps to your friends.';
  end if;
  if coalesce(p_media_url,'') = '' then raise exception 'Missing media.'; end if;
  if p_media_kind not in ('photo','video') then p_media_kind := 'photo'; end if;

  insert into public.snaps(
    sender_profile_id, recipient_profile_id, media_url, media_kind, caption, duration_ms
  ) values (
    auth.uid(), p_recipient, p_media_url, p_media_kind,
    nullif(btrim(coalesce(p_caption,'')), ''),
    greatest(1000, least(coalesce(p_duration_ms, 10000), 30000))
  )
  returning id into v_id;

  insert into public.radar_pings(from_profile, to_profile, kind, message)
  values (auth.uid(), p_recipient, 'snap', null);

  perform public.touch_streak(p_recipient);

  return v_id;
end;
$$;
grant execute on function public.send_snap(uuid, text, text, text, int) to authenticated;

-- =====================================================================
-- 4) list_my_streaks — active streaks with the other person + live status.
--    Hidden once fully lapsed beyond the mercy grace (deadline + 24h).
-- =====================================================================
create or replace function public.list_my_streaks()
returns table(
  other_id       uuid,
  username       text,
  display_name   text,
  avatar_url     text,
  current_streak int,
  longest_streak int,
  is_alive       boolean,
  hours_left     int,
  can_mercy      boolean
)
language sql security definer stable set search_path = public as $$
  select
    pr.id, pr.username, pr.display_name, pr.avatar_url,
    s.current_streak, s.longest_streak,
    (now() <= s.last_extended_at + interval '48 hours')                      as is_alive,
    greatest(0, floor(extract(epoch from
        (s.last_extended_at + interval '48 hours' - now())) / 3600))::int    as hours_left,
    (s.mercy_used_at is null
       and now() >  s.last_extended_at + interval '48 hours'
       and now() <= s.last_extended_at + interval '72 hours')                as can_mercy
  from public.streaks s
  join public.profiles pr
    on pr.id = case when s.profile_a_id = auth.uid()
                    then s.profile_b_id else s.profile_a_id end
  where (s.profile_a_id = auth.uid() or s.profile_b_id = auth.uid())
    and s.current_streak > 0
    and s.last_extended_at is not null
    and now() <= s.last_extended_at + interval '72 hours'
  order by s.current_streak desc, s.last_extended_at desc;
$$;
grant execute on function public.list_my_streaks() to authenticated;

-- =====================================================================
-- 5) use_streak_mercy — one-time revive of a just-lapsed streak (within the
--    24h grace after the deadline). Keeps the count; resets the clock.
-- =====================================================================
create or replace function public.use_streak_mercy(p_other uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_a uuid := least(auth.uid(), p_other);
  v_b uuid := greatest(auth.uid(), p_other);
  r   public.streaks%rowtype;
  n   timestamptz := now();
begin
  if auth.uid() is null or p_other = auth.uid() then return false; end if;
  select * into r from public.streaks
   where profile_a_id = v_a and profile_b_id = v_b for update;
  if r.profile_a_id is null then return false; end if;
  if r.mercy_used_at is not null then return false; end if;
  if r.last_extended_at is null
     or n <= r.last_extended_at + interval '48 hours'      -- not lapsed yet
     or n >  r.last_extended_at + interval '72 hours' then -- past the grace
    return false;
  end if;
  update public.streaks
     set last_extended_at = n, mercy_used_at = n, last_message_at = n
   where profile_a_id = v_a and profile_b_id = v_b;
  return true;
end;
$$;
grant execute on function public.use_streak_mercy(uuid) to authenticated;
