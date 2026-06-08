-- Karochat — Wave 22: affirming gender-identity rooms.
-- Non-binary, genderqueer, agender, two-spirit, intersex, India's third
-- gender (Hijra / Kinnar), pronouns & expression, and trans / transition
-- support. Identity-affirming by design (see the People's Charter).
-- Idempotent and additive. Users can still create + name their own rooms via
-- the normal create-room flow; these are official seeds alongside them.

insert into public.room_subcategories (category_slug, slug, label, position) values
  ('lgbtq', 'lgbtq-genders',  'Gender identities',      9),
  ('lgbtq', 'lgbtq-pronouns', 'Pronouns & expression', 10),
  ('lgbtq', 'lgbtq-trans',    'Trans & transition',    11)
on conflict (category_slug, slug) do update
  set label = excluded.label, position = excluded.position;

do $$
declare
  r record;
begin
  -- ----- Gender identities -------------------------------------------------
  for r in select * from (values
    ('Non-binary lounge',        'For all non-binary folks — enby & proud.'),
    ('They/them lounge',         'A home for they/them and beyond.'),
    ('Genderqueer',              'Queering gender, together.'),
    ('Genderfluid',             'Flowing between and beyond genders.'),
    ('Agender',                  'No gender, all welcome.'),
    ('Bigender',                 'Two genders, one you.'),
    ('Demiboy & demigirl',       'Partly, mostly, sort-of — demigender folks.'),
    ('Pangender',                'Every gender, all at once.'),
    ('Neutrois',                 'Neutral / null gender community.'),
    ('Androgyne',                'Between masculine and feminine.'),
    ('Genderflux',               'When intensity of gender shifts.'),
    ('Xenogender',               'Genders beyond the human binary.'),
    ('Maverique',                'A gender all its own.'),
    ('Multigender & plural',     'More than one — multigender folks.'),
    ('Gender nonconforming',     'Breaking the mould, however you like.'),
    ('Two-Spirit',               'For Indigenous Two-Spirit people.'),
    ('Intersex & proud',         'By and for intersex people.'),
    ('Third gender · Hijra/Kinnar (India)', 'India''s third-gender & Hijra/Kinnar community.'),
    ('Questioning my gender',    'Not sure yet? You belong here.'),
    ('Enby India',               'Non-binary folks across India.'),
    ('Enby joy',                 'Gender euphoria & good vibes only.')
  ) as t(name, topic) loop
    perform public.ensure_official_room('lgbtq','lgbtq-genders', r.name, r.topic,
      'public', false, false, false, null, 80);
  end loop;

  -- ----- Pronouns & expression --------------------------------------------
  for r in select * from (values
    ('they/them',                'they/them speakers & friends.'),
    ('she/they',                 'she/they folks.'),
    ('he/they',                  'he/they folks.'),
    ('any pronouns',             'Use whatever — all good here.'),
    ('ask my pronouns',          'Pronouns vary / ask first.'),
    ('neopronouns (xe/ze/fae)',  'Neopronoun users & learners.'),
    ('Name & pronoun support',   'Changing your name / pronouns, socially or legally.'),
    ('Gender expression & style','Clothes, hair, presentation, euphoria.'),
    ('Drag & androgyny',         'Drag, kings, queens, in-betweens.')
  ) as t(name, topic) loop
    perform public.ensure_official_room('lgbtq','lgbtq-pronouns', r.name, r.topic,
      'public', false, false, false, null, 70);
  end loop;

  -- ----- Trans & transition ------------------------------------------------
  for r in select * from (values
    ('Trans umbrella',           'All trans & gender-diverse people.'),
    ('Transfeminine / trans women', 'Trans women & transfem folks.'),
    ('Transmasculine / trans men',  'Trans men & transmasc folks.'),
    ('Coming out',               'Telling family, friends, the world.'),
    ('Social transition',        'Name, pronouns, presentation, day-to-day.'),
    ('Medical transition & HRT',  'HRT, surgery, healthcare — peer support.'),
    ('Trans joy',                'Euphoria, wins, and good days.'),
    ('Trans & faith',            'Holding faith and identity together.'),
    ('Trans India',              'Trans & gender-diverse folks in India.'),
    ('Trans elders',             'Wisdom, history, and being seen.'),
    ('Newly out & questioning',  'Just starting out — welcome.'),
    ('Allies for trans folks',   'Show up, listen, support.')
  ) as t(name, topic) loop
    perform public.ensure_official_room('lgbtq','lgbtq-trans', r.name, r.topic,
      'public', false, false, false, null, 80);
  end loop;
end$$;
