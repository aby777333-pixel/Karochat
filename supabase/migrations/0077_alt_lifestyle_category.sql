-- Karochat — "Alternative Lifestyle (18+)" category.
--
-- Adult dating, casual encounters, alternative relationships & lifestyle for
-- consenting adults, organised globally. Mirrors the EXISTING `adult` category
-- conventions exactly: the category carries is_adult = true (so every room
-- shows the 18+ badge via browse_catalog), and rooms are seeded `public`
-- (same as the 275 existing adult rooms). The platform's one-time legal/terms
-- gate already covers entry — no new gating logic is introduced.
--
-- People create + name their own rooms here via the existing "+ Create your
-- own room" CTA and choose Public / listed (invite) / unlisted / secret with
-- the existing room-creation system. Purely additive + idempotent; nothing
-- existing is removed, renamed, or renumbered. Uses ensure_official_room (0015).

-- ── Top-level category (position 34, right after Accommodation = 33) ─────────
insert into public.room_categories (slug, label, description, icon, position, is_adult) values
  ('alt-lifestyle', 'Alternative Lifestyle (18+)',
   'Adult dating, casual encounters, alternative relationships & lifestyle. 18+, consensual, frank.',
   '💋', 34, true)
on conflict (slug) do update
  set label = excluded.label, description = excluded.description,
      icon = excluded.icon, position = excluded.position, is_adult = excluded.is_adult;

-- ── Subcategories ───────────────────────────────────────────────────────────
insert into public.room_subcategories (category_slug, slug, label, position) values
  ('alt-lifestyle','alt-casual',    'Casual Dating & Encounters',     10),
  ('alt-lifestyle','alt-fwb',       'FWB & Cohabitation',             20),
  ('alt-lifestyle','alt-group',     'Group Dating & Social',          30),
  ('alt-lifestyle','alt-swinging',  'Swinging & Lifestyle',           40),
  ('alt-lifestyle','alt-enm',       'Open, Poly & Non-Monogamy',      50),
  ('alt-lifestyle','alt-dynamics',  'Relationship Dynamics',          60),
  ('alt-lifestyle','alt-straight',  'Straight Communities',           70),
  ('alt-lifestyle','alt-bisexual',  'Bisexual Communities',           80),
  ('alt-lifestyle','alt-gay',       'Gay Communities',                90),
  ('alt-lifestyle','alt-lesbian',   'Lesbian Communities',            100),
  ('alt-lifestyle','alt-lgbtq',     'LGBTQ+ Communities',             110),
  ('alt-lifestyle','alt-naturist',  'Naturist & Clothing-Optional',   120),
  ('alt-lifestyle','alt-couples',   'Couples Communities',            130),
  ('alt-lifestyle','alt-mature',    'Mature Communities',             140),
  ('alt-lifestyle','alt-travel',    'Travel, Resorts & Events',       150),
  ('alt-lifestyle','alt-verify',    'Verified members & hosts',       160),
  ('alt-lifestyle','alt-local',     'Local · by country & city',      170)
on conflict (category_slug, slug) do update
  set label = excluded.label, position = excluded.position;

-- ── Topic rooms ─────────────────────────────────────────────────────────────
do $$
declare
  t text;
  v_casual    text[] := array['One Night Flings','Casual Meetups','Casual Dating','Casual Connections','Casual Relationships','No Strings Attached (NSA)','Adult Meetups','Spontaneous Meetups','Open-Minded Singles','Weekend Connections','Travel Flings','Vacation Encounters','Local Adult Connections','Mature Casual Dating'];
  v_fwb       text[] := array['Friends With Benefits (FWB)','Long-Term FWB','Local FWB Communities','Ongoing Casual Connections','Living Together','Cohabitation','Trial Living Arrangements','Relationship Without Marriage','Alternative Partnerships','Roommates With Benefits'];
  v_group     text[] := array['Group Dating','Group Meetups','Singles Groups','Couples Groups','Adult Social Circles','Lifestyle Social Events','Social Networking Communities','Mixed Social Groups','Open-Minded Social Communities'];
  v_swing     text[] := array['Swinging','Swinger Communities','Lifestyle Communities','Couples Seeking Couples','Singles & Couples Networking','Lifestyle Travel','Lifestyle Resorts','New To Swinging','Experienced Lifestyle Members','Swinging Events','Swinging Discussions','International Lifestyle Communities'];
  v_enm       text[] := array['Open Relationships','Ethical Non-Monogamy','Polyamory','Open Marriages','Multiple Partner Relationships','Alternative Relationships','Relationship Exploration','Modern Relationship Models','Relationship Freedom Communities'];
  v_dynamics  text[] := array['Cuckold Discussions','Hotwife Communities','MFM','FMF','Group Play','Couples Seeking Single Men','Couples Seeking Single Women','Power Exchange Discussions','Lifestyle Dynamics','Relationship Role Communities','Alternative Relationship Dynamics'];
  v_straight  text[] := array['Straight Singles','Straight Dating','Straight Couples','Straight Social Groups'];
  v_bi        text[] := array['Bisexual Singles','Bisexual Dating','Bisexual Couples','Bisexual Social Networking','Bisexual Lifestyle Communities'];
  v_gay       text[] := array['Gay Singles','Gay Dating','Gay Relationships','Gay Social Groups','Gay Lifestyle Communities'];
  v_lesbian   text[] := array['Lesbian Singles','Lesbian Dating','Lesbian Relationships','Lesbian Social Groups','Lesbian Lifestyle Communities'];
  v_lgbtq     text[] := array['LGBTQ+ Dating','LGBTQ+ Relationships','LGBTQ+ Social Networking','LGBTQ+ Meetups','LGBTQ+ Lifestyle Communities'];
  v_naturist  text[] := array['Nude Beaches','Naturist Beaches','Nude Hiking','Naturist Hiking','Nude Camping','Naturist Camping','Clothing-Optional Resorts','Naturist Travel','Body Positivity Communities','Naturist Meetups','Naturist Social Groups','Clothing-Optional Vacations'];
  v_couples   text[] := array['Couples Lounge','Married Couples','Long-Term Couples','Open-Minded Couples','Couples Seeking Friends','Couples Networking','Couples Travel','Couples Social Communities'];
  v_mature    text[] := array['30+ Dating','40+ Dating','50+ Dating','60+ Dating','Senior Dating','Mature Relationships','Mature Singles','Mature Lifestyle Communities'];
  v_travel    text[] := array['Lifestyle Travel','Resort Meetups','Cruise Meetups','International Lifestyle Travel','Adult Vacations','Holiday Connections','Destination Meetups','Social Retreats','Lifestyle Gatherings','Community Events'];
  v_verify    text[] := array['Verified Members Lounge','Verified Couples','Verified Hosts','Verified Event Organizers','Verified Communities'];
begin
  foreach t in array v_casual loop
    perform public.ensure_official_room('alt-lifestyle','alt-casual', t, t || ' — meet open-minded adults near you. 18+, be respectful & consensual.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_fwb loop
    perform public.ensure_official_room('alt-lifestyle','alt-fwb', t, t || ' — honest, low-pressure adult connections. 18+.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_group loop
    perform public.ensure_official_room('alt-lifestyle','alt-group', t, t || ' — social circles & group meetups. 18+.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_swing loop
    perform public.ensure_official_room('alt-lifestyle','alt-swinging', t, t || ' — the lifestyle, with respect & consent. 18+.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_enm loop
    perform public.ensure_official_room('alt-lifestyle','alt-enm', t, t || ' — open, poly & ethically non-monogamous. 18+.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_dynamics loop
    perform public.ensure_official_room('alt-lifestyle','alt-dynamics', t, t || ' — consenting-adult relationship dynamics. 18+.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_straight loop
    perform public.ensure_official_room('alt-lifestyle','alt-straight', t, t || ' — straight community. 18+.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_bi loop
    perform public.ensure_official_room('alt-lifestyle','alt-bisexual', t, t || ' — bi+ community. 18+.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_gay loop
    perform public.ensure_official_room('alt-lifestyle','alt-gay', t, t || ' — gay community. 18+.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_lesbian loop
    perform public.ensure_official_room('alt-lifestyle','alt-lesbian', t, t || ' — lesbian community. 18+.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_lgbtq loop
    perform public.ensure_official_room('alt-lifestyle','alt-lgbtq', t, t || ' — LGBTQ+ community. 18+.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_naturist loop
    perform public.ensure_official_room('alt-lifestyle','alt-naturist', t, t || ' — naturist & clothing-optional, body-positive. 18+.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_couples loop
    perform public.ensure_official_room('alt-lifestyle','alt-couples', t, t || ' — for couples & open-minded partners. 18+.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_mature loop
    perform public.ensure_official_room('alt-lifestyle','alt-mature', t, t || ' — mature adults & seniors. 18+.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_travel loop
    perform public.ensure_official_room('alt-lifestyle','alt-travel', t, t || ' — lifestyle travel, resorts & events. 18+.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_verify loop
    perform public.ensure_official_room('alt-lifestyle','alt-verify', t, t || ' — verified members, couples & hosts. 18+.', 'public', false, false, false, null, 80);
  end loop;

  -- A few voice-enabled lounges.
  perform public.ensure_official_room('alt-lifestyle','alt-couples','Couples Voice Lounge', 'Live voice lounge for couples. 18+.', 'public', true, false, false, null, 100);
  perform public.ensure_official_room('alt-lifestyle','alt-casual','Singles Voice Lounge', 'Live voice lounge for singles. 18+.', 'public', true, false, false, null, 100);
  perform public.ensure_official_room('alt-lifestyle','alt-swinging','Lifestyle Voice Lounge', 'Live voice lounge for the lifestyle. 18+.', 'public', true, false, false, null, 100);
end$$;

-- ── Local rooms · Continent → Country → State → District → City ─────────────
do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('Casual Meetups','India','Kerala','Ernakulam','Kochi'),
      ('Casual Meetups','India','Maharashtra','Mumbai','Mumbai'),
      ('FWB','India','Karnataka','Bengaluru','Bengaluru'),
      ('Swinging','India','Delhi','New Delhi','Delhi'),
      ('FWB','USA','Florida','Miami-Dade County','Miami'),
      ('Casual Dating','USA','New York','New York County','New York City'),
      ('Swinging','USA','Nevada','Clark County','Las Vegas'),
      ('Naturists','USA','California','Los Angeles County','Los Angeles'),
      ('Swinging','United Kingdom','England','Greater London','London'),
      ('Casual Dating','United Kingdom','England','Greater Manchester','Manchester'),
      ('Naturists','Spain','Catalonia','Barcelona','Barcelona'),
      ('Lifestyle','Spain','Community of Madrid','Madrid','Madrid'),
      ('Gay Dating','Australia','New South Wales','Sydney','Sydney'),
      ('Lifestyle','Australia','Victoria','Melbourne','Melbourne'),
      ('Lesbian Dating','Canada','Ontario','Toronto','Toronto'),
      ('Casual Dating','Canada','British Columbia','Metro Vancouver','Vancouver'),
      ('Lifestyle','UAE','Dubai','Dubai','Dubai'),
      ('Casual Dating','Germany','Berlin','Berlin','Berlin'),
      ('Lifestyle','Netherlands','North Holland','Amsterdam','Amsterdam'),
      ('Casual Dating','Thailand','Bangkok','Bangkok','Bangkok'),
      ('Lifestyle','Brazil','Rio de Janeiro','Rio de Janeiro','Rio de Janeiro'),
      ('Casual Dating','Mexico','Mexico City','Mexico City','Mexico City'),
      ('Lifestyle','France','Île-de-France','Paris','Paris'),
      ('Casual Dating','Singapore','Central Region','Singapore','Singapore'),
      ('Lifestyle','South Africa','Gauteng','Johannesburg','Johannesburg')
    ) as t(topic, country, state, district, city)
  loop
    perform public.ensure_official_room('alt-lifestyle','alt-local',
      rec.topic || ' · ' || rec.city || ', ' || rec.state,
      rec.topic || ' for open-minded adults in ' || rec.city
        || ' (' || rec.district || ', ' || rec.state || ', ' || rec.country
        || '). 18+, consensual, respectful.',
      'public', false, false, false, null, 80);
  end loop;

  perform public.ensure_official_room('alt-lifestyle','alt-local',
    'Worldwide lobby', 'Anywhere on Earth — find your people. 18+.',
    'public', false, false, false, null, 150);
  perform public.ensure_official_room('alt-lifestyle','alt-local',
    'Add your country or city', 'Create a room for your country, region or town here. 18+.',
    'public', false, false, false, null, 100);
end$$;
