-- Karochat — "Ayurveda, Alternative Medicine & Diet" room category.
--
-- A new top-level Rooms category with default seeded rooms across Ayurveda,
-- Alternative Medicine, Diet & Nutrition, Wellness and Herbs & Plants, plus a
-- Community group of popular topics. Users create their own public/private
-- rooms here via the existing "+ Create your own room" CTA (no client change).
-- Wellness rooms are voice-enabled for live yoga/meditation sessions.
--
-- Purely additive + idempotent (ensure_official_room, migration 0015). Nothing
-- existing is removed, renamed, or renumbered.

-- ── Top-level category (position 36, after Infotainment = 35) ────────────────
insert into public.room_categories (slug, label, description, icon, position, is_adult) values
  ('ayur-altmed-diet', 'Ayurveda, Alternative Medicine & Diet',
   'Ayurveda, herbal & alternative medicine, diet, nutrition & holistic wellness. Community discussion.',
   '🌿', 36, false)
on conflict (slug) do update
  set label = excluded.label, description = excluded.description,
      icon = excluded.icon, position = excluded.position, is_adult = excluded.is_adult;

-- ── Subcategories ───────────────────────────────────────────────────────────
insert into public.room_subcategories (category_slug, slug, label, position) values
  ('ayur-altmed-diet','ayur-ayurveda',  'Ayurveda',             10),
  ('ayur-altmed-diet','ayur-altmed',    'Alternative Medicine', 20),
  ('ayur-altmed-diet','ayur-diet',      'Diet & Nutrition',     30),
  ('ayur-altmed-diet','ayur-wellness',  'Wellness',             40),
  ('ayur-altmed-diet','ayur-herbs',     'Herbs & Plants',       50),
  ('ayur-altmed-diet','ayur-community', 'Community',            60)
on conflict (category_slug, slug) do update
  set label = excluded.label, position = excluded.position;

-- ── Default rooms ───────────────────────────────────────────────────────────
do $$
declare
  t text;
  v_ayurveda  text[] := array['Ayurveda','Ayurvedic Herbs','Ayurvedic Remedies','Ayurvedic Lifestyle','Panchakarma','Kerala Ayurveda','Ayurvedic Diet'];
  v_altmed    text[] := array['Alternative Medicine','Herbal Medicine','Natural Remedies','Home Remedies','Traditional Medicine','Chinese Medicine','Siddha','Unani','Acupuncture','Acupressure','Reflexology','Reiki','Energy Healing','Holistic Healing'];
  v_diet      text[] := array['Diet & Nutrition','Healthy Eating','Weight Loss','Weight Gain','Vegetarian','Vegan','Keto','Paleo','Mediterranean Diet','Intermittent Fasting','Healthy Recipes','Meal Planning'];
  v_wellness  text[] := array['Wellness','Yoga','Meditation','Breathing Exercises','Stress Relief','Better Sleep','Longevity','Healthy Lifestyle'];
  v_herbs     text[] := array['Medicinal Plants','Herbal Gardens','Herbal Teas','Organic Living','Natural Foods'];
  v_community text[] := array['Natural Hair Loss Remedies','Diabetes Diet Support','Ayurvedic Weight Loss','Herbal Healing Kerala','Organic Food Lovers','Turmeric Benefits','Ashwagandha Community','Natural Skin Care','Healthy Cooking Club','Vegan Athletes','Yoga for Seniors','Ayurvedic Recipes','Herbal Tea Enthusiasts','Alternative Cancer Support','Gut Health Community','Holistic Parenting','Natural Living India','Ayurvedic Beauty Tips'];
begin
  foreach t in array v_ayurveda loop
    perform public.ensure_official_room('ayur-altmed-diet','ayur-ayurveda', t,
      t || ' — tips, questions & community. (Info only — consult a doctor.)', 'public', false, false, false, null, 100);
  end loop;
  foreach t in array v_altmed loop
    perform public.ensure_official_room('ayur-altmed-diet','ayur-altmed', t,
      t || ' — discuss practices & experiences. (Info only — consult a doctor.)', 'public', false, false, false, null, 100);
  end loop;
  foreach t in array v_diet loop
    perform public.ensure_official_room('ayur-altmed-diet','ayur-diet', t,
      t || ' — share meals, plans & results. (Info only — consult a dietitian.)', 'public', false, false, false, null, 100);
  end loop;
  foreach t in array v_wellness loop
    perform public.ensure_official_room('ayur-altmed-diet','ayur-wellness', t,
      t || ' — practise together & share. Voice on for live sessions.', 'public', true, false, false, null, 100);
  end loop;
  foreach t in array v_herbs loop
    perform public.ensure_official_room('ayur-altmed-diet','ayur-herbs', t,
      t || ' — grow, brew & learn about plants.', 'public', false, false, false, null, 100);
  end loop;
  foreach t in array v_community loop
    perform public.ensure_official_room('ayur-altmed-diet','ayur-community', t,
      t || ' — community room. Be kind; info only, not medical advice.', 'public', false, false, false, null, 100);
  end loop;
end$$;
