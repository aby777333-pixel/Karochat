-- Karochat — Wave 19.3 hotfix: make official adult rooms joinable.
--
-- Migration 0026 seeded the four "(empty)" categories. Adult rooms were
-- shipped with visibility='listed' to avoid showing in non-adult listings
-- — but page.tsx redirects to /rooms?join=required for any non-public room
-- without an invite code, so the catalog "Be first →" link silently kicked
-- users back to the lobby.
--
-- Fix: flip official adult rooms to visibility='public'. The 18+ chip on
-- the catalog row (driven by room_categories.is_adult) is what warns users;
-- the room itself just needs to be joinable. (`is_public` is a generated
-- column derived from `visibility`, so flipping visibility updates both.)
--
-- Also flip ANY other official catalog room that ended up 'listed' or
-- 'unlisted' / 'secret', for the same reason — official discovery rooms
-- should always be joinable directly. This is a no-op for the rest of
-- the catalog because they were seeded 'public' anyway.

update public.rooms
   set visibility = 'public'
 where is_official = true
   and visibility in ('listed', 'unlisted', 'secret');
