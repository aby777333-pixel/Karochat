-- Karochat — Wave 20.3: keep the system Lobby out of "User rooms".
--
-- The fixed-UUID global Lobby (00000000-0000-0000-0000-00000000aaaa) has
-- is_official=false and owner_id=null. The previous browse_user_rooms
-- RPC matched only on is_official/is_dm/is_saved/visibility, so the
-- Lobby showed up as the sole "User rooms" entry — confusing because
-- the Lobby is a Karochat-owned default, not a user-created room.
--
-- Fix: require owner_id IS NOT NULL. All user-created rooms are
-- inserted by create_room with owner_id = auth.uid(), so this filter
-- includes every real user room and excludes the system Lobby (the
-- only is_official=false row with owner_id=null).
--
-- Idempotent. Safe to re-run.

create or replace function public.browse_user_rooms(p_limit int default 100)
returns table (
  id           uuid,
  name         text,
  description  text,
  visibility   text,
  member_count int,
  created_at   timestamptz,
  is_member    boolean
)
language sql security definer set search_path = public stable
as $$
  select
    r.id,
    r.name,
    r.description,
    r.visibility,
    (select count(*)::int from public.room_members rm where rm.room_id = r.id)
                                                  as member_count,
    r.created_at,
    public.is_room_member(r.id, auth.uid())       as is_member
  from public.rooms r
  where r.is_official = false
    and r.owner_id    is not null   -- ← excludes the system Lobby
    and r.is_dm       = false
    and r.is_saved    = false
    and r.visibility in ('public','listed')
  order by
    (select count(*) from public.room_members rm where rm.room_id = r.id) desc,
    r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 300));
$$;

revoke all on function public.browse_user_rooms(int) from public;
grant execute on function public.browse_user_rooms(int) to authenticated;
