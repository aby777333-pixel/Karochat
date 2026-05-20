-- Karochat — v12 Wave 10: owner-only "delete this room" action.
-- Cascades clean up everything (room_members + messages both ON DELETE
-- CASCADE the room reference). Refuses to delete the Lobby, official seed
-- rooms, and saved rooms by owner-of-other (those are personal — only the
-- one user can delete theirs, which they can via the same RPC since they're
-- the owner). Run AFTER 0017_catalog_global_expansion.sql. Idempotent.

create or replace function public.delete_room(p_room_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_owner       uuid;
  v_is_official boolean;
  v_lobby_id    constant uuid := '00000000-0000-0000-0000-00000000aaaa';
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_room_id = v_lobby_id then
    raise exception 'the Lobby cannot be deleted';
  end if;

  select owner_id, is_official
    into v_owner, v_is_official
    from public.rooms
   where id = p_room_id;
  if v_owner is null and v_is_official is null then
    raise exception 'room not found';
  end if;

  if v_is_official then
    raise exception 'official rooms cannot be deleted by users';
  end if;
  if v_owner is null then
    raise exception 'this room has no owner — contact support';
  end if;
  if v_owner <> v_user then
    raise exception 'only the room owner can delete this room';
  end if;

  delete from public.rooms where id = p_room_id;
end;
$$;

revoke all on function public.delete_room(uuid) from public;
grant execute on function public.delete_room(uuid) to authenticated;
