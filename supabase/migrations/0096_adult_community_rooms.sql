-- Karochat — Adult hub: a "Community rooms" subcategory for user-created rooms.
--
-- Users can already create rooms via the main catalog; this gives the Adult hub
-- a dedicated subcategory so rooms people create from inside /adult have a home
-- and stay discoverable. Purely additive + idempotent. No rooms are seeded here
-- (these are user-created); nothing existing is changed.

insert into public.room_subcategories (category_slug, slug, label, position) values
  ('adult', 'adult-community', 'Community rooms', 90)
on conflict (category_slug, slug) do update
  set label = excluded.label, position = excluded.position;
