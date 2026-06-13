-- Karochat — "Stays, BnBs & Homestays" expansion.
--
-- Extends the EXISTING `stays` category (position 28) into a global travel &
-- accommodation hub. Purely additive: new subcategories use fresh slugs that
-- don't collide with the current ones (st-bnb, st-vacation, st-hostels,
-- st-longstay, st-hosts, st-india, st-global), and rooms are seeded via the
-- existing ensure_official_room() helper. Public by default. People add + name
-- their own rooms via the existing "+ Create your own room" CTA.
--
-- Idempotent. Nothing existing is removed, renamed or renumbered.

-- ── New subcategories ───────────────────────────────────────────────────────
insert into public.room_subcategories (category_slug, slug, label, position) values
  ('stays','st-vacation-rentals','Vacation Rentals',                 80),
  ('stays','st-homestays',       'Homestays',                        90),
  ('stays','st-bnbs',            'Bed & Breakfasts (BnBs)',          100),
  ('stays','st-serviced',        'Serviced Apartments',              110),
  ('stays','st-hotels-resorts',  'Hotels & Resorts',                 120),
  ('stays','st-backpacker',      'Hostels & Backpacker',             130),
  ('stays','st-unique',          'Unique & Specialty Stays',         140),
  ('stays','st-corporate',       'Business & Corporate Travel',      150),
  ('stays','st-nomad',           'Digital Nomad & Remote Work',      160),
  ('stays','st-student-travel',  'Student & Educational Travel',     170),
  ('stays','st-pilgrimage',      'Pilgrimage & Religious Travel',    180),
  ('stays','st-wellness',        'Medical & Wellness Travel',        190),
  ('stays','st-adventure',       'Adventure & Tourism',              200),
  ('stays','st-marketplace',     'Travel Marketplace',               210),
  ('stays','st-filters',         'Filters · budget, family, pet…',   220),
  ('stays','st-reviews',         'Reviews & Recommendations',        230),
  ('stays','st-destinations',    'Destinations · by country & city', 240)
on conflict (category_slug, slug) do update
  set label = excluded.label, position = excluded.position;

-- ── Type-based rooms ────────────────────────────────────────────────────────
do $$
declare
  t text;
  v_vacation   text[] := array['Vacation Homes','Holiday Homes','Beach Houses','Lake Houses','Mountain Cabins','Countryside Retreats','Farm Stays','Forest Lodges','Island Stays','Luxury Villas','Family Vacation Homes','Group Vacation Rentals','Weekend Getaways'];
  v_homestays  text[] := array['Family Homestays','Cultural Homestays','Rural Homestays','Urban Homestays','Heritage Homestays','Local Experience Homestays','Student Homestays','Host Family Accommodation','International Visitor Homestays'];
  v_bnbs       text[] := array['Traditional B&Bs','Boutique B&Bs','Luxury B&Bs','Countryside B&Bs','Coastal B&Bs','Historic B&Bs','Family-Run B&Bs','Budget B&Bs'];
  v_serviced   text[] := array['Executive Apartments','Corporate Apartments','Business Travel Apartments','Luxury Serviced Apartments','Extended Stay Apartments','Furnished Apartments','Short-Term Serviced Apartments','Long-Term Serviced Apartments'];
  v_hotels     text[] := array['Budget Hotels','Mid-Range Hotels','Luxury Hotels','Boutique Hotels','Business Hotels','Airport Hotels','Family Resorts','Beach Resorts','Mountain Resorts','Wellness Resorts','Spa Resorts','Eco Resorts','All-Inclusive Resorts'];
  v_backpacker text[] := array['Backpacker Hostels','Youth Hostels','Budget Hostels','Digital Nomad Hostels','Adventure Travel Hostels','Women''s Hostels','Men''s Hostels','Mixed Hostels','Capsule Hostels'];
  v_unique     text[] := array['Treehouses','Tiny Homes','Houseboats','Floating Homes','Glamping Sites','Safari Lodges','Desert Camps','Eco Lodges','Igloos','Cottages','Castles','Heritage Properties','Luxury Retreats','Off-Grid Stays'];
  v_corporate  text[] := array['Corporate Housing','Executive Stays','Relocation Housing','Long-Term Business Accommodation','Conference Hotels','Business Travel Networks','Workcation Properties'];
  v_nomad      text[] := array['Digital Nomad Accommodation','Co-Living Spaces','Work-Friendly Stays','Remote Work Retreats','Long-Stay Rentals','International Nomad Communities','Freelancer-Friendly Accommodation'];
  v_student    text[] := array['Student Stays','Study Abroad Housing','Exchange Student Accommodation','Internship Accommodation','Summer Program Housing','Campus Visitor Stays'];
  v_pilgrimage text[] := array['Pilgrim Accommodation','Temple Stays','Church Guest Houses','Monastery Accommodation','Ashram Stays','Spiritual Retreat Centres','Religious Event Accommodation'];
  v_wellness   text[] := array['Medical Tourism Accommodation','Hospital Nearby Stays','Recovery Accommodation','Wellness Retreats','Rehabilitation Retreats','Senior Travel Accommodation'];
  v_adventure  text[] := array['Trekking Base Camps','Hiking Lodges','Ski Accommodation','Surf Camps','Scuba Diving Resorts','Wildlife Lodges','Camping Grounds','Caravan Parks','RV Parks'];
  v_market     text[] := array['Stays Available','Stay Wanted','Last-Minute Deals','Travel Accommodation Offers','Seasonal Rentals','Vacation Rental Marketplace','Direct Host Listings','Group Travel Accommodation','Travel Partner Finder'];
  v_filters    text[] := array['Budget Stays','Luxury Stays','Family-Friendly','Pet-Friendly','Wheelchair-Accessible','Beachfront','Mountain View','City Centre','Business Travel','Remote-Work-Friendly','Verified Hosts','Verified Properties'];
  v_reviews    text[] := array['Best Stays by City','Best Homestays','Best BnBs','Best Budget Accommodation','Luxury Stay Recommendations','Family-Friendly Stays','Solo Traveler Recommendations','Hidden Gems','Host Reviews','Guest Reviews'];
begin
  foreach t in array v_vacation loop
    perform public.ensure_official_room('stays','st-vacation-rentals', t, t || ' — book direct, list yours, swap tips.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_homestays loop
    perform public.ensure_official_room('stays','st-homestays', t, t || ' — live like a local, host a guest.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_bnbs loop
    perform public.ensure_official_room('stays','st-bnbs', t, t || ' — find a bed, list your B&B.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_serviced loop
    perform public.ensure_official_room('stays','st-serviced', t, t || ' — furnished, flexible stays.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_hotels loop
    perform public.ensure_official_room('stays','st-hotels-resorts', t, t || ' — deals, reviews & bookings.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_backpacker loop
    perform public.ensure_official_room('stays','st-backpacker', t, t || ' — cheap beds & travel buddies.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_unique loop
    perform public.ensure_official_room('stays','st-unique', t, t || ' — unforgettable, one-of-a-kind stays.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_corporate loop
    perform public.ensure_official_room('stays','st-corporate', t, t || ' — for business travellers & relocations.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_nomad loop
    perform public.ensure_official_room('stays','st-nomad', t, t || ' — wifi, desk, community for nomads.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_student loop
    perform public.ensure_official_room('stays','st-student-travel', t, t || ' — for students & study-abroad.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_pilgrimage loop
    perform public.ensure_official_room('stays','st-pilgrimage', t, t || ' — stays for pilgrims & retreats.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_wellness loop
    perform public.ensure_official_room('stays','st-wellness', t, t || ' — stays for treatment, recovery & wellness.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_adventure loop
    perform public.ensure_official_room('stays','st-adventure', t, t || ' — basecamps & outdoor stays.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_market loop
    perform public.ensure_official_room('stays','st-marketplace', t, t || ' — post offers & requirements.', 'public', false, false, false, null, 100);
  end loop;
  foreach t in array v_filters loop
    perform public.ensure_official_room('stays','st-filters', t, t || ' — filter stays by what matters.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_reviews loop
    perform public.ensure_official_room('stays','st-reviews', t, t || ' — honest reviews & recommendations.', 'public', false, false, false, null, 80);
  end loop;
end$$;

-- ── Destination rooms · Country → State/Province → County/District → City ────
do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('India','Kerala','Kottayam','Kumarakom'),
      ('India','Kerala','Ernakulam','Kochi'),
      ('India','Goa','North Goa','Calangute'),
      ('India','Rajasthan','Udaipur','Udaipur'),
      ('India','Himachal Pradesh','Kullu','Manali'),
      ('India','Tamil Nadu','Nilgiris','Ooty'),
      ('India','Maharashtra','Mumbai','Mumbai'),
      ('USA','Florida','Miami-Dade County','Miami'),
      ('USA','California','Los Angeles County','Los Angeles'),
      ('USA','New York','New York County','New York City'),
      ('USA','Nevada','Clark County','Las Vegas'),
      ('USA','Hawaii','Maui County','Maui'),
      ('United Kingdom','England','Greater London','London'),
      ('United Kingdom','Scotland','City of Edinburgh','Edinburgh'),
      ('France','Île-de-France','Paris','Paris'),
      ('France','Provence-Alpes-Côte d''Azur','Alpes-Maritimes','Nice'),
      ('Italy','Lazio','Rome','Rome'),
      ('Spain','Catalonia','Barcelona','Barcelona'),
      ('Thailand','Phuket','Phuket','Phuket'),
      ('Thailand','Bangkok','Bangkok','Bangkok'),
      ('Indonesia','Bali','Badung','Bali'),
      ('UAE','Dubai','Dubai','Dubai'),
      ('Japan','Tokyo','Tokyo','Tokyo'),
      ('Singapore','Central Region','Singapore','Singapore'),
      ('Australia','New South Wales','Sydney','Sydney'),
      ('Maldives','Kaafu Atoll','Malé','Maldives'),
      ('Greece','South Aegean','Cyclades','Santorini'),
      ('Switzerland','Bern','Interlaken-Oberhasli','Interlaken'),
      ('Mexico','Quintana Roo','Benito Juárez','Cancún'),
      ('South Africa','Western Cape','Cape Town','Cape Town')
    ) as t(country, state, district, city)
  loop
    perform public.ensure_official_room('stays','st-destinations',
      'Stays · ' || rec.city || ', ' || rec.state,
      'Stays, BnBs, homestays, hotels & vacation rentals in ' || rec.city
        || ' (' || rec.district || ', ' || rec.state || ', ' || rec.country
        || '). Hosts list, guests ask, everyone reviews.',
      'public', false, false, false, null, 80);
  end loop;

  -- Worldwide catch-all
  perform public.ensure_official_room('stays','st-destinations',
    'Worldwide stays lobby', 'Anywhere on Earth — find a stay or list your place.',
    'public', false, false, false, null, 150);
  perform public.ensure_official_room('stays','st-destinations',
    'Add your destination', 'Create a room for your country, region or town here.',
    'public', false, false, false, null, 100);
end$$;
