-- Karochat — Wave 19.14: fix invite-code minting, add member-invite
-- and DM-promote flows.
--
-- Bug: every room-creating / visibility-changing RPC called
-- gen_random_bytes(), which lives in extensions.pgcrypto. The
-- functions ship with set search_path = public, so the call resolved
-- as public.gen_random_bytes — which doesn't exist — and Postgres
-- threw "function gen_random_bytes(integer) does not exist", killing
-- any "Private" room create.
--
-- Fix: use gen_random_uuid() (always in public) and slice it to an
-- 8-char code. Same minting helper centralised in
-- public._mint_invite_code(). Updated functions:
--   • create_room
--   • regenerate_invite_code
--   • set_room_visibility
--
-- Wave 19.14 also adds:
--   • add_member_to_room(p_room_id, p_user_id) — any current member of
--     a non-DM, non-vault, non-saved room can add another user
--     directly. Bans + the existing reject trigger still apply.
--   • promote_dm_to_group(p_room_id) — converts a 1:1 DM into a
--     normal multi-member room (clears dm_key + is_dm, sets visibility
--     to 'unlisted', mints an invite code). Either DM party can do
--     this; subsequent invites use add_member_to_room or the code.
--
-- Idempotent and additive.

-- ============================================================================
-- Helper: mint a random 8-char invite code using gen_random_uuid().
-- ============================================================================
create or replace function public._mint_invite_code()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_code text;
  v_attempts int := 0;
begin
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when length(v_code) = 8
      and not exists (select 1 from public.rooms where invite_code = v_code);
    v_attempts := v_attempts + 1;
    if v_attempts > 10 then
      -- give up generating a unique slice; fall back to a longer one
      v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
      exit;
    end if;
  end loop;
  return v_code;
end;
$$;
revoke all on function public._mint_invite_code() from public;

-- ============================================================================
-- create_room — use _mint_invite_code instead of gen_random_bytes.
-- ============================================================================
create or replace function public.create_room(
  p_name        text,
  p_description text default null,
  p_visibility  text default 'public',
  p_category    text default null,
  p_tags        text[] default '{}'::text[]
) returns table (id uuid, invite_code text, visibility text)
language plpgsql security definer set search_path = public
as $$
declare
  v_id   uuid := gen_random_uuid();
  v_code text;
  v_user uuid := auth.uid();
  v_vis  text := coalesce(nullif(trim(p_visibility), ''), 'public');
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if length(coalesce(trim(p_name), '')) = 0 then raise exception 'name required'; end if;
  if v_vis not in ('public','listed','unlisted','secret') then
    raise exception 'invalid visibility';
  end if;

  if v_vis in ('unlisted','secret') then
    v_code := public._mint_invite_code();
  end if;

  insert into public.rooms (id, name, description, visibility, invite_code,
                            owner_id, category, tags)
       values (v_id, trim(p_name),
               nullif(trim(coalesce(p_description, '')), ''),
               v_vis, v_code, v_user,
               nullif(trim(coalesce(p_category, '')), ''),
               coalesce(p_tags, '{}'::text[]));

  insert into public.room_members (room_id, user_id, role)
    values (v_id, v_user, 'owner');

  return query select v_id, v_code, v_vis;
end;
$$;
revoke all on function public.create_room(text, text, text, text, text[]) from public;
grant execute on function public.create_room(text, text, text, text, text[]) to authenticated;

-- ============================================================================
-- regenerate_invite_code — same fix.
-- ============================================================================
create or replace function public.regenerate_invite_code(
  p_room_id uuid
) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_code text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select owner_id into v_owner from public.rooms where id = p_room_id;
  if v_owner is null then raise exception 'room not found'; end if;
  if v_owner <> v_user then raise exception 'only the owner can regenerate the invite code'; end if;
  v_code := public._mint_invite_code();
  update public.rooms set invite_code = v_code where id = p_room_id;
  return v_code;
end;
$$;
revoke all on function public.regenerate_invite_code(uuid) from public;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;

-- ============================================================================
-- set_room_visibility — same fix.
-- ============================================================================
create or replace function public.set_room_visibility(
  p_room_id    uuid,
  p_visibility text
) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_owner    uuid;
  v_is_dm    boolean;
  v_is_saved boolean;
  v_code     text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_visibility not in ('public','listed','unlisted','secret') then
    raise exception 'invalid visibility';
  end if;
  select owner_id, is_dm, is_saved, invite_code
    into v_owner, v_is_dm, v_is_saved, v_code
    from public.rooms where id = p_room_id;
  if v_owner is null then raise exception 'room not found'; end if;
  if v_is_dm or v_is_saved then
    raise exception 'cannot change visibility of DM or Saved rooms';
  end if;
  if v_owner <> v_user then
    raise exception 'only the owner can change visibility';
  end if;

  if p_visibility in ('unlisted','secret') and v_code is null then
    v_code := public._mint_invite_code();
    update public.rooms
       set visibility = p_visibility, invite_code = v_code
     where id = p_room_id;
  else
    update public.rooms set visibility = p_visibility where id = p_room_id;
  end if;
  return p_visibility;
end;
$$;
revoke all on function public.set_room_visibility(uuid, text) from public;
grant execute on function public.set_room_visibility(uuid, text) to authenticated;

-- ============================================================================
-- add_member_to_room — let any current member of a non-DM, non-vault,
-- non-saved room add another user directly. The reject-banned trigger
-- from 0027 still fires, so banned users are still kept out.
-- ============================================================================
create or replace function public.add_member_to_room(
  p_room_id uuid,
  p_user_id uuid
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_is_dm  boolean;
  v_is_vault boolean;
  v_is_saved boolean;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_user_id is null then raise exception 'target user required'; end if;
  if v_user = p_user_id then return; end if;

  select is_dm, is_vault, is_saved
    into v_is_dm, v_is_vault, v_is_saved
    from public.rooms where id = p_room_id;
  if v_is_dm is null and v_is_vault is null and v_is_saved is null then
    raise exception 'room not found';
  end if;
  if v_is_dm then
    raise exception 'this is a 1:1 DM — use promote_dm_to_group first';
  end if;
  if v_is_vault then
    raise exception 'vault rooms are 1:1 only';
  end if;
  if v_is_saved then
    raise exception 'saved rooms are personal';
  end if;

  -- Caller must already be a member.
  if not exists (
    select 1 from public.room_members
     where room_id = p_room_id and user_id = v_user
  ) then
    raise exception 'only members can add others';
  end if;

  insert into public.room_members (room_id, user_id, role)
    values (p_room_id, p_user_id, 'member')
  on conflict do nothing;
end;
$$;
revoke all on function public.add_member_to_room(uuid, uuid) from public;
grant execute on function public.add_member_to_room(uuid, uuid) to authenticated;

-- ============================================================================
-- promote_dm_to_group — convert a 1:1 DM into a group room. Either
-- party can do this; the new room becomes 'unlisted' with an invite
-- code so people can be brought in. Vault DMs are NOT promotable.
-- ============================================================================
create or replace function public.promote_dm_to_group(
  p_room_id uuid,
  p_new_name text default null
) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_is_dm    boolean;
  v_is_vault boolean;
  v_code     text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select is_dm, is_vault
    into v_is_dm, v_is_vault
    from public.rooms where id = p_room_id;
  if v_is_dm is null then raise exception 'room not found'; end if;
  if v_is_vault then raise exception 'vault DMs cannot be promoted'; end if;
  if not v_is_dm then raise exception 'this room is already a group'; end if;

  -- Caller must be a member of the DM.
  if not exists (
    select 1 from public.room_members
     where room_id = p_room_id and user_id = v_user
  ) then
    raise exception 'only DM participants can promote';
  end if;

  v_code := public._mint_invite_code();

  update public.rooms
     set is_dm        = false,
         dm_key       = null,
         visibility   = 'unlisted',
         invite_code  = v_code,
         name         = coalesce(nullif(trim(p_new_name), ''), name),
         owner_id     = coalesce(owner_id, v_user)
   where id = p_room_id;

  return v_code;
end;
$$;
revoke all on function public.promote_dm_to_group(uuid, text) from public;
grant execute on function public.promote_dm_to_group(uuid, text) to authenticated;
