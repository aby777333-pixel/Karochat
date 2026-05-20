-- Karochat — v12 Wave 16: meet-now matchmaking, vault DMs, breakouts +
-- recording-consent + live captions toggle, admin gate, mood-driven
-- discovery. Run AFTER 0020_bio_translate_reports.sql. Idempotent.

-- ============================================================================
-- meet_queue — anyone can declare "I'm looking for a 5-min stranger chat."
-- Two waiting users get paired, both get redirected into a freshly created DM.
-- ============================================================================
create table if not exists public.meet_queue (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  matched_with uuid references public.profiles(id) on delete set null,
  matched_room uuid references public.rooms(id) on delete set null
);

create index if not exists meet_queue_waiting_idx
  on public.meet_queue (joined_at)
  where matched_room is null;

alter table public.meet_queue enable row level security;

drop policy if exists "meet_queue_read_self" on public.meet_queue;
create policy "meet_queue_read_self" on public.meet_queue
  for select to authenticated using (user_id = auth.uid());

-- enter_meet_queue: register the caller; if another waiter exists, pair them.
-- Returns the matched room id (or null while still waiting).
create or replace function public.enter_meet_queue()
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_other  uuid;
  v_room   uuid;
  v_dm_key text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  -- Drop stale entries (older than 60s with no match).
  delete from public.meet_queue
   where matched_room is null and joined_at < (now() - interval '60 seconds');

  -- Already in queue? Return existing match (if any) or null.
  select matched_room into v_room from public.meet_queue where user_id = v_user;
  if found then
    return v_room;
  end if;

  -- Try to claim an earlier waiter (skip locked rows so two simultaneous
  -- callers can't both grab the same partner).
  select user_id into v_other
    from public.meet_queue
   where matched_room is null and user_id <> v_user
   order by joined_at asc
   limit 1
   for update skip locked;

  if v_other is null then
    -- No one to pair with — wait in queue.
    insert into public.meet_queue (user_id) values (v_user)
       on conflict (user_id) do update set joined_at = now(),
                                            matched_with = null,
                                            matched_room = null;
    return null;
  end if;

  -- Found a partner. Create (or fetch) the deterministic DM room.
  v_dm_key := case when v_user < v_other
                then v_user::text || ':' || v_other::text
                else v_other::text || ':' || v_user::text
              end;

  select id into v_room from public.rooms
   where is_dm = true and dm_key = v_dm_key
   limit 1;

  if v_room is null then
    v_room := gen_random_uuid();
    insert into public.rooms (id, name, description, visibility,
                              is_dm, is_saved, dm_key, owner_id, expires_at)
         values (v_room, 'Meet · 5 min', null, 'secret',
                 true, false, v_dm_key, null,
                 now() + interval '5 minutes');
    insert into public.room_members (room_id, user_id, role)
      values (v_room, v_user, 'member'),
             (v_room, v_other, 'member')
    on conflict do nothing;
  end if;

  -- Mark both queue rows as matched.
  update public.meet_queue set matched_with = v_other, matched_room = v_room
   where user_id = v_user;
  update public.meet_queue set matched_with = v_user,  matched_room = v_room
   where user_id = v_other;

  -- Also store self if not yet — but only after attempting match.
  if not exists (select 1 from public.meet_queue where user_id = v_user) then
    insert into public.meet_queue (user_id, matched_with, matched_room)
                 values (v_user, v_other, v_room);
  end if;

  return v_room;
end;
$$;

revoke all on function public.enter_meet_queue() from public;
grant execute on function public.enter_meet_queue() to authenticated;

create or replace function public.leave_meet_queue()
returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return; end if;
  delete from public.meet_queue where user_id = v_user;
end;
$$;

revoke all on function public.leave_meet_queue() from public;
grant execute on function public.leave_meet_queue() to authenticated;

-- ============================================================================
-- rooms columns for: vault DMs, breakouts, recording consent
-- ============================================================================
alter table public.rooms
  add column if not exists is_vault           boolean not null default false,
  add column if not exists parent_room_id     uuid references public.rooms(id) on delete set null,
  add column if not exists expires_at         timestamptz,
  add column if not exists recording_started_at timestamptz,
  add column if not exists recording_started_by uuid references public.profiles(id) on delete set null;

create index if not exists rooms_parent_idx on public.rooms (parent_room_id);

-- Per-user opt-in to recording. A recording can only proceed when every
-- present member has consented. We just store the consent, the client
-- enforces "everyone has consented" before flipping recording_started_at.
create table if not exists public.recording_consents (
  room_id     uuid not null references public.rooms(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  consented   boolean not null default false,
  decided_at  timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.recording_consents enable row level security;

drop policy if exists "rc_read_members" on public.recording_consents;
create policy "rc_read_members" on public.recording_consents
  for select to authenticated using (
    exists (select 1 from public.room_members rm
             where rm.room_id = recording_consents.room_id and rm.user_id = auth.uid())
  );

drop policy if exists "rc_write_self" on public.recording_consents;
create policy "rc_write_self" on public.recording_consents
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "rc_update_self" on public.recording_consents;
create policy "rc_update_self" on public.recording_consents
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.set_recording_consent(
  p_room_id uuid, p_consented boolean
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.room_members rm
                  where rm.room_id = p_room_id and rm.user_id = v_user) then
    raise exception 'not a member of this room';
  end if;
  insert into public.recording_consents (room_id, user_id, consented)
       values (p_room_id, v_user, coalesce(p_consented, false))
  on conflict (room_id, user_id)
    do update set consented = excluded.consented, decided_at = now();
end;
$$;

revoke all on function public.set_recording_consent(uuid, boolean) from public;
grant execute on function public.set_recording_consent(uuid, boolean) to authenticated;

-- Start recording: only succeeds if every present member has opted in.
create or replace function public.start_recording(p_room_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_member_ct   int;
  v_consent_ct  int;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.rooms r where r.id = p_room_id
                   and (r.owner_id = v_user or v_user in
                        (select user_id from public.room_members
                          where room_id = p_room_id and role in ('owner','admin')))) then
    raise exception 'only owners and mods can start recording';
  end if;
  select count(*) into v_member_ct from public.room_members where room_id = p_room_id;
  select count(*) into v_consent_ct from public.recording_consents
   where room_id = p_room_id and consented = true;
  if v_consent_ct < v_member_ct then
    raise exception 'every member must consent first (% of %)', v_consent_ct, v_member_ct;
  end if;
  update public.rooms
     set recording_started_at = now(), recording_started_by = v_user
   where id = p_room_id;
end;
$$;

revoke all on function public.start_recording(uuid) from public;
grant execute on function public.start_recording(uuid) to authenticated;

create or replace function public.stop_recording(p_room_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  update public.rooms set recording_started_at = null, recording_started_by = null
   where id = p_room_id
     and (owner_id = v_user or v_user in
          (select user_id from public.room_members
            where room_id = p_room_id and role in ('owner','admin')));
end;
$$;

revoke all on function public.stop_recording(uuid) from public;
grant execute on function public.stop_recording(uuid) to authenticated;

-- create_breakout: owner/mod spawns a child room linked to a parent.
create or replace function public.create_breakout(
  p_parent_room_id uuid, p_name text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id   uuid;
  v_clean text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.rooms r where r.id = p_parent_room_id
                   and (r.owner_id = v_user or v_user in
                        (select user_id from public.room_members
                          where room_id = p_parent_room_id and role in ('owner','admin')))) then
    raise exception 'only owners and mods can create breakouts';
  end if;
  v_clean := nullif(trim(coalesce(p_name, '')), '');
  if v_clean is null then raise exception 'breakout needs a name'; end if;

  v_id := gen_random_uuid();
  insert into public.rooms (id, name, description, visibility, owner_id,
                            is_dm, is_saved, parent_room_id)
       values (v_id, v_clean, null, 'unlisted', v_user,
               false, false, p_parent_room_id);
  insert into public.room_members (room_id, user_id, role)
       values (v_id, v_user, 'owner');
  return v_id;
end;
$$;

revoke all on function public.create_breakout(uuid, text) from public;
grant execute on function public.create_breakout(uuid, text) to authenticated;

-- ============================================================================
-- create_vault_dm — like get_or_create_dm but with is_vault = true so the
-- client side knows to E2EE the content.
-- ============================================================================
create or replace function public.create_vault_dm(p_other uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_room   uuid;
  v_dm_key text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_other is null or p_other = v_user then
    raise exception 'invalid partner';
  end if;

  v_dm_key := case when v_user < p_other
                then v_user::text || ':' || p_other::text || ':vault'
                else p_other::text || ':' || v_user::text || ':vault'
              end;

  select id into v_room from public.rooms
   where is_dm = true and dm_key = v_dm_key
   limit 1;

  if v_room is null then
    v_room := gen_random_uuid();
    insert into public.rooms (id, name, description, visibility,
                              is_dm, is_saved, is_vault, dm_key, owner_id)
         values (v_room, 'Vault · E2EE', null, 'secret',
                 true, false, true, v_dm_key, null);
    insert into public.room_members (room_id, user_id, role)
      values (v_room, v_user, 'member'),
             (v_room, p_other, 'member')
    on conflict do nothing;
  end if;

  return v_room;
end;
$$;

revoke all on function public.create_vault_dm(uuid) from public;
grant execute on function public.create_vault_dm(uuid) to authenticated;

-- ============================================================================
-- profiles.is_admin — admin gate for the report queue. Admins are flipped
-- manually by service-role for now.
-- ============================================================================
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- admin_list_reports: full visibility for admins, ordered by priority.
create or replace function public.admin_list_reports(p_limit int default 100)
returns table (
  id            uuid,
  reporter_id   uuid,
  reporter_handle text,
  target_kind   text,
  target_id     text,
  category      text,
  body          text,
  status        text,
  reviewer_id   uuid,
  priority      int,
  created_at    timestamptz
)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.is_admin = true) then
    raise exception 'admin only';
  end if;
  return query
    select r.id, r.reporter_id,
           (select pr.username from public.profiles pr where pr.id = r.reporter_id),
           r.target_kind, r.target_id, r.category, r.body, r.status,
           r.reviewer_id, r.priority, r.created_at
      from public.reports r
     where r.status in ('new','triaged')
     order by r.priority desc, r.created_at asc
     limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function public.admin_list_reports(int) from public;
grant execute on function public.admin_list_reports(int) to authenticated;

create or replace function public.admin_update_report(
  p_id uuid, p_status text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.is_admin = true) then
    raise exception 'admin only';
  end if;
  if p_status not in ('new','triaged','actioned','dismissed') then
    raise exception 'invalid status %', p_status;
  end if;
  update public.reports
     set status = p_status,
         reviewer_id = auth.uid(),
         updated_at = now()
   where id = p_id;
end;
$$;

revoke all on function public.admin_update_report(uuid, text) from public;
grant execute on function public.admin_update_report(uuid, text) to authenticated;

-- ============================================================================
-- find_mood_rooms — rooms with at least one currently-active member whose
-- mood overlaps with the viewer's. Falls back to the broader official rooms
-- when the viewer has no mood set.
-- ============================================================================
create or replace function public.find_mood_rooms(p_limit int default 30)
returns table (
  room_id        uuid,
  room_name      text,
  category_slug  text,
  member_count   int,
  shared_mood    text,
  example_user   text
)
language plpgsql security definer set search_path = public stable
as $$
declare
  v_user uuid := auth.uid();
  v_my_mood text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  select case when mood_expires_at is null or mood_expires_at > now()
              then mood else null end
    into v_my_mood
    from public.profiles where id = v_user;

  if v_my_mood is null then
    return; -- no mood, no recommendations
  end if;

  return query
    with mood_mates as (
      select rm.room_id, p.username, p.mood
        from public.room_members rm
        join public.profiles p on p.id = rm.user_id
       where p.mood = v_my_mood
         and (p.mood_expires_at is null or p.mood_expires_at > now())
         and rm.user_id <> v_user
    )
    select r.id,
           r.name,
           r.category_slug,
           (select count(*)::int from public.room_members rm where rm.room_id = r.id),
           v_my_mood::text,
           (select mm.username from mood_mates mm where mm.room_id = r.id limit 1)
      from public.rooms r
     where r.id in (select distinct room_id from mood_mates)
       and r.is_dm = false and r.is_saved = false
       and r.visibility in ('public','listed')
     order by (select count(*) from mood_mates mm where mm.room_id = r.id) desc
     limit greatest(1, least(coalesce(p_limit, 30), 100));
end;
$$;

revoke all on function public.find_mood_rooms(int) from public;
grant execute on function public.find_mood_rooms(int) to authenticated;

-- ============================================================================
-- handshake_codes — short-lived 6-char codes that two devices exchange
-- (via Bluetooth or by reading off-screen). Whoever claims the same code
-- creates an instant DM with the issuer.
-- ============================================================================
create table if not exists public.handshake_codes (
  code        text primary key,
  issuer_id   uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '120 seconds'),
  claimed_by  uuid references public.profiles(id) on delete set null,
  claimed_room uuid references public.rooms(id) on delete set null
);

create index if not exists handshake_active_idx
  on public.handshake_codes (issuer_id, expires_at desc);

alter table public.handshake_codes enable row level security;

drop policy if exists "hs_read_party" on public.handshake_codes;
create policy "hs_read_party" on public.handshake_codes
  for select to authenticated using (
    issuer_id = auth.uid() or claimed_by = auth.uid()
  );

create or replace function public.create_handshake_code()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_try  int  := 0;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  -- 6-char alphanumeric, uppercase-friendly. Retry on rare collisions.
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.handshake_codes (code, issuer_id) values (v_code, v_user);
      return v_code;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 5 then raise exception 'could not allocate code'; end if;
    end;
  end loop;
end;
$$;

revoke all on function public.create_handshake_code() from public;
grant execute on function public.create_handshake_code() to authenticated;

-- claim_handshake_code: caller claims someone else's code; we create a DM
-- between them and return the room id. Issuer polls and sees claimed_room
-- fill in.
create or replace function public.claim_handshake_code(p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_issuer  uuid;
  v_room    uuid;
  v_dm_key  text;
  v_clean   text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  v_clean := upper(trim(coalesce(p_code,'')));
  if length(v_clean) <> 6 then raise exception 'invalid code'; end if;

  select issuer_id, claimed_room into v_issuer, v_room
    from public.handshake_codes
   where code = v_clean and expires_at > now()
   for update;
  if not found then raise exception 'code expired or unknown'; end if;
  if v_issuer = v_user then raise exception 'cannot claim your own code'; end if;
  if v_room is not null then return v_room; end if;

  -- Standard non-vault DM between the two.
  v_dm_key := case when v_user < v_issuer
                then v_user::text || ':' || v_issuer::text
                else v_issuer::text || ':' || v_user::text
              end;

  select id into v_room from public.rooms
   where is_dm = true and dm_key = v_dm_key limit 1;

  if v_room is null then
    v_room := gen_random_uuid();
    insert into public.rooms (id, name, description, visibility,
                              is_dm, is_saved, dm_key)
         values (v_room, 'Handshake', null, 'secret', true, false, v_dm_key);
    insert into public.room_members (room_id, user_id, role)
      values (v_room, v_user, 'member'),
             (v_room, v_issuer, 'member')
    on conflict do nothing;
  end if;

  update public.handshake_codes
     set claimed_by = v_user, claimed_room = v_room
   where code = v_clean;

  return v_room;
end;
$$;

revoke all on function public.claim_handshake_code(text) from public;
grant execute on function public.claim_handshake_code(text) to authenticated;

-- ============================================================================
-- vault_keys — pub-key directory for is_vault DMs. Each user uploads their
-- ECDH P-256 JWK; the private key never leaves the device. The receiver
-- derives the shared AES-GCM key locally.
-- ============================================================================
create table if not exists public.vault_keys (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  public_jwk   jsonb not null,
  updated_at   timestamptz not null default now()
);

alter table public.vault_keys enable row level security;

drop policy if exists "vault_keys_read_authenticated" on public.vault_keys;
create policy "vault_keys_read_authenticated" on public.vault_keys
  for select to authenticated using (true);

drop policy if exists "vault_keys_write_self" on public.vault_keys;
create policy "vault_keys_write_self" on public.vault_keys
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "vault_keys_update_self" on public.vault_keys;
create policy "vault_keys_update_self" on public.vault_keys
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- image_scans — audit log for /api/scan/image. Every chat image upload
-- writes a row. RLS lets admins + self read. Positive matches auto-file a
-- minor-category report.
-- ============================================================================
create table if not exists public.image_scans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete set null,
  public_url   text not null,
  bucket       text,
  path         text,
  provider     text not null,
  provider_detail text,
  blocked      boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists image_scans_blocked_idx
  on public.image_scans (blocked, created_at desc);

alter table public.image_scans enable row level security;

drop policy if exists "image_scans_read_self_or_admin" on public.image_scans;
create policy "image_scans_read_self_or_admin" on public.image_scans
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- ============================================================================
-- Realtime publication: handshake polling + meet-queue polling are
-- short-lived (< 2 min) so we deliberately use plain query polling rather
-- than realtime to avoid publication overhead.
-- ============================================================================
