-- Karochat — v9 Phase 5.2: Snaps (disappearing photo/video DMs).
-- Wires the dormant public.snaps table (0042) with friend-gated send, a
-- view-once + single-replay viewer contract, best-effort screenshot alerts,
-- and inbox/sent listing. Delivery rides the existing radar_pings → web-push
-- path (0067/0074) via a new 'snap' kind. Idempotent.

-- =====================================================================
-- 1) radar_pings learns the 'snap' kind, and the push trigger learns to
--    phrase snap + screenshot alerts. (message='screenshot' = screenshot
--    alert back to the sender; otherwise it's a new-snap alert.)
-- =====================================================================
alter table public.radar_pings drop constraint if exists radar_pings_kind_check;
alter table public.radar_pings
  add constraint radar_pings_kind_check
  check (kind in ('scan','wave','call','snap'));

create or replace function public.radar_ping_notify()
returns trigger
language plpgsql security definer set search_path = public as $function$
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
  elsif new.kind = 'snap' then
    if new.message = 'screenshot' then
      v_title := '📸 ' || v_name || ' took a screenshot';
      v_body  := 'Of a snap you sent.';
    else
      v_title := '📸 ' || v_name || ' sent you a snap';
      v_body  := 'Tap to open before it disappears.';
    end if;
    v_url   := '/snaps';
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
end; $function$;

-- =====================================================================
-- 2) send_snap — friend-gated; inserts the snap and a 'snap' ping.
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

  return v_id;
end;
$$;
grant execute on function public.send_snap(uuid, text, text, text, int) to authenticated;

-- =====================================================================
-- 3) view_snap — the view-once contract. First open sets viewed_at; a second
--    open (one replay) sets replayed_at; after that it's gone. Returns the
--    media only while the snap is still openable.
-- =====================================================================
create or replace function public.view_snap(p_snap_id uuid)
returns table(
  media_url   text,
  media_kind  text,
  caption     text,
  duration_ms int,
  was_replay  boolean
)
language plpgsql security definer set search_path = public as $$
declare v public.snaps%rowtype;
begin
  select * into v from public.snaps where id = p_snap_id;
  if v.id is null or v.recipient_profile_id <> auth.uid() then
    raise exception 'Snap not found.';
  end if;
  if v.expires_at < now() then
    raise exception 'This snap has expired.';
  end if;

  if v.viewed_at is null then
    update public.snaps set viewed_at = now() where id = p_snap_id;
    return query select v.media_url, v.media_kind, v.caption, v.duration_ms, false;
  elsif v.replayed_at is null then
    update public.snaps set replayed_at = now() where id = p_snap_id;
    return query select v.media_url, v.media_kind, v.caption, v.duration_ms, true;
  else
    raise exception 'This snap has already been viewed.';
  end if;
end;
$$;
grant execute on function public.view_snap(uuid) to authenticated;

-- =====================================================================
-- 4) mark_snap_screenshotted — recipient flags a screenshot; sender is
--    pinged once.
-- =====================================================================
create or replace function public.mark_snap_screenshotted(p_snap_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_sender uuid;
begin
  select sender_profile_id into v_sender from public.snaps
   where id = p_snap_id and recipient_profile_id = auth.uid();
  if v_sender is null then return; end if;

  update public.snaps set screenshotted_at = now()
   where id = p_snap_id and screenshotted_at is null;
  if found then
    insert into public.radar_pings(from_profile, to_profile, kind, message)
    values (auth.uid(), v_sender, 'snap', 'screenshot');
  end if;
end;
$$;
grant execute on function public.mark_snap_screenshotted(uuid) to authenticated;

-- =====================================================================
-- 5) list_inbox_snaps — received, still-openable (not yet replayed-out, not
--    expired). Deliberately does NOT return media_url or caption — those come
--    only from view_snap, so a consumed snap can't be re-fetched.
-- =====================================================================
create or replace function public.list_inbox_snaps()
returns table(
  snap_id             uuid,
  sender_id           uuid,
  sender_username     text,
  sender_display_name text,
  sender_avatar_url   text,
  media_kind          text,
  has_caption         boolean,
  created_at          timestamptz,
  viewed_at           timestamptz
)
language sql security definer stable set search_path = public as $$
  select s.id, s.sender_profile_id, p.username, p.display_name, p.avatar_url,
         s.media_kind, (s.caption is not null), s.created_at, s.viewed_at
  from public.snaps s
  join public.profiles p on p.id = s.sender_profile_id
  where s.recipient_profile_id = auth.uid()
    and s.replayed_at is null
    and s.expires_at > now()
  order by s.created_at desc;
$$;
grant execute on function public.list_inbox_snaps() to authenticated;

-- =====================================================================
-- 6) list_sent_snaps — sender's recent snaps with delivery status.
-- =====================================================================
create or replace function public.list_sent_snaps()
returns table(
  snap_id                uuid,
  recipient_id           uuid,
  recipient_username     text,
  recipient_display_name text,
  recipient_avatar_url   text,
  media_kind             text,
  created_at             timestamptz,
  viewed_at              timestamptz,
  replayed_at            timestamptz,
  screenshotted_at       timestamptz,
  expires_at             timestamptz
)
language sql security definer stable set search_path = public as $$
  select s.id, s.recipient_profile_id, p.username, p.display_name, p.avatar_url,
         s.media_kind, s.created_at, s.viewed_at, s.replayed_at,
         s.screenshotted_at, s.expires_at
  from public.snaps s
  join public.profiles p on p.id = s.recipient_profile_id
  where s.sender_profile_id = auth.uid()
    and s.recipient_profile_id is not null
  order by s.created_at desc
  limit 100;
$$;
grant execute on function public.list_sent_snaps() to authenticated;
