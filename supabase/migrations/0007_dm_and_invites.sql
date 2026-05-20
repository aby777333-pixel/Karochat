-- Karochat — v6: 1:1 Direct Messages (as secret rooms) + invite helpers
-- Adds is_dm/dm_key columns + RPCs for DM creation, code regeneration,
-- and owner-driven invites from the member list.
-- Run AFTER 0006_room_visibility.sql. Idempotent.

alter table public.rooms
  add column if not exists is_dm  boolean not null default false,
  add column if not exists dm_key text;

create unique index if not exists rooms_dm_key_idx
  on public.rooms (dm_key)
  where dm_key is not null;

-- ============================================================================
-- Re-create rooms_browse so DMs never leak into the lobby.
-- ============================================================================
drop view if exists public.rooms_browse;
create view public.rooms_browse as
select
  r.id,
  r.name,
  r.description,
  r.visibility,
  r.is_public,
  r.category,
  r.tags,
  r.allow_anonymous,
  r.owner_id,
  r.created_at,
  (select count(*) from public.room_members rm where rm.room_id = r.id) as member_count
from public.rooms r
where r.visibility in ('public','listed')
  and r.is_dm = false;

grant select on public.rooms_browse to authenticated;

-- ============================================================================
-- get_or_create_dm: deterministic 1:1 DM room between auth.uid() and target
-- ============================================================================
create or replace function public.get_or_create_dm(p_target_user_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_other  uuid := p_target_user_id;
  v_key    text;
  v_id     uuid;
  v_target_exists boolean;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if v_other is null then raise exception 'target user required'; end if;
  if v_user = v_other then raise exception 'cannot DM yourself'; end if;

  select exists(select 1 from public.profiles where id = v_other) into v_target_exists;
  if not v_target_exists then raise exception 'user not found'; end if;

  if v_user::text < v_other::text then
    v_key := v_user::text || ':' || v_other::text;
  else
    v_key := v_other::text || ':' || v_user::text;
  end if;

  select id into v_id from public.rooms where dm_key = v_key;
  if v_id is not null then
    insert into public.room_members (room_id, user_id, role)
      values (v_id, v_user, 'member') on conflict do nothing;
    insert into public.room_members (room_id, user_id, role)
      values (v_id, v_other, 'member') on conflict do nothing;
    return v_id;
  end if;

  v_id := gen_random_uuid();
  insert into public.rooms (id, name, description, visibility, owner_id, is_dm, dm_key)
       values (v_id, 'Direct Message', null, 'secret', v_user, true, v_key);

  insert into public.room_members (room_id, user_id, role)
    values (v_id, v_user,  'owner');
  insert into public.room_members (room_id, user_id, role)
    values (v_id, v_other, 'member');

  return v_id;
end;
$$;

revoke all on function public.get_or_create_dm(uuid) from public;
grant execute on function public.get_or_create_dm(uuid) to authenticated;

-- ============================================================================
-- regenerate_invite_code: owner-only; works regardless of current visibility
-- so a public room owner can mint a code to share if they want.
-- ============================================================================
create or replace function public.regenerate_invite_code(p_room_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_owner uuid;
  v_is_dm boolean;
  v_code  text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select owner_id, is_dm into v_owner, v_is_dm from public.rooms where id = p_room_id;
  if v_owner is null then raise exception 'room not found'; end if;
  if v_is_dm then raise exception 'DMs do not have invite codes'; end if;
  if v_owner <> v_user then raise exception 'only the owner can regenerate the invite code'; end if;

  loop
    v_code := upper(
      regexp_replace(encode(gen_random_bytes(8), 'base64'), '[^A-Za-z0-9]', '', 'g')
    );
    v_code := substr(v_code, 1, 8);
    exit when length(v_code) = 8
      and not exists (select 1 from public.rooms where invite_code = v_code);
  end loop;

  update public.rooms set invite_code = v_code where id = p_room_id;
  return v_code;
end;
$$;

revoke all on function public.regenerate_invite_code(uuid) from public;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;

-- ============================================================================
-- my_invitable_rooms_for: rooms I own where target user isn't already a member
-- (used by the member popover's "Invite to another room" submenu)
-- ============================================================================
create or replace function public.my_invitable_rooms_for(p_target_user_id uuid)
returns table (id uuid, name text, visibility text)
language sql security definer set search_path = public
as $$
  select r.id, r.name, r.visibility
    from public.rooms r
   where r.owner_id = auth.uid()
     and r.is_dm = false
     and not exists (
       select 1 from public.room_members rm
        where rm.room_id = r.id
          and rm.user_id = p_target_user_id
     )
   order by r.created_at desc;
$$;

revoke all on function public.my_invitable_rooms_for(uuid) from public;
grant execute on function public.my_invitable_rooms_for(uuid) to authenticated;

-- ============================================================================
-- invite_user_to_room: owner-only direct add (skips invite-code dance)
-- ============================================================================
create or replace function public.invite_user_to_room(p_room_id uuid, p_target_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_owner uuid;
  v_is_dm boolean;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_target_user_id is null then raise exception 'target user required'; end if;
  select owner_id, is_dm into v_owner, v_is_dm from public.rooms where id = p_room_id;
  if v_owner is null then raise exception 'room not found'; end if;
  if v_is_dm then raise exception 'cannot add members to a DM'; end if;
  if v_owner <> v_user then raise exception 'only the owner can invite'; end if;

  insert into public.room_members (room_id, user_id, role)
    values (p_room_id, p_target_user_id, 'member')
    on conflict do nothing;
end;
$$;

revoke all on function public.invite_user_to_room(uuid, uuid) from public;
grant execute on function public.invite_user_to_room(uuid, uuid) to authenticated;
