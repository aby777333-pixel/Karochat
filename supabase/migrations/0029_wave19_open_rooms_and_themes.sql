-- Karochat — Wave 19.5: Karochat is free. Stop gating user rooms by
-- default + add owner-chosen room themes.
--
-- Idempotent and additive.

-- ============================================================================
-- 1) Convert every user-created 'listed' room to 'public' so the default
--    behaviour matches the spirit of the app: anyone joins anyone's room
--    unless the owner explicitly chooses a private mode.
--    (DMs / saved / vault rooms are intentionally separate and untouched.)
-- ============================================================================
update public.rooms
   set visibility = 'public'
 where is_official = false
   and visibility  = 'listed'
   and (is_dm    is not true)
   and (is_saved is not true)
   and (is_vault is not true);

-- ============================================================================
-- 2) Relax join_public_room to accept any room whose visibility is "open"
--    in this app's sense — public or listed. Unlisted and secret still
--    require an invite code (those are the explicit private modes).
-- ============================================================================
create or replace function public.join_public_room(p_room_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_vis  text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select visibility into v_vis from public.rooms where id = p_room_id;
  if v_vis is null then raise exception 'room not found'; end if;
  -- Banned users are rejected by the room_members_reject_banned trigger
  -- added in 0027 — owners can still block someone explicitly.
  if v_vis not in ('public','listed') then
    raise exception 'this room is private — use an invite code';
  end if;
  insert into public.room_members (room_id, user_id, role)
    values (p_room_id, v_user, 'member')
    on conflict do nothing;
  return p_room_id;
end;
$$;
revoke all on function public.join_public_room(uuid) from public;
grant execute on function public.join_public_room(uuid) to authenticated;

-- ============================================================================
-- 3) rooms.theme — owner picks a vibe. Free-form so the client can ship
--    new themes without DB migrations; the picker UI enumerates the valid
--    options and a missing/unknown value just falls back to the default.
-- ============================================================================
alter table public.rooms
  add column if not exists theme text;

-- ============================================================================
-- 4) set_room_theme — owner-only setter.
-- ============================================================================
create or replace function public.set_room_theme(
  p_room_id uuid,
  p_theme   text
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_owner uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select owner_id into v_owner from public.rooms where id = p_room_id;
  if v_owner is null then raise exception 'room not found'; end if;
  if v_owner <> v_user then raise exception 'only the room owner can change the theme'; end if;
  update public.rooms set theme = nullif(p_theme, '') where id = p_room_id;
end;
$$;
revoke all on function public.set_room_theme(uuid, text) from public;
grant execute on function public.set_room_theme(uuid, text) to authenticated;
