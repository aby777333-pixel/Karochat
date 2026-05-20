-- Karochat — v12 Wave 8: catalog seed (curated subset).
-- ~300 official rooms across all 20 v6 categories. Idempotent — every insert
-- uses ON CONFLICT DO NOTHING (for categories/subcategories) and the
-- ensure_official_room RPC keys on (category, subcategory, name). Re-running
-- this migration only adds new entries.
-- Run AFTER 0015_catalog_schema.sql.

-- ============================================================================
-- 1. Categories
-- ============================================================================
insert into public.room_categories (slug, label, description, icon, position, is_adult) values
  ('india',    'Regional · India',    'Cities, states, neighbourhoods across India',                                '🇮🇳', 100, false),
  ('global',   'Regional · Global',   'Cities and scenes around the world',                                          '🌐', 200, false),
  ('nri',      'NRI & Diaspora',      'Indians abroad — by community, country, and life stage',                      '✈️', 300, false),
  ('students', 'Students',            'School, undergrad, grad, exams, campuses — global',                            '🎓', 400, false),
  ('career',   'Career & Work',       'Industries, specializations, and the meta of working life',                    '💼', 500, false),
  ('money',    'Trading & Money',     'Trading, investing, personal finance, business',                               '💰', 600, false),
  ('travel',   'Travel & Trekking',   'Trails, road trips, slow travel, the outdoors',                                '🥾', 700, false),
  ('dating',   'Dating & Romance',    'Singles, couples, queer dating, kink-aware spaces',                            '💖', 800, false),
  ('events',   'Events & Culture',    'Festivals, concerts, parties, cultural programs',                              '🎉', 900, false),
  ('games',    'Games & Esports',     'PvP, MMO, tabletop, casual, mobile, retro',                                    '🎮', 1000, false),
  ('music',    'Music',               'Genres, languages, instruments, the listening rooms',                          '🎵', 1100, false),
  ('arts',     'Arts & Creative',     'Photography, painting, writing, film, crafts, design',                         '🎨', 1200, false),
  ('food',     'Food & Cooking',      'Cuisines, recipes, restaurants, diets',                                        '🍳', 1300, false),
  ('health',   'Health & Wellness',   'Fitness, mental health, recovery, support spaces',                             '🏋️', 1400, false),
  ('lgbtq',    'LGBTQ+',              'Queer-affirming community spaces across regions and lives',                    '🌈', 1500, false),
  ('tech',     'Tech & Builders',     'Engineers, designers, indie hackers, security, AI',                            '🧠', 1600, false),
  ('pets',     'Pets & Animals',      'Dogs, cats, birds, fish, rescues, wildlife',                                   '🐈', 1700, false),
  ('books',    'Books & Learning',    'Reading, languages, history, philosophy, science',                             '📚', 1800, false),
  ('faith',    'Faith & Meaning',     'Religious and spiritual conversations across traditions',                      '🛐', 1900, false),
  ('vibes',    'Just Vibes',          'Memes, late-night, random, hot-takes, nostalgia',                              '🎭', 2000, false)
on conflict (slug) do update
  set label = excluded.label,
      description = excluded.description,
      icon = excluded.icon,
      position = excluded.position,
      is_adult = excluded.is_adult;

-- ============================================================================
-- 2. Subcategories
-- ============================================================================
insert into public.room_subcategories (category_slug, slug, label, position) values
  -- India
  ('india', 'metros',        'Metros',                   100),
  ('india', 'south',          'South India',              200),
  ('india', 'north',          'North India',              300),
  ('india', 'west',           'West India',               400),
  ('india', 'east',           'East India',               500),
  ('india', 'northeast',      'Northeast',                600),
  ('india', 'chennai-deep',   'Chennai · Deep cuts',      150),
  -- Global
  ('global', 'north-america', 'North America',            100),
  ('global', 'europe',        'Europe',                   200),
  ('global', 'mena',          'Middle East & N. Africa',  300),
  ('global', 'asia',          'Asia',                     400),
  ('global', 'oceania',       'Oceania',                  500),
  ('global', 'africa',        'Africa',                   600),
  ('global', 'south-america', 'South America',            700),
  -- NRI
  ('nri', 'by-language',      'By mother tongue',         100),
  ('nri', 'by-life',          'Life abroad',              200),
  ('nri', 'cross-cutting',    'Cross-cutting',            300),
  -- Students
  ('students', 'iits-iims',   'IITs · IIMs',              100),
  ('students', 'exam-prep',   'Exam prep',                200),
  ('students', 'campus-life', 'Campus life',              300),
  ('students', 'international','Studying abroad',         400),
  ('students', 'office-hours','Office hours',             500),
  -- Career
  ('career', 'software',      'Software',                 100),
  ('career', 'finance',       'Finance',                  200),
  ('career', 'medicine',      'Medicine',                 300),
  ('career', 'law',           'Law',                      400),
  ('career', 'creative',      'Creative industries',      500),
  ('career', 'cross-cutting', 'Cross-cutting',            600),
  -- Money
  ('money', 'trading',        'Trading',                  100),
  ('money', 'investing',      'Investing',                200),
  ('money', 'personal',       'Personal finance',         300),
  ('money', 'business',       'Business & founders',      400),
  -- Travel
  ('travel', 'trekking',      'Trekking',                 100),
  ('travel', 'travel',        'Travel & nomad life',      200),
  ('travel', 'outdoor',       'Outdoor sports',           300),
  -- Dating
  ('dating', 'singles',       'Singles',                  100),
  ('dating', 'queer',         'Queer dating',             200),
  ('dating', 'meet-now',      'Date / activity buddy',    300),
  ('dating', 'adult',         'Adult · 18+',              900),
  -- Events
  ('events', 'india',         'India · annual',           100),
  ('events', 'global',        'Global · annual',          200),
  ('events', 'nightlife',     'Nightlife & parties',      300),
  ('events', 'music-live',    'Live music',               400),
  -- Games
  ('games', 'fps',            'FPS / shooters',           100),
  ('games', 'mmo-rpg',        'MMO / RPG',                200),
  ('games', 'mobile',         'Mobile',                   300),
  ('games', 'tabletop',       'Tabletop & TCG',           400),
  ('games', 'esports',        'Esports & streaming',      500),
  -- Music
  ('music', 'by-genre',       'By genre',                 100),
  ('music', 'by-language',    'By language',              200),
  ('music', 'making-music',   'Making music',             300),
  -- Arts
  ('arts', 'visual',          'Visual art',               100),
  ('arts', 'photography',     'Photography',              200),
  ('arts', 'writing',         'Writing',                  300),
  ('arts', 'film',            'Film & video',             400),
  ('arts', 'crafts',          'Crafts',                   500),
  -- Food
  ('food', 'indian',          'Indian cuisines',          100),
  ('food', 'global',          'Global cuisines',          200),
  ('food', 'home-cooks',      'Home cooks',               300),
  ('food', 'drinks',          'Drinks',                   400),
  -- Health
  ('health', 'fitness',       'Fitness',                  100),
  ('health', 'mental',        'Mental health',            200),
  ('health', 'womens',        'Women''s health',          300),
  ('health', 'recovery',      'Recovery & support',       400),
  -- LGBTQ
  ('lgbtq', 'by-language',    'By mother tongue',         100),
  ('lgbtq', 'by-life',        'By life stage',            200),
  ('lgbtq', 'support',        'Support',                  300),
  -- Tech
  ('tech', 'web-dev',         'Web dev',                  100),
  ('tech', 'ai',              'AI & data',                200),
  ('tech', 'security',        'Security',                 300),
  ('tech', 'devops',          'DevOps / cloud',           400),
  ('tech', 'indie',           'Indie hackers',            500),
  -- Pets
  ('pets', 'dogs',            'Dogs',                     100),
  ('pets', 'cats',            'Cats',                     200),
  ('pets', 'other',           'Other animals',            300),
  -- Books
  ('books', 'fiction',        'Fiction',                  100),
  ('books', 'non-fiction',    'Non-fiction',              200),
  ('books', 'languages',      'Learning languages',       300),
  ('books', 'history',        'History',                  400),
  ('books', 'science',        'Science',                  500),
  -- Faith
  ('faith', 'hindu',          'Hindu traditions',         100),
  ('faith', 'abrahamic',      'Abrahamic',                200),
  ('faith', 'dharmic',        'Dharmic (others)',         300),
  ('faith', 'secular',        'Secular & humanist',       400),
  -- Vibes
  ('vibes', 'memes',          'Memes',                    100),
  ('vibes', 'late-night',     'Late night',               200),
  ('vibes', 'media',          'Movies & shows',           300),
  ('vibes', 'random',         'Random',                   400)
on conflict (category_slug, slug) do update
  set label = excluded.label, position = excluded.position;

-- ============================================================================
-- 3. Rooms — curated seed across all 20 categories
-- Using ensure_official_room for idempotency.
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- India · metros + chennai deep cuts
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('india','metros','chennai-lobby:1','Everyone in Chennai. Pull up a chair.');
select public.ensure_official_room('india','metros','chennai-late-night:1','11pm onwards. Quieter, slower, weirder.');
select public.ensure_official_room('india','metros','chennai-foodies:1','Where to eat in Chennai right now.');
select public.ensure_official_room('india','metros','chennai-queer:1','Queer-friendly Chennai — all welcome.');
select public.ensure_official_room('india','metros','chennai-newcomers:1','Just moved? Ask anything.');
select public.ensure_official_room('india','metros','chennai-singles:1','Single in Chennai — friendship-first OK.');
select public.ensure_official_room('india','metros','chennai-events:1','What''s happening this week.');
select public.ensure_official_room('india','metros','chennai-traffic-rant:1','Universal Chennai catharsis.');
select public.ensure_official_room('india','metros','chennai-weekend-plans:1','Friday-Sunday coordination.');
select public.ensure_official_room('india','metros','chennai-coworking:1','Remote workers + freelancers IRL meetups.');

select public.ensure_official_room('india','metros','mumbai-lobby:1','Aamchi Mumbai. Everyone welcome.');
select public.ensure_official_room('india','metros','mumbai-late-night:1','11pm onwards. Insomnia capital.');
select public.ensure_official_room('india','metros','mumbai-foodies:1','Where to eat in Mumbai right now.');
select public.ensure_official_room('india','metros','mumbai-queer:1','Queer-friendly Mumbai — all welcome.');
select public.ensure_official_room('india','metros','mumbai-locals-train:1','Local-train survivors only.');
select public.ensure_official_room('india','metros','mumbai-startup:1','Mumbai tech + startups.');

select public.ensure_official_room('india','metros','bangalore-lobby:1','Namma Bengaluru.');
select public.ensure_official_room('india','metros','bangalore-tech:1','Bangalore tech, off-the-clock.');
select public.ensure_official_room('india','metros','bangalore-foodies:1','Where to eat in Bangalore right now.');
select public.ensure_official_room('india','metros','bangalore-queer:1','Queer-friendly Bangalore — all welcome.');
select public.ensure_official_room('india','metros','bangalore-traffic-rant:1','Outer ring road catharsis.');
select public.ensure_official_room('india','metros','bangalore-runners:1','Cubbon Park, Lalbagh, weekend long runs.');

select public.ensure_official_room('india','metros','delhi-lobby:1','Dilli ka adda.');
select public.ensure_official_room('india','metros','delhi-foodies:1','Where to eat in Delhi right now.');
select public.ensure_official_room('india','metros','delhi-queer:1','Queer-friendly Delhi — all welcome.');
select public.ensure_official_room('india','metros','delhi-aiims-prep:1','AIIMS prep, AIIMSonians, doctors.');
select public.ensure_official_room('india','metros','delhi-startup:1','Delhi-NCR tech + startups.');

select public.ensure_official_room('india','metros','hyderabad-lobby:1','Hyderabad-Secunderabad — all welcome.');
select public.ensure_official_room('india','metros','hyderabad-foodies:1','Biryani-first. Everything-else second.');
select public.ensure_official_room('india','metros','hyderabad-queer:1','Queer-friendly Hyderabad — all welcome.');
select public.ensure_official_room('india','metros','hyderabad-tech:1','HITEC City and adjacent.');

select public.ensure_official_room('india','metros','kolkata-lobby:1','Kolkata adda.');
select public.ensure_official_room('india','metros','kolkata-foodies:1','Mishti, kathi rolls, biryani.');
select public.ensure_official_room('india','metros','kolkata-queer:1','Queer-friendly Kolkata.');
select public.ensure_official_room('india','metros','kolkata-durga-puja:1','Durga Puja year-round chatter.');

select public.ensure_official_room('india','metros','pune-lobby:1','Pune lobby.');
select public.ensure_official_room('india','metros','pune-foodies:1','Where to eat in Pune.');
select public.ensure_official_room('india','metros','pune-coworking:1','Remote workers in Pune.');

select public.ensure_official_room('india','metros','ahmedabad-lobby:1','Amdavad lobby.');
select public.ensure_official_room('india','metros','jaipur-lobby:1','Pink City. Pull up.');
select public.ensure_official_room('india','metros','kochi-lobby:1','Kochi lobby.');
select public.ensure_official_room('india','metros','goa-lobby:1','Goa — locals + nomads.');

-- Chennai deep cuts
select public.ensure_official_room('india','chennai-deep','chennai-besant-nagar:1','Besant Nagar — beach, cafes, dogs.');
select public.ensure_official_room('india','chennai-deep','chennai-mylapore:1','Mylapore — temples, kapaleeshwarar, kapali coffee.');
select public.ensure_official_room('india','chennai-deep','chennai-velachery:1','Velachery — the bridge to ECR.');
select public.ensure_official_room('india','chennai-deep','chennai-omr-techies:1','OMR tech corridor, off-the-clock.');
select public.ensure_official_room('india','chennai-deep','chennai-margazhi:1','December music season chatter.');
select public.ensure_official_room('india','chennai-deep','chennai-pongal:1','Mid-January — pongal panic.');
select public.ensure_official_room('india','chennai-deep','chennai-rains:1','Northeast monsoon survivors.');
select public.ensure_official_room('india','chennai-deep','chennai-marina:1','Marina walks + sunrise.');
select public.ensure_official_room('india','chennai-deep','chennai-iitm:1','IIT Madras students + alumni.');
select public.ensure_official_room('india','chennai-deep','chennai-dosa-debate:1','Murugan vs Adyar vs Hot Chips. Settle it.');
select public.ensure_official_room('india','chennai-deep','chennai-filter-coffee:1','Decoction debates.');
select public.ensure_official_room('india','chennai-deep','chennai-tamil-lit:1','Tamil writing, sangam to now.');
select public.ensure_official_room('india','chennai-deep','chennai-carnatic:1','Carnatic music — kutcheri-curious to nerds.');

-- ──────────────────────────────────────────────────────────────────────────
-- India · south / north / west / east / northeast (one lobby each)
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('india','south','coimbatore-lobby:1','Coimbatore — Kovai pull-up.');
select public.ensure_official_room('india','south','madurai-lobby:1','Madurai — meenakshi madness.');
select public.ensure_official_room('india','south','trichy-lobby:1','Trichy lobby.');
select public.ensure_official_room('india','south','tirunelveli-lobby:1','Tirunelveli halwa enjoyers.');
select public.ensure_official_room('india','south','mysuru-lobby:1','Mysuru — palace town vibes.');
select public.ensure_official_room('india','south','mangaluru-lobby:1','Mangaluru lobby.');
select public.ensure_official_room('india','south','thiruvananthapuram-lobby:1','Thiruvananthapuram lobby.');
select public.ensure_official_room('india','south','kozhikode-lobby:1','Kozhikode lobby.');
select public.ensure_official_room('india','south','visakhapatnam-lobby:1','Vizag lobby.');
select public.ensure_official_room('india','south','vijayawada-lobby:1','Vijayawada lobby.');

select public.ensure_official_room('india','north','lucknow-lobby:1','Lucknow lobby.');
select public.ensure_official_room('india','north','varanasi-lobby:1','Banaras — ghats, music, philosophy.');
select public.ensure_official_room('india','north','agra-lobby:1','Agra lobby.');
select public.ensure_official_room('india','north','chandigarh-lobby:1','Chandigarh lobby.');
select public.ensure_official_room('india','north','amritsar-lobby:1','Amritsar lobby.');
select public.ensure_official_room('india','north','dehradun-lobby:1','Dehradun lobby.');
select public.ensure_official_room('india','north','jammu-srinagar-lobby:1','J&K lobby.');

select public.ensure_official_room('india','west','surat-lobby:1','Surat lobby.');
select public.ensure_official_room('india','west','udaipur-lobby:1','Udaipur lobby.');
select public.ensure_official_room('india','west','jodhpur-lobby:1','Jodhpur lobby.');
select public.ensure_official_room('india','west','nagpur-lobby:1','Nagpur lobby.');
select public.ensure_official_room('india','west','nashik-lobby:1','Nashik lobby.');

select public.ensure_official_room('india','east','bhubaneswar-lobby:1','Bhubaneswar lobby.');
select public.ensure_official_room('india','east','patna-lobby:1','Patna lobby.');
select public.ensure_official_room('india','east','ranchi-lobby:1','Ranchi lobby.');

select public.ensure_official_room('india','northeast','guwahati-lobby:1','Guwahati lobby.');
select public.ensure_official_room('india','northeast','shillong-lobby:1','Shillong lobby.');
select public.ensure_official_room('india','northeast','imphal-lobby:1','Imphal lobby.');
select public.ensure_official_room('india','northeast','aizawl-lobby:1','Aizawl lobby.');
select public.ensure_official_room('india','northeast','kohima-lobby:1','Kohima lobby.');
select public.ensure_official_room('india','northeast','itanagar-lobby:1','Itanagar lobby.');
select public.ensure_official_room('india','northeast','gangtok-lobby:1','Gangtok lobby.');

-- ──────────────────────────────────────────────────────────────────────────
-- Global · metros (one lobby each)
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('global','north-america','nyc-lobby:1','NYC lobby.');
select public.ensure_official_room('global','north-america','sf-bay-lobby:1','SF Bay Area lobby.');
select public.ensure_official_room('global','north-america','la-lobby:1','Los Angeles lobby.');
select public.ensure_official_room('global','north-america','chicago-lobby:1','Chicago lobby.');
select public.ensure_official_room('global','north-america','seattle-lobby:1','Seattle lobby.');
select public.ensure_official_room('global','north-america','austin-lobby:1','Austin lobby.');
select public.ensure_official_room('global','north-america','toronto-lobby:1','Toronto lobby.');
select public.ensure_official_room('global','north-america','vancouver-lobby:1','Vancouver lobby.');
select public.ensure_official_room('global','north-america','montreal-lobby:1','Montréal lobby.');

select public.ensure_official_room('global','europe','london-lobby:1','London lobby.');
select public.ensure_official_room('global','europe','paris-lobby:1','Paris lobby.');
select public.ensure_official_room('global','europe','berlin-lobby:1','Berlin lobby.');
select public.ensure_official_room('global','europe','amsterdam-lobby:1','Amsterdam lobby.');
select public.ensure_official_room('global','europe','barcelona-lobby:1','Barcelona lobby.');
select public.ensure_official_room('global','europe','madrid-lobby:1','Madrid lobby.');
select public.ensure_official_room('global','europe','lisbon-lobby:1','Lisbon lobby.');
select public.ensure_official_room('global','europe','dublin-lobby:1','Dublin lobby.');
select public.ensure_official_room('global','europe','stockholm-lobby:1','Stockholm lobby.');
select public.ensure_official_room('global','europe','warsaw-lobby:1','Warsaw lobby.');

select public.ensure_official_room('global','mena','dubai-lobby:1','Dubai lobby.');
select public.ensure_official_room('global','mena','abu-dhabi-lobby:1','Abu Dhabi lobby.');
select public.ensure_official_room('global','mena','doha-lobby:1','Doha lobby.');
select public.ensure_official_room('global','mena','riyadh-lobby:1','Riyadh lobby.');
select public.ensure_official_room('global','mena','istanbul-lobby:1','Istanbul lobby.');
select public.ensure_official_room('global','mena','cairo-lobby:1','Cairo lobby.');
select public.ensure_official_room('global','mena','tel-aviv-lobby:1','Tel Aviv lobby.');

select public.ensure_official_room('global','asia','singapore-lobby:1','Singapore lobby.');
select public.ensure_official_room('global','asia','tokyo-lobby:1','Tokyo lobby.');
select public.ensure_official_room('global','asia','seoul-lobby:1','Seoul lobby.');
select public.ensure_official_room('global','asia','hong-kong-lobby:1','Hong Kong lobby.');
select public.ensure_official_room('global','asia','bangkok-lobby:1','Bangkok lobby.');
select public.ensure_official_room('global','asia','kuala-lumpur-lobby:1','Kuala Lumpur lobby.');
select public.ensure_official_room('global','asia','jakarta-lobby:1','Jakarta lobby.');
select public.ensure_official_room('global','asia','bali-lobby:1','Bali — nomads + locals.');
select public.ensure_official_room('global','asia','manila-lobby:1','Manila lobby.');
select public.ensure_official_room('global','asia','ho-chi-minh-lobby:1','Saigon lobby.');
select public.ensure_official_room('global','asia','karachi-lobby:1','Karachi lobby.');
select public.ensure_official_room('global','asia','dhaka-lobby:1','Dhaka lobby.');
select public.ensure_official_room('global','asia','colombo-lobby:1','Colombo lobby.');
select public.ensure_official_room('global','asia','kathmandu-lobby:1','Kathmandu lobby.');

select public.ensure_official_room('global','oceania','sydney-lobby:1','Sydney lobby.');
select public.ensure_official_room('global','oceania','melbourne-lobby:1','Melbourne lobby.');
select public.ensure_official_room('global','oceania','auckland-lobby:1','Auckland lobby.');

select public.ensure_official_room('global','africa','lagos-lobby:1','Lagos lobby.');
select public.ensure_official_room('global','africa','nairobi-lobby:1','Nairobi lobby.');
select public.ensure_official_room('global','africa','cape-town-lobby:1','Cape Town lobby.');
select public.ensure_official_room('global','africa','johannesburg-lobby:1','Joburg lobby.');

select public.ensure_official_room('global','south-america','sao-paulo-lobby:1','São Paulo lobby.');
select public.ensure_official_room('global','south-america','rio-lobby:1','Rio lobby.');
select public.ensure_official_room('global','south-america','buenos-aires-lobby:1','Buenos Aires lobby.');
select public.ensure_official_room('global','south-america','mexico-city-lobby:1','CDMX lobby.');

-- ──────────────────────────────────────────────────────────────────────────
-- NRI
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('nri','by-language','tamil-diaspora:1','Tamils outside India — find your people.');
select public.ensure_official_room('nri','by-language','telugu-diaspora:1','Telugu diaspora — find your people.');
select public.ensure_official_room('nri','by-language','malayali-diaspora:1','Malayali diaspora.');
select public.ensure_official_room('nri','by-language','kannadiga-diaspora:1','Kannadiga diaspora.');
select public.ensure_official_room('nri','by-language','punjabi-diaspora:1','Punjabi diaspora.');
select public.ensure_official_room('nri','by-language','gujarati-diaspora:1','Gujarati diaspora.');
select public.ensure_official_room('nri','by-language','bengali-diaspora:1','Bengali diaspora.');
select public.ensure_official_room('nri','by-language','marathi-diaspora:1','Marathi diaspora.');
select public.ensure_official_room('nri','by-language','hindi-diaspora:1','Hindi-speaking diaspora.');

select public.ensure_official_room('nri','by-life','nri-h1b-survivors:1','H-1B lottery, transfers, AC21, the whole circus.');
select public.ensure_official_room('nri','by-life','nri-canada-pr:1','Canada PR journey.');
select public.ensure_official_room('nri','by-life','nri-uk-skilled-worker:1','UK skilled-worker visa, sponsorship.');
select public.ensure_official_room('nri','by-life','nri-aussie-pr:1','Australia PR + 482.');
select public.ensure_official_room('nri','by-life','nri-eu-blue-card:1','EU blue card + Schengen labour.');
select public.ensure_official_room('nri','by-life','nri-gulf:1','Life in the Gulf — beyond the visa.');
select public.ensure_official_room('nri','by-life','nri-returning-home:1','Reverse-NRI — coming back to India.');

select public.ensure_official_room('nri','cross-cutting','nri-homesick:1','When India hits hardest. No fixing, just sitting.');
select public.ensure_official_room('nri','cross-cutting','nri-cooking-from-memory:1','Recreating mom''s dishes 12 time zones away.');
select public.ensure_official_room('nri','cross-cutting','nri-raising-desi-kids:1','First-gen, second-gen, third-gen.');
select public.ensure_official_room('nri','cross-cutting','nri-festival-far-from-home:1','Diwali without family, Eid without azaan.');
select public.ensure_official_room('nri','cross-cutting','nri-finance-tax:1','Cross-border tax, FATCA, FBAR, RNOR.');

-- ──────────────────────────────────────────────────────────────────────────
-- Students
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('students','iits-iims','iit-madras:1','IITM students + alumni.');
select public.ensure_official_room('students','iits-iims','iit-bombay:1','IITB students + alumni.');
select public.ensure_official_room('students','iits-iims','iit-delhi:1','IITD students + alumni.');
select public.ensure_official_room('students','iits-iims','iit-kanpur:1','IITK students + alumni.');
select public.ensure_official_room('students','iits-iims','iit-kharagpur:1','IITKgp students + alumni.');
select public.ensure_official_room('students','iits-iims','iit-roorkee:1','IITR students + alumni.');
select public.ensure_official_room('students','iits-iims','iim-ahmedabad:1','IIM-A.');
select public.ensure_official_room('students','iits-iims','iim-bangalore:1','IIM-B.');
select public.ensure_official_room('students','iits-iims','iim-calcutta:1','IIM-C.');

select public.ensure_official_room('students','exam-prep','jee-prep:1','JEE Main + Advanced grind.');
select public.ensure_official_room('students','exam-prep','neet-prep:1','NEET grind.');
select public.ensure_official_room('students','exam-prep','cat-prep:1','CAT/MAT/XAT prep.');
select public.ensure_official_room('students','exam-prep','upsc-prep:1','Civils prep.');
select public.ensure_official_room('students','exam-prep','gate-prep:1','GATE prep.');
select public.ensure_official_room('students','exam-prep','gre-gmat:1','GRE + GMAT.');
select public.ensure_official_room('students','exam-prep','ielts-toefl:1','IELTS / TOEFL / Duolingo.');
select public.ensure_official_room('students','exam-prep','ca-prep:1','CA Foundation / Inter / Final.');
select public.ensure_official_room('students','exam-prep','cfa-frm:1','CFA + FRM.');
select public.ensure_official_room('students','exam-prep','usmle-plab:1','USMLE / PLAB / AMC.');

select public.ensure_official_room('students','campus-life','students-ask-anything:1','Open Q&A — peers + occasional prof drop-ins.');
select public.ensure_official_room('students','campus-life','students-find-a-professor:1','Find a prof to talk to in your field.');
select public.ensure_official_room('students','campus-life','students-research-collab:1','Looking for collaborators.');
select public.ensure_official_room('students','campus-life','students-thesis-help:1','Thesis swamp solidarity.');
select public.ensure_official_room('students','campus-life','students-internship-hunt:1','Internship hunt.');
select public.ensure_official_room('students','campus-life','students-mental-health:1','Burnout, anxiety, you''re not alone.');
select public.ensure_official_room('students','campus-life','students-first-gen:1','First in the family to attend higher ed.');
select public.ensure_official_room('students','campus-life','students-3am-procrastination:1','3am, paper due, here we are.');
select public.ensure_official_room('students','campus-life','students-night-before-exam:1','One last review together.');

select public.ensure_official_room('students','international','students-international:1','Studying abroad — practical talk.');
select public.ensure_official_room('students','international','students-housing-abroad:1','Off-campus housing across countries.');
select public.ensure_official_room('students','international','students-erasmus-exchange:1','Erasmus + exchange semester swap.');

select public.ensure_official_room('students','office-hours','prof-office-hours-cs:1','Rotating verified CS profs.', 'listed', false, false, true, 'professors');
select public.ensure_official_room('students','office-hours','prof-office-hours-econ:1','Verified econ profs.', 'listed', false, false, true, 'professors');
select public.ensure_official_room('students','office-hours','prof-office-hours-medicine:1','Verified medicine profs.', 'listed', false, false, true, 'professors');
select public.ensure_official_room('students','office-hours','prof-office-hours-law:1','Verified law profs.', 'listed', false, false, true, 'professors');

-- ──────────────────────────────────────────────────────────────────────────
-- Career
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('career','software','frontend-india:1','Frontend dev community.');
select public.ensure_official_room('career','software','backend-india:1','Backend dev community.');
select public.ensure_official_room('career','software','mobile-dev-india:1','iOS + Android devs.');
select public.ensure_official_room('career','software','devops-india:1','DevOps + SRE.');
select public.ensure_official_room('career','software','data-eng-india:1','Data engineers + pipelines.');
select public.ensure_official_room('career','software','senior-engineers-lounge:1','Staff/principal/architect.');

select public.ensure_official_room('career','finance','ib-analysts:1','Investment banking analysts/associates.');
select public.ensure_official_room('career','finance','equity-research:1','Equity research.');
select public.ensure_official_room('career','finance','pe-vc:1','PE + VC investors.');
select public.ensure_official_room('career','finance','risk-compliance:1','Risk, compliance, audit.');

select public.ensure_official_room('career','medicine','doctors-residency:1','Residents — survive together.');
select public.ensure_official_room('career','medicine','doctors-pg-prep:1','Doctors prepping for PG.');
select public.ensure_official_room('career','medicine','nurses-india:1','Nurses + allied health.');

select public.ensure_official_room('career','law','lawyers-india:1','Lawyers — general lobby.');
select public.ensure_official_room('career','law','litigation:1','Litigators.');
select public.ensure_official_room('career','law','corporate-law:1','Corporate law / M&A.');

select public.ensure_official_room('career','creative','designers-india:1','Designers — UI, UX, product, brand.');
select public.ensure_official_room('career','creative','copywriters-india:1','Copywriters + content writers.');
select public.ensure_official_room('career','creative','filmmakers-india:1','Indie filmmakers + crew.');

select public.ensure_official_room('career','cross-cutting','salary-transparency:1','Anon salary sharing by city + role.');
select public.ensure_official_room('career','cross-cutting','interview-prep:1','Mock interviews + peer prep.');
select public.ensure_official_room('career','cross-cutting','resume-roast:1','Roast & be roasted — kindly.');
select public.ensure_official_room('career','cross-cutting','women-in-tech:1','Women + non-binary in tech.');
select public.ensure_official_room('career','cross-cutting','queer-in-tech:1','Queer folks in tech.');
select public.ensure_official_room('career','cross-cutting','career-pivots:1','Mid-career pivot stories.');
select public.ensure_official_room('career','cross-cutting','unemployed-not-alone:1','Job hunt without isolation.');
select public.ensure_official_room('career','cross-cutting','manager-corner:1','New managers comparing notes.');

-- ──────────────────────────────────────────────────────────────────────────
-- Money
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('money','trading','traders-floor:1','General traders'' lobby.');
select public.ensure_official_room('money','trading','intraday-traders:1','Intraday only.');
select public.ensure_official_room('money','trading','options-traders:1','Options buyers + sellers.');
select public.ensure_official_room('money','trading','options-selling:1','Selling premium — the long game.');
select public.ensure_official_room('money','trading','forex-traders:1','Forex traders.');
select public.ensure_official_room('money','trading','forex-gio4x-style:1','Gentleman''s forex.');
select public.ensure_official_room('money','trading','crypto-traders:1','Crypto spot + futures.');
select public.ensure_official_room('money','trading','algo-traders:1','Algo + systematic traders.');
select public.ensure_official_room('money','trading','mql5-traders:1','MQL5, MT5, EA building.');
select public.ensure_official_room('money','trading','pine-script-traders:1','TradingView Pine Script.');
select public.ensure_official_room('money','trading','trading-psychology:1','The mind game.');
select public.ensure_official_room('money','trading','trading-losses-anonymous:1','Peer support after losses.');
select public.ensure_official_room('money','trading','prop-firm-traders:1','FTMO, MFF, Topstep, etc.');

select public.ensure_official_room('money','investing','long-term-investors:1','Boring, slow, profitable.');
select public.ensure_official_room('money','investing','value-investors:1','Graham + Buffett school.');
select public.ensure_official_room('money','investing','index-fund-bogleheads:1','Three-fund portfolios.');
select public.ensure_official_room('money','investing','mutual-funds-india:1','MFs + SIPs in India.');
select public.ensure_official_room('money','investing','us-stocks-from-india:1','LRS, RSU, ESPP, taxation.');
select public.ensure_official_room('money','investing','reits-invits:1','REITs + InvITs.');
select public.ensure_official_room('money','investing','stressed-assets:1','NPA, special situations, distressed.');
select public.ensure_official_room('money','investing','aif-cat1-cat2-cat3:1','AIF investors + managers.');
select public.ensure_official_room('money','investing','angel-investing:1','Angel investors.');

select public.ensure_official_room('money','personal','personal-finance-india:1','Budgeting, taxes, insurance, the basics.');
select public.ensure_official_room('money','personal','tax-savers:1','80C, 80D, 80CCD — and beyond.');
select public.ensure_official_room('money','personal','fire-india:1','FIRE — Indian flavour.');
select public.ensure_official_room('money','personal','first-job-first-money:1','New paycheque survival guide.');

select public.ensure_official_room('money','business','bootstrappers:1','No VC. No problem.');
select public.ensure_official_room('money','business','d2c-founders:1','D2C brand founders.');
select public.ensure_official_room('money','business','saas-founders:1','SaaS founders.');
select public.ensure_official_room('money','business','solopreneurs:1','Companies of one.');

-- ──────────────────────────────────────────────────────────────────────────
-- Travel
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('travel','trekking','trekkers-india:1','India trekkers'' lobby.');
select public.ensure_official_room('travel','trekking','himalayan-treks:1','Himalayan trails.');
select public.ensure_official_room('travel','trekking','western-ghats-trails:1','Sahyadris + Western Ghats.');
select public.ensure_official_room('travel','trekking','nilgiris-trekking:1','Nilgiris trails.');
select public.ensure_official_room('travel','trekking','solo-trekkers:1','Solo trekkers'' lobby.');
select public.ensure_official_room('travel','trekking','women-trekkers:1','Women trekkers.');
select public.ensure_official_room('travel','trekking','queer-trekkers:1','Queer trekkers.');
select public.ensure_official_room('travel','trekking','monsoon-treks:1','Rainy-season trails.');
select public.ensure_official_room('travel','trekking','everest-base-camp:1','EBC prep + stories.');
select public.ensure_official_room('travel','trekking','gear-talk:1','Boots, bags, jackets, tents.');

select public.ensure_official_room('travel','travel','solo-travelers:1','Solo traveller lobby.');
select public.ensure_official_room('travel','travel','women-solo-travelers:1','Women solo travel.');
select public.ensure_official_room('travel','travel','queer-travelers:1','Queer travel.');
select public.ensure_official_room('travel','travel','digital-nomad-india:1','Indian nomads abroad.');
select public.ensure_official_room('travel','travel','bullet-riders-himalaya:1','Bullet + Royal Enfield Himalaya rides.');
select public.ensure_official_room('travel','travel','backpackers-southeast-asia:1','SE Asia backpacking.');
select public.ensure_official_room('travel','travel','visa-strategies:1','Schengen + every other visa puzzle.');

select public.ensure_official_room('travel','outdoor','scuba-diving:1','Scuba lobby.');
select public.ensure_official_room('travel','outdoor','surfing-india:1','India surfing scene.');
select public.ensure_official_room('travel','outdoor','rock-climbing-india:1','Climbing in India.');
select public.ensure_official_room('travel','outdoor','birdwatchers:1','Birding lobby.');
select public.ensure_official_room('travel','outdoor','running-marathons:1','Marathon prep + race chat.');

-- ──────────────────────────────────────────────────────────────────────────
-- Dating
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('dating','singles','singles-chennai:1','Single in Chennai.');
select public.ensure_official_room('dating','singles','singles-mumbai:1','Single in Mumbai.');
select public.ensure_official_room('dating','singles','singles-bangalore:1','Single in Bangalore.');
select public.ensure_official_room('dating','singles','singles-delhi:1','Single in Delhi-NCR.');
select public.ensure_official_room('dating','singles','singles-30-plus:1','30+ singles.');
select public.ensure_official_room('dating','singles','singles-40-plus:1','40+ singles.');
select public.ensure_official_room('dating','singles','divorcees-dating-again:1','Back in the deep end.');
select public.ensure_official_room('dating','singles','single-parents-dating:1','Single parents dating.');
select public.ensure_official_room('dating','singles','long-distance-relationships:1','LDR survivors.');
select public.ensure_official_room('dating','singles','interfaith-couples:1','Interfaith couples.');

select public.ensure_official_room('dating','queer','gay-men-dating-india:1','Gay men dating in India.');
select public.ensure_official_room('dating','queer','lesbian-dating-india:1','Lesbian dating in India.');
select public.ensure_official_room('dating','queer','bi-dating:1','Bi+ dating.');
select public.ensure_official_room('dating','queer','trans-dating:1','Trans dating + t4t.');
select public.ensure_official_room('dating','queer','queer-platonic:1','Queer platonic partnerships.');
select public.ensure_official_room('dating','queer','ace-dating:1','Ace-spectrum dating.');

select public.ensure_official_room('dating','meet-now','coffee-date-coordination:1','Coffee date — pick a city.');
select public.ensure_official_room('dating','meet-now','concert-buddy:1','Need a concert buddy.');
select public.ensure_official_room('dating','meet-now','movie-buddy:1','Movie buddy tonight.');
select public.ensure_official_room('dating','meet-now','walking-partner:1','Walking partner — by city.');
select public.ensure_official_room('dating','meet-now','gym-buddy:1','Gym buddy.');

-- ──────────────────────────────────────────────────────────────────────────
-- Events
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('events','india','pongal-2026:1','Pongal 2026 — mid-Jan.');
select public.ensure_official_room('events','india','holi-2026:1','Holi 2026 — March chaos.');
select public.ensure_official_room('events','india','onam-2026:1','Onam 2026 — sadhya season.');
select public.ensure_official_room('events','india','diwali-2026:1','Diwali 2026 — October.');
select public.ensure_official_room('events','india','eid-2026:1','Eid 2026.');
select public.ensure_official_room('events','india','durga-puja-2026:1','Durga Puja 2026 — pandal-hopping.');
select public.ensure_official_room('events','india','margazhi-music-season:1','December music season — Chennai.');
select public.ensure_official_room('events','india','jaipur-lit-fest:1','Jaipur Lit Fest chatter.');
select public.ensure_official_room('events','india','nh7-weekender:1','NH7 Weekender + adjacent festivals.');

select public.ensure_official_room('events','global','pride-month-2026:1','June 2026 — global Pride lounge.');
select public.ensure_official_room('events','global','coachella-2026:1','Coachella 2026.');
select public.ensure_official_room('events','global','tomorrowland:1','Tomorrowland chatter.');
select public.ensure_official_room('events','global','burning-man:1','Burning Man.');
select public.ensure_official_room('events','global','olympics-2028:1','LA 2028 — early hype.');

select public.ensure_official_room('events','nightlife','clubbing-tonight-chennai:1','Clubbing tonight — Chennai.');
select public.ensure_official_room('events','nightlife','clubbing-tonight-mumbai:1','Clubbing tonight — Mumbai.');
select public.ensure_official_room('events','nightlife','clubbing-tonight-bangalore:1','Clubbing tonight — Bangalore.');
select public.ensure_official_room('events','nightlife','queer-parties-india:1','Queer parties — India circuit.');
select public.ensure_official_room('events','nightlife','house-parties-india:1','House party coordination.');

select public.ensure_official_room('events','music-live','live-music-tonight-chennai:1','Live music tonight — Chennai.', 'public', true, false);
select public.ensure_official_room('events','music-live','live-music-tonight-mumbai:1','Live music tonight — Mumbai.', 'public', true, false);
select public.ensure_official_room('events','music-live','live-music-tonight-bangalore:1','Live music tonight — Bangalore.', 'public', true, false);
select public.ensure_official_room('events','music-live','ar-rahman-fans:1','AR Rahman fans.', 'public', true, false);
select public.ensure_official_room('events','music-live','arijit-singh-fans:1','Arijit Singh fans.', 'public', true, false);
select public.ensure_official_room('events','music-live','coldplay-india:1','Coldplay India tour.', 'public', true, false);
select public.ensure_official_room('events','music-live','bts-army-india:1','BTS ARMY India.', 'public', true, false);

-- ──────────────────────────────────────────────────────────────────────────
-- Games
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('games','fps','valorant-india:1','Valorant India.', 'public', true, false);
select public.ensure_official_room('games','fps','cs2-players:1','Counter-Strike 2.', 'public', true, false);
select public.ensure_official_room('games','fps','apex-legends:1','Apex Legends.', 'public', true, false);
select public.ensure_official_room('games','fps','cod-mobile:1','CoD Mobile.');

select public.ensure_official_room('games','mmo-rpg','wow-classic:1','WoW Classic.');
select public.ensure_official_room('games','mmo-rpg','ffxiv:1','FFXIV.');
select public.ensure_official_room('games','mmo-rpg','elden-ring:1','Elden Ring + DLC.');
select public.ensure_official_room('games','mmo-rpg','bg3:1','Baldur''s Gate 3.');
select public.ensure_official_room('games','mmo-rpg','the-witcher:1','The Witcher.');

select public.ensure_official_room('games','mobile','bgmi:1','BGMI India.', 'public', true, false);
select public.ensure_official_room('games','mobile','clash-royale:1','Clash Royale.');
select public.ensure_official_room('games','mobile','mobile-gamers:1','Mobile gaming general.');

select public.ensure_official_room('games','tabletop','dnd-5e:1','D&D 5e tables.', 'public', true, false);
select public.ensure_official_room('games','tabletop','chess-india:1','Chess India.');
select public.ensure_official_room('games','tabletop','magic-the-gathering:1','MTG.');
select public.ensure_official_room('games','tabletop','board-game-cafes:1','Board game cafés — by city.');
select public.ensure_official_room('games','tabletop','warhammer-40k:1','40K hobbyists.');

select public.ensure_official_room('games','esports','streamers-india:1','Indian streamers.', 'public', true, false);
select public.ensure_official_room('games','esports','speedrunners:1','Speedrun community.');

-- ──────────────────────────────────────────────────────────────────────────
-- Music
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('music','by-genre','indie-rock:1','Indie + alt-rock.');
select public.ensure_official_room('music','by-genre','metal:1','Metal — all flavours.');
select public.ensure_official_room('music','by-genre','hip-hop:1','Hip-hop heads.');
select public.ensure_official_room('music','by-genre','jazz:1','Jazz lovers.');
select public.ensure_official_room('music','by-genre','electronic:1','Electronic — house, techno, drum & bass.');
select public.ensure_official_room('music','by-genre','lofi-india:1','Lo-fi study/chill.');
select public.ensure_official_room('music','by-genre','classical-western:1','Classical western.');
select public.ensure_official_room('music','by-genre','carnatic:1','Carnatic music nerds.');
select public.ensure_official_room('music','by-genre','hindustani:1','Hindustani classical.');

select public.ensure_official_room('music','by-language','tamil-music:1','Tamil music — folk to film.');
select public.ensure_official_room('music','by-language','hindi-music:1','Hindi music — old & new.');
select public.ensure_official_room('music','by-language','malayalam-music:1','Malayalam music.');
select public.ensure_official_room('music','by-language','telugu-music:1','Telugu music.');
select public.ensure_official_room('music','by-language','kannada-music:1','Kannada music.');
select public.ensure_official_room('music','by-language','bengali-music:1','Bengali music — Rabindrasangeet to indie.');
select public.ensure_official_room('music','by-language','punjabi-music:1','Punjabi music.');
select public.ensure_official_room('music','by-language','kpop-india:1','K-pop India.');
select public.ensure_official_room('music','by-language','jpop-jrock:1','J-pop + J-rock.');

select public.ensure_official_room('music','making-music','producers-bedroom:1','Bedroom producers — share + critique.');
select public.ensure_official_room('music','making-music','songwriters:1','Songwriters circle.');
select public.ensure_official_room('music','making-music','guitar-talk:1','Guitar players.');
select public.ensure_official_room('music','making-music','synth-heads:1','Synthesizers + modular.');
select public.ensure_official_room('music','making-music','ableton-users:1','Ableton Live.');
select public.ensure_official_room('music','making-music','singers-warmup:1','Vocal warm-up partner.', 'public', true, false);

-- ──────────────────────────────────────────────────────────────────────────
-- Arts
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('arts','visual','procreate-artists:1','Procreate artists.');
select public.ensure_official_room('arts','visual','watercolor:1','Watercolour painters.');
select public.ensure_official_room('arts','visual','digital-art:1','Digital art general.');
select public.ensure_official_room('arts','visual','tattoo-artists:1','Tattoo artists + collectors.');
select public.ensure_official_room('arts','visual','indian-folk-art:1','Madhubani, Warli, Kalamkari, Pattachitra.');

select public.ensure_official_room('arts','photography','street-photography:1','Street photographers.');
select public.ensure_official_room('arts','photography','portrait-photography:1','Portrait photographers.');
select public.ensure_official_room('arts','photography','wildlife-photography:1','Wildlife photographers.');
select public.ensure_official_room('arts','photography','film-photography:1','Film + analog.');

select public.ensure_official_room('arts','writing','writers-room:1','Writers room — open to anyone writing anything.');
select public.ensure_official_room('arts','writing','poetry-india:1','Indian poetry — page + spoken.');
select public.ensure_official_room('arts','writing','urdu-poetry:1','Urdu poetry, ghazals, nazms.');
select public.ensure_official_room('arts','writing','tamil-poetry:1','Tamil poetry.');
select public.ensure_official_room('arts','writing','sci-fi-fantasy-writers:1','SFF writers.');
select public.ensure_official_room('arts','writing','romance-writers:1','Romance writers.');

select public.ensure_official_room('arts','film','indie-film-india:1','Indie film India.');
select public.ensure_official_room('arts','film','tamil-cinema:1','Tamil cinema.');
select public.ensure_official_room('arts','film','malayalam-new-wave:1','Malayalam new wave.');
select public.ensure_official_room('arts','film','world-cinema:1','World cinema.');
select public.ensure_official_room('arts','film','anime-india:1','Anime India.');

select public.ensure_official_room('arts','crafts','knitting-india:1','Knitters + crocheters.');
select public.ensure_official_room('arts','crafts','pottery:1','Pottery + ceramics.');
select public.ensure_official_room('arts','crafts','calligraphy:1','Calligraphy — all scripts.');
select public.ensure_official_room('arts','crafts','jewelry-makers:1','Jewellery makers.');

-- ──────────────────────────────────────────────────────────────────────────
-- Food
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('food','indian','tamil-cooking:1','Tamil home cooking.');
select public.ensure_official_room('food','indian','chettinad:1','Chettinad cuisine.');
select public.ensure_official_room('food','indian','andhra-cooking:1','Andhra cuisine.');
select public.ensure_official_room('food','indian','kerala-cooking:1','Kerala cuisine.');
select public.ensure_official_room('food','indian','bengali-cooking:1','Bengali cuisine.');
select public.ensure_official_room('food','indian','punjabi-cooking:1','Punjabi cuisine.');
select public.ensure_official_room('food','indian','gujarati-cooking:1','Gujarati cuisine.');
select public.ensure_official_room('food','indian','hyderabadi:1','Hyderabadi cuisine.');

select public.ensure_official_room('food','global','italian-cooking:1','Italian cooking.');
select public.ensure_official_room('food','global','thai-cooking:1','Thai cooking.');
select public.ensure_official_room('food','global','japanese-cooking:1','Japanese cooking.');
select public.ensure_official_room('food','global','korean-cooking:1','Korean cooking.');
select public.ensure_official_room('food','global','mexican-cooking:1','Mexican cooking.');

select public.ensure_official_room('food','home-cooks','home-bakers:1','Home bakers — bread, cake, all of it.');
select public.ensure_official_room('food','home-cooks','sourdough-india:1','Sourdough India.');
select public.ensure_official_room('food','home-cooks','meal-prep:1','Meal prep weekly.');
select public.ensure_official_room('food','home-cooks','bachelor-cooking:1','Bachelor cooking — quick + cheap.');
select public.ensure_official_room('food','home-cooks','vegan-india:1','Vegan India.');
select public.ensure_official_room('food','home-cooks','keto-india:1','Keto India.');

select public.ensure_official_room('food','drinks','filter-coffee-debate:1','Decoction debates.');
select public.ensure_official_room('food','drinks','chai-purists:1','Chai purists.');
select public.ensure_official_room('food','drinks','craft-beer-india:1','Craft beer India.');
select public.ensure_official_room('food','drinks','whisky-lovers:1','Whisky lovers.');
select public.ensure_official_room('food','drinks','cocktail-bartenders:1','Cocktail nerds.');

-- ──────────────────────────────────────────────────────────────────────────
-- Health
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('health','fitness','gym-rats:1','Gym general.');
select public.ensure_official_room('health','fitness','powerlifting:1','Powerlifting.');
select public.ensure_official_room('health','fitness','calisthenics:1','Calisthenics + bodyweight.');
select public.ensure_official_room('health','fitness','running-india:1','Running India.');
select public.ensure_official_room('health','fitness','yoga-india:1','Yoga India.');
select public.ensure_official_room('health','fitness','bjj-india:1','BJJ India.');
select public.ensure_official_room('health','fitness','boxing-india:1','Boxing India.');
select public.ensure_official_room('health','fitness','cycling-india:1','Cycling India.');
select public.ensure_official_room('health','fitness','swimming:1','Swimmers'' lobby.');

select public.ensure_official_room('health','mental','mental-health-india:1','Peer mental health support.');
select public.ensure_official_room('health','mental','therapy-talk:1','Therapy — talking about going.');
select public.ensure_official_room('health','mental','anxiety-support:1','Anxiety peer support.');
select public.ensure_official_room('health','mental','adhd-india:1','ADHD adults India.');
select public.ensure_official_room('health','mental','autism-adult-india:1','Autistic adults India.');
select public.ensure_official_room('health','mental','meditation-india:1','Meditation + mindfulness.');

select public.ensure_official_room('health','womens','womens-health:1','Women''s health lobby.');
select public.ensure_official_room('health','womens','pcos-pcod-support:1','PCOS / PCOD support.');
select public.ensure_official_room('health','womens','endo-warriors:1','Endometriosis peer support.');
select public.ensure_official_room('health','womens','menopause-india:1','Menopause India.');

select public.ensure_official_room('health','recovery','sober-curious:1','Sober + sober-curious.');
select public.ensure_official_room('health','recovery','addiction-recovery:1','Addiction recovery peer support.');
select public.ensure_official_room('health','recovery','grief-india:1','Grief — all kinds.');
select public.ensure_official_room('health','recovery','pet-loss:1','Pet loss.');
select public.ensure_official_room('health','recovery','caregivers:1','Caregivers — elderly + chronic.');
select public.ensure_official_room('health','recovery','survivors-of-abuse:1','Survivors of abuse — peer-only.', 'listed');

-- ──────────────────────────────────────────────────────────────────────────
-- LGBTQ
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('lgbtq','by-language','queer-tamil:1','Queer Tamil-speakers.');
select public.ensure_official_room('lgbtq','by-language','queer-malayali:1','Queer Malayali-speakers.');
select public.ensure_official_room('lgbtq','by-language','queer-telugu:1','Queer Telugu-speakers.');
select public.ensure_official_room('lgbtq','by-language','queer-bengali:1','Queer Bengali-speakers.');
select public.ensure_official_room('lgbtq','by-language','queer-punjabi:1','Queer Punjabi-speakers.');
select public.ensure_official_room('lgbtq','by-language','queer-marathi:1','Queer Marathi-speakers.');
select public.ensure_official_room('lgbtq','by-language','queer-hindi-belt:1','Queer Hindi-belt.');
select public.ensure_official_room('lgbtq','by-language','queer-northeast:1','Queer Northeast.');

select public.ensure_official_room('lgbtq','by-life','queer-parents:1','Queer parents.');
select public.ensure_official_room('lgbtq','by-life','queer-elders:1','Queer 50+.');
select public.ensure_official_room('lgbtq','by-life','queer-small-town:1','Queer in a small town.');
select public.ensure_official_room('lgbtq','by-life','queer-friendship:1','Queer platonic friendship.');
select public.ensure_official_room('lgbtq','by-life','chosen-family:1','Chosen family.');

select public.ensure_official_room('lgbtq','support','coming-out-india:1','Coming out — in India.');
select public.ensure_official_room('lgbtq','support','still-in-closet:1','Still closeted — safe.', 'listed');
select public.ensure_official_room('lgbtq','support','out-to-family:1','Out to family stories.');
select public.ensure_official_room('lgbtq','support','out-at-work:1','Out at work stories.');
select public.ensure_official_room('lgbtq','support','trans-health:1','Trans health peer support.');
select public.ensure_official_room('lgbtq','support','hrt-talk:1','HRT — peer info.');
select public.ensure_official_room('lgbtq','support','intersex-india:1','Intersex India.');
select public.ensure_official_room('lgbtq','support','ace-aro-india:1','Ace + aro India.');

-- ──────────────────────────────────────────────────────────────────────────
-- Tech
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('tech','web-dev','react-india:1','React + Next.js India.');
select public.ensure_official_room('tech','web-dev','vue-svelte:1','Vue + Svelte.');
select public.ensure_official_room('tech','web-dev','nextjs:1','Next.js power-users.');
select public.ensure_official_room('tech','web-dev','postgres-talk:1','Postgres lovers.');
select public.ensure_official_room('tech','web-dev','rust-india:1','Rust India.');
select public.ensure_official_room('tech','web-dev','golang:1','Go programmers.');

select public.ensure_official_room('tech','ai','ai-builders:1','AI builders general.');
select public.ensure_official_room('tech','ai','prompt-engineers:1','Prompt engineering.');
select public.ensure_official_room('tech','ai','claude-power-users:1','Claude power-users.');
select public.ensure_official_room('tech','ai','chatgpt-power-users:1','ChatGPT power-users.');
select public.ensure_official_room('tech','ai','local-llm:1','Local + open-source LLMs.');
select public.ensure_official_room('tech','ai','ollama-users:1','Ollama users.');
select public.ensure_official_room('tech','ai','huggingface-india:1','Hugging Face India.');

select public.ensure_official_room('tech','security','security-india:1','Security general.');
select public.ensure_official_room('tech','security','bug-bounty:1','Bug bounty hunters.');
select public.ensure_official_room('tech','security','ctf-india:1','CTF teams India.');
select public.ensure_official_room('tech','security','appsec:1','App security.');

select public.ensure_official_room('tech','devops','aws-india:1','AWS India.');
select public.ensure_official_room('tech','devops','gcp-india:1','GCP India.');
select public.ensure_official_room('tech','devops','kubernetes-india:1','Kubernetes India.');
select public.ensure_official_room('tech','devops','docker-talk:1','Docker general.');
select public.ensure_official_room('tech','devops','terraform-talk:1','Terraform / IaC.');

select public.ensure_official_room('tech','indie','indie-hackers-india:1','Indie hackers India.');
select public.ensure_official_room('tech','indie','nocode-india:1','No-code builders.');
select public.ensure_official_room('tech','indie','solo-game-devs:1','Solo game devs.');
select public.ensure_official_room('tech','indie','arduino-india:1','Arduino + ESP32 + makers.');

-- ──────────────────────────────────────────────────────────────────────────
-- Pets
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('pets','dogs','dog-parents-india:1','Dog parents — general.');
select public.ensure_official_room('pets','dogs','indie-dogs:1','Indie dog parents.');
select public.ensure_official_room('pets','dogs','labradors:1','Labrador parents.');
select public.ensure_official_room('pets','dogs','golden-retrievers:1','Golden retriever parents.');
select public.ensure_official_room('pets','dogs','german-shepherds:1','GSD parents.');
select public.ensure_official_room('pets','dogs','street-dog-feeders:1','Street-dog feeders + rescuers.');

select public.ensure_official_room('pets','cats','cat-parents-india:1','Cat parents — general.');
select public.ensure_official_room('pets','cats','street-cats-india:1','Street cats + colony feeders.');

select public.ensure_official_room('pets','other','fish-keepers:1','Aquarium keepers.');
select public.ensure_official_room('pets','other','planted-tanks:1','Planted tanks.');
select public.ensure_official_room('pets','other','bird-keepers:1','Bird keepers.');
select public.ensure_official_room('pets','other','rabbit-parents:1','Rabbit parents.');
select public.ensure_official_room('pets','other','reptile-keepers:1','Reptile keepers.');
select public.ensure_official_room('pets','other','animal-rescue-india:1','Animal rescue volunteers India.');
select public.ensure_official_room('pets','other','pet-loss-grief:1','Pet loss — soft space.');

-- ──────────────────────────────────────────────────────────────────────────
-- Books
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('books','fiction','lit-fic:1','Literary fiction.');
select public.ensure_official_room('books','fiction','sci-fi:1','Sci-fi readers.');
select public.ensure_official_room('books','fiction','fantasy:1','Fantasy readers.');
select public.ensure_official_room('books','fiction','romance:1','Romance readers.');
select public.ensure_official_room('books','fiction','romantasy:1','Romantasy boom.');
select public.ensure_official_room('books','fiction','mystery-thriller:1','Mystery + thriller.');
select public.ensure_official_room('books','fiction','horror:1','Horror.');
select public.ensure_official_room('books','fiction','queer-fic:1','Queer fiction.');
select public.ensure_official_room('books','fiction','indian-writing:1','Indian writing in English.');
select public.ensure_official_room('books','fiction','tamil-lit:1','Tamil literature.');
select public.ensure_official_room('books','fiction','malayalam-lit:1','Malayalam literature.');

select public.ensure_official_room('books','non-fiction','memoir-biography:1','Memoir + biography.');
select public.ensure_official_room('books','non-fiction','philosophy-india:1','Philosophy — Indian + global.');
select public.ensure_official_room('books','non-fiction','popular-science:1','Popular science.');
select public.ensure_official_room('books','non-fiction','self-help-honest:1','Self-help (honest discussion).');

select public.ensure_official_room('books','languages','learn-tamil:1','Learning Tamil.');
select public.ensure_official_room('books','languages','learn-hindi:1','Learning Hindi.');
select public.ensure_official_room('books','languages','learn-sanskrit:1','Learning Sanskrit.');
select public.ensure_official_room('books','languages','learn-japanese:1','Learning Japanese.');
select public.ensure_official_room('books','languages','learn-korean:1','Learning Korean.');
select public.ensure_official_room('books','languages','learn-spanish:1','Learning Spanish.');
select public.ensure_official_room('books','languages','learn-french:1','Learning French.');
select public.ensure_official_room('books','languages','learn-german:1','Learning German.');
select public.ensure_official_room('books','languages','learn-arabic:1','Learning Arabic.');
select public.ensure_official_room('books','languages','learn-mandarin:1','Learning Mandarin.');

select public.ensure_official_room('books','history','indian-history:1','Indian history.');
select public.ensure_official_room('books','history','ancient-india:1','Ancient India.');
select public.ensure_official_room('books','history','partition-stories:1','Partition stories.');
select public.ensure_official_room('books','history','world-history:1','World history.');
select public.ensure_official_room('books','history','ww2:1','WW2 buffs.');

select public.ensure_official_room('books','science','astrophysics:1','Astrophysics nerds.');
select public.ensure_official_room('books','science','neuroscience:1','Neuroscience.');
select public.ensure_official_room('books','science','genetics:1','Genetics + bio.');
select public.ensure_official_room('books','science','math-recreational:1','Recreational math.');

-- ──────────────────────────────────────────────────────────────────────────
-- Faith
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('faith','hindu','hindu-philosophy:1','Hindu philosophy discussion.');
select public.ensure_official_room('faith','hindu','vedanta:1','Vedanta study.');
select public.ensure_official_room('faith','hindu','tamil-saivism:1','Tamil Saiva tradition.');
select public.ensure_official_room('faith','hindu','vaishnavism:1','Vaishnavism.');
select public.ensure_official_room('faith','hindu','shaktism:1','Shakta traditions.');

select public.ensure_official_room('faith','abrahamic','islam-in-india:1','Islam in India.');
select public.ensure_official_room('faith','abrahamic','sufi-traditions:1','Sufi traditions.');
select public.ensure_official_room('faith','abrahamic','christianity-in-india:1','Christianity in India.');
select public.ensure_official_room('faith','abrahamic','catholic-india:1','Catholic India.');
select public.ensure_official_room('faith','abrahamic','mar-thoma:1','Mar Thoma + Syriac.');

select public.ensure_official_room('faith','dharmic','sikh-faith:1','Sikh faith + Gurbani.');
select public.ensure_official_room('faith','dharmic','jain-philosophy:1','Jain philosophy.');
select public.ensure_official_room('faith','dharmic','buddhism-discussion:1','Buddhism general.');
select public.ensure_official_room('faith','dharmic','ambedkarite-buddhism:1','Ambedkarite Buddhism.');
select public.ensure_official_room('faith','dharmic','zen:1','Zen practice.');

select public.ensure_official_room('faith','secular','agnostic-india:1','Agnostic India.');
select public.ensure_official_room('faith','secular','atheist-india:1','Atheist India.');
select public.ensure_official_room('faith','secular','ex-religious:1','Ex-religious — peer support.', 'listed');
select public.ensure_official_room('faith','secular','interfaith-dialogue:1','Interfaith dialogue.');

-- ──────────────────────────────────────────────────────────────────────────
-- Vibes
-- ──────────────────────────────────────────────────────────────────────────
select public.ensure_official_room('vibes','memes','memes-india:1','India memes — fresh + dank.');
select public.ensure_official_room('vibes','memes','tamil-memes:1','Tamil memes.');
select public.ensure_official_room('vibes','memes','malayali-memes:1','Malayali memes.');
select public.ensure_official_room('vibes','memes','bong-memes:1','Bong memes.');
select public.ensure_official_room('vibes','memes','bollywood-memes:1','Bollywood memes.');

select public.ensure_official_room('vibes','late-night','3am-thoughts:1','3am thoughts.');
select public.ensure_official_room('vibes','late-night','cant-sleep:1','Can''t sleep — talk to me.');
select public.ensure_official_room('vibes','late-night','existential-3am:1','Existential 3am.');
select public.ensure_official_room('vibes','late-night','vent-space:1','Vent space — no fixing.');

select public.ensure_official_room('vibes','media','tv-discussion:1','TV discussion — all shows.');
select public.ensure_official_room('vibes','media','succession-india:1','Succession + heir-themed media.');
select public.ensure_official_room('vibes','media','severance-india:1','Severance — innies + outies.');
select public.ensure_official_room('vibes','media','heeramandi:1','Heeramandi + period dramas.');
select public.ensure_official_room('vibes','media','panchayat-india:1','Panchayat fans.');
select public.ensure_official_room('vibes','media','k-drama-india:1','K-drama India.');
select public.ensure_official_room('vibes','media','c-drama-india:1','C-drama India.');
select public.ensure_official_room('vibes','media','anime-india:1','Anime India.');
select public.ensure_official_room('vibes','media','studio-ghibli:1','Studio Ghibli softness.');
select public.ensure_official_room('vibes','media','criterion-collection:1','Criterion Collection nerds.');

select public.ensure_official_room('vibes','random','hot-takes:1','Hot takes — defend them.');
select public.ensure_official_room('vibes','random','unpopular-opinions:1','Unpopular opinions.');
select public.ensure_official_room('vibes','random','change-my-view:1','Change my view — kindly.');
select public.ensure_official_room('vibes','random','random-strangers:1','Random strangers — say hi.');
select public.ensure_official_room('vibes','random','talk-to-anyone:1','Talk to anyone, no agenda.');
select public.ensure_official_room('vibes','random','bored-and-online:1','Bored + online.');
select public.ensure_official_room('vibes','random','nostalgia-90s-india:1','90s India nostalgia.');
select public.ensure_official_room('vibes','random','2000s-kids-india:1','2000s kids unite.');
select public.ensure_official_room('vibes','random','yahoo-messenger-veterans:1','Yahoo Messenger survivors.');
select public.ensure_official_room('vibes','random','procrastination-station:1','Procrastinators united.');
