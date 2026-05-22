-- Karochat — Wave 19: fill the empty catalog categories.
-- Idempotent and additive. Safe to re-run.
--
-- Empty categories (per the lobby): adult, identity, finance, outdoors.
-- Romance has subcats but is light on country breakdowns.
--
-- This migration:
--   1. Ensures catalog_counts() RPC exists (was called by the UI but never
--      defined in a tracked migration).
--   2. Seeds subcategories for the four empty categories + romance extras.
--   3. Seeds country-scoped + India-state-scoped rooms across them.

-- ============================================================================
-- 0) catalog_counts — UI calls this on lobby render to compute per-(cat, sub)
--    totals. Define it idempotently. Counts ALL rooms that have a category +
--    subcategory tag, regardless of is_official, so user-created rooms show
--    up in their chosen category too.
-- ============================================================================
create or replace function public.catalog_counts()
returns table (
  category_slug    text,
  subcategory_slug text,
  room_count       int
)
language sql security definer set search_path = public stable
as $$
  select r.category_slug, r.subcategory_slug, count(*)::int
    from public.rooms r
   where r.category_slug    is not null
     and r.subcategory_slug is not null
     and r.is_dm     is not true
     and r.is_saved  is not true
     and r.is_vault  is not true
     and r.visibility in ('public','listed')
   group by r.category_slug, r.subcategory_slug;
$$;

revoke all on function public.catalog_counts() from public;
grant execute on function public.catalog_counts() to anon, authenticated;

-- ============================================================================
-- 1) Subcategory rows for the empty categories.
-- ============================================================================
insert into public.room_subcategories (category_slug, slug, label, position) values
  -- ADULT (18+, listed visibility on all rooms)
  ('adult', 'adult-global',      'By country',           10),
  ('adult', 'adult-india-states','By Indian state',      20),
  ('adult', 'adult-flirt',       'Flirt lounges',        30),
  ('adult', 'adult-singles',     'Adult singles',        40),
  ('adult', 'adult-dating',      'Adult dating',         50),
  ('adult', 'adult-nightlife',   'Nightlife',            60),

  -- IDENTITY
  ('identity', 'identity-global',       'By country',         10),
  ('identity', 'identity-india-states', 'By Indian state',    20),
  ('identity', 'identity-neurodiv',     'Neurodivergent',     30),
  ('identity', 'identity-disability',   'Disability & access',40),
  ('identity', 'identity-ace-aro',      'Asexual / aromantic',50),
  ('identity', 'identity-polyam',       'Polyamory & open',   60),
  ('identity', 'identity-thirdculture', 'Third-culture / diaspora', 70),

  -- FINANCE
  ('finance', 'finance-global',       'By country',          10),
  ('finance', 'finance-india-states', 'By Indian state',     20),
  ('finance', 'finance-stocks',       'Stocks & markets',    30),
  ('finance', 'finance-crypto',       'Crypto',              40),
  ('finance', 'finance-realestate',   'Real estate',         50),
  ('finance', 'finance-personal',     'Personal finance',    60),
  ('finance', 'finance-startup',      'Startups & VC',       70),

  -- OUTDOORS
  ('outdoors', 'outdoors-global',       'By country',         10),
  ('outdoors', 'outdoors-india-states', 'By Indian state',    20),
  ('outdoors', 'outdoors-hiking',       'Hiking & trekking',  30),
  ('outdoors', 'outdoors-camping',      'Camping & overnights', 40),
  ('outdoors', 'outdoors-cycling',      'Cycling',            50),
  ('outdoors', 'outdoors-road',         'Road trips',         60),
  ('outdoors', 'outdoors-water',        'Beach & water',      70),

  -- ROMANCE extras (subcats may already exist via 0022; safe upsert)
  ('romance', 'romance-global',       'By country',          15),
  ('romance', 'romance-india-states', 'By Indian state',     25)
on conflict (category_slug, slug) do update
  set label = excluded.label,
      position = excluded.position;

-- ============================================================================
-- 2) Bulk-seed the country and state rooms.
-- ============================================================================
do $$
declare
  v_countries text[] := array[
    'India','Pakistan','Bangladesh','Sri Lanka','Nepal',
    'United States','Canada','Mexico','Brazil','Argentina',
    'United Kingdom','Ireland','Germany','France','Spain','Italy','Portugal','Netherlands','Sweden',
    'United Arab Emirates','Saudi Arabia','Qatar','Kuwait','Oman','Bahrain',
    'Singapore','Malaysia','Indonesia','Thailand','Philippines','Vietnam','South Korea','Japan',
    'Australia','New Zealand',
    'South Africa','Nigeria','Kenya','Ghana','Egypt','Morocco'
  ];
  v_india_states text[] := array[
    'Maharashtra','Tamil Nadu','Karnataka','Delhi','West Bengal',
    'Telangana','Andhra Pradesh','Gujarat','Punjab','Kerala',
    'Rajasthan','Uttar Pradesh','Madhya Pradesh','Bihar','Haryana',
    'Jharkhand','Odisha','Chhattisgarh','Assam','Goa','Uttarakhand','Himachal Pradesh'
  ];
  v_country text;
  v_state   text;
begin
  -- ADULT (18+ rooms ship as 'listed' visibility so they aren't surfaced in
  -- non-adult listings outside the catalog).
  foreach v_country in array v_countries loop
    perform public.ensure_official_room(
      'adult', 'adult-global',
      'Adult · ' || v_country,
      '🔞 Consenting adults from ' || v_country || '.',
      'listed', false, false, false, null, 60);
  end loop;
  foreach v_state in array v_india_states loop
    perform public.ensure_official_room(
      'adult', 'adult-india-states',
      'Adult · ' || v_state,
      '🔞 Adults from ' || v_state || '.',
      'listed', false, false, false, null, 50);
  end loop;
  perform public.ensure_official_room('adult','adult-singles','Adult singles · global','🔞 Worldwide adult singles.','listed',true,false,false,null,80);
  perform public.ensure_official_room('adult','adult-singles','Adult singles · India','🔞 Indian adult singles only.','listed',true,false,false,null,80);
  perform public.ensure_official_room('adult','adult-dating','Open dating','🔞 Looking, not promising.','listed',true,false,false,null,60);
  perform public.ensure_official_room('adult','adult-nightlife','After midnight','🔞 Worldwide after-dark lounge.','listed',true,false,false,null,80);
  perform public.ensure_official_room('adult','adult-nightlife','Bombay nights','🔞 Mumbai after-hours.','listed',true,false,false,null,40);
  perform public.ensure_official_room('adult','adult-nightlife','Delhi nights','🔞 Delhi after-hours.','listed',true,false,false,null,40);

  -- IDENTITY
  foreach v_country in array v_countries loop
    perform public.ensure_official_room(
      'identity','identity-global',
      v_country || ' · identity & community',
      'Every way of being human in ' || v_country || '.',
      'public', false, false, false, null, 60);
  end loop;
  foreach v_state in array v_india_states loop
    perform public.ensure_official_room(
      'identity','identity-india-states',
      v_state || ' · identity',
      'Identity & community in ' || v_state || '.',
      'public', false, false, false, null, 50);
  end loop;
  perform public.ensure_official_room('identity','identity-neurodiv','ADHD lounge','Hyperfocus, dopamine, the whole circus.','public',false,false,false,null,80);
  perform public.ensure_official_room('identity','identity-neurodiv','Autistic adults','By and for autistic adults.','public',false,false,false,null,80);
  perform public.ensure_official_room('identity','identity-neurodiv','Late diagnosed','Discovered yourself in your 30s+.','public',false,false,false,null,60);
  perform public.ensure_official_room('identity','identity-disability','Disabled & proud','Visible and invisible disabilities welcome.','public',false,false,false,null,60);
  perform public.ensure_official_room('identity','identity-disability','Chronic illness','Living with the long thing.','public',false,false,false,null,60);
  perform public.ensure_official_room('identity','identity-ace-aro','Ace lounge','Asexual identities — every shade.','public',false,false,false,null,60);
  perform public.ensure_official_room('identity','identity-ace-aro','Aro lounge','Aromantic identities — every shade.','public',false,false,false,null,60);
  perform public.ensure_official_room('identity','identity-polyam','Polyam basics','New to polyamory? Start here.','public',false,false,false,null,60);
  perform public.ensure_official_room('identity','identity-polyam','Ethical non-monogamy','ENM, ENM-curious, ENM-skeptical.','public',false,false,false,null,60);
  perform public.ensure_official_room('identity','identity-thirdculture','TCKs','Third-culture kids — between worlds.','public',false,false,false,null,80);
  perform public.ensure_official_room('identity','identity-thirdculture','Diaspora SoAsia','South Asian diaspora — anywhere.','public',false,false,false,null,80);
  perform public.ensure_official_room('identity','identity-thirdculture','Diaspora Africa','African diaspora — anywhere.','public',false,false,false,null,80);

  -- FINANCE
  foreach v_country in array v_countries loop
    perform public.ensure_official_room(
      'finance','finance-global',
      'Money · ' || v_country,
      'Markets, jobs, costs in ' || v_country || '.',
      'public', false, false, false, null, 60);
  end loop;
  foreach v_state in array v_india_states loop
    perform public.ensure_official_room(
      'finance','finance-india-states',
      'Money · ' || v_state,
      'Personal finance and jobs in ' || v_state || '.',
      'public', false, false, false, null, 50);
  end loop;
  perform public.ensure_official_room('finance','finance-stocks','Indian stocks · NSE/BSE','Nifty, Sensex, midcaps, smallcaps.','public',false,false,false,null,120);
  perform public.ensure_official_room('finance','finance-stocks','US stocks','S&P, NASDAQ, mega-caps to penny.','public',false,false,false,null,120);
  perform public.ensure_official_room('finance','finance-stocks','UK stocks · FTSE','LSE traders only.','public',false,false,false,null,60);
  perform public.ensure_official_room('finance','finance-stocks','Options & derivatives','Calls, puts, spreads.','public',false,false,false,null,80);
  perform public.ensure_official_room('finance','finance-stocks','Day traders','Intraday and scalping.','public',false,false,false,null,80);
  perform public.ensure_official_room('finance','finance-crypto','Bitcoin','BTC only.','public',false,false,false,null,120);
  perform public.ensure_official_room('finance','finance-crypto','Ethereum & L2s','ETH, Optimism, Arbitrum, Base.','public',false,false,false,null,80);
  perform public.ensure_official_room('finance','finance-crypto','Solana','SOL ecosystem.','public',false,false,false,null,80);
  perform public.ensure_official_room('finance','finance-crypto','DeFi & yield','Liquidity, lending, real yield.','public',false,false,false,null,80);
  perform public.ensure_official_room('finance','finance-crypto','India crypto · tax & policy','30% + 1% TDS reality check.','public',false,false,false,null,80);
  perform public.ensure_official_room('finance','finance-realestate','Mumbai real estate','Buy / rent / commute.','public',false,false,false,null,60);
  perform public.ensure_official_room('finance','finance-realestate','Bangalore real estate','Buy / rent / commute.','public',false,false,false,null,60);
  perform public.ensure_official_room('finance','finance-realestate','Delhi-NCR real estate','Buy / rent / commute.','public',false,false,false,null,60);
  perform public.ensure_official_room('finance','finance-realestate','US real estate','Mortgage rates, markets, REITs.','public',false,false,false,null,60);
  perform public.ensure_official_room('finance','finance-realestate','UK real estate','Stamp duty, leasehold, mortgage.','public',false,false,false,null,60);
  perform public.ensure_official_room('finance','finance-personal','Budgeting 101','Spend, save, sleep at night.','public',false,false,false,null,80);
  perform public.ensure_official_room('finance','finance-personal','Debt payoff','Cards, EMIs, sleep.','public',false,false,false,null,60);
  perform public.ensure_official_room('finance','finance-personal','FIRE · India','Financial independence, Indian flavour.','public',false,false,false,null,80);
  perform public.ensure_official_room('finance','finance-personal','FIRE · US','Lean / fat / coast variants.','public',false,false,false,null,80);
  perform public.ensure_official_room('finance','finance-startup','Founders India','India-based founders, every stage.','public',false,false,false,null,80);
  perform public.ensure_official_room('finance','finance-startup','Founders global','Worldwide founders lounge.','public',false,false,false,null,80);
  perform public.ensure_official_room('finance','finance-startup','VC & angels','Deal flow, term sheets, tickets.','public',false,false,false,null,60);

  -- OUTDOORS
  foreach v_country in array v_countries loop
    perform public.ensure_official_room(
      'outdoors','outdoors-global',
      'Outdoors · ' || v_country,
      'Wild places to go in ' || v_country || '.',
      'public', false, false, false, null, 60);
  end loop;
  foreach v_state in array v_india_states loop
    perform public.ensure_official_room(
      'outdoors','outdoors-india-states',
      'Outdoors · ' || v_state,
      'Treks, beaches, rides in ' || v_state || '.',
      'public', false, false, false, null, 50);
  end loop;
  perform public.ensure_official_room('outdoors','outdoors-hiking','Himalayan treks','EBC, Markha, Hampta, Sandakphu.','public',false,false,false,null,100);
  perform public.ensure_official_room('outdoors','outdoors-hiking','Western Ghats','Sahyadri trails — monsoon-safe and not.','public',false,false,false,null,80);
  perform public.ensure_official_room('outdoors','outdoors-hiking','Alps & Dolomites','Europe high routes.','public',false,false,false,null,60);
  perform public.ensure_official_room('outdoors','outdoors-hiking','PCT & AT','American thru-hikes.','public',false,false,false,null,60);
  perform public.ensure_official_room('outdoors','outdoors-hiking','Day hikers','Sunup, summit, sundown.','public',false,false,false,null,80);
  perform public.ensure_official_room('outdoors','outdoors-camping','Wild camping · India','Bring your own permit.','public',false,false,false,null,60);
  perform public.ensure_official_room('outdoors','outdoors-camping','Car camping','Roof tents, RVs, base camps.','public',false,false,false,null,60);
  perform public.ensure_official_room('outdoors','outdoors-camping','Bikepacking','Pedals + panniers + sleep wherever.','public',false,false,false,null,60);
  perform public.ensure_official_room('outdoors','outdoors-cycling','Road cycling','Tarmac, KOMs, kits.','public',false,false,false,null,60);
  perform public.ensure_official_room('outdoors','outdoors-cycling','MTB & gravel','Off-road, drop-bar, jump lines.','public',false,false,false,null,60);
  perform public.ensure_official_room('outdoors','outdoors-cycling','Cycle commuters','Daily 2-wheel city kit.','public',false,false,false,null,60);
  perform public.ensure_official_room('outdoors','outdoors-road','Leh-Manali','THE ride. Plan + survive.','public',false,false,false,null,80);
  perform public.ensure_official_room('outdoors','outdoors-road','Spiti & Ladakh','High-altitude road plans.','public',false,false,false,null,80);
  perform public.ensure_official_room('outdoors','outdoors-road','Route 66','Cross-USA roadtrips.','public',false,false,false,null,60);
  perform public.ensure_official_room('outdoors','outdoors-road','Garden Route','South African coast drive.','public',false,false,false,null,40);
  perform public.ensure_official_room('outdoors','outdoors-water','Goa & Konkan','Indian west coast beaches.','public',false,false,false,null,80);
  perform public.ensure_official_room('outdoors','outdoors-water','Andaman & Lakshadweep','India islands.','public',false,false,false,null,60);
  perform public.ensure_official_room('outdoors','outdoors-water','Diving · Asia','Bali, Boracay, Andaman, Maldives.','public',false,false,false,null,60);
  perform public.ensure_official_room('outdoors','outdoors-water','Surf · global','Wave-chasing planet-wide.','public',false,false,false,null,60);

  -- ROMANCE — fill out by-country and by-state with broader coverage.
  foreach v_country in array v_countries loop
    perform public.ensure_official_room(
      'romance','romance-global',
      'Romance · ' || v_country,
      'Dating and flirts in ' || v_country || '.',
      'public', true, false, false, null, 80);
  end loop;
  foreach v_state in array v_india_states loop
    perform public.ensure_official_room(
      'romance','romance-india-states',
      'Romance · ' || v_state,
      'Dating in ' || v_state || '.',
      'public', true, false, false, null, 50);
  end loop;
end$$;

-- ============================================================================
-- 3) Make sure the adult category is flagged is_adult (drives the 18+ chip
--    in browse_catalog — it falls back to room_categories.is_adult).
-- ============================================================================
update public.room_categories set is_adult = true where slug = 'adult';
