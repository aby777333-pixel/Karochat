-- Karochat — "Money, Trading & Investing" expansion.
--
-- Extends the EXISTING `finance` category (position 8). Purely additive: new
-- subcategories use fresh slugs that don't collide with the current ones
-- (finance-global, finance-india-states, finance-stocks, finance-crypto,
-- finance-realestate, finance-personal, finance-startup); existing subcats
-- (crypto, stocks) are just enriched with more rooms. Public by default; a few
-- "live" rooms get voice enabled. People add their own rooms via the existing
-- "+ Create your own room" CTA. Idempotent; nothing existing is removed.

-- ── New subcategories ───────────────────────────────────────────────────────
insert into public.room_subcategories (category_slug, slug, label, position) values
  ('finance','finance-forex',         'Forex Trading',               80),
  ('finance','finance-commodities',   'Commodities',                 90),
  ('finance','finance-indices',       'Indices & Futures',           100),
  ('finance','finance-options',       'Options & Derivatives',       110),
  ('finance','finance-funds',         'Funds & Asset Management',    120),
  ('finance','finance-fixed-income',  'Fixed Income & Bonds',        130),
  ('finance','finance-business',      'Business & Entrepreneurship', 140),
  ('finance','finance-banking',       'Banking & Financial Services',150),
  ('finance','finance-wealth',        'Wealth Building',             160),
  ('finance','finance-economy',       'Economic Discussions',        170),
  ('finance','finance-trading-tech',  'Trading Technology',          180),
  ('finance','finance-education',     'Education & Learning',        190),
  ('finance','finance-pros',          'Professional Communities',    200),
  ('finance','finance-alt',           'Alternative Investments',     210),
  ('finance','finance-opportunities', 'Marketplace & Opportunities', 220),
  ('finance','finance-regional',      'Regional · by country & city',230)
on conflict (category_slug, slug) do update
  set label = excluded.label, position = excluded.position;

-- ── Type-based rooms ────────────────────────────────────────────────────────
do $$
declare
  t text;
  v_forex     text[] := array['Forex Beginners','Forex Strategies','Forex Signals','Forex Analysis','Forex Brokers','Major Currency Pairs','Minor Currency Pairs','Exotic Currency Pairs','Scalping','Swing Trading','Day Trading','Position Trading','Algorithmic Forex Trading'];
  v_crypto    text[] := array['Bitcoin','Ethereum','Altcoins','Meme Coins','Stablecoins','DeFi','NFTs','Crypto Mining','Crypto Staking','Web3','Blockchain Technology','Crypto Trading Strategies'];
  v_stocks    text[] := array['Stock Market Beginners','Day Trading Stocks','Swing Trading Stocks','Value Investing','Growth Investing','Dividend Investing','Penny Stocks','Blue Chip Stocks','Earnings Discussions','IPO Discussions','US Stocks','European Stocks','Indian Stocks','Asian Stocks','Emerging Markets'];
  v_commod    text[] := array['Gold Trading','Silver Trading','Oil Trading','Natural Gas','Agricultural Commodities','Metals Markets'];
  v_indices   text[] := array['US Indices','European Indices','Asian Markets','Global Indices','Futures Trading'];
  v_options   text[] := array['Options Trading','Futures & Derivatives','CFDs','Derivatives Strategies','Hedging','Volatility Trading'];
  v_funds     text[] := array['Mutual Funds','Index Funds','ETFs','Hedge Funds','Fund Management','Wealth Management'];
  v_fixed     text[] := array['Bonds','Government Bonds','Corporate Bonds','Treasury Investments','Fixed Deposits','Savings Instruments'];
  v_business  text[] := array['Startups','Business Funding','Venture Capital','Angel Investing','Crowdfunding','Business Acquisition','Franchises','Business Ideas','Online Businesses','Small Business Owners','Side Hustles','E-Commerce','Digital Businesses'];
  v_banking   text[] := array['Personal Banking','Corporate Banking','Digital Banking','FinTech','Payment Systems','Credit Cards','Loans & Mortgages','Financial Regulations'];
  v_wealth    text[] := array['Financial Freedom','Passive Income','Multiple Income Streams','Budgeting','Saving Money','Debt Reduction','Wealth Creation','Family Wealth Planning'];
  v_economy   text[] := array['Global Economy','Inflation','Interest Rates','Central Banks','Federal Reserve','RBI Discussions','Monetary Policy','Economic News'];
  v_tech      text[] := array['Trading Platforms','Algorithmic Trading','Expert Advisors (EAs)','Trading Bots','Artificial Intelligence Trading','Quantitative Trading','Trading Software','Market Data Analysis'];
  v_edu       text[] := array['Learn Trading','Learn Investing','Financial Literacy','Personal Finance Basics','Trading Psychology','Risk Management','Technical Analysis','Fundamental Analysis','Price Action Trading','Smart Money Concepts','Institutional Trading','Portfolio Management'];
  v_pros      text[] := array['Fund Managers','Financial Advisors','Investment Bankers','Wealth Managers','Traders Network','Brokers Network','FinTech Professionals','Economists'];
  v_alt       text[] := array['Precious Metals','Collectibles','Art Investments','Wine Investments','Luxury Assets','Venture Investments','Private Equity'];
  v_opps      text[] := array['Investment Opportunities','Joint Ventures','Capital Raising','Investor Meetups','Startup Pitches','Business Partnerships','Trading Communities','Wealth Networking'];
begin
  foreach t in array v_forex loop
    perform public.ensure_official_room('finance','finance-forex', t, t || ' — forex traders, strategies & analysis.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_crypto loop
    perform public.ensure_official_room('finance','finance-crypto', t, t || ' — crypto discussion & strategy.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_stocks loop
    perform public.ensure_official_room('finance','finance-stocks', t, t || ' — equities, picks & analysis.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_commod loop
    perform public.ensure_official_room('finance','finance-commodities', t, t || ' — commodity markets & trades.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_indices loop
    perform public.ensure_official_room('finance','finance-indices', t, t || ' — index & futures trading.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_options loop
    perform public.ensure_official_room('finance','finance-options', t, t || ' — options, futures & hedging.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_funds loop
    perform public.ensure_official_room('finance','finance-funds', t, t || ' — funds & asset management.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_fixed loop
    perform public.ensure_official_room('finance','finance-fixed-income', t, t || ' — bonds & fixed income.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_business loop
    perform public.ensure_official_room('finance','finance-business', t, t || ' — founders, funding & growth.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_banking loop
    perform public.ensure_official_room('finance','finance-banking', t, t || ' — banking, fintech & services.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_wealth loop
    perform public.ensure_official_room('finance','finance-wealth', t, t || ' — build wealth & financial freedom.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_economy loop
    perform public.ensure_official_room('finance','finance-economy', t, t || ' — economy, policy & news.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_tech loop
    perform public.ensure_official_room('finance','finance-trading-tech', t, t || ' — platforms, bots & quant.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_edu loop
    perform public.ensure_official_room('finance','finance-education', t, t || ' — learn to trade & invest.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_pros loop
    perform public.ensure_official_room('finance','finance-pros', t, t || ' — professional finance network.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_alt loop
    perform public.ensure_official_room('finance','finance-alt', t, t || ' — alternative & private assets.', 'public', false, false, false, null, 80);
  end loop;
  foreach t in array v_opps loop
    perform public.ensure_official_room('finance','finance-opportunities', t, t || ' — deals, capital & networking.', 'public', false, false, false, null, 100);
  end loop;

  -- A few live, voice-enabled market rooms.
  perform public.ensure_official_room('finance','finance-education','Live Market Discussion', 'Talk the markets live — voice on.', 'public', true, false, false, null, 100);
  perform public.ensure_official_room('finance','finance-forex','Forex Live Room', 'Live forex session — voice on.', 'public', true, false, false, null, 100);
  perform public.ensure_official_room('finance','finance-crypto','Crypto Live Room', 'Live crypto session — voice on.', 'public', true, false, false, null, 100);
end$$;

-- ── Regional market rooms · topic × location ────────────────────────────────
do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('Investing','India','Kerala'),
      ('Investing','India','Maharashtra'),
      ('Forex','India','Mumbai'),
      ('Stocks','India','Bengaluru'),
      ('Crypto','India','Delhi'),
      ('Startups','India','Bengaluru'),
      ('Stocks','USA','New York'),
      ('Investing','USA','California'),
      ('Crypto','Singapore','Singapore'),
      ('Real Estate','UAE','Dubai'),
      ('Forex','UAE','Dubai'),
      ('Startups','UK','London'),
      ('Stocks','UK','London'),
      ('Investing','Canada','Toronto'),
      ('Crypto','Nigeria','Lagos'),
      ('Forex','Nigeria','Lagos'),
      ('Stocks','Australia','Sydney'),
      ('Investing','Germany','Frankfurt'),
      ('Crypto','Japan','Tokyo'),
      ('Startups','Singapore','Singapore')
    ) as t(topic, country, place)
  loop
    perform public.ensure_official_room('finance','finance-regional',
      rec.topic || ' · ' || rec.place || ', ' || rec.country,
      rec.topic || ' community for ' || rec.place || ', ' || rec.country
        || ' — local markets, meetups & opportunities.',
      'public', false, false, false, null, 80);
  end loop;

  perform public.ensure_official_room('finance','finance-regional',
    'Add your country or city', 'Create a market room for your country, state or city here.',
    'public', false, false, false, null, 100);
end$$;
