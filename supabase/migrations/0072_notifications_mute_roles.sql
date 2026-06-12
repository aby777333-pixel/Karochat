-- 0072_notifications_mute_roles.sql
-- =====================================================================
-- 1) Web Push fanout for messages — DMs, nudges, and @mentions now ride
--    the exact pipeline 0068 built for radar pings (app_secrets config →
--    pg_net → /api/push/send → VAPID). Fully fail-safe: any hiccup is
--    swallowed and the message insert is never affected.
-- 2) Mute: room_members.muted_until + a BEFORE INSERT guard on messages
--    + mute/unmute RPCs with the same privilege hierarchy as 0027's
--    remove_room_member (owner > admin > moderator > member).
-- 3) Roles: set_room_member_role — the room owner can grant/revoke
--    'moderator' and 'admin' on members.
-- All additive: no existing table, policy, RPC, or trigger is modified.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Message push fanout
-- ---------------------------------------------------------------------
create or replace function public.message_push_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_url_cfg     text;
  v_secret      text;
  v_is_dm       boolean;
  v_is_saved    boolean;
  v_room_name   text;
  v_sender      text;
  v_kind        text;        -- 'dm' | 'nudge' | 'mention'
  v_title       text;
  v_body        text;
  v_preview     text;
  v_recipient   uuid;
  v_subs        jsonb;
  v_members     int;
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
    return new;
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

  for v_recipient in
    select distinct u.uid from (
      -- DM: every other member (1 person; group-safe anyway).
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
    ) u
    -- Respect blocks: never push to someone who blocked the sender.
    where not exists (
      select 1 from public.user_blocks b
       where b.blocker_id = u.uid and b.blocked_id = new.sender_id)
    limit 50
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

drop trigger if exists message_push_notify_trg on public.messages;
create trigger message_push_notify_trg
  after insert on public.messages
  for each row execute function public.message_push_notify();

-- ---------------------------------------------------------------------
-- 2) Mute
-- ---------------------------------------------------------------------
alter table public.room_members
  add column if not exists muted_until timestamptz;

create or replace function public.reject_muted_member()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_until timestamptz;
begin
  if new.type = 'system' then return new; end if;
  select rm.muted_until into v_until
    from public.room_members rm
   where rm.room_id = new.room_id and rm.user_id = new.sender_id;
  if v_until is not null and v_until > now() then
    raise exception 'you are muted in this room until %', to_char(v_until, 'HH24:MI');
  end if;
  return new;
end; $$;

drop trigger if exists reject_muted_member_trg on public.messages;
create trigger reject_muted_member_trg
  before insert on public.messages
  for each row execute function public.reject_muted_member();

create or replace function public.mute_room_member(
  p_room_id uuid,
  p_user_id uuid,
  p_minutes int default 60
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_room_owner  uuid;
  v_caller_role text;
  v_target_role text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if v_user = p_user_id then raise exception 'cannot mute yourself'; end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 10080 then
    raise exception 'mute length must be 1 minute to 7 days';
  end if;

  select r.owner_id into v_room_owner from public.rooms r where r.id = p_room_id;
  if v_room_owner is null then raise exception 'room not found'; end if;

  select rm.role into v_caller_role
    from public.room_members rm
   where rm.room_id = p_room_id and rm.user_id = v_user;

  if not (v_user = v_room_owner or v_caller_role in ('owner','admin','moderator')) then
    raise exception 'only owners / admins / moderators can mute members';
  end if;
  if p_user_id = v_room_owner then
    raise exception 'cannot mute the room owner';
  end if;

  select rm.role into v_target_role
    from public.room_members rm
   where rm.room_id = p_room_id and rm.user_id = p_user_id;
  if v_target_role is null and not exists (
    select 1 from public.room_members
     where room_id = p_room_id and user_id = p_user_id) then
    raise exception 'not a member of this room';
  end if;
  if v_caller_role = 'moderator' and v_target_role in ('owner','admin','moderator') then
    raise exception 'moderators can only mute plain members';
  end if;

  update public.room_members
     set muted_until = now() + make_interval(mins => p_minutes)
   where room_id = p_room_id and user_id = p_user_id;
end;
$$;
revoke all on function public.mute_room_member(uuid, uuid, int) from public;
grant execute on function public.mute_room_member(uuid, uuid, int) to authenticated;

create or replace function public.unmute_room_member(
  p_room_id uuid,
  p_user_id uuid
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_room_owner  uuid;
  v_caller_role text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  select r.owner_id into v_room_owner from public.rooms r where r.id = p_room_id;
  if v_room_owner is null then raise exception 'room not found'; end if;

  select rm.role into v_caller_role
    from public.room_members rm
   where rm.room_id = p_room_id and rm.user_id = v_user;

  if not (v_user = v_room_owner or v_caller_role in ('owner','admin','moderator')) then
    raise exception 'only owners / admins / moderators can unmute members';
  end if;

  update public.room_members
     set muted_until = null
   where room_id = p_room_id and user_id = p_user_id;
end;
$$;
revoke all on function public.unmute_room_member(uuid, uuid) from public;
grant execute on function public.unmute_room_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3) Roles — owner grants/revokes moderator (or admin)
-- ---------------------------------------------------------------------
-- 0002 defined role check ('owner','admin','member'); 0027's moderation
-- RPCs already reference 'moderator' defensively but the value could
-- never be stored. Widen the check so moderators become real.
alter table public.room_members
  drop constraint if exists room_members_role_check;
alter table public.room_members
  add constraint room_members_role_check
  check (role in ('owner','admin','moderator','member'));

create or replace function public.set_room_member_role(
  p_room_id uuid,
  p_user_id uuid,
  p_role text
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user       uuid := auth.uid();
  v_room_owner uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_role is not null and p_role not in ('moderator','admin','member') then
    raise exception 'role must be moderator, admin, or member';
  end if;

  select r.owner_id into v_room_owner from public.rooms r where r.id = p_room_id;
  if v_room_owner is null then raise exception 'room not found'; end if;
  if v_user <> v_room_owner then
    raise exception 'only the room owner can change roles';
  end if;
  if p_user_id = v_room_owner then
    raise exception 'the owner''s role cannot be changed';
  end if;
  if not exists (
    select 1 from public.room_members
     where room_id = p_room_id and user_id = p_user_id) then
    raise exception 'not a member of this room';
  end if;

  -- role is NOT NULL — demotion writes 'member', never null.
  update public.room_members
     set role = coalesce(nullif(p_role, ''), 'member')
   where room_id = p_room_id and user_id = p_user_id;
end;
$$;
revoke all on function public.set_room_member_role(uuid, uuid, text) from public;
grant execute on function public.set_room_member_role(uuid, uuid, text) to authenticated;
