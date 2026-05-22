-- Karochat — Wave 19.7: fill any "cohort"-style subcategories regardless
-- of slug.
--
-- The owner added their own Cohorts subcategories via the Supabase dash
-- (IITs / NITs / AIIMS / Ivy League / etc.). My previous migrations
-- couldn't seed those because they don't know the exact slugs the owner
-- chose. This migration walks every category whose label matches
-- /cohort/i, finds the subcategories under it, and adds 3 starter rooms
-- per subcategory (a lobby, a current-students room, and an alumni
-- room). It only adds rooms where the subcategory has zero rooms today,
-- so re-runs are no-ops.
--
-- Idempotent and additive.

do $$
declare
  v_cat record;
  v_sub record;
  v_existing int;
  v_short    text;
begin
  for v_cat in
    select slug, label from public.room_categories
     where lower(coalesce(label, '')) like '%cohort%'
  loop
    for v_sub in
      select category_slug, slug, label
        from public.room_subcategories
       where category_slug = v_cat.slug
    loop
      select count(*) into v_existing
        from public.rooms
       where category_slug = v_sub.category_slug
         and subcategory_slug = v_sub.slug;
      if v_existing > 0 then continue; end if;

      -- "Short" form trims clutter from the label so the room name stays
      -- readable. e.g. "Ivy League (US)" → "Ivy League".
      v_short := regexp_replace(coalesce(v_sub.label, v_sub.slug), '\s*\(.*\)\s*$', '');

      perform public.ensure_official_room(
        v_sub.category_slug, v_sub.slug,
        v_short || ' lounge',
        'General chat for ' || v_short || ' — anyone affiliated welcome.',
        'public', true, false, false, null, 120);
      perform public.ensure_official_room(
        v_sub.category_slug, v_sub.slug,
        v_short || ' · current students',
        'Currently studying / attending ' || v_short || '.',
        'public', true, false, false, null, 100);
      perform public.ensure_official_room(
        v_sub.category_slug, v_sub.slug,
        v_short || ' · alumni',
        v_short || ' alumni — connect across years.',
        'public', true, false, false, null, 100);
      perform public.ensure_official_room(
        v_sub.category_slug, v_sub.slug,
        v_short || ' · prospective',
        'Thinking about ' || v_short || '. Ask anyone.',
        'public', true, false, false, null, 80);
    end loop;
  end loop;
end$$;

-- Same treatment for ANY subcategory whose label contains 'cohort' even
-- if its category isn't named Cohort. Covers the case where the owner
-- added "Cohorts" as a subcategory under students.
do $$
declare
  v_sub record;
  v_existing int;
begin
  for v_sub in
    select category_slug, slug, label
      from public.room_subcategories
     where lower(coalesce(label, '')) like '%cohort%'
  loop
    select count(*) into v_existing
      from public.rooms
     where category_slug = v_sub.category_slug
       and subcategory_slug = v_sub.slug;
    if v_existing > 0 then continue; end if;
    perform public.ensure_official_room(
      v_sub.category_slug, v_sub.slug,
      'Cohort lounge',
      'Find your batch, share notes, vent together.',
      'public', true, false, false, null, 200);
  end loop;
end$$;
