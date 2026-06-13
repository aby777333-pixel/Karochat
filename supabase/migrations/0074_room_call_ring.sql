-- Karochat — ring room/DM members when a call starts.
--
-- Problem: regular room & DM calls (CallButton / CallWidget → CallPanel) joined
-- LiveKit silently — the other person was never signalled, so calls "didn't
-- ping" whether the app was open or closed.
--
-- Fix: reuse the proven radar_pings → web-push pipeline (0067 + 0068). When a
-- caller starts a call, ring_room() inserts a `call` ping for every OTHER
-- member of the room. The existing AFTER-INSERT trigger fans those out as
-- background Web Push (closed app), and the in-app realtime listener rings +
-- vibrates + toasts (open app). Tapping either deep-links the callee straight
-- into the call via /rooms/<id>?call=<mode>, which auto-answers.
--
-- Purely additive + idempotent. The radar (Meet-now) call path keeps working
-- unchanged. Nothing existing is removed or renamed.

-- ============================================================================
-- 1) ring_room(room_id, mode) — fan a call ping out to the other members.
--    Capped at small rooms / DMs so busy public rooms are never spammed.
-- ============================================================================
create or replace function public.ring_room(p_room_id uuid, p_mode text default 'audio')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_mode    text := case when p_mode = 'video' then 'video' else 'audio' end;
  v_members integer;
  v_count   integer := 0;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  -- Caller must belong to the room.
  if not exists (
    select 1 from public.room_members
     where room_id = p_room_id and user_id = v_user
  ) then
    raise exception 'not a room member';
  end if;

  -- Ring DMs and small group rooms only; never blast large/public rooms.
  select count(*) into v_members
    from public.room_members where room_id = p_room_id;
  if v_members > 30 then
    return 0;
  end if;

  -- One call ping per other member. The radar_ping_notify trigger (0068)
  -- turns each into a background Web Push automatically.
  insert into public.radar_pings (from_profile, to_profile, kind, room_id, message)
  select v_user, rm.user_id, 'call', p_room_id, v_mode
    from public.room_members rm
   where rm.room_id = p_room_id
     and rm.user_id <> v_user;
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

revoke all on function public.ring_room(uuid, text) from public;
grant execute on function public.ring_room(uuid, text) to authenticated;

-- ============================================================================
-- 2) radar_ping_notify() — deep-link call pushes straight into the call.
--    Same function as 0068; only the `call` branch's URL/body changes so the
--    notification opens /rooms/<id>?call=<mode> (auto-answer). Wave/scan and
--    all other behaviour are byte-for-byte unchanged + fully fail-safe.
-- ============================================================================
create or replace function public.radar_ping_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_url_cfg text;
  v_secret  text;
  v_subs    jsonb;
  v_name    text;
  v_title   text;
  v_body    text;
  v_url     text;
begin
  select radar_push_url, radar_push_secret into v_url_cfg, v_secret
    from public.app_secrets where id = 1;
  if v_url_cfg is null or v_secret is null then
    return new;
  end if;

  select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
    into v_subs
    from public.web_push_subscriptions s
   where s.profile_id = new.to_profile;
  if v_subs is null then
    return new;
  end if;

  select coalesce(p.display_name, p.username, 'Someone') into v_name
    from public.profiles p where p.id = new.from_profile;

  if new.kind = 'wave' then
    v_title := '👋 ' || v_name || ' waved at you';
    v_body  := coalesce(new.message, 'Someone nearby waved. Open Meet now.');
    v_url   := '/meet/now';
  elsif new.kind = 'call' then
    v_title := '📞 ' || v_name || ' is calling';
    v_body  := 'Tap to answer.';
    v_url   := '/rooms/' || coalesce(new.room_id::text, '')
               || case when new.message in ('audio','video')
                       then '?call=' || new.message
                       else '?call=audio' end;
  else
    v_title := '📡 Someone nearby is looking';
    v_body  := coalesce(new.message, 'Open Meet now to see who is around.');
    v_url   := '/meet/now';
  end if;

  begin
    perform net.http_post(
      url := v_url_cfg,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'secret', v_secret,
        'subscriptions', v_subs,
        'notification', jsonb_build_object(
          'title', v_title, 'body', v_body, 'url', v_url, 'tag', 'radar-' || new.kind
        )
      )
    );
  exception when others then
    null;
  end;

  return new;
end; $$;
