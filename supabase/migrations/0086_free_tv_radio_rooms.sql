-- Karochat — "Worldwide Free TV" + "Worldwide Free Radio" rooms (country-wise).
--
-- Two new subcategories under the existing `infotainment` category (now shown as
-- "Live & Karaoke music"), each with country-wise rooms where people gather to
-- watch free-to-air TV / tune in to free internet radio and chat together.
-- Reuses the existing rooms + LiveKit watch-party layer (voice + cam on). People
-- paste their country's free TV / radio stream links and watch/listen together.
--
-- Purely additive + idempotent (ensure_official_room, migration 0015). Nothing
-- existing is removed, renamed, or renumbered.

insert into public.room_subcategories (category_slug, slug, label, position) values
  ('infotainment','info-tv',       'Worldwide Free TV',    190),
  ('infotainment','info-radio-ww', 'Worldwide Free Radio', 200)
on conflict (category_slug, slug) do update
  set label = excluded.label, position = excluded.position;

do $$
declare
  c text;
  -- A broad, diverse country set; people create their own for anything missing.
  v_countries text[] := array[
    'Global / International','United States','United Kingdom','India','Canada',
    'Australia','Ireland','Germany','France','Spain','Italy','Portugal',
    'Netherlands','Sweden','Norway','Poland','Russia','Turkey','Greece',
    'Brazil','Mexico','Argentina','Colombia','Chile','Japan','South Korea',
    'China','Hong Kong','Taiwan','Indonesia','Malaysia','Singapore',
    'Philippines','Thailand','Vietnam','Pakistan','Bangladesh','Sri Lanka',
    'Nepal','Saudi Arabia','UAE','Qatar','Egypt','Morocco','Nigeria','Ghana',
    'Kenya','South Africa'
  ];
begin
  -- Lounge / hub rooms first.
  perform public.ensure_official_room('infotainment','info-tv',
    'Free TV Lounge', 'Free-to-air & public TV from around the world — watch & chat together. 📺', 'public', true, true, false, null, 300);
  perform public.ensure_official_room('infotainment','info-radio-ww',
    'Free Radio Lounge', 'Free internet radio from around the world — tune in & chat. 📻', 'public', true, false, false, null, 300);

  foreach c in array v_countries loop
    perform public.ensure_official_room('infotainment','info-tv',
      c || ' — Free TV',
      'Free-to-air & public TV from ' || c || ' — share stream links, watch & chat together.',
      'public', true, true, false, null, 200);
    perform public.ensure_official_room('infotainment','info-radio-ww',
      c || ' — Free Radio',
      'Free internet radio stations from ' || c || ' — tune in, share links & chat.',
      'public', true, false, false, null, 200);
  end loop;
end$$;
