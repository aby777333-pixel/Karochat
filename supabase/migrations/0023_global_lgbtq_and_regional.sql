-- Karochat — v12 Wave 17: global LGBTQ + worldwide Regional expansion.
-- Goal: the catalog must feel worldwide from the very first visit, not
-- India-only. This migration ensures every continent gets first-class
-- presence and adds ~80 globally-resonant LGBTQ+ rooms.
-- Run AFTER 0022_catalog_full.sql. Idempotent (uses ensure_official_room).

-- ============================================================================
-- Subcategory backfill — make sure every region/identity slug we reference
-- below exists in room_subcategories. Cheap idempotent upserts.
-- ============================================================================
insert into public.room_subcategories (category_slug, slug, label, description, position) values
  ('regional', 'us-cities',          'United States · Cities',     'NYC, LA, SF, Chicago…',            10),
  ('regional', 'uk-cities',           'United Kingdom · Cities',    'London, Manchester, Edinburgh…',   11),
  ('regional', 'canada-cities',       'Canada · Cities',            'Toronto, Vancouver, Montreal…',    12),
  ('regional', 'australia-cities',    'Australia · Cities',         'Sydney, Melbourne, Brisbane…',     13),
  ('regional', 'germany-cities',      'Germany · Cities',           'Berlin, Munich, Hamburg…',         14),
  ('regional', 'france-cities',       'France · Cities',            'Paris, Lyon, Marseille…',          15),
  ('regional', 'brazil-cities',       'Brazil · Cities',            'São Paulo, Rio, Salvador…',        16),
  ('regional', 'mexico-cities',       'Mexico · Cities',            'CDMX, Guadalajara, Monterrey…',    17),
  ('regional', 'japan-cities',        'Japan · Cities',             'Tokyo, Osaka, Kyoto…',             18),
  ('regional', 'south-korea-cities',  'South Korea · Cities',       'Seoul, Busan…',                    19),
  ('regional', 'china-cities',        'China · Cities',             'Beijing, Shanghai, Shenzhen…',     20),
  ('regional', 'indonesia-cities',    'Indonesia · Cities',         'Jakarta, Surabaya, Bali…',         21),
  ('regional', 'philippines-cities',  'Philippines · Cities',       'Manila, Cebu, Davao…',             22),
  ('regional', 'thailand-cities',     'Thailand · Cities',          'Bangkok, Chiang Mai, Phuket…',     23),
  ('regional', 'vietnam-cities',      'Vietnam · Cities',           'Saigon, Hanoi, Da Nang…',          24),
  ('regional', 'pakistan-cities',     'Pakistan · Cities',          'Karachi, Lahore, Islamabad…',      25),
  ('regional', 'bangladesh-cities',   'Bangladesh · Cities',        'Dhaka, Chittagong…',               26),
  ('regional', 'turkey-cities',       'Türkiye · Cities',           'Istanbul, Ankara, Izmir…',         27),
  ('regional', 'south-africa-cities', 'South Africa · Cities',      'Joburg, Cape Town, Durban…',       28),
  ('regional', 'nigeria-cities',      'Nigeria · Cities',           'Lagos, Abuja, Port Harcourt…',     29),
  ('regional', 'kenya-cities',        'Kenya · Cities',             'Nairobi, Mombasa…',                30),
  ('regional', 'egypt-cities',        'Egypt · Cities',             'Cairo, Alexandria…',               31),
  ('regional', 'uae-cities',          'UAE · Cities',               'Dubai, Abu Dhabi, Sharjah…',       32),
  ('regional', 'saudi-cities',        'Saudi Arabia · Cities',      'Riyadh, Jeddah, Dammam…',          33),
  ('regional', 'iran-cities',         'Iran · Cities',              'Tehran, Mashhad, Isfahan…',        34),
  ('regional', 'spain-cities',        'Spain · Cities',             'Madrid, Barcelona, Valencia…',     35),
  ('regional', 'italy-cities',        'Italy · Cities',             'Roma, Milano, Napoli…',            36),
  ('regional', 'netherlands-cities',  'Netherlands · Cities',       'Amsterdam, Rotterdam, Utrecht…',   37),
  ('regional', 'sweden-cities',       'Sweden · Cities',            'Stockholm, Göteborg, Malmö…',      38),
  ('regional', 'poland-cities',       'Poland · Cities',            'Warsaw, Kraków, Wrocław…',         39),
  ('regional', 'argentina-cities',    'Argentina · Cities',         'Buenos Aires, Córdoba, Rosario…',  40),
  ('regional', 'chile-cities',        'Chile · Cities',             'Santiago, Valparaíso…',            41),
  ('regional', 'colombia-cities',     'Colombia · Cities',          'Bogotá, Medellín, Cali…',          42),
  ('lgbtq',    'global-cities',       'LGBTQ+ · Global Cities',     'Queer life by city, worldwide',    1),
  ('lgbtq',    'identity-global',     'LGBTQ+ · Identity (Global)', 'Identity-specific global rooms',   2),
  ('lgbtq',    'support-global',      'LGBTQ+ · Support (Global)',  'Coming out, family, support',      3),
  ('lgbtq',    'culture-global',      'LGBTQ+ · Culture & Pride',   'Drag, ballroom, pride, culture',   4),
  ('lgbtq',    'asia-pacific',        'LGBTQ+ · Asia-Pacific',      'Queer Asia-Pacific spaces',        5),
  ('lgbtq',    'latin-america',       'LGBTQ+ · Latin America',     'Queer LATAM spaces',               6),
  ('lgbtq',    'africa-mena',         'LGBTQ+ · Africa & MENA',     'Queer Africa + MENA',              7),
  ('lgbtq',    'europe',              'LGBTQ+ · Europe',            'Queer European spaces',            8)
on conflict (category_slug, slug) do update set
  label = excluded.label,
  description = excluded.description,
  position = excluded.position;

-- ============================================================================
-- World cities — at least one room per major global city so the lobby
-- doesn't feel India-only.  ensure_official_room is idempotent.
-- ============================================================================
do $$
declare
  pairs text[][] := array[
    -- North America
    array['regional','us-cities','New York','Five-borough chat — NYC after dark, NYC at noon.'],
    array['regional','us-cities','Los Angeles','LA folks — beach to Boyle Heights.'],
    array['regional','us-cities','San Francisco','Bay Area — tech, fog, and everyone in between.'],
    array['regional','us-cities','Chicago','Windy city, deep dish, deep talk.'],
    array['regional','us-cities','Seattle','PNW vibes — rain, coffee, code.'],
    array['regional','us-cities','Austin','Keep Austin weird.'],
    array['regional','us-cities','Miami','Miami nights, Cuban coffee, beach minds.'],
    array['regional','us-cities','Houston','Houston, we have a chat.'],
    array['regional','us-cities','Atlanta','ATL — culture, music, southern warmth.'],
    array['regional','us-cities','Boston','Beantown — students, sports, sea.'],
    array['regional','us-cities','Washington DC','Politics-optional DC.'],
    array['regional','us-cities','Philadelphia','Philly — cheesesteaks and real talk.'],
    array['regional','us-cities','Denver','Mile-high conversations.'],
    array['regional','us-cities','Phoenix','Sonoran sun + chill.'],
    array['regional','us-cities','Portland','Portland — weird, kind, raining.'],

    array['regional','canada-cities','Toronto','The 6ix.'],
    array['regional','canada-cities','Vancouver','Pacific, mountains, mist.'],
    array['regional','canada-cities','Montreal','Bilingual, beautiful, late-night.'],
    array['regional','canada-cities','Calgary','Cowboys + cold + curious folks.'],
    array['regional','canada-cities','Ottawa','Capital chat.'],

    -- UK / Ireland
    array['regional','uk-cities','London','London — every accent welcome.'],
    array['regional','uk-cities','Manchester','Mancunian banter.'],
    array['regional','uk-cities','Edinburgh','Auld Reekie.'],
    array['regional','uk-cities','Birmingham','Brum — second city, first vibes.'],
    array['regional','uk-cities','Glasgow','Pure dead brilliant.'],
    array['regional','uk-cities','Bristol','Banksy''s town — and yours.'],
    array['regional','uk-cities','Liverpool','Scousers welcome.'],
    array['regional','uk-cities','Dublin','Dublin (Ireland) — Guinness optional.'],

    -- Europe — west & north
    array['regional','germany-cities','Berlin','Berghain to brunch.'],
    array['regional','germany-cities','Munich','München & beyond.'],
    array['regional','germany-cities','Hamburg','Hafen city.'],
    array['regional','germany-cities','Cologne','Köln am Rhein.'],
    array['regional','germany-cities','Frankfurt','Mainhattan.'],
    array['regional','france-cities','Paris','Paris — café table, midnight Métro.'],
    array['regional','france-cities','Lyon','La capitale des Gaules.'],
    array['regional','france-cities','Marseille','Méditerranéen.'],
    array['regional','france-cities','Toulouse','La ville rose.'],
    array['regional','france-cities','Bordeaux','Bordelais.'],
    array['regional','netherlands-cities','Amsterdam','Grachten, fietsen, gezelligheid.'],
    array['regional','netherlands-cities','Rotterdam','Rotterdam — bold + bright.'],
    array['regional','netherlands-cities','Utrecht','Utrechters welkom.'],
    array['regional','spain-cities','Madrid','Madrileños.'],
    array['regional','spain-cities','Barcelona','Catalunya — la nostra ciutat.'],
    array['regional','spain-cities','Valencia','Valencia — paella & playa.'],
    array['regional','spain-cities','Sevilla','Andalucía.'],
    array['regional','italy-cities','Roma','Tutte le strade portano qui.'],
    array['regional','italy-cities','Milano','Milano — fashion + fierezza.'],
    array['regional','italy-cities','Napoli','Forza Napoli.'],
    array['regional','italy-cities','Firenze','Firenze — arte e amici.'],
    array['regional','italy-cities','Torino','Sabaudo.'],
    array['regional','sweden-cities','Stockholm','Skärgården vibes.'],
    array['regional','sweden-cities','Göteborg','Göteborgare.'],
    array['regional','sweden-cities','Malmö','Skåne i fokus.'],
    array['regional','poland-cities','Warsaw','Warszawa — kawa + szczerze.'],
    array['regional','poland-cities','Kraków','Kraków — historia żywa.'],
    array['regional','poland-cities','Wrocław','Wrocław na piątkę.'],

    -- Australia / NZ
    array['regional','australia-cities','Sydney','Sydneysiders — harbour and beyond.'],
    array['regional','australia-cities','Melbourne','Melburnians — coffee culture.'],
    array['regional','australia-cities','Brisbane','BNE — sunshine state.'],
    array['regional','australia-cities','Perth','Perth — west coast best coast.'],
    array['regional','australia-cities','Adelaide','City of churches.'],
    array['regional','australia-cities','Canberra','Capital banter.'],

    -- East Asia
    array['regional','japan-cities','Tokyo','東京 — Tokyo any time.'],
    array['regional','japan-cities','Osaka','大阪 — kuidaore.'],
    array['regional','japan-cities','Kyoto','京都 — quiet streets.'],
    array['regional','japan-cities','Fukuoka','福岡 — Kyushu hub.'],
    array['regional','japan-cities','Sapporo','札幌 — Hokkaido cool.'],
    array['regional','south-korea-cities','Seoul','서울 — 24-hour city.'],
    array['regional','south-korea-cities','Busan','부산 — 바다 & banter.'],
    array['regional','south-korea-cities','Incheon','인천 — gateway.'],
    array['regional','china-cities','Beijing','北京 — hutongs and 11pm noodles.'],
    array['regional','china-cities','Shanghai','上海 — Pudong sunsets.'],
    array['regional','china-cities','Shenzhen','深圳 — moves fast.'],
    array['regional','china-cities','Guangzhou','广州 — Cantonese chat.'],
    array['regional','china-cities','Chengdu','成都 — pandas + 火锅.'],

    -- SE Asia
    array['regional','indonesia-cities','Jakarta','Macet tapi seru.'],
    array['regional','indonesia-cities','Bandung','Bandung — kreatif.'],
    array['regional','indonesia-cities','Surabaya','Surabaya — kota pahlawan.'],
    array['regional','indonesia-cities','Bali','Bali — locals + nomads.'],
    array['regional','philippines-cities','Manila','Manileños.'],
    array['regional','philippines-cities','Cebu','Bisaya welcome.'],
    array['regional','philippines-cities','Davao','Mindanao chat.'],
    array['regional','thailand-cities','Bangkok','กรุงเทพ — Krung Thep.'],
    array['regional','thailand-cities','Chiang Mai','เชียงใหม่ — slower lane.'],
    array['regional','thailand-cities','Phuket','ภูเก็ต — Andaman.'],
    array['regional','vietnam-cities','Saigon','Sài Gòn — quán cà phê.'],
    array['regional','vietnam-cities','Hanoi','Hà Nội — phố cổ.'],
    array['regional','vietnam-cities','Da Nang','Đà Nẵng — biển + cầu.'],
    array['regional','pakistan-cities','Karachi','City of lights.'],
    array['regional','pakistan-cities','Lahore','Lahore lahore aye.'],
    array['regional','pakistan-cities','Islamabad','Capital convos.'],
    array['regional','bangladesh-cities','Dhaka','ঢাকা — boishakhi vibes.'],
    array['regional','bangladesh-cities','Chittagong','চট্টগ্রাম — coastal chat.'],

    -- Middle East / Türkiye
    array['regional','turkey-cities','Istanbul','İstanbul — iki kıta arasında.'],
    array['regional','turkey-cities','Ankara','Başkent.'],
    array['regional','turkey-cities','Izmir','Ege''nin incisi.'],
    array['regional','uae-cities','Dubai','Dubai — every passport welcome.'],
    array['regional','uae-cities','Abu Dhabi','Capital chats.'],
    array['regional','uae-cities','Sharjah','Sharjah — quieter cousin.'],
    array['regional','saudi-cities','Riyadh','Riyadh — quietly buzzing.'],
    array['regional','saudi-cities','Jeddah','Jeddah — Red Sea air.'],
    array['regional','iran-cities','Tehran','تهران — بزرگ‌ترین شهر.'],

    -- Africa
    array['regional','south-africa-cities','Johannesburg','Joburg — Jozi.'],
    array['regional','south-africa-cities','Cape Town','Mother City.'],
    array['regional','south-africa-cities','Durban','Durbanites — beachside.'],
    array['regional','nigeria-cities','Lagos','Lagosians.'],
    array['regional','nigeria-cities','Abuja','FCT vibes.'],
    array['regional','nigeria-cities','Port Harcourt','Garden City.'],
    array['regional','kenya-cities','Nairobi','254, Nairobians.'],
    array['regional','kenya-cities','Mombasa','Coast vibes — pwani.'],
    array['regional','egypt-cities','Cairo','القاهرة — never sleeps.'],
    array['regional','egypt-cities','Alexandria','الإسكندرية — Mediterranean.'],

    -- LATAM
    array['regional','brazil-cities','São Paulo','SP — todas as tribos.'],
    array['regional','brazil-cities','Rio de Janeiro','Rio — praia, samba, papo.'],
    array['regional','brazil-cities','Salvador','Salvador — axé.'],
    array['regional','brazil-cities','Belo Horizonte','BH — pão de queijo.'],
    array['regional','brazil-cities','Brasília','Brasília — capital chat.'],
    array['regional','mexico-cities','Mexico City','CDMX — colonias y compas.'],
    array['regional','mexico-cities','Guadalajara','Tapatíos.'],
    array['regional','mexico-cities','Monterrey','Regio.'],
    array['regional','argentina-cities','Buenos Aires','Porteños.'],
    array['regional','argentina-cities','Córdoba','Córdoba — al palo.'],
    array['regional','argentina-cities','Rosario','Canallas & leprosos.'],
    array['regional','chile-cities','Santiago','Santiaguinos.'],
    array['regional','chile-cities','Valparaíso','Valpo — cerros y mar.'],
    array['regional','colombia-cities','Bogotá','Bogotanos.'],
    array['regional','colombia-cities','Medellín','Paisas — la eterna primavera.'],
    array['regional','colombia-cities','Cali','Cali — la sucursal del cielo.']
  ];
  rec text[];
begin
  foreach rec slice 1 in array pairs loop
    perform public.ensure_official_room(
      rec[1], rec[2], rec[3], rec[4],
      'public', false, false, false, null, 200
    );
  end loop;
end$$;

-- ============================================================================
-- Global LGBTQ+ rooms — identity, support, culture, regional. Worldwide,
-- not India-only. We deliberately keep the names neutral and welcoming.
-- ============================================================================
do $$
declare
  pairs text[][] := array[
    -- Identity (global)
    array['lgbtq','identity-global','Gay men · global','Anywhere in the world, all gay men welcome.'],
    array['lgbtq','identity-global','Lesbian women · global','Lesbian + sapphic women, worldwide.'],
    array['lgbtq','identity-global','Bi+ · global','Bisexual, pansexual, fluid — all welcome.'],
    array['lgbtq','identity-global','Trans · global','Trans people, all genders, worldwide.'],
    array['lgbtq','identity-global','Trans men','Trans masc / trans men space.'],
    array['lgbtq','identity-global','Trans women','Trans fem / trans women space.'],
    array['lgbtq','identity-global','Non-binary · global','Beyond the binary, all welcome.'],
    array['lgbtq','identity-global','Genderqueer · global','Genderqueer + gender-expansive.'],
    array['lgbtq','identity-global','Intersex · global','Intersex people + allies.'],
    array['lgbtq','identity-global','Ace / aro · global','Asexual + aromantic spectrum.'],
    array['lgbtq','identity-global','Two-spirit · global','Two-spirit Indigenous folks.'],
    array['lgbtq','identity-global','Questioning · global','Figuring it out, no pressure.'],

    -- Support
    array['lgbtq','support-global','Just came out · global','Just told someone — celebrate or breathe here.'],
    array['lgbtq','support-global','Closeted but here · global','Anonymous-friendly, no outing, no judgment.'],
    array['lgbtq','support-global','Family rejected me · global','You aren''t alone. Real chat, real support.'],
    array['lgbtq','support-global','Religious + queer','Faith + identity — every tradition welcome.'],
    array['lgbtq','support-global','Queer & disabled','Crip queer chat — body, access, joy.'],
    array['lgbtq','support-global','Queer parents · global','Queer parents, queer kids, queer families.'],
    array['lgbtq','support-global','Older LGBTQ+ · global','40+, 50+, 60+ — chosen-family chat.'],
    array['lgbtq','support-global','Queer teens (16-19)','Verified-only. Peer support, no adults.'],

    -- Culture & Pride
    array['lgbtq','culture-global','Drag · global','Drag artists + fans, worldwide.'],
    array['lgbtq','culture-global','Ballroom culture','House, kiki, ballroom — global scene.'],
    array['lgbtq','culture-global','Pride march global','Pride marches around the world — pics, dates, plans.'],
    array['lgbtq','culture-global','Queer cinema','Films, shows, recs — global.'],
    array['lgbtq','culture-global','Queer literature','Books, poetry, zines.'],
    array['lgbtq','culture-global','Queer music','LGBTQ+ artists and scenes, worldwide.'],
    array['lgbtq','culture-global','Queer history','Stonewall to today, every region.'],
    array['lgbtq','culture-global','Polyamory · queer','Queer poly experiences and questions.'],
    array['lgbtq','culture-global','Kink · queer','Kink + LGBTQ — consent-first chat.'],

    -- Global cities — top queer-vibrant cities
    array['lgbtq','global-cities','LGBTQ+ · New York','NYC queer everything.'],
    array['lgbtq','global-cities','LGBTQ+ · Los Angeles','LA queer everything.'],
    array['lgbtq','global-cities','LGBTQ+ · San Francisco','SF Bay — the original.'],
    array['lgbtq','global-cities','LGBTQ+ · Chicago','Boystown to Bronzeville.'],
    array['lgbtq','global-cities','LGBTQ+ · London','LDN — Vauxhall to Soho.'],
    array['lgbtq','global-cities','LGBTQ+ · Manchester','Canal Street + beyond.'],
    array['lgbtq','global-cities','LGBTQ+ · Berlin','Berghain to Schöneberg.'],
    array['lgbtq','global-cities','LGBTQ+ · Paris','Marais and beyond.'],
    array['lgbtq','global-cities','LGBTQ+ · Amsterdam','Reguliersdwarsstraat.'],
    array['lgbtq','global-cities','LGBTQ+ · Madrid','Chueca y barrios.'],
    array['lgbtq','global-cities','LGBTQ+ · Barcelona','Eixample + més.'],
    array['lgbtq','global-cities','LGBTQ+ · Rome','Gay Roma.'],
    array['lgbtq','global-cities','LGBTQ+ · Stockholm','Södermalm + más.'],
    array['lgbtq','global-cities','LGBTQ+ · Toronto','Church-Wellesley.'],
    array['lgbtq','global-cities','LGBTQ+ · Montreal','Le Village.'],
    array['lgbtq','global-cities','LGBTQ+ · Mexico City','Zona Rosa y más.'],
    array['lgbtq','global-cities','LGBTQ+ · São Paulo','Paulista pride.'],
    array['lgbtq','global-cities','LGBTQ+ · Rio de Janeiro','Carioca rainbow.'],
    array['lgbtq','global-cities','LGBTQ+ · Buenos Aires','Recoleta + Palermo.'],
    array['lgbtq','global-cities','LGBTQ+ · Sydney','Mardi Gras central.'],
    array['lgbtq','global-cities','LGBTQ+ · Melbourne','Smith + Brunswick.'],
    array['lgbtq','global-cities','LGBTQ+ · Auckland','Karangahape + beyond.'],
    array['lgbtq','global-cities','LGBTQ+ · Tokyo','Ni-chōme + Tokyo Rainbow.'],
    array['lgbtq','global-cities','LGBTQ+ · Bangkok','Silom + Saphan Khwai.'],
    array['lgbtq','global-cities','LGBTQ+ · Taipei','Asia-Pacific Pride central.'],
    array['lgbtq','global-cities','LGBTQ+ · Seoul','Itaewon + 종로.'],
    array['lgbtq','global-cities','LGBTQ+ · Manila','Quezon City + Makati.'],
    array['lgbtq','global-cities','LGBTQ+ · Cape Town','De Waterkant.'],
    array['lgbtq','global-cities','LGBTQ+ · Johannesburg','Joburg queer.'],
    array['lgbtq','global-cities','LGBTQ+ · Tel Aviv','Tel Aviv pride.'],

    -- Asia-Pacific regional
    array['lgbtq','asia-pacific','Queer Japan','日本 LGBTQ+ コミュニティ.'],
    array['lgbtq','asia-pacific','Queer Korea','퀴어 한국.'],
    array['lgbtq','asia-pacific','Queer Taiwan','First in Asia to legalize.'],
    array['lgbtq','asia-pacific','Queer Hong Kong','HK + queer.'],
    array['lgbtq','asia-pacific','Queer Thailand','Bangkok and the kingdom.'],
    array['lgbtq','asia-pacific','Queer Vietnam','Việt Nam tự hào.'],
    array['lgbtq','asia-pacific','Queer Philippines','Bahaghari, Pilipinas.'],
    array['lgbtq','asia-pacific','Queer Indonesia','LGBTQ+ Indonesia — solidarity.'],
    array['lgbtq','asia-pacific','Queer Australia','Australia + queer.'],
    array['lgbtq','asia-pacific','Queer New Zealand','Aotearoa rainbow.'],

    -- Latin America regional
    array['lgbtq','latin-america','Queer Brasil','LGBTQ+ Brasil — orgulho.'],
    array['lgbtq','latin-america','Queer México','Orgullo mexicano.'],
    array['lgbtq','latin-america','Queer Argentina','Orgullo argentino.'],
    array['lgbtq','latin-america','Queer Colombia','Orgullo Colombia.'],
    array['lgbtq','latin-america','Queer Chile','Orgullo Chile.'],
    array['lgbtq','latin-america','Queer Perú','Orgullo Perú.'],

    -- Africa + MENA
    array['lgbtq','africa-mena','Queer Africa · safe','Anonymous-friendly. Solidarity.'],
    array['lgbtq','africa-mena','Queer South Africa','South Africa rainbow.'],
    array['lgbtq','africa-mena','Queer Nigeria · safe','Anonymous-friendly. No outing.'],
    array['lgbtq','africa-mena','Queer Kenya · safe','Anonymous-friendly. Solidarity.'],
    array['lgbtq','africa-mena','Queer MENA · safe','Middle East + North Africa, anonymous-friendly.'],
    array['lgbtq','africa-mena','Queer diaspora','African + MENA queer diaspora worldwide.'],

    -- Europe regional
    array['lgbtq','europe','Queer UK','UK + queer.'],
    array['lgbtq','europe','Queer Ireland','Irish rainbow.'],
    array['lgbtq','europe','Queer Germany','Deutschland Regenbogen.'],
    array['lgbtq','europe','Queer France','France arc-en-ciel.'],
    array['lgbtq','europe','Queer Spain','España arcoíris.'],
    array['lgbtq','europe','Queer Italy','Italia arcobaleno.'],
    array['lgbtq','europe','Queer Netherlands','Nederland + queer.'],
    array['lgbtq','europe','Queer Nordic','Nordic queer space.'],
    array['lgbtq','europe','Queer Poland · safe','Anonymous-friendly. Solidarity.'],
    array['lgbtq','europe','Queer Eastern Europe · safe','EE queer — anonymous-friendly.']
  ];
  rec text[];
begin
  foreach rec slice 1 in array pairs loop
    perform public.ensure_official_room(
      rec[1], rec[2], rec[3], rec[4],
      'public', false, false, false, null, 200
    );
  end loop;
end$$;
