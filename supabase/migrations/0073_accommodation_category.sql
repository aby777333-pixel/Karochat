-- Karochat — "Accommodation & Stay" catalog.
--
-- Adds a dedicated, globally-organised "Accommodation & Stay" top-level
-- category so people worldwide can discover, advertise, discuss and connect
-- about every kind of accommodation, rental, temporary stay and housing
-- opportunity.
--
-- Structure (mirrors the existing catalog conventions — see 0066 bnb,
-- 0052 marketplace):
--   * Accommodation-TYPE subcategories (Residential, Rooms & Shared, PG &
--     Hostels, Short-Term, Hotels, Student, Workforce, Senior/Special,
--     Property Marketplace, Travel & Relocation) — each seeded with the
--     specific sub-types as rooms.
--   * A "Filters" subcategory surfacing the cross-cutting facets people
--     search by (furnished/unfurnished, pet-friendly, family, gender-
--     specific, student, budget, short/long-term).
--   * Location subcategories organised globally by Country → State/Province
--     → County/District → City/Town. Each city gets a stay lobby plus
--     rentals / PG & hostels / hotels & short-stay facet rooms, with the full
--     hierarchy written into the room topic
--     (e.g. India → Kerala → Kottayam → Changanassery).
--   * Provider (hosts), Seeker and Reviews/Verification subcategories.
--
-- Public rooms by default. Sellers AND seekers can add + name their own rooms
-- under any of these subcategories via the existing "+ Create your own room
-- in …" CTA in the catalog browser (the lobby reads categories live from
-- room_categories, so no client change is required).
--
-- Idempotent and purely additive. Safe to re-run. Nothing existing is
-- removed, renamed or renumbered. Uses the existing ensure_official_room()
-- helper (0015) so member counts / RLS stay correct, and browse_catalog()
-- (already patched in 0066 to surface user-created rooms in the tree).

-- ============================================================================
-- 0) Top-level category  (position 33 — directly after Bed & Breakfast = 32)
-- ============================================================================
insert into public.room_categories (slug, label, description, icon, position, is_adult) values
  ('accommodation', 'Accommodation & Stay',
   'Find, advertise & discuss rentals, rooms, PG, hostels, hotels & stays — worldwide, by location.',
   '🏘️', 33, false)
on conflict (slug) do update
  set label       = excluded.label,
      description = excluded.description,
      icon        = excluded.icon,
      position    = excluded.position,
      is_adult    = excluded.is_adult;

-- ============================================================================
-- 1) Subcategories
-- ============================================================================
insert into public.room_subcategories (category_slug, slug, label, position) values
  ('accommodation','accommodation-residential',    'Residential Rentals',              10),
  ('accommodation','accommodation-rooms-shared',   'Rooms & Shared Accommodation',     20),
  ('accommodation','accommodation-pg-hostel',      'Paying Guest & Hostels',           30),
  ('accommodation','accommodation-short-term',     'Short-Term & Temporary Stays',     40),
  ('accommodation','accommodation-hotels',         'Hotels & Commercial Stays',        50),
  ('accommodation','accommodation-student',        'Student & Educational Housing',    60),
  ('accommodation','accommodation-workforce',      'Workforce & Professional Housing', 70),
  ('accommodation','accommodation-senior-special', 'Senior & Special Housing',         80),
  ('accommodation','accommodation-marketplace',    'Property Marketplace',             90),
  ('accommodation','accommodation-relocation',     'Travel & Relocation',              100),
  ('accommodation','accommodation-filters',        'Furnished, pet-friendly & budget', 110),
  ('accommodation','accommodation-india',          'India · by state & city',          120),
  ('accommodation','accommodation-usa',            'USA · by state & city',            130),
  ('accommodation','accommodation-uk',             'UK & Ireland',                     140),
  ('accommodation','accommodation-canada',         'Canada',                           150),
  ('accommodation','accommodation-gulf',           'Gulf & Middle East',               160),
  ('accommodation','accommodation-anz',            'Australia & New Zealand',          170),
  ('accommodation','accommodation-europe',         'Europe',                           180),
  ('accommodation','accommodation-asia',           'Asia-Pacific',                     190),
  ('accommodation','accommodation-africa',         'Africa',                           200),
  ('accommodation','accommodation-americas',       'Latin America & Caribbean',        210),
  ('accommodation','accommodation-global',         'Worldwide',                        220),
  ('accommodation','accommodation-hosts',          'Providers — list your place',      230),
  ('accommodation','accommodation-seekers',        'Seekers — find a place',           240),
  ('accommodation','accommodation-reviews',        'Reviews, verification & safety',   250)
on conflict (category_slug, slug) do update
  set label = excluded.label, position = excluded.position;

-- ============================================================================
-- 2) Type-based rooms — seed each specific accommodation type as a room.
--    Public, no voice/cam/verify gating. People create their own on top.
-- ============================================================================
do $$
declare
  t text;
  v_residential   text[] := array['Apartments','Flats','Studio Apartments','Condominiums (Condos)','Villas','Townhouses','Individual Houses','Independent Homes','Duplexes','Shared Housing','Co-Living Spaces','Gated Community Homes'];
  v_rooms_shared  text[] := array['Rooms for Rent','Single Rooms','Shared Rooms','Roommates Wanted','Flatmates Wanted','House Sharing','Bed Spaces','Shared Apartments','Shared Houses'];
  v_pg_hostel     text[] := array['Paying Guest (PG) Accommodation','Men''s PG','Women''s PG','Student PG','Working Professionals PG','Executive PG','Boys'' Hostels','Girls'' Hostels','Student Hostels','Working Women''s Hostels','Working Men''s Hostels','University Accommodation'];
  v_short_term    text[] := array['Vacation Rentals','Holiday Homes','Serviced Apartments','Corporate Housing','Temporary Accommodation','Daily Rentals','Weekly Rentals','Monthly Rentals','Homestays','Guest Houses'];
  v_hotels        text[] := array['Hotels','Motels','Lodges','Inns','Resorts','Budget Hotels','Luxury Hotels','Business Hotels','Backpacker Accommodation','Bed & Breakfasts (B&B)','Capsule Hotels'];
  v_student       text[] := array['College Hostels','University Dormitories','Student Accommodation','International Student Housing','Campus Housing','Off-Campus Housing'];
  v_workforce     text[] := array['Staff Accommodation','Employee Housing','Corporate Accommodation','Construction Worker Housing','Seasonal Worker Accommodation','Migrant Worker Housing'];
  v_senior        text[] := array['Senior Living Communities','Assisted Living','Retirement Homes','Disability-Friendly Accommodation','Rehabilitation Housing'];
  v_marketplace   text[] := array['Property for Rent','Property Wanted','Property Exchange','Rental Leads','Lease Transfers','Sublets','Short-Term Leases','Long-Term Leases'];
  v_relocation    text[] := array['Relocation Assistance','New City Accommodation','Expat Housing','Digital Nomad Stays','International Relocation Housing'];
  v_filters       text[] := array['Furnished Homes','Semi-Furnished Homes','Unfurnished Homes','Pet-Friendly Stays','Family Accommodation','Women-Only Accommodation','Men-Only Accommodation','Couples-Friendly Stays','Student-Friendly Stays','Bachelor Accommodation','Budget Stays','Premium & Luxury Stays','Short-Term Stays','Long-Term Stays'];
  v_hosts         text[] := array['List Your Property','Landlords & Owners','Property Agents & Brokers','Hotels & Resorts','Hostel & PG Operators','Vacation Rental Hosts','Verified Providers Lounge'];
  v_seekers       text[] := array['Find a Rental','Find a Roommate','Find a PG or Hostel','Find a Short Stay','Urgent / Same-Day Stay','Requirements & Wanted Board'];
  v_reviews       text[] := array['Property & Stay Reviews','Landlord & Agent Reviews','Scam Alerts & Safety','Rent, Deposit & Pricing Advice','Tenancy & Legal Help','Verified Owner & Agent Badges'];
begin
  foreach t in array v_residential loop
    perform public.ensure_official_room('accommodation','accommodation-residential', t,
      t || ' — listings, seekers, owners & agents worldwide.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_rooms_shared loop
    perform public.ensure_official_room('accommodation','accommodation-rooms-shared', t,
      t || ' — match with roommates, flatmates & shared homes.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_pg_hostel loop
    perform public.ensure_official_room('accommodation','accommodation-pg-hostel', t,
      t || ' — vacancies, tariffs & enquiries.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_short_term loop
    perform public.ensure_official_room('accommodation','accommodation-short-term', t,
      t || ' — daily, weekly & monthly short stays.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_hotels loop
    perform public.ensure_official_room('accommodation','accommodation-hotels', t,
      t || ' — bookings, deals & traveller tips.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_student loop
    perform public.ensure_official_room('accommodation','accommodation-student', t,
      t || ' — on & off-campus housing for students.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_workforce loop
    perform public.ensure_official_room('accommodation','accommodation-workforce', t,
      t || ' — housing for staff, employees & workers.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_senior loop
    perform public.ensure_official_room('accommodation','accommodation-senior-special', t,
      t || ' — senior, assisted, accessible & care housing.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_marketplace loop
    perform public.ensure_official_room('accommodation','accommodation-marketplace', t,
      t || ' — post, browse & match property leads.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_relocation loop
    perform public.ensure_official_room('accommodation','accommodation-relocation', t,
      t || ' — moving city or country? Land here first.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_filters loop
    perform public.ensure_official_room('accommodation','accommodation-filters', t,
      t || ' — filter stays by what matters to you.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_hosts loop
    perform public.ensure_official_room('accommodation','accommodation-hosts', t,
      t || ' — advertise vacancies, photos, pricing & contact.', 'public', false, false, false, null, 100);
  end loop;
  foreach t in array v_seekers loop
    perform public.ensure_official_room('accommodation','accommodation-seekers', t,
      t || ' — post your requirement, budget & area.', 'public', false, false, false, null, 100);
  end loop;
  foreach t in array v_reviews loop
    perform public.ensure_official_room('accommodation','accommodation-reviews', t,
      t || ' — reviews, verification & staying safe.', 'public', false, false, false, null, 80);
  end loop;
end$$;

-- ============================================================================
-- 3) Location rooms — Country → State/Province → County/District → City/Town.
--    Each city gets a stay lobby + rentals / PG & hostels / hotels & short-stay
--    facet rooms. The full hierarchy is written into each room's topic.
-- ============================================================================
do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      -- ── India (Country → State → District → City) ──
      ('accommodation-india','India','Kerala','Kottayam','Changanassery'),
      ('accommodation-india','India','Kerala','Ernakulam','Kochi'),
      ('accommodation-india','India','Kerala','Thiruvananthapuram','Thiruvananthapuram'),
      ('accommodation-india','India','Tamil Nadu','Chennai','Chennai'),
      ('accommodation-india','India','Tamil Nadu','Coimbatore','Coimbatore'),
      ('accommodation-india','India','Karnataka','Bengaluru Urban','Bengaluru'),
      ('accommodation-india','India','Telangana','Hyderabad','Hyderabad'),
      ('accommodation-india','India','Maharashtra','Mumbai Suburban','Mumbai'),
      ('accommodation-india','India','Maharashtra','Pune','Pune'),
      ('accommodation-india','India','Delhi','New Delhi','Delhi'),
      ('accommodation-india','India','Haryana','Gurugram','Gurugram'),
      ('accommodation-india','India','Uttar Pradesh','Gautam Buddh Nagar','Noida'),
      ('accommodation-india','India','West Bengal','Kolkata','Kolkata'),
      -- ── USA (Country → State → County → City) ──
      ('accommodation-usa','USA','Texas','Harris County','Houston'),
      ('accommodation-usa','USA','Texas','Travis County','Austin'),
      ('accommodation-usa','USA','California','Los Angeles County','Los Angeles'),
      ('accommodation-usa','USA','California','San Francisco County','San Francisco'),
      ('accommodation-usa','USA','New York','New York County','New York City'),
      ('accommodation-usa','USA','Illinois','Cook County','Chicago'),
      ('accommodation-usa','USA','Florida','Miami-Dade County','Miami'),
      ('accommodation-usa','USA','Washington','King County','Seattle'),
      -- ── UK & Ireland ──
      ('accommodation-uk','United Kingdom','England','Greater London','London'),
      ('accommodation-uk','United Kingdom','England','Greater Manchester','Manchester'),
      ('accommodation-uk','United Kingdom','England','West Midlands','Birmingham'),
      ('accommodation-uk','United Kingdom','Scotland','City of Edinburgh','Edinburgh'),
      ('accommodation-uk','Ireland','Leinster','Dublin','Dublin'),
      -- ── Canada ──
      ('accommodation-canada','Canada','Ontario','Toronto','Toronto'),
      ('accommodation-canada','Canada','British Columbia','Metro Vancouver','Vancouver'),
      ('accommodation-canada','Canada','Quebec','Montreal','Montreal'),
      ('accommodation-canada','Canada','Alberta','Calgary','Calgary'),
      -- ── Gulf & Middle East ──
      ('accommodation-gulf','UAE','Dubai','Dubai','Dubai'),
      ('accommodation-gulf','UAE','Abu Dhabi','Abu Dhabi','Abu Dhabi'),
      ('accommodation-gulf','Saudi Arabia','Riyadh Province','Riyadh','Riyadh'),
      ('accommodation-gulf','Qatar','Doha','Doha','Doha'),
      ('accommodation-gulf','Oman','Muscat','Muscat','Muscat'),
      -- ── Australia & New Zealand ──
      ('accommodation-anz','Australia','New South Wales','Sydney','Sydney'),
      ('accommodation-anz','Australia','Victoria','Melbourne','Melbourne'),
      ('accommodation-anz','Australia','Queensland','Brisbane','Brisbane'),
      ('accommodation-anz','New Zealand','Auckland Region','Auckland','Auckland'),
      -- ── Europe ──
      ('accommodation-europe','Germany','Berlin','Berlin','Berlin'),
      ('accommodation-europe','France','Île-de-France','Paris','Paris'),
      ('accommodation-europe','Netherlands','North Holland','Amsterdam','Amsterdam'),
      ('accommodation-europe','Spain','Catalonia','Barcelona','Barcelona'),
      ('accommodation-europe','Italy','Lazio','Rome','Rome'),
      -- ── Asia-Pacific ──
      ('accommodation-asia','Singapore','Central Region','Singapore','Singapore'),
      ('accommodation-asia','Malaysia','Federal Territory','Kuala Lumpur','Kuala Lumpur'),
      ('accommodation-asia','Thailand','Bangkok','Bangkok','Bangkok'),
      ('accommodation-asia','Japan','Tokyo','Tokyo','Tokyo'),
      ('accommodation-asia','Indonesia','Bali','Denpasar','Bali'),
      ('accommodation-asia','Philippines','Metro Manila','Manila','Manila'),
      -- ── Africa ──
      ('accommodation-africa','South Africa','Gauteng','Johannesburg','Johannesburg'),
      ('accommodation-africa','South Africa','Western Cape','Cape Town','Cape Town'),
      ('accommodation-africa','Nigeria','Lagos State','Lagos','Lagos'),
      ('accommodation-africa','Kenya','Nairobi County','Nairobi','Nairobi'),
      ('accommodation-africa','Egypt','Cairo Governorate','Cairo','Cairo'),
      -- ── Latin America & Caribbean ──
      ('accommodation-americas','Brazil','São Paulo','São Paulo','São Paulo'),
      ('accommodation-americas','Mexico','Mexico City','Mexico City','Mexico City'),
      ('accommodation-americas','Argentina','Buenos Aires','Buenos Aires','Buenos Aires'),
      ('accommodation-americas','Colombia','Antioquia','Medellín','Medellín')
    ) as t(sub, country, state, district, city)
  loop
    -- City stay lobby — full hierarchy in the topic.
    perform public.ensure_official_room('accommodation', rec.sub,
      'Stay · ' || rec.city || ', ' || rec.state,
      'Accommodation in ' || rec.city || ' (' || rec.district || ', ' || rec.state || ', ' || rec.country
        || ') — rentals, rooms, PG/hostels, short stays & hotels. Post listings or requirements.',
      'public', false, false, false, null, 80);
    -- Rentals facet.
    perform public.ensure_official_room('accommodation', rec.sub,
      'Rentals · ' || rec.city,
      'Apartments, flats, houses & villas for rent in ' || rec.city || ', ' || rec.state || ', ' || rec.country || '.',
      'public', false, false, false, null, 80);
    -- PG / hostels / shared facet.
    perform public.ensure_official_room('accommodation', rec.sub,
      'PG, Hostels & Shared · ' || rec.city,
      'PG, hostels, bed spaces, roommates & shared rooms in ' || rec.city || ', ' || rec.state || '.',
      'public', false, false, false, null, 80);
    -- Hotels / short-stay facet.
    perform public.ensure_official_room('accommodation', rec.sub,
      'Hotels & Short Stays · ' || rec.city,
      'Hotels, resorts, homestays, serviced apartments & short stays in ' || rec.city || ', ' || rec.country || '.',
      'public', false, false, false, null, 80);
  end loop;
end$$;

-- ============================================================================
-- 4) Worldwide entry rooms — for places not yet broken out by city.
-- ============================================================================
do $$
declare
  k text;
  v_world text[] := array[
    'Pakistan','Bangladesh','Sri Lanka','Nepal','Switzerland','Sweden','Portugal',
    'Turkey','South Korea','Vietnam','Hong Kong','China','Russia','Poland','Greece'
  ];
begin
  perform public.ensure_official_room('accommodation','accommodation-global',
    'Worldwide accommodation lobby', 'Anywhere on Earth — ask for or advertise a place to stay.',
    'public', false, false, false, null, 150);
  perform public.ensure_official_room('accommodation','accommodation-global',
    'Add your country or city', 'Don''t see your place? Create a room for your country, district or town here.',
    'public', false, false, false, null, 100);
  foreach k in array v_world loop
    perform public.ensure_official_room('accommodation','accommodation-global',
      'Stay · ' || k, 'Accommodation, rentals & stays across ' || k || '. Post listings or requirements.',
      'public', false, false, false, null, 80);
  end loop;
end$$;
