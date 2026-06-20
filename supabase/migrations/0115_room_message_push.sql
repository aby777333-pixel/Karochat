-- 0115_room_message_push.sql
-- =====================================================================
-- Notify EVERY member of a public / group room on EVERY message — online
-- (the GlobalNotifier realtime listener already receives the INSERT via
-- RLS) and offline (this Web Push fan-out). DMs, nudges, and @mentions are
-- unchanged; this only adds a new 'room' kind for ordinary messages, which
-- 0072 deliberately skipped.
--
-- Fan-out is capped (web push to the first N member subscriptions) purely
-- as infra protection for very large rooms — the cap only limits the
-- *offline* push; online members all get the realtime event regardless.
-- Blocks are respected. Moderation-mutes (room_members.muted_until) only
-- gate *posting*, not receiving, so they are intentionally not filtered
-- here. Everything stays fail-safe: any push hiccup is swallowed and the
-- message insert is never affected.
--
-- Additive: only public.message_push_notify() is replaced. The trigger,
-- the mute guard, and the role RPCs from 0072 are untouched.
-- =====================================================================

create or replace function public.message_push_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_url_cfg     text;
  v_secret      text;
  v_is_dm       boolean;
  v_is_saved    boolean;
  v_room_name   text;
  v_sender      text;
  v_kind        text;        -- 'dm' | 'nudge' | 'mention' | 'room'
  v_title       text;
  v_body        text;
  v_preview     text;
  v_recipient   uuid;
  v_subs        jsonb;
  v_members     int;
  v_limit       int;
begin
  -- Cheap early exits first — the vast majority of messages return here.
  if new.sender_id is null or new.type = 'system' then return new; end if;

  select r.is_dm, coalesce(r.is_saved, false), r.name
    into v_is_dm, v_is_saved, v_room_name
    from public.rooms r where r.id = new.room_id;
  if v_is_saved then return new; end if;

  if v_is_dm then
    v_kind := 'dm';
  elsif new.type = 'nudge' then
    v_kind := 'nudge';
  elsif new.mentions is not null and jsonb_typeof(new.mentions) = 'array'
        and jsonb_array_length(new.mentions) > 0 then
    v_kind := 'mention';
  else
    -- NEW: ordinary public / group room message → notify all members.
    v_kind := 'room';
  end if;

  select radar_push_url, radar_push_secret into v_url_cfg, v_secret
    from public.app_secrets where id = 1;
  if v_url_cfg is null or v_secret is null then return new; end if;

  select coalesce(p.display_name, p.username, 'Someone') into v_sender
    from public.profiles p where p.id = new.sender_id;

  v_preview := case
    when new.type = 'voice' then '🎙 Voice message'
    when new.type = 'file' and coalesce(new.content, '') = '' then '📎 Sent a file'
    when new.image_url is not null and coalesce(new.content, '') = '' then '📷 Sent a photo'
    else left(coalesce(new.content, ''), 120)
  end;

  -- Nudge storms: only fan out room-wide nudges in small rooms.
  if v_kind = 'nudge' and not v_is_dm then
    select count(*) into v_members
      from public.room_members where room_id = new.room_id;
    if v_members > 25 then return new; end if;
  end if;

  -- Offline-push fan-out cap. Generous for ordinary rooms; protects the
  -- push backend from unbounded blasts in very large public rooms.
  v_limit := case when v_kind = 'room' then 200 else 50 end;

  for v_recipient in
    select distinct u.uid from (
      -- DM / nudge: every other member (1 person for a DM; group-safe).
      select rm.user_id as uid
        from public.room_members rm
       where v_kind in ('dm', 'nudge')
         and rm.room_id = new.room_id
         and rm.user_id <> new.sender_id
      union
      -- Mentions: @username'd room members.
      select p.id as uid
        from public.profiles p
        join public.room_members rm
          on rm.room_id = new.room_id and rm.user_id = p.id
       where v_kind = 'mention'
         and p.username in (
           select jsonb_array_elements_text(new.mentions))
         and p.id <> new.sender_id
      union
      -- NEW: ordinary room message → every other member.
      select rm.user_id as uid
        from public.room_members rm
       where v_kind = 'room'
         and rm.room_id = new.room_id
         and rm.user_id <> new.sender_id
    ) u
    -- Respect blocks: never push to someone who blocked the sender.
    where not exists (
      select 1 from public.user_blocks b
       where b.blocker_id = u.uid and b.blocked_id = new.sender_id)
    limit v_limit
  loop
    select jsonb_agg(jsonb_build_object(
             'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      into v_subs
      from public.web_push_subscriptions s
     where s.profile_id = v_recipient;
    if v_subs is null then continue; end if;

    if v_kind = 'nudge' then
      v_title := '⚡ ' || v_sender || ' sent a nudge';
      v_body  := case when v_is_dm then 'Nudge!' else 'In ' || coalesce(v_room_name, 'a room') end;
    elsif v_kind = 'mention' then
      v_title := '💬 ' || v_sender || ' mentioned you';
      v_body  := 'In ' || coalesce(v_room_name, 'a room') ||
                 case when v_preview <> '' then ': ' || v_preview else '' end;
    elsif v_kind = 'room' then
      v_title := '💬 ' || v_sender || ' · ' || coalesce(v_room_name, 'Room');
      v_body  := case when v_preview <> '' then v_preview else 'New message' end;
    else
      v_title := '💬 ' || v_sender;
      v_body  := v_preview;
    end if;

    begin
      perform net.http_post(
        url := v_url_cfg,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'secret', v_secret,
          'subscriptions', v_subs,
          'notification', jsonb_build_object(
            'title', v_title,
            'body', v_body,
            'url', '/rooms/' || new.room_id::text,
            'tag', 'msg-' || new.room_id::text
          )
        )
      );
    exception when others then
      -- never let a push hiccup break the message insert
      null;
    end;
  end loop;

  return new;
end; $$;
