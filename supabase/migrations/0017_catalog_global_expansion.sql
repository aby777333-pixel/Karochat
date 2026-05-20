-- Karochat — v12 Wave 9: expand the global catalog.
-- For every existing global metro, fill out the standard 6-pack
-- (lobby + late-night + foodies + queer + newcomers + events), then add
-- a second tier of cities + country-level lobbies for places not yet seeded.
-- Idempotent — ensure_official_room keys on (category, subcategory, name).
-- Run AFTER 0016_catalog_seed.sql.

-- ============================================================================
-- 1. Round out existing North America metros to the standard 6-pack
-- ============================================================================
select public.ensure_official_room('global','north-america','nyc-late-night:1','11pm onwards NYC.');
select public.ensure_official_room('global','north-america','nyc-foodies:1','Where to eat in NYC right now.');
select public.ensure_official_room('global','north-america','nyc-queer:1','Queer-friendly NYC — all welcome.');
select public.ensure_official_room('global','north-america','nyc-newcomers:1','Just moved to NYC? Ask anything.');
select public.ensure_official_room('global','north-america','nyc-events:1','What''s happening this week in NYC.');

select public.ensure_official_room('global','north-america','sf-bay-late-night:1','11pm onwards SF Bay.');
select public.ensure_official_room('global','north-america','sf-bay-foodies:1','Where to eat in SF Bay right now.');
select public.ensure_official_room('global','north-america','sf-bay-queer:1','Queer-friendly SF Bay.');
select public.ensure_official_room('global','north-america','sf-bay-newcomers:1','Just moved to SF? Ask anything.');
select public.ensure_official_room('global','north-america','sf-bay-events:1','What''s happening this week — SF.');

select public.ensure_official_room('global','north-america','la-late-night:1','11pm onwards LA.');
select public.ensure_official_room('global','north-america','la-foodies:1','Where to eat in LA right now.');
select public.ensure_official_room('global','north-america','la-queer:1','Queer-friendly LA.');
select public.ensure_official_room('global','north-america','la-events:1','What''s happening this week — LA.');

select public.ensure_official_room('global','north-america','chicago-late-night:1','11pm onwards Chicago.');
select public.ensure_official_room('global','north-america','chicago-foodies:1','Where to eat in Chicago.');
select public.ensure_official_room('global','north-america','chicago-queer:1','Queer-friendly Chicago.');

select public.ensure_official_room('global','north-america','seattle-late-night:1','11pm onwards Seattle.');
select public.ensure_official_room('global','north-america','seattle-foodies:1','Where to eat in Seattle.');
select public.ensure_official_room('global','north-america','seattle-queer:1','Queer-friendly Seattle.');

select public.ensure_official_room('global','north-america','austin-late-night:1','11pm onwards Austin.');
select public.ensure_official_room('global','north-america','austin-foodies:1','Where to eat in Austin.');
select public.ensure_official_room('global','north-america','austin-queer:1','Queer-friendly Austin.');

select public.ensure_official_room('global','north-america','toronto-late-night:1','11pm onwards Toronto.');
select public.ensure_official_room('global','north-america','toronto-foodies:1','Where to eat in Toronto.');
select public.ensure_official_room('global','north-america','toronto-queer:1','Queer-friendly Toronto.');

select public.ensure_official_room('global','north-america','vancouver-foodies:1','Where to eat in Vancouver.');
select public.ensure_official_room('global','north-america','vancouver-queer:1','Queer-friendly Vancouver.');

select public.ensure_official_room('global','north-america','montreal-foodies:1','Where to eat in Montréal.');
select public.ensure_official_room('global','north-america','montreal-queer:1','Queer-friendly Montréal.');

-- New North America cities
select public.ensure_official_room('global','north-america','boston-lobby:1','Boston lobby.');
select public.ensure_official_room('global','north-america','boston-foodies:1','Where to eat in Boston.');
select public.ensure_official_room('global','north-america','boston-queer:1','Queer-friendly Boston.');
select public.ensure_official_room('global','north-america','miami-lobby:1','Miami lobby.');
select public.ensure_official_room('global','north-america','miami-late-night:1','11pm onwards Miami.');
select public.ensure_official_room('global','north-america','miami-queer:1','Queer-friendly Miami.');
select public.ensure_official_room('global','north-america','atlanta-lobby:1','Atlanta lobby.');
select public.ensure_official_room('global','north-america','atlanta-queer:1','Queer-friendly Atlanta.');
select public.ensure_official_room('global','north-america','denver-lobby:1','Denver lobby.');
select public.ensure_official_room('global','north-america','denver-queer:1','Queer-friendly Denver.');
select public.ensure_official_room('global','north-america','portland-lobby:1','Portland lobby.');
select public.ensure_official_room('global','north-america','portland-queer:1','Queer-friendly Portland.');
select public.ensure_official_room('global','north-america','dc-lobby:1','Washington DC lobby.');
select public.ensure_official_room('global','north-america','dc-queer:1','Queer-friendly DC.');
select public.ensure_official_room('global','north-america','philly-lobby:1','Philadelphia lobby.');
select public.ensure_official_room('global','north-america','houston-lobby:1','Houston lobby.');
select public.ensure_official_room('global','north-america','dallas-lobby:1','Dallas lobby.');
select public.ensure_official_room('global','north-america','minneapolis-lobby:1','Minneapolis lobby.');
select public.ensure_official_room('global','north-america','new-orleans-lobby:1','New Orleans lobby.');
select public.ensure_official_room('global','north-america','nashville-lobby:1','Nashville lobby.');
select public.ensure_official_room('global','north-america','las-vegas-lobby:1','Las Vegas lobby.');
select public.ensure_official_room('global','north-america','phoenix-lobby:1','Phoenix lobby.');
select public.ensure_official_room('global','north-america','calgary-lobby:1','Calgary lobby.');
select public.ensure_official_room('global','north-america','ottawa-lobby:1','Ottawa lobby.');
select public.ensure_official_room('global','north-america','edmonton-lobby:1','Edmonton lobby.');
select public.ensure_official_room('global','north-america','guadalajara-lobby:1','Guadalajara lobby.');
select public.ensure_official_room('global','north-america','monterrey-lobby:1','Monterrey lobby.');

-- ============================================================================
-- 2. Round out existing Europe metros + add second-tier cities
-- ============================================================================
select public.ensure_official_room('global','europe','london-late-night:1','11pm onwards London.');
select public.ensure_official_room('global','europe','london-foodies:1','Where to eat in London.');
select public.ensure_official_room('global','europe','london-queer:1','Queer-friendly London.');
select public.ensure_official_room('global','europe','london-newcomers:1','Just moved to London? Ask anything.');
select public.ensure_official_room('global','europe','london-events:1','What''s happening this week — London.');

select public.ensure_official_room('global','europe','paris-late-night:1','11pm onwards Paris.');
select public.ensure_official_room('global','europe','paris-foodies:1','Where to eat in Paris.');
select public.ensure_official_room('global','europe','paris-queer:1','Queer-friendly Paris.');
select public.ensure_official_room('global','europe','paris-newcomers:1','Just moved to Paris? Ask anything.');

select public.ensure_official_room('global','europe','berlin-late-night:1','11pm onwards Berlin.');
select public.ensure_official_room('global','europe','berlin-foodies:1','Where to eat in Berlin.');
select public.ensure_official_room('global','europe','berlin-queer:1','Queer-friendly Berlin.');
select public.ensure_official_room('global','europe','berlin-newcomers:1','Just moved to Berlin? Ask anything.');

select public.ensure_official_room('global','europe','amsterdam-late-night:1','11pm onwards Amsterdam.');
select public.ensure_official_room('global','europe','amsterdam-foodies:1','Where to eat in Amsterdam.');
select public.ensure_official_room('global','europe','amsterdam-queer:1','Queer-friendly Amsterdam.');

select public.ensure_official_room('global','europe','barcelona-foodies:1','Where to eat in Barcelona.');
select public.ensure_official_room('global','europe','barcelona-queer:1','Queer-friendly Barcelona.');
select public.ensure_official_room('global','europe','madrid-foodies:1','Where to eat in Madrid.');
select public.ensure_official_room('global','europe','madrid-queer:1','Queer-friendly Madrid.');
select public.ensure_official_room('global','europe','lisbon-foodies:1','Where to eat in Lisbon.');
select public.ensure_official_room('global','europe','lisbon-queer:1','Queer-friendly Lisbon.');
select public.ensure_official_room('global','europe','dublin-foodies:1','Where to eat in Dublin.');

-- New European cities
select public.ensure_official_room('global','europe','rome-lobby:1','Rome lobby.');
select public.ensure_official_room('global','europe','rome-foodies:1','Where to eat in Rome.');
select public.ensure_official_room('global','europe','milan-lobby:1','Milan lobby.');
select public.ensure_official_room('global','europe','milan-foodies:1','Where to eat in Milan.');
select public.ensure_official_room('global','europe','florence-lobby:1','Florence lobby.');
select public.ensure_official_room('global','europe','naples-lobby:1','Naples lobby.');
select public.ensure_official_room('global','europe','venice-lobby:1','Venice lobby.');
select public.ensure_official_room('global','europe','munich-lobby:1','Munich lobby.');
select public.ensure_official_room('global','europe','munich-queer:1','Queer-friendly Munich.');
select public.ensure_official_room('global','europe','hamburg-lobby:1','Hamburg lobby.');
select public.ensure_official_room('global','europe','frankfurt-lobby:1','Frankfurt lobby.');
select public.ensure_official_room('global','europe','cologne-lobby:1','Cologne lobby.');
select public.ensure_official_room('global','europe','vienna-lobby:1','Vienna lobby.');
select public.ensure_official_room('global','europe','vienna-foodies:1','Where to eat in Vienna.');
select public.ensure_official_room('global','europe','zurich-lobby:1','Zürich lobby.');
select public.ensure_official_room('global','europe','geneva-lobby:1','Geneva lobby.');
select public.ensure_official_room('global','europe','brussels-lobby:1','Brussels lobby.');
select public.ensure_official_room('global','europe','copenhagen-lobby:1','Copenhagen lobby.');
select public.ensure_official_room('global','europe','copenhagen-queer:1','Queer-friendly Copenhagen.');
select public.ensure_official_room('global','europe','oslo-lobby:1','Oslo lobby.');
select public.ensure_official_room('global','europe','helsinki-lobby:1','Helsinki lobby.');
select public.ensure_official_room('global','europe','reykjavik-lobby:1','Reykjavík lobby.');
select public.ensure_official_room('global','europe','prague-lobby:1','Prague lobby.');
select public.ensure_official_room('global','europe','prague-foodies:1','Where to eat in Prague.');
select public.ensure_official_room('global','europe','budapest-lobby:1','Budapest lobby.');
select public.ensure_official_room('global','europe','budapest-late-night:1','11pm onwards Budapest.');
select public.ensure_official_room('global','europe','bucharest-lobby:1','Bucharest lobby.');
select public.ensure_official_room('global','europe','kyiv-lobby:1','Kyiv lobby.');
select public.ensure_official_room('global','europe','moscow-lobby:1','Moscow lobby.');
select public.ensure_official_room('global','europe','st-petersburg-lobby:1','St Petersburg lobby.');
select public.ensure_official_room('global','europe','athens-lobby:1','Athens lobby.');
select public.ensure_official_room('global','europe','manchester-lobby:1','Manchester lobby.');
select public.ensure_official_room('global','europe','manchester-queer:1','Queer-friendly Manchester.');
select public.ensure_official_room('global','europe','birmingham-lobby:1','Birmingham lobby.');
select public.ensure_official_room('global','europe','edinburgh-lobby:1','Edinburgh lobby.');
select public.ensure_official_room('global','europe','edinburgh-queer:1','Queer-friendly Edinburgh.');
select public.ensure_official_room('global','europe','glasgow-lobby:1','Glasgow lobby.');
select public.ensure_official_room('global','europe','liverpool-lobby:1','Liverpool lobby.');
select public.ensure_official_room('global','europe','bristol-lobby:1','Bristol lobby.');
select public.ensure_official_room('global','europe','brighton-lobby:1','Brighton lobby.');
select public.ensure_official_room('global','europe','brighton-queer:1','Queer-friendly Brighton — pride capital.');
select public.ensure_official_room('global','europe','cork-lobby:1','Cork lobby.');
select public.ensure_official_room('global','europe','galway-lobby:1','Galway lobby.');
select public.ensure_official_room('global','europe','lyon-lobby:1','Lyon lobby.');
select public.ensure_official_room('global','europe','marseille-lobby:1','Marseille lobby.');
select public.ensure_official_room('global','europe','nice-lobby:1','Nice lobby.');
select public.ensure_official_room('global','europe','seville-lobby:1','Seville lobby.');
select public.ensure_official_room('global','europe','valencia-lobby:1','Valencia lobby.');
select public.ensure_official_room('global','europe','porto-lobby:1','Porto lobby.');
select public.ensure_official_room('global','europe','rotterdam-lobby:1','Rotterdam lobby.');
select public.ensure_official_room('global','europe','the-hague-lobby:1','The Hague lobby.');
select public.ensure_official_room('global','europe','antwerp-lobby:1','Antwerp lobby.');
select public.ensure_official_room('global','europe','krakow-lobby:1','Kraków lobby.');
select public.ensure_official_room('global','europe','wroclaw-lobby:1','Wrocław lobby.');
select public.ensure_official_room('global','europe','gothenburg-lobby:1','Gothenburg lobby.');
select public.ensure_official_room('global','europe','bergen-lobby:1','Bergen lobby.');
select public.ensure_official_room('global','europe','tallinn-lobby:1','Tallinn lobby.');
select public.ensure_official_room('global','europe','riga-lobby:1','Riga lobby.');
select public.ensure_official_room('global','europe','vilnius-lobby:1','Vilnius lobby.');
select public.ensure_official_room('global','europe','sofia-lobby:1','Sofia lobby.');
select public.ensure_official_room('global','europe','belgrade-lobby:1','Belgrade lobby.');
select public.ensure_official_room('global','europe','zagreb-lobby:1','Zagreb lobby.');
select public.ensure_official_room('global','europe','ljubljana-lobby:1','Ljubljana lobby.');
select public.ensure_official_room('global','europe','bratislava-lobby:1','Bratislava lobby.');
select public.ensure_official_room('global','europe','tbilisi-lobby:1','Tbilisi lobby.');

-- ============================================================================
-- 3. MENA — round out + add cities
-- ============================================================================
select public.ensure_official_room('global','mena','dubai-late-night:1','11pm onwards Dubai.');
select public.ensure_official_room('global','mena','dubai-foodies:1','Where to eat in Dubai.');
select public.ensure_official_room('global','mena','dubai-newcomers:1','Just moved to Dubai? Ask anything.');
select public.ensure_official_room('global','mena','dubai-expats:1','Dubai expats lobby.');
select public.ensure_official_room('global','mena','abu-dhabi-foodies:1','Where to eat in Abu Dhabi.');
select public.ensure_official_room('global','mena','abu-dhabi-expats:1','Abu Dhabi expats.');
select public.ensure_official_room('global','mena','doha-foodies:1','Where to eat in Doha.');
select public.ensure_official_room('global','mena','doha-expats:1','Doha expats.');
select public.ensure_official_room('global','mena','riyadh-foodies:1','Where to eat in Riyadh.');
select public.ensure_official_room('global','mena','jeddah-lobby:1','Jeddah lobby.');
select public.ensure_official_room('global','mena','muscat-lobby:1','Muscat lobby.');
select public.ensure_official_room('global','mena','manama-lobby:1','Manama lobby.');
select public.ensure_official_room('global','mena','kuwait-city-lobby:1','Kuwait City lobby.');
select public.ensure_official_room('global','mena','sharjah-lobby:1','Sharjah lobby.');
select public.ensure_official_room('global','mena','ajman-lobby:1','Ajman lobby.');
select public.ensure_official_room('global','mena','amman-lobby:1','Amman lobby.');
select public.ensure_official_room('global','mena','beirut-lobby:1','Beirut lobby.');
select public.ensure_official_room('global','mena','beirut-queer:1','Queer-friendly Beirut.');
select public.ensure_official_room('global','mena','baghdad-lobby:1','Baghdad lobby.');
select public.ensure_official_room('global','mena','tehran-lobby:1','Tehran lobby.');
select public.ensure_official_room('global','mena','istanbul-late-night:1','11pm onwards Istanbul.');
select public.ensure_official_room('global','mena','istanbul-foodies:1','Where to eat in Istanbul.');
select public.ensure_official_room('global','mena','istanbul-queer:1','Queer-friendly Istanbul.');
select public.ensure_official_room('global','mena','ankara-lobby:1','Ankara lobby.');
select public.ensure_official_room('global','mena','izmir-lobby:1','İzmir lobby.');
select public.ensure_official_room('global','mena','cairo-foodies:1','Where to eat in Cairo.');
select public.ensure_official_room('global','mena','alexandria-lobby:1','Alexandria lobby.');
select public.ensure_official_room('global','mena','casablanca-lobby:1','Casablanca lobby.');
select public.ensure_official_room('global','mena','marrakech-lobby:1','Marrakech lobby.');
select public.ensure_official_room('global','mena','rabat-lobby:1','Rabat lobby.');
select public.ensure_official_room('global','mena','tunis-lobby:1','Tunis lobby.');
select public.ensure_official_room('global','mena','algiers-lobby:1','Algiers lobby.');
select public.ensure_official_room('global','mena','tel-aviv-queer:1','Queer-friendly Tel Aviv.');
select public.ensure_official_room('global','mena','jerusalem-lobby:1','Jerusalem lobby.');

-- ============================================================================
-- 4. Asia — round out + add second-tier cities
-- ============================================================================
select public.ensure_official_room('global','asia','singapore-late-night:1','11pm onwards Singapore.');
select public.ensure_official_room('global','asia','singapore-foodies:1','Where to eat in Singapore — hawker debates.');
select public.ensure_official_room('global','asia','singapore-queer:1','Queer-friendly Singapore.');
select public.ensure_official_room('global','asia','singapore-expats:1','Singapore expats lobby.');

select public.ensure_official_room('global','asia','tokyo-late-night:1','11pm onwards Tokyo.');
select public.ensure_official_room('global','asia','tokyo-foodies:1','Where to eat in Tokyo.');
select public.ensure_official_room('global','asia','tokyo-queer:1','Queer-friendly Tokyo — Ni-chōme + beyond.');
select public.ensure_official_room('global','asia','tokyo-newcomers:1','Just moved to Tokyo? Ask anything.');
select public.ensure_official_room('global','asia','osaka-lobby:1','Osaka lobby.');
select public.ensure_official_room('global','asia','osaka-foodies:1','Where to eat in Osaka.');
select public.ensure_official_room('global','asia','kyoto-lobby:1','Kyoto lobby.');
select public.ensure_official_room('global','asia','fukuoka-lobby:1','Fukuoka lobby.');
select public.ensure_official_room('global','asia','sapporo-lobby:1','Sapporo lobby.');

select public.ensure_official_room('global','asia','seoul-late-night:1','11pm onwards Seoul.');
select public.ensure_official_room('global','asia','seoul-foodies:1','Where to eat in Seoul.');
select public.ensure_official_room('global','asia','seoul-queer:1','Queer-friendly Seoul — Itaewon + beyond.');
select public.ensure_official_room('global','asia','busan-lobby:1','Busan lobby.');
select public.ensure_official_room('global','asia','jeju-lobby:1','Jeju lobby.');

select public.ensure_official_room('global','asia','hong-kong-late-night:1','11pm onwards Hong Kong.');
select public.ensure_official_room('global','asia','hong-kong-foodies:1','Where to eat in Hong Kong.');
select public.ensure_official_room('global','asia','hong-kong-queer:1','Queer-friendly Hong Kong.');
select public.ensure_official_room('global','asia','taipei-lobby:1','Taipei lobby.');
select public.ensure_official_room('global','asia','taipei-queer:1','Queer-friendly Taipei — Asia''s pride capital.');

select public.ensure_official_room('global','asia','bangkok-late-night:1','11pm onwards Bangkok.');
select public.ensure_official_room('global','asia','bangkok-foodies:1','Where to eat in Bangkok.');
select public.ensure_official_room('global','asia','bangkok-queer:1','Queer-friendly Bangkok.');
select public.ensure_official_room('global','asia','chiang-mai-lobby:1','Chiang Mai lobby.');
select public.ensure_official_room('global','asia','chiang-mai-nomads:1','Chiang Mai digital nomads.');
select public.ensure_official_room('global','asia','phuket-lobby:1','Phuket lobby.');

select public.ensure_official_room('global','asia','kuala-lumpur-late-night:1','11pm onwards KL.');
select public.ensure_official_room('global','asia','kuala-lumpur-foodies:1','Where to eat in KL.');
select public.ensure_official_room('global','asia','penang-lobby:1','Penang lobby.');
select public.ensure_official_room('global','asia','johor-bahru-lobby:1','Johor Bahru lobby.');

select public.ensure_official_room('global','asia','jakarta-foodies:1','Where to eat in Jakarta.');
select public.ensure_official_room('global','asia','jakarta-queer:1','Queer-friendly Jakarta.');
select public.ensure_official_room('global','asia','bali-nomads:1','Bali digital nomads.');
select public.ensure_official_room('global','asia','bali-foodies:1','Where to eat in Bali.');
select public.ensure_official_room('global','asia','surabaya-lobby:1','Surabaya lobby.');
select public.ensure_official_room('global','asia','bandung-lobby:1','Bandung lobby.');
select public.ensure_official_room('global','asia','yogyakarta-lobby:1','Yogyakarta lobby.');

select public.ensure_official_room('global','asia','manila-foodies:1','Where to eat in Manila.');
select public.ensure_official_room('global','asia','manila-queer:1','Queer-friendly Manila.');
select public.ensure_official_room('global','asia','cebu-lobby:1','Cebu lobby.');
select public.ensure_official_room('global','asia','davao-lobby:1','Davao lobby.');

select public.ensure_official_room('global','asia','ho-chi-minh-foodies:1','Where to eat in Saigon.');
select public.ensure_official_room('global','asia','ho-chi-minh-nomads:1','Saigon digital nomads.');
select public.ensure_official_room('global','asia','hanoi-lobby:1','Hanoi lobby.');
select public.ensure_official_room('global','asia','da-nang-lobby:1','Da Nang lobby.');
select public.ensure_official_room('global','asia','da-nang-nomads:1','Da Nang nomads.');
select public.ensure_official_room('global','asia','hoi-an-lobby:1','Hội An lobby.');

select public.ensure_official_room('global','asia','phnom-penh-lobby:1','Phnom Penh lobby.');
select public.ensure_official_room('global','asia','siem-reap-lobby:1','Siem Reap lobby.');
select public.ensure_official_room('global','asia','vientiane-lobby:1','Vientiane lobby.');
select public.ensure_official_room('global','asia','yangon-lobby:1','Yangon lobby.');

select public.ensure_official_room('global','asia','karachi-foodies:1','Where to eat in Karachi.');
select public.ensure_official_room('global','asia','lahore-lobby:1','Lahore lobby.');
select public.ensure_official_room('global','asia','lahore-foodies:1','Where to eat in Lahore.');
select public.ensure_official_room('global','asia','islamabad-lobby:1','Islamabad lobby.');
select public.ensure_official_room('global','asia','dhaka-foodies:1','Where to eat in Dhaka.');
select public.ensure_official_room('global','asia','chittagong-lobby:1','Chittagong lobby.');
select public.ensure_official_room('global','asia','colombo-foodies:1','Where to eat in Colombo.');
select public.ensure_official_room('global','asia','kandy-lobby:1','Kandy lobby.');
select public.ensure_official_room('global','asia','kathmandu-foodies:1','Where to eat in Kathmandu.');
select public.ensure_official_room('global','asia','pokhara-lobby:1','Pokhara lobby.');
select public.ensure_official_room('global','asia','thimphu-lobby:1','Thimphu lobby.');
select public.ensure_official_room('global','asia','beijing-lobby:1','Beijing lobby.');
select public.ensure_official_room('global','asia','shanghai-lobby:1','Shanghai lobby.');
select public.ensure_official_room('global','asia','shenzhen-lobby:1','Shenzhen lobby.');
select public.ensure_official_room('global','asia','guangzhou-lobby:1','Guangzhou lobby.');
select public.ensure_official_room('global','asia','chengdu-lobby:1','Chengdu lobby.');

-- ============================================================================
-- 5. Oceania — round out
-- ============================================================================
select public.ensure_official_room('global','oceania','sydney-late-night:1','11pm onwards Sydney.');
select public.ensure_official_room('global','oceania','sydney-foodies:1','Where to eat in Sydney.');
select public.ensure_official_room('global','oceania','sydney-queer:1','Queer-friendly Sydney — Mardi Gras year-round.');
select public.ensure_official_room('global','oceania','melbourne-late-night:1','11pm onwards Melbourne.');
select public.ensure_official_room('global','oceania','melbourne-foodies:1','Where to eat in Melbourne.');
select public.ensure_official_room('global','oceania','melbourne-queer:1','Queer-friendly Melbourne.');
select public.ensure_official_room('global','oceania','brisbane-lobby:1','Brisbane lobby.');
select public.ensure_official_room('global','oceania','brisbane-queer:1','Queer-friendly Brisbane.');
select public.ensure_official_room('global','oceania','perth-lobby:1','Perth lobby.');
select public.ensure_official_room('global','oceania','adelaide-lobby:1','Adelaide lobby.');
select public.ensure_official_room('global','oceania','canberra-lobby:1','Canberra lobby.');
select public.ensure_official_room('global','oceania','auckland-foodies:1','Where to eat in Auckland.');
select public.ensure_official_room('global','oceania','auckland-queer:1','Queer-friendly Auckland.');
select public.ensure_official_room('global','oceania','wellington-lobby:1','Wellington lobby.');
select public.ensure_official_room('global','oceania','christchurch-lobby:1','Christchurch lobby.');
select public.ensure_official_room('global','oceania','suva-lobby:1','Suva lobby — Fiji.');

-- ============================================================================
-- 6. Africa — round out + add cities
-- ============================================================================
select public.ensure_official_room('global','africa','lagos-foodies:1','Where to eat in Lagos.');
select public.ensure_official_room('global','africa','lagos-queer:1','Queer-friendly Lagos.');
select public.ensure_official_room('global','africa','lagos-newcomers:1','Just moved to Lagos? Ask anything.');
select public.ensure_official_room('global','africa','abuja-lobby:1','Abuja lobby.');
select public.ensure_official_room('global','africa','nairobi-foodies:1','Where to eat in Nairobi.');
select public.ensure_official_room('global','africa','nairobi-queer:1','Queer-friendly Nairobi.');
select public.ensure_official_room('global','africa','mombasa-lobby:1','Mombasa lobby.');
select public.ensure_official_room('global','africa','cape-town-late-night:1','11pm onwards Cape Town.');
select public.ensure_official_room('global','africa','cape-town-queer:1','Queer-friendly Cape Town.');
select public.ensure_official_room('global','africa','johannesburg-late-night:1','11pm onwards Joburg.');
select public.ensure_official_room('global','africa','johannesburg-queer:1','Queer-friendly Joburg.');
select public.ensure_official_room('global','africa','durban-lobby:1','Durban lobby.');
select public.ensure_official_room('global','africa','addis-ababa-lobby:1','Addis Ababa lobby.');
select public.ensure_official_room('global','africa','accra-lobby:1','Accra lobby.');
select public.ensure_official_room('global','africa','dakar-lobby:1','Dakar lobby.');
select public.ensure_official_room('global','africa','dar-es-salaam-lobby:1','Dar es Salaam lobby.');
select public.ensure_official_room('global','africa','kampala-lobby:1','Kampala lobby.');
select public.ensure_official_room('global','africa','kigali-lobby:1','Kigali lobby.');
select public.ensure_official_room('global','africa','abidjan-lobby:1','Abidjan lobby.');
select public.ensure_official_room('global','africa','harare-lobby:1','Harare lobby.');
select public.ensure_official_room('global','africa','windhoek-lobby:1','Windhoek lobby.');
select public.ensure_official_room('global','africa','maputo-lobby:1','Maputo lobby.');
select public.ensure_official_room('global','africa','luanda-lobby:1','Luanda lobby.');
select public.ensure_official_room('global','africa','antananarivo-lobby:1','Antananarivo lobby.');
select public.ensure_official_room('global','africa','port-louis-lobby:1','Port Louis lobby — Mauritius.');

-- ============================================================================
-- 7. South America — round out + add cities
-- ============================================================================
select public.ensure_official_room('global','south-america','sao-paulo-late-night:1','11pm onwards São Paulo.');
select public.ensure_official_room('global','south-america','sao-paulo-foodies:1','Where to eat in São Paulo.');
select public.ensure_official_room('global','south-america','sao-paulo-queer:1','Queer-friendly São Paulo.');
select public.ensure_official_room('global','south-america','rio-late-night:1','11pm onwards Rio.');
select public.ensure_official_room('global','south-america','rio-foodies:1','Where to eat in Rio.');
select public.ensure_official_room('global','south-america','rio-queer:1','Queer-friendly Rio.');
select public.ensure_official_room('global','south-america','brasilia-lobby:1','Brasília lobby.');
select public.ensure_official_room('global','south-america','belo-horizonte-lobby:1','Belo Horizonte lobby.');
select public.ensure_official_room('global','south-america','salvador-lobby:1','Salvador lobby.');
select public.ensure_official_room('global','south-america','buenos-aires-late-night:1','11pm onwards Buenos Aires.');
select public.ensure_official_room('global','south-america','buenos-aires-foodies:1','Where to eat in Buenos Aires.');
select public.ensure_official_room('global','south-america','buenos-aires-queer:1','Queer-friendly Buenos Aires.');
select public.ensure_official_room('global','south-america','cordoba-lobby:1','Córdoba lobby.');
select public.ensure_official_room('global','south-america','santiago-lobby:1','Santiago lobby.');
select public.ensure_official_room('global','south-america','santiago-foodies:1','Where to eat in Santiago.');
select public.ensure_official_room('global','south-america','bogota-lobby:1','Bogotá lobby.');
select public.ensure_official_room('global','south-america','medellin-lobby:1','Medellín lobby.');
select public.ensure_official_room('global','south-america','medellin-nomads:1','Medellín digital nomads.');
select public.ensure_official_room('global','south-america','cartagena-lobby:1','Cartagena lobby.');
select public.ensure_official_room('global','south-america','lima-lobby:1','Lima lobby.');
select public.ensure_official_room('global','south-america','lima-foodies:1','Where to eat in Lima.');
select public.ensure_official_room('global','south-america','cusco-lobby:1','Cusco lobby.');
select public.ensure_official_room('global','south-america','quito-lobby:1','Quito lobby.');
select public.ensure_official_room('global','south-america','caracas-lobby:1','Caracas lobby.');
select public.ensure_official_room('global','south-america','montevideo-lobby:1','Montevideo lobby.');
select public.ensure_official_room('global','south-america','la-paz-lobby:1','La Paz lobby.');
select public.ensure_official_room('global','south-america','asuncion-lobby:1','Asunción lobby.');
select public.ensure_official_room('global','south-america','mexico-city-late-night:1','11pm onwards CDMX.');
select public.ensure_official_room('global','south-america','mexico-city-foodies:1','Where to eat in CDMX.');
select public.ensure_official_room('global','south-america','mexico-city-queer:1','Queer-friendly CDMX.');
