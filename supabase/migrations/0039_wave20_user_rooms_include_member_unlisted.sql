-- Karochat — Wave 20.10: include the caller's unlisted rooms in
-- "User rooms" browse.
--
-- Before: browse_user_rooms required visibility in ('public','listed'),
-- so an owner who created a "Private (invite link only)" room (visibility
-- = 'unlisted') saw 0 results in the User rooms tab — even though it's
-- their own room. The lobby "Hidden from the lobby" promise for unlisted
-- still holds for everyone else.
--
-- After: a row is returned when visibility is public/listed (for all
-- callers), OR when visibility is 'unlisted' AND the caller is already a
-- member. Secret rooms remain excluded.
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
    and r.owner_id    is not null
    and r.is_dm       = false
    and r.is_saved    = false
    and (
      r.visibility in ('public','listed')
      or (r.visibility = 'unlisted'
          and public.is_room_member(r.id, auth.uid()))
    )
  order by
    (select count(*) from public.room_members rm where rm.room_id = r.id) desc,
    r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 300));
$$;

revoke all on function public.browse_user_rooms(int) from public;
grant execute on function public.browse_user_rooms(int) to authenticated;
