-- Karochat — Wave 19.6: seed the Students · Cohorts subcategory.
--
-- The "Cohorts" label exists in the catalog tree (added directly via the
-- Supabase dashboard at some point) but no migration ever shipped rooms
-- for it, so it shows up as "0 rooms". This migration:
--   1. Ensures a 'students-cohorts' subcategory row exists with label
--      "Cohorts" (idempotent upsert).
--   2. Seeds class-of, semester, and exam-year cohort rooms.
--   3. Also fills any other long-empty students subcategories with a
--      pinch of starter rooms so the tree feels alive everywhere.
--
-- Idempotent and additive.

-- ============================================================================
-- 1) Subcategory row.
-- ============================================================================
insert into public.room_subcategories (category_slug, slug, label, position) values
  ('students', 'students-cohorts', 'Cohorts', 1005)
on conflict (category_slug, slug) do update
  set label = excluded.label,
      position = excluded.position;

-- ============================================================================
-- 2) Cohort rooms — class-of years + entrance cohort sets.
-- ============================================================================
do $$
declare
  v_years int[] := array[2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];
  v_year int;
begin
  -- "Class of YYYY" rooms — global undergrad-style cohorts.
  foreach v_year in array v_years loop
    perform public.ensure_official_room(
      'students', 'students-cohorts',
      'Class of ' || v_year,
      'Anyone graduating in ' || v_year || '. Compare notes, plan, vent.',
      'public', true, false, false, null, 200);
  end loop;

  -- Indian entrance-exam cohorts.
  perform public.ensure_official_room('students','students-cohorts','JEE 2026 aspirants','Studying for JEE Mains/Advanced 2026.','public',true,false,false,null,150);
  perform public.ensure_official_room('students','students-cohorts','JEE 2027 aspirants','Studying for JEE 2027.','public',true,false,false,null,150);
  perform public.ensure_official_room('students','students-cohorts','NEET 2026 aspirants','Medical entrance, India, 2026 batch.','public',true,false,false,null,150);
  perform public.ensure_official_room('students','students-cohorts','NEET 2027 aspirants','Medical entrance, India, 2027 batch.','public',true,false,false,null,120);
  perform public.ensure_official_room('students','students-cohorts','UPSC 2026 batch','Civil services exam cohort.','public',true,false,false,null,120);
  perform public.ensure_official_room('students','students-cohorts','CAT 2026 batch','MBA aspirants, CAT 2026.','public',true,false,false,null,120);
  perform public.ensure_official_room('students','students-cohorts','GATE 2026 batch','Engineering postgrad entrance.','public',true,false,false,null,80);

  -- Common international + grad cohorts.
  perform public.ensure_official_room('students','students-cohorts','MBA Class of 2026','Two-year MBA, any school, 2026.','public',true,false,false,null,80);
  perform public.ensure_official_room('students','students-cohorts','MBA Class of 2027','MBA cohort starting in 2025.','public',true,false,false,null,80);
  perform public.ensure_official_room('students','students-cohorts','PhD starting 2026','First-years anywhere.','public',true,false,false,null,60);
  perform public.ensure_official_room('students','students-cohorts','PhD starting 2027','First-years 2027.','public',true,false,false,null,60);
  perform public.ensure_official_room('students','students-cohorts','Masters · Fall 2026','Beginning master''s, Fall 2026.','public',true,false,false,null,80);
  perform public.ensure_official_room('students','students-cohorts','Masters · Fall 2027','Beginning master''s, Fall 2027.','public',true,false,false,null,80);
  perform public.ensure_official_room('students','students-cohorts','Bootcamp cohort','Anyone in a bootcamp right now.','public',true,false,false,null,60);
  perform public.ensure_official_room('students','students-cohorts','Coursera + edX cohorts','MOOC learners sharing progress.','public',true,false,false,null,60);
  perform public.ensure_official_room('students','students-cohorts','Year abroad','Studying abroad this year.','public',true,false,false,null,60);
  perform public.ensure_official_room('students','students-cohorts','Final-year survival','Last-year students, breathe together.','public',true,false,false,null,80);
  perform public.ensure_official_room('students','students-cohorts','First-year newbies','First year of any program.','public',true,false,false,null,80);
end$$;

-- ============================================================================
-- 3) Touch other students subcats so nothing in that category reads 0.
-- ============================================================================
do $$
begin
  -- by-level — already seeded in 0022, but add a few warm-up rooms in case
  -- the user is on a fresh DB.
  perform public.ensure_official_room('students','students-by-level','Re-entering education','Coming back after a gap.','public',true,false,false,null,60);

  -- help — extras
  perform public.ensure_official_room('students','students-help','Stuck on a problem set','Drop the problem, get a nudge.','public',true,false,false,null,80);
  perform public.ensure_official_room('students','students-help','Writing feedback','Essays, theses, applications.','public',true,false,false,null,60);

  -- practical — extras
  perform public.ensure_official_room('students','students-practical','Funding & scholarships','Find money for school.','public',true,false,false,null,80);
  perform public.ensure_official_room('students','students-practical','Internships now','Open internships, share + ask.','public',true,false,false,null,80);
  perform public.ensure_official_room('students','students-practical','Resume / CV reviews','Drop yours, get a free look.','public',true,false,false,null,60);

  -- life — extras
  perform public.ensure_official_room('students','students-life','Roommate finder','Looking for / offering a room.','public',true,false,false,null,80);
  perform public.ensure_official_room('students','students-life','Burnt out','For when school is breaking you.','public',true,false,false,null,80);
  perform public.ensure_official_room('students','students-life','First-gen students','First in your family to go.','public',true,false,false,null,60);
end$$;
