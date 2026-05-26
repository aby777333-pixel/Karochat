-- Karochat — Travel companion subcategories under Adult & Sex-Positive.
--
-- Adds two new subcategories ("Travel companion · male" and
-- "Travel companion · female") and seeds them with rooms scoped by:
--
--   • country — 41 countries, mirroring the existing adult-global set
--   • Indian state — 22 states, mirroring adult-india-states
--   • world city — 25 major cities
--   • Indian city — 15 major cities
--
-- Total: 206 new rooms (~50 kB of new row data on top of the existing
-- 744 kB rooms table). No new tables, no new buckets, no schema
-- changes — pure data seed via ensure_official_room RPC.
--
-- Idempotent: ensure_official_room is upsert-by-(category_slug,
-- subcategory_slug, name). Safe to re-run.

-- =====================================================================
-- 1) SUBCATEGORIES
-- =====================================================================

insert into public.room_subcategories
  (category_slug, slug, label, description, position)
values
  ('adult', 'adult-travel-male',
   'Travel companion · male',
   '🧳 Men looking for travel companions — country, state, and city threads worldwide.',
   70),
  ('adult', 'adult-travel-female',
   'Travel companion · female',
   '🧳 Women looking for travel companions — country, state, and city threads worldwide.',
   80)
on conflict (category_slug, slug) do update
  set label = excluded.label,
      description = excluded.description,
      position = excluded.position;

-- =====================================================================
-- 2) ROOMS
-- =====================================================================
-- ensure_official_room signature:
--   (p_category_slug, p_subcategory_slug, p_name, p_topic, p_visibility,
--    p_voice_enabled, p_cam_enabled, p_verified_only, p_verified_kind,
--    p_capacity)

do $$
declare
  v_countries text[] := array[
    'Argentina','Australia','Bahrain','Bangladesh','Brazil','Canada','Egypt',
    'France','Germany','Ghana','India','Indonesia','Ireland','Italy','Japan',
    'Kenya','Kuwait','Malaysia','Mexico','Morocco','Nepal','Netherlands',
    'New Zealand','Nigeria','Oman','Pakistan','Philippines','Portugal',
    'Qatar','Saudi Arabia','Singapore','South Africa','South Korea','Spain',
    'Sri Lanka','Sweden','Thailand','United Arab Emirates','United Kingdom',
    'United States','Vietnam'
  ];
  v_india_states text[] := array[
    'Andhra Pradesh','Assam','Bihar','Chhattisgarh','Delhi','Goa','Gujarat',
    'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala',
    'Madhya Pradesh','Maharashtra','Odisha','Punjab','Rajasthan','Tamil Nadu',
    'Telangana','Uttar Pradesh','Uttarakhand','West Bengal'
  ];
  v_world_cities text[] := array[
    'London','New York','Los Angeles','Dubai','Bangkok','Tokyo','Singapore (city)',
    'Sydney','Berlin','Paris','Amsterdam','Barcelona','Istanbul','Cairo',
    'Cape Town','Buenos Aires','São Paulo','Mexico City','Toronto','Vancouver',
    'Hong Kong','Kuala Lumpur','Seoul','Lisbon','Vienna'
  ];
  v_india_cities text[] := array[
    'Bengaluru','Mumbai','Delhi NCR','Hyderabad','Chennai','Kolkata','Pune',
    'Ahmedabad','Surat','Jaipur','Lucknow','Indore','Kochi','Chandigarh',
    'Panaji (Goa)'
  ];
  v text;
begin
  -- ---- COUNTRIES ----
  foreach v in array v_countries loop
    perform public.ensure_official_room(
      'adult', 'adult-travel-male',
      'Travel · Male · ' || v,
      '🔞🧳 Men looking for male travel companions in/from ' || v || '.',
      'public', false, false, false, null, 60
    );
    perform public.ensure_official_room(
      'adult', 'adult-travel-female',
      'Travel · Female · ' || v,
      '🔞🧳 Women looking for female travel companions in/from ' || v || '.',
      'public', false, false, false, null, 60
    );
  end loop;

  -- ---- INDIAN STATES ----
  foreach v in array v_india_states loop
    perform public.ensure_official_room(
      'adult', 'adult-travel-male',
      'Travel · Male · ' || v,
      '🔞🧳 Male travel companions across ' || v || '.',
      'public', false, false, false, null, 60
    );
    perform public.ensure_official_room(
      'adult', 'adult-travel-female',
      'Travel · Female · ' || v,
      '🔞🧳 Female travel companions across ' || v || '.',
      'public', false, false, false, null, 60
    );
  end loop;

  -- ---- WORLD CITIES ----
  foreach v in array v_world_cities loop
    perform public.ensure_official_room(
      'adult', 'adult-travel-male',
      'Travel · Male · ' || v,
      '🔞🧳 Men meeting up + travelling around ' || v || '.',
      'public', false, false, false, null, 60
    );
    perform public.ensure_official_room(
      'adult', 'adult-travel-female',
      'Travel · Female · ' || v,
      '🔞🧳 Women meeting up + travelling around ' || v || '.',
      'public', false, false, false, null, 60
    );
  end loop;

  -- ---- INDIAN CITIES ----
  foreach v in array v_india_cities loop
    perform public.ensure_official_room(
      'adult', 'adult-travel-male',
      'Travel · Male · ' || v,
      '🔞🧳 Men meeting up + travelling around ' || v || '.',
      'public', false, false, false, null, 60
    );
    perform public.ensure_official_room(
      'adult', 'adult-travel-female',
      'Travel · Female · ' || v,
      '🔞🧳 Women meeting up + travelling around ' || v || '.',
      'public', false, false, false, null, 60
    );
  end loop;
end $$;
