-- Karochat — v10 Wave 5 fix-pass: room search RPC.
-- Run AFTER 0011_mood_vibes_stories.sql. Idempotent.

-- search_rooms: name + description match across non-DM, non-saved rooms the
-- caller can see (public, listed, or rooms they're a member of). Returns
-- member_count + an is_member hint so the UI can pick the right CTA.
create or replace function public.search_rooms(p_query text)
returns table (
  id           uuid,
  name         text,
  description  text,
  visibility   text,
  member_count int,
  is_member    boolean
)
language sql security definer set search_path = public
as $$
  with q as (select trim(coalesce(p_query, '')) as q)
  select
    r.id,
    r.name,
    r.description,
    r.visibility,
    (select count(*) from public.room_members rm where rm.room_id = r.id)::int
                                              as member_count,
    public.is_room_member(r.id, auth.uid())   as is_member
  from public.rooms r, q
  where length(q.q) >= 1
    and r.is_dm    = false
    and r.is_saved = false
    and (
      r.visibility in ('public','listed')
      or public.is_room_member(r.id, auth.uid())
    )
    and (
      r.name ilike '%' || q.q || '%'
      or coalesce(r.description, '') ilike '%' || q.q || '%'
    )
  order by
    (case when r.name ilike (select q from q) || '%' then 0 else 1 end),
    (select count(*) from public.room_members rm where rm.room_id = r.id) desc,
    r.name
  limit 20;
$$;

revoke all on function public.search_rooms(text) from public;
grant execute on function public.search_rooms(text) to authenticated;
