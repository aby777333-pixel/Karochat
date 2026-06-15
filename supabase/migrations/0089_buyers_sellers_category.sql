-- Karochat — "Buyers & Sellers" rooms category (country- and state-wise).
--
-- A dedicated marketplace-style category where people meet to buy & sell, with
-- rooms organised worldwide (by country) and India state-wise + city-wise, plus
-- general buyer / seller lounges.
--
-- Purely additive + idempotent (mirrors the marketplace migration 0052):
--   * Uses ensure_official_room() (0015) so member counts / RLS stay correct.
--   * `on conflict ... do update` upserts the category + subcategories, so it is
--     safe to re-run.
--   * Nothing existing is removed, renamed or renumbered. Position 37 sits just
--     after the last main category (ayur-altmed-diet = 36); the `buy-sell` slug
--     is new. User-created rooms are unaffected.

-- ============================================================================
-- 0) Top-level category
-- ============================================================================
insert into public.room_categories (slug, label, description, icon, position, is_adult) values
  ('buy-sell', 'Buyers & Sellers', 'Buy & sell anything — worldwide, India state-wise & city-wise.', '🤝', 37, false)
on conflict (slug) do update
  set label = excluded.label,
      description = excluded.description,
      icon = excluded.icon,
      position = excluded.position;

-- ============================================================================
-- 1) Subcategories
-- ============================================================================
insert into public.room_subcategories (category_slug, slug, label, position) values
  ('buy-sell','bs-buyers',       'Buyers',                 10),
  ('buy-sell','bs-sellers',      'Sellers',                20),
  ('buy-sell','bs-india-states', 'India · by state',       30),
  ('buy-sell','bs-india-cities', 'India · top cities',     40),
  ('buy-sell','bs-countries',    'Worldwide · by country', 50)
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
    'Singapore','Germany','France','Italy','Spain','Netherlands','Saudi Arabia',
    'Qatar','Kuwait','Oman','Bahrain','Malaysia','New Zealand','Ireland',
    'South Africa','Nigeria','Kenya','Brazil','Mexico','Japan','South Korea',
    'Indonesia','Philippines','Thailand','Vietnam','Pakistan','Bangladesh',
    'Sri Lanka','Nepal'
  ];
  s text;
  c text;
  k text;
begin
  -- ----- GENERAL BUYER LOUNGES -------------------------------------------
  perform public.ensure_official_room('buy-sell','bs-buyers',
    'Buyers · India', 'Looking to buy? Post what you want across India.',
    'public', false, false, false, null, 150);
  perform public.ensure_official_room('buy-sell','bs-buyers',
    'Buyers · Worldwide', 'Buyers from anywhere — post your wishlist.',
    'public', false, false, false, null, 120);
  perform public.ensure_official_room('buy-sell','bs-buyers',
    'Wanted / in search of', 'Can''t find it? Ask the sellers here.',
    'public', false, false, false, null, 100);
  perform public.ensure_official_room('buy-sell','bs-buyers',
    'Bulk & wholesale buyers', 'Buying in volume — connect with suppliers.',
    'public', false, false, false, null, 80);

  -- ----- GENERAL SELLER LOUNGES ------------------------------------------
  perform public.ensure_official_room('buy-sell','bs-sellers',
    'Sellers · India', 'Got something to sell? List it for buyers in India.',
    'public', false, false, false, null, 150);
  perform public.ensure_official_room('buy-sell','bs-sellers',
    'Sellers · Worldwide', 'Sell to buyers anywhere on earth.',
    'public', false, false, false, null, 120);
  perform public.ensure_official_room('buy-sell','bs-sellers',
    'Wholesalers & distributors', 'Wholesale lots, distribution & supply.',
    'public', false, false, false, null, 100);
  perform public.ensure_official_room('buy-sell','bs-sellers',
    'Manufacturers & exporters', 'Makers & exporters meeting buyers.',
    'public', false, false, false, null, 80);

  -- ----- INDIA · STATE-WISE ----------------------------------------------
  foreach s in array v_states loop
    perform public.ensure_official_room('buy-sell','bs-india-states',
      'Buyers & Sellers · ' || s,
      'Buy & sell anything in ' || s || ' — connect locally.',
      'public', false, false, false, null, 100);
  end loop;

  -- ----- INDIA · CITY-WISE -----------------------------------------------
  foreach c in array v_cities loop
    perform public.ensure_official_room('buy-sell','bs-india-cities',
      'Buyers & Sellers · ' || c,
      'Local buyers & sellers in ' || c || '.',
      'public', false, false, false, null, 120);
  end loop;

  -- ----- WORLDWIDE · COUNTRY-WISE ----------------------------------------
  foreach k in array v_countries loop
    perform public.ensure_official_room('buy-sell','bs-countries',
      'Buyers & Sellers · ' || k,
      'Buy & sell in ' || k || ' — local marketplace.',
      'public', false, false, false, null, 100);
  end loop;
end$$;
