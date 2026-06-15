-- Karochat — remove the "Worldwide Free TV" + "Worldwide Free Radio" rooms.
--
-- Migration 0086 seeded two subcategories (`info-tv`, `info-radio-ww`) under the
-- `infotainment` ("Live & Karaoke music") category, each with ~49 country-wise
-- official rooms. We are replacing that room-based surface with the dedicated
-- in-app "TV & Radio" feature (/livetv), so these catalog rooms are no longer
-- needed and are removed here.
--
-- Safe + idempotent:
--   * Deleting the rooms cascades to room_members / messages / etc. — every
--     FK that references public.rooms(id) is ON DELETE CASCADE or SET NULL
--     (see 0002/0021/0025/0027/0042/0067/0070/0079), so no orphan rows remain.
--   * subcategory_slug has no FK, so the rooms must be deleted explicitly
--     before (or independently of) the subcategory rows.
--   * Re-running deletes nothing. Only these two slugs are touched; the rest of
--     the "Live & Karaoke music" category (karaoke, music, etc.) is untouched.

-- 1) Remove the official TV / Radio rooms (cascades clean up memberships, etc.).
delete from public.rooms
 where is_official = true
   and category_slug = 'infotainment'
   and subcategory_slug in ('info-tv', 'info-radio-ww');

-- 2) Remove the two subcategory headers from the catalog tree.
delete from public.room_subcategories
 where category_slug = 'infotainment'
   and slug in ('info-tv', 'info-radio-ww');
