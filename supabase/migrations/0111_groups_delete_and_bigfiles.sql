-- Karochat — Groups delete affordance + larger chat file uploads.
-- (1) browse_user_rooms gains is_owner so the lobby/browser can show an
--     owner-only delete button (delete_room RPC already enforces owner-only).
-- (2) chat-files bucket limit raised 50MB → 500MB so big files/videos upload
--     (they already render as drive-like download cards via FileCard).
-- Additive + backward-compatible. Idempotent.

-- Return shape changes (adds is_owner) → must drop the old signature first.
drop function if exists public.browse_user_rooms(integer);
create or replace function public.browse_user_rooms(p_limit integer default 100)
returns table(
  id           uuid,
  name         text,
  description  text,
  visibility   text,
  member_count integer,
  created_at   timestamptz,
  is_member    boolean,
  is_owner     boolean
)
language sql stable security definer set search_path = public
as $function$
  select
    r.id,
    r.name,
    r.description,
    r.visibility,
    (select count(*)::int from public.room_members rm where rm.room_id = r.id) as member_count,
    r.created_at,
    public.is_room_member(r.id, auth.uid())  as is_member,
    (r.owner_id = auth.uid())                as is_owner
  from public.rooms r
  where r.is_official = false
    and r.owner_id    is not null
    and r.is_dm       = false
    and r.is_saved    = false
    and (
      r.visibility in ('public','listed')
      or (r.visibility = 'unlisted' and public.is_room_member(r.id, auth.uid()))
    )
  order by
    (select count(*) from public.room_members rm where rm.room_id = r.id) desc,
    r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 300));
$function$;
revoke all on function public.browse_user_rooms(integer) from public;
grant execute on function public.browse_user_rooms(integer) to authenticated;

update storage.buckets set file_size_limit = 524288000 where id = 'chat-files';
