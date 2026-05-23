-- Karochat — Wave 20: Students area gets its own common + per-age-group
-- lobbies, plus a 'student-rooms' subcategory for user-created student
-- rooms.
--
-- The Students area also moves out of the verification-gated wall — the
-- common lobbies, the age-group lobbies, and the user-created student
-- rooms are open to ANY signed-in user (age 13+, the platform minimum).
-- Verification is still required for high-trust features (Help Beacons,
-- helper routing, office hours).
--
-- This migration:
--   1. Ensures the 'students-lobbies' subcategory exists (label "Common
--      lobbies", high priority).
--   2. Ensures the 'student-rooms' subcategory exists (label "Student
--      rooms", catches user-created rooms inside Students).
--   3. Seeds six official lobby rooms (1 common + 5 age bands), tagged
--      with a stable `topic` value so the UI can identify them
--      regardless of name changes.
--   4. Adds `list_student_lobbies()` RPC the Students page uses to
--      render the lobby cards in a stable order.
--
-- Additive + idempotent. Safe to re-run.

-- ============================================================================
-- 1) Subcategory rows.
-- ============================================================================
insert into public.room_subcategories (category_slug, slug, label, position) values
  ('students', 'students-lobbies', 'Common lobbies', 1),
  ('students', 'student-rooms',    'Student rooms (user-created)', 2)
on conflict (category_slug, slug) do update
  set label    = excluded.label,
      position = excluded.position;

-- ============================================================================
-- 2) Seed the lobby rooms. The `topic` field carries a stable identifier
--    (e.g. 'lobby:common', 'lobby:age:13-15') so the UI can pick them up
--    without depending on the display name.
-- ============================================================================
do $$
declare
  v_id uuid;
begin
  -- Common lobby — everyone, all ages, no verification required.
  v_id := public.ensure_official_room(
    'students', 'students-lobbies',
    'Students Common Lobby',
    'lobby:common',
    'public', true, true, false, null, 500);

  -- Age-group lobbies.
  v_id := public.ensure_official_room(
    'students', 'students-lobbies',
    'Students · Ages 13–15',
    'lobby:age:13-15',
    'public', true, true, false, null, 200);

  v_id := public.ensure_official_room(
    'students', 'students-lobbies',
    'Students · Ages 16–17',
    'lobby:age:16-17',
    'public', true, true, false, null, 200);

  v_id := public.ensure_official_room(
    'students', 'students-lobbies',
    'Students · Ages 18–22',
    'lobby:age:18-22',
    'public', true, true, false, null, 300);

  v_id := public.ensure_official_room(
    'students', 'students-lobbies',
    'Students · Ages 23–29',
    'lobby:age:23-29',
    'public', true, true, false, null, 300);

  v_id := public.ensure_official_room(
    'students', 'students-lobbies',
    'Students · Ages 30+',
    'lobby:age:30plus',
    'public', true, true, false, null, 200);
end$$;

-- ============================================================================
-- 3) list_student_lobbies — returns the six lobby rooms in display order
--    with a live member_count. Open to anon (so the Students landing page
--    can render even when the user isn't signed in yet — useful later if
--    we surface a public preview).
-- ============================================================================
create or replace function public.list_student_lobbies()
returns table (
  id            uuid,
  name          text,
  topic         text,
  visibility    text,
  capacity      int,
  member_count  int,
  band          text,
  sort_order    int
)
language sql security definer set search_path = public stable
as $$
  with lobbies as (
    select r.id, r.name, r.topic, r.visibility, r.capacity,
           (select count(*)::int from public.room_members rm
              where rm.room_id = r.id)                          as member_count,
           case r.topic
             when 'lobby:common'      then 'common'
             when 'lobby:age:13-15'   then '13-15'
             when 'lobby:age:16-17'   then '16-17'
             when 'lobby:age:18-22'   then '18-22'
             when 'lobby:age:23-29'   then '23-29'
             when 'lobby:age:30plus'  then '30+'
             else 'other'
           end as band,
           case r.topic
             when 'lobby:common'      then 0
             when 'lobby:age:13-15'   then 1
             when 'lobby:age:16-17'   then 2
             when 'lobby:age:18-22'   then 3
             when 'lobby:age:23-29'   then 4
             when 'lobby:age:30plus'  then 5
             else 99
           end as sort_order
      from public.rooms r
     where r.is_official = true
       and r.category_slug = 'students'
       and r.subcategory_slug = 'students-lobbies'
       and r.topic in (
         'lobby:common',
         'lobby:age:13-15',
         'lobby:age:16-17',
         'lobby:age:18-22',
         'lobby:age:23-29',
         'lobby:age:30plus'
       )
  )
  select id, name, topic, visibility, capacity, member_count, band, sort_order
    from lobbies
   order by sort_order asc;
$$;

revoke all on function public.list_student_lobbies() from public;
grant execute on function public.list_student_lobbies() to anon, authenticated;

-- ============================================================================
-- 4) browse_student_user_rooms — non-official rooms in the Students area
--    that anyone can join. Mirrors browse_user_rooms but is scoped to
--    category='students' so the Students area lists them.
-- ============================================================================
create or replace function public.browse_student_user_rooms(p_limit int default 100)
returns table (
  id            uuid,
  name          text,
  description   text,
  visibility    text,
  member_count  int,
  created_at    timestamptz,
  is_member     boolean,
  subcategory_slug text
)
language sql security definer set search_path = public stable
as $$
  select
    r.id, r.name, r.description, r.visibility,
    (select count(*)::int from public.room_members rm where rm.room_id = r.id) as member_count,
    r.created_at,
    exists (select 1 from public.room_members rm
             where rm.room_id = r.id and rm.user_id = auth.uid()) as is_member,
    r.subcategory_slug
  from public.rooms r
  where r.is_official = false
    and r.is_dm     is not true
    and r.is_saved  is not true
    and r.is_vault  is not true
    and r.category_slug = 'students'
    and r.visibility in ('public','listed')
  order by
    (select count(*) from public.room_members rm where rm.room_id = r.id) desc,
    r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke all on function public.browse_student_user_rooms(int) from public;
grant execute on function public.browse_student_user_rooms(int) to authenticated;
