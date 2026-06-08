-- Karochat — Wave 22: marketplace & community catalog expansion.
-- Adds real-estate, classifieds, jobs, stays/BnBs, local-business (yellow
-- pages), ads, and festivals categories — worldwide, India-national,
-- India-state-wise and India-city-wise — plus extra arts rooms.
--
-- Idempotent and additive. Safe to re-run. Uses the existing
-- ensure_official_room() helper (0015) so member counts / RLS stay correct.
-- User-created rooms (custom names) continue to flow through the normal
-- create-room path and the "User rooms" tab; nothing here touches that.

-- ============================================================================
-- 0) Top-level categories
-- ============================================================================
insert into public.room_categories (slug, label, description, icon, position, is_adult) values
  ('real-estate', 'Real Estate & Property',   'Buy, sell, rent — worldwide, India & state-wise.',          '🏠', 25, false),
  ('classifieds', 'Classifieds & Marketplace','Like Craigslist — for sale, wanted, free, services.',       '🛒', 26, false),
  ('jobs',        'Jobs & Hiring',            'Job seekers & employers — remote, gigs, by industry.',      '💼', 27, false),
  ('stays',       'Stays, BnBs & Homestays',  'BnBs, homestays, hostels & vacation rentals.',              '🏡', 28, false),
  ('local-biz',   'Local Business & Services','Yellow-pages style directory of local pros & shops.',       '📒', 29, false),
  ('ads',         'Ads & Promotions',         'Promote a business, deal, event or launch.',                '📣', 30, false),
  ('festivals',   'Festivals, Fairs & Markets','Local festivals, fairs, flea & farmers markets.',          '🎪', 31, false)
on conflict (slug) do update
  set label = excluded.label,
      description = excluded.description,
      icon = excluded.icon,
      position = excluded.position;

-- ============================================================================
-- 1) Subcategories
-- ============================================================================
insert into public.room_subcategories (category_slug, slug, label, position) values
  -- REAL ESTATE
  ('real-estate','re-india-states','By Indian state',     10),
  ('real-estate','re-india-cities','India · top cities',   20),
  ('real-estate','re-buy',         'Buyers',               30),
  ('real-estate','re-sell',        'Sellers & owners',     40),
  ('real-estate','re-rent',        'Rentals, PG & flatmates',50),
  ('real-estate','re-commercial',  'Commercial & office',  60),
  ('real-estate','re-land',        'Plots & land',         70),
  ('real-estate','re-luxury',      'Luxury & villas',      80),
  ('real-estate','re-global',      'Worldwide',            90),
  ('real-estate','re-agents',      'Agents & brokers',    100),
  ('real-estate','re-nri',         'NRI investment',      110),

  -- CLASSIFIEDS
  ('classifieds','cl-forsale',     'For sale — general',   10),
  ('classifieds','cl-electronics', 'Electronics & gadgets',20),
  ('classifieds','cl-furniture',   'Furniture & home',     30),
  ('classifieds','cl-vehicles',    'Vehicles & auto',      40),
  ('classifieds','cl-free',        'Free & giveaways',     50),
  ('classifieds','cl-wanted',      'Wanted / in search of',60),
  ('classifieds','cl-services',    'Services offered',     70),
  ('classifieds','cl-barter',      'Barter & swap',        80),
  ('classifieds','cl-india-cities','India · cities',       90),
  ('classifieds','cl-global',      'Worldwide',           100),

  -- JOBS
  ('jobs','jb-seekers',     'Job seekers',           10),
  ('jobs','jb-employers',   'Employers & recruiters',20),
  ('jobs','jb-remote',      'Remote & work-from-home',30),
  ('jobs','jb-gigs',        'Gigs & freelance',      40),
  ('jobs','jb-internships', 'Internships & freshers',50),
  ('jobs','jb-it',          'IT & software',         60),
  ('jobs','jb-sales',       'Sales & marketing',     70),
  ('jobs','jb-healthcare',  'Healthcare',            80),
  ('jobs','jb-bluecollar',  'Skilled & blue-collar', 90),
  ('jobs','jb-govt',        'Govt & PSU',           100),
  ('jobs','jb-india-cities','India · cities',       110),
  ('jobs','jb-global',      'Worldwide',            120),

  -- STAYS
  ('stays','st-bnb',      'BnBs & homestays',       10),
  ('stays','st-vacation', 'Vacation rentals',       20),
  ('stays','st-hostels',  'Hostels & backpackers',  30),
  ('stays','st-longstay', 'Long stays & co-living',  40),
  ('stays','st-hosts',    'Hosts',                  50),
  ('stays','st-india',    'India · destinations',   60),
  ('stays','st-global',   'Worldwide',              70),

  -- LOCAL BUSINESS
  ('local-biz','lb-directory',   'Business directory',   10),
  ('local-biz','lb-home',        'Home services',        20),
  ('local-biz','lb-professional','Professionals',        30),
  ('local-biz','lb-shops',       'Shops & retail',       40),
  ('local-biz','lb-food',        'Restaurants & cafes',  50),
  ('local-biz','lb-india-cities','India · cities',       60),

  -- ADS
  ('ads','ad-business','Promote your business', 10),
  ('ads','ad-deals',   'Deals & offers',        20),
  ('ads','ad-events',  'Event promotions',      30),
  ('ads','ad-creators','Creators & shoutouts',  40),
  ('ads','ad-startups','Startup launches',      50),

  -- FESTIVALS
  ('festivals','fest-india',   'India · festivals',     10),
  ('festivals','fest-global',  'Worldwide festivals',   20),
  ('festivals','fest-fairs',   'Fairs & flea markets',  30),
  ('festivals','fest-music',   'Music festivals',       40),
  ('festivals','fest-food',    'Food festivals',        50),
  ('festivals','fest-cultural','Cultural & heritage',   60),

  -- ARTS (extra subcats on the existing category)
  ('arts','arts-makers','Makers, crafts & handmade', 200),
  ('arts','arts-local', 'Local art scenes',          210)
on conflict (category_slug, slug) do update
  set label = excluded.label, position = excluded.position;

-- ============================================================================
-- 2) Rooms
-- ============================================================================
do $$
declare
  v_states text[] := array[
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa',
    'Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala',
    'Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland',
    'Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
    'Uttar Pradesh','Uttarakhand','West Bengal',
    'Delhi','Jammu & Kashmir','Ladakh','Puducherry','Chandigarh','Andaman & Nicobar'
  ];
  v_cities text[] := array[
    'Mumbai','Delhi NCR','Bengaluru','Hyderabad','Chennai','Kolkata','Pune',
    'Ahmedabad','Jaipur','Surat','Lucknow','Kochi','Chandigarh','Indore',
    'Nagpur','Coimbatore','Visakhapatnam','Bhopal','Patna','Vadodara'
  ];
  v_countries text[] := array[
    'United States','United Kingdom','United Arab Emirates','Canada','Australia',
    'Singapore','Germany','Saudi Arabia','Qatar','Malaysia','New Zealand','Ireland'
  ];
  v_destinations text[] := array[
    'Goa','Manali','Rishikesh','Jaipur','Udaipur','Munnar','Coorg','Shimla',
    'Darjeeling','Pondicherry','Ladakh','Andaman Islands','Varanasi','Kerala Backwaters'
  ];
  v_fests_in text[] := array[
    'Diwali','Holi','Durga Puja','Ganesh Chaturthi','Onam','Pongal','Navratri',
    'Eid','Christmas','Baisakhi','Bihu','Lohri','Ugadi','Raksha Bandhan',
    'Janmashtami','Makar Sankranti'
  ];
  v_fests_global text[] := array[
    'Oktoberfest','Carnival (Rio)','Coachella','Tomorrowland','Burning Man',
    'La Tomatina','Mardi Gras','Glastonbury','Edinburgh Fringe','Diwali abroad'
  ];
  s text;
  c text;
  k text;
  d text;
  f text;
begin
  -- ----- REAL ESTATE ------------------------------------------------------
  foreach s in array v_states loop
    perform public.ensure_official_room('real-estate','re-india-states',
      'Property · ' || s, 'Buy, sell & rent property in ' || s || '.',
      'public', false, false, false, null, 80);
  end loop;
  foreach c in array v_cities loop
    perform public.ensure_official_room('real-estate','re-india-cities',
      'Property · ' || c, 'Flats, houses & plots in ' || c || '.',
      'public', false, false, false, null, 100);
  end loop;
  foreach k in array v_countries loop
    perform public.ensure_official_room('real-estate','re-global',
      'Property · ' || k, 'Real estate in ' || k || '.',
      'public', false, false, false, null, 80);
  end loop;
  perform public.ensure_official_room('real-estate','re-buy','Home buyers · India','First-time and seasoned home buyers across India.','public',false,false,false,null,120);
  perform public.ensure_official_room('real-estate','re-buy','First-time home buyers','Loans, paperwork, what nobody tells you.','public',false,false,false,null,100);
  perform public.ensure_official_room('real-estate','re-buy','Home buyers · worldwide','Buying property anywhere on earth.','public',false,false,false,null,100);
  perform public.ensure_official_room('real-estate','re-buy','Buy-to-let investors','Rental yield, cap rates, landlording.','public',false,false,false,null,80);
  perform public.ensure_official_room('real-estate','re-sell','Property owners · India','Owners selling directly — FSBO India.','public',false,false,false,null,120);
  perform public.ensure_official_room('real-estate','re-sell','For sale by owner (FSBO)','Skip the agent — sell it yourself.','public',false,false,false,null,100);
  perform public.ensure_official_room('real-estate','re-sell','Builders & developers','New launches, pre-launch, inventory.','public',false,false,false,null,100);
  perform public.ensure_official_room('real-estate','re-rent','Rentals · India','Find & list rental homes across India.','public',false,false,false,null,150);
  perform public.ensure_official_room('real-estate','re-rent','PG & hostels','Paying-guest & shared accommodation.','public',false,false,false,null,120);
  perform public.ensure_official_room('real-estate','re-rent','Flatmates & roommates','Find a flatmate, split the rent.','public',false,false,false,null,120);
  perform public.ensure_official_room('real-estate','re-commercial','Office space','Lease & buy commercial office space.','public',false,false,false,null,80);
  perform public.ensure_official_room('real-estate','re-commercial','Shops & showrooms','Retail commercial property.','public',false,false,false,null,80);
  perform public.ensure_official_room('real-estate','re-commercial','Warehouse & industrial','Godowns, factories, logistics space.','public',false,false,false,null,60);
  perform public.ensure_official_room('real-estate','re-land','Plots & land · India','Residential & agricultural plots.','public',false,false,false,null,100);
  perform public.ensure_official_room('real-estate','re-land','Farmland & estates','Farms, orchards, large parcels.','public',false,false,false,null,60);
  perform public.ensure_official_room('real-estate','re-luxury','Luxury homes & villas','High-end residential worldwide.','public',false,false,false,null,80);
  perform public.ensure_official_room('real-estate','re-luxury','Second homes & resorts','Hills, beaches, getaways.','public',false,false,false,null,60);
  perform public.ensure_official_room('real-estate','re-agents','Agents & brokers · India','Verified-ish brokers, leads, listings.','public',false,false,false,null,100);
  perform public.ensure_official_room('real-estate','re-agents','Property consultants','Advisory, valuation, due diligence.','public',false,false,false,null,60);
  perform public.ensure_official_room('real-estate','re-nri','NRI property India','Buy, manage & sell from abroad.','public',false,false,false,null,100);
  perform public.ensure_official_room('real-estate','re-nri','NRI legal & POA','Power of attorney, taxes, repatriation.','public',false,false,false,null,60);

  -- ----- CLASSIFIEDS ------------------------------------------------------
  foreach c in array v_cities loop
    perform public.ensure_official_room('classifieds','cl-india-cities',
      'Classifieds · ' || c, 'Buy & sell anything in ' || c || '.',
      'public', false, false, false, null, 120);
  end loop;
  foreach k in array v_countries loop
    perform public.ensure_official_room('classifieds','cl-global',
      'Classifieds · ' || k, 'Local classifieds for ' || k || '.',
      'public', false, false, false, null, 100);
  end loop;
  perform public.ensure_official_room('classifieds','cl-forsale','For sale — everything','General marketplace, all items.','public',false,false,false,null,150);
  perform public.ensure_official_room('classifieds','cl-forsale','Garage & moving sales','Clearing out — come grab it.','public',false,false,false,null,80);
  perform public.ensure_official_room('classifieds','cl-electronics','Phones & laptops','Buy/sell used & new gadgets.','public',false,false,false,null,120);
  perform public.ensure_official_room('classifieds','cl-electronics','Gaming & PC parts','GPUs, consoles, rigs.','public',false,false,false,null,80);
  perform public.ensure_official_room('classifieds','cl-electronics','Cameras & audio','Lenses, mics, hi-fi.','public',false,false,false,null,60);
  perform public.ensure_official_room('classifieds','cl-furniture','Furniture & decor','Sofas, beds, home goods.','public',false,false,false,null,100);
  perform public.ensure_official_room('classifieds','cl-furniture','Appliances','Fridges, ACs, washers.','public',false,false,false,null,80);
  perform public.ensure_official_room('classifieds','cl-vehicles','Used cars','Buy & sell pre-owned cars.','public',false,false,false,null,120);
  perform public.ensure_official_room('classifieds','cl-vehicles','Bikes & scooters','Two-wheelers, all kinds.','public',false,false,false,null,100);
  perform public.ensure_official_room('classifieds','cl-vehicles','Auto parts & spares','Parts, tyres, accessories.','public',false,false,false,null,60);
  perform public.ensure_official_room('classifieds','cl-free','Free stuff','Give it away, keep it out of landfill.','public',false,false,false,null,100);
  perform public.ensure_official_room('classifieds','cl-free','Borrow & lend','Tools, gear — share don''t buy.','public',false,false,false,null,60);
  perform public.ensure_official_room('classifieds','cl-wanted','Wanted / in search of','Looking for something specific?','public',false,false,false,null,80);
  perform public.ensure_official_room('classifieds','cl-services','Services offered','Tutors, movers, cleaners, more.','public',false,false,false,null,100);
  perform public.ensure_official_room('classifieds','cl-services','Repairs & handymen','Fix-it folks near you.','public',false,false,false,null,80);
  perform public.ensure_official_room('classifieds','cl-barter','Barter & swap','Trade goods & skills, no cash.','public',false,false,false,null,60);

  -- ----- JOBS -------------------------------------------------------------
  foreach c in array v_cities loop
    perform public.ensure_official_room('jobs','jb-india-cities',
      'Jobs · ' || c, 'Hiring & job hunting in ' || c || '.',
      'public', false, false, false, null, 120);
  end loop;
  foreach k in array v_countries loop
    perform public.ensure_official_room('jobs','jb-global',
      'Jobs · ' || k, 'Openings & seekers in ' || k || '.',
      'public', false, false, false, null, 100);
  end loop;
  perform public.ensure_official_room('jobs','jb-seekers','Job seekers · India','Share your CV, get referrals.','public',false,false,false,null,150);
  perform public.ensure_official_room('jobs','jb-seekers','Career switchers','Pivoting industries or roles.','public',false,false,false,null,80);
  perform public.ensure_official_room('jobs','jb-employers','Employers & recruiters','Post roles, find candidates.','public',false,false,false,null,120);
  perform public.ensure_official_room('jobs','jb-employers','Startup hiring','Early-stage teams hiring fast.','public',false,false,false,null,80);
  perform public.ensure_official_room('jobs','jb-remote','Remote jobs · global','Work from anywhere.','public',false,false,false,null,150);
  perform public.ensure_official_room('jobs','jb-remote','Remote · India friendly','Remote roles open to India.','public',false,false,false,null,100);
  perform public.ensure_official_room('jobs','jb-gigs','Freelance & gigs','Project work, contracts, gigs.','public',false,false,false,null,120);
  perform public.ensure_official_room('jobs','jb-gigs','Part-time & weekend','Side income & part-time roles.','public',false,false,false,null,80);
  perform public.ensure_official_room('jobs','jb-internships','Internships','Internships & apprenticeships.','public',false,false,false,null,100);
  perform public.ensure_official_room('jobs','jb-internships','Freshers & campus','First job, off-campus drives.','public',false,false,false,null,100);
  perform public.ensure_official_room('jobs','jb-it','IT & software jobs','Dev, data, DevOps, QA.','public',false,false,false,null,150);
  perform public.ensure_official_room('jobs','jb-it','Design & product','UX, UI, PM roles.','public',false,false,false,null,80);
  perform public.ensure_official_room('jobs','jb-sales','Sales & marketing jobs','BD, growth, performance.','public',false,false,false,null,100);
  perform public.ensure_official_room('jobs','jb-healthcare','Healthcare jobs','Nurses, doctors, allied health.','public',false,false,false,null,80);
  perform public.ensure_official_room('jobs','jb-bluecollar','Skilled trades','Electricians, drivers, fitters.','public',false,false,false,null,100);
  perform public.ensure_official_room('jobs','jb-bluecollar','Hospitality & retail staff','Cooks, stewards, store staff.','public',false,false,false,null,80);
  perform public.ensure_official_room('jobs','jb-govt','Govt & PSU jobs','Sarkari naukri, exams, results.','public',false,false,false,null,120);

  -- ----- STAYS ------------------------------------------------------------
  foreach d in array v_destinations loop
    perform public.ensure_official_room('stays','st-india',
      'Stays · ' || d, 'BnBs, homestays & rentals in ' || d || '.',
      'public', false, false, false, null, 100);
  end loop;
  foreach k in array v_countries loop
    perform public.ensure_official_room('stays','st-global',
      'Stays · ' || k, 'Where to stay in ' || k || '.',
      'public', false, false, false, null, 80);
  end loop;
  perform public.ensure_official_room('stays','st-bnb','BnBs & homestays','Find & list cosy homestays.','public',false,false,false,null,120);
  perform public.ensure_official_room('stays','st-bnb','Farm & nature stays','Off-grid, farm, forest stays.','public',false,false,false,null,60);
  perform public.ensure_official_room('stays','st-vacation','Vacation rentals','Whole homes for your trip.','public',false,false,false,null,100);
  perform public.ensure_official_room('stays','st-hostels','Hostels & backpackers','Dorms, budget beds, meetups.','public',false,false,false,null,100);
  perform public.ensure_official_room('stays','st-longstay','Co-living & long stays','Months-long & digital-nomad bases.','public',false,false,false,null,80);
  perform public.ensure_official_room('stays','st-hosts','Hosts lounge','Tips for hosting guests well.','public',false,false,false,null,80);

  -- ----- LOCAL BUSINESS ---------------------------------------------------
  foreach c in array v_cities loop
    perform public.ensure_official_room('local-biz','lb-india-cities',
      'Local biz · ' || c, 'Find & list local businesses in ' || c || '.',
      'public', false, false, false, null, 100);
  end loop;
  perform public.ensure_official_room('local-biz','lb-directory','Business directory','List your business, get found.','public',false,false,false,null,120);
  perform public.ensure_official_room('local-biz','lb-home','Plumbers & electricians','Home repair pros near you.','public',false,false,false,null,80);
  perform public.ensure_official_room('local-biz','lb-home','Cleaning & pest control','Deep clean, sanitation, pest.','public',false,false,false,null,60);
  perform public.ensure_official_room('local-biz','lb-home','Movers & packers','Shifting homes & offices.','public',false,false,false,null,80);
  perform public.ensure_official_room('local-biz','lb-professional','CAs & accountants','Tax, GST, audit, books.','public',false,false,false,null,80);
  perform public.ensure_official_room('local-biz','lb-professional','Lawyers & legal','Legal advice & services.','public',false,false,false,null,80);
  perform public.ensure_official_room('local-biz','lb-professional','Doctors & clinics','Local healthcare providers.','public',false,false,false,null,80);
  perform public.ensure_official_room('local-biz','lb-shops','Local shops & retail','Neighbourhood stores & deals.','public',false,false,false,null,80);
  perform public.ensure_official_room('local-biz','lb-food','Restaurants & cafes','Eateries, tiffins, caterers.','public',false,false,false,null,100);

  -- ----- ADS --------------------------------------------------------------
  perform public.ensure_official_room('ads','ad-business','Promote your business','Free shoutouts for small biz.','public',false,false,false,null,120);
  perform public.ensure_official_room('ads','ad-business','Local advertising','Reach your city & neighbourhood.','public',false,false,false,null,80);
  perform public.ensure_official_room('ads','ad-deals','Deals, offers & coupons','Discounts, sales, promo codes.','public',false,false,false,null,120);
  perform public.ensure_official_room('ads','ad-events','Event promotions','Promote gigs, meetups, launches.','public',false,false,false,null,80);
  perform public.ensure_official_room('ads','ad-creators','Creators & shoutouts','Collab, cross-promo, S4S.','public',false,false,false,null,80);
  perform public.ensure_official_room('ads','ad-startups','Startup launches','Launch day — show the world.','public',false,false,false,null,80);

  -- ----- FESTIVALS --------------------------------------------------------
  foreach f in array v_fests_in loop
    perform public.ensure_official_room('festivals','fest-india',
      f, 'Celebrate ' || f || ' — plans, wishes, meetups.',
      'public', false, false, false, null, 120);
  end loop;
  foreach f in array v_fests_global loop
    perform public.ensure_official_room('festivals','fest-global',
      f, 'Everything ' || f || '.',
      'public', false, false, false, null, 100);
  end loop;
  perform public.ensure_official_room('festivals','fest-fairs','Flea & farmers markets','Stalls, finds, weekend markets.','public',false,false,false,null,80);
  perform public.ensure_official_room('festivals','fest-fairs','Craft & art fairs','Handmade, makers, exhibitions.','public',false,false,false,null,80);
  perform public.ensure_official_room('festivals','fest-fairs','Trade fairs & expos','Industry expos & conventions.','public',false,false,false,null,60);
  perform public.ensure_official_room('festivals','fest-music','Music festivals · India','Sunburn, NH7, indie & more.','public',false,false,false,null,100);
  perform public.ensure_official_room('festivals','fest-food','Food festivals','Street food, fests & pop-ups.','public',false,false,false,null,80);
  perform public.ensure_official_room('festivals','fest-cultural','Cultural & heritage','Folk, dance, regional traditions.','public',false,false,false,null,80);

  -- ----- ARTS (extra) -----------------------------------------------------
  perform public.ensure_official_room('arts','arts-makers','Handmade & crafts','Makers selling & sharing craft.','public',false,false,false,null,100);
  perform public.ensure_official_room('arts','arts-makers','Print, zines & illustration','Indie print & illustrators.','public',false,false,false,null,60);
  perform public.ensure_official_room('arts','arts-makers','Pottery & ceramics','Wheel, hand-build, glaze talk.','public',false,false,false,null,60);
  perform public.ensure_official_room('arts','arts-local','Local art scenes · India','Galleries, shows, open mics.','public',false,false,false,null,80);
  perform public.ensure_official_room('arts','arts-local','Street art & murals','Walls, festivals, crews.','public',false,false,false,null,60);
end$$;
