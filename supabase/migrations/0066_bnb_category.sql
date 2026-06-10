-- Karochat — Bed & Breakfast catalog + user-room discoverability.
--
-- 1) Adds a dedicated "Bed & Breakfast" top-level category with subcategories
--    so hosts can list a place and guests can find a bed. People can create
--    their own rooms inside it via the existing "+ Create your own room in …"
--    CTA in the catalog browser (no client change needed — the lobby reads
--    categories live from room_categories).
--
-- 2) Patches browse_catalog() so that USER-CREATED public/listed rooms that
--    are filed under a category also show up in the catalog tree — not only
--    in the "User rooms" tab. Previously browse_catalog filtered
--    is_official = true, so a room someone created under (say) bnb/bnb-hosts
--    bumped the catalog_counts() roll-up but never appeared when the node was
--    expanded ("No rooms yet"). Now every created public room shows up in the
--    lobby where people browse and can join.
--
-- Idempotent and additive. Safe to re-run. Nothing existing is removed or
-- renumbered. Uses the existing ensure_official_room() helper (0015) so member
-- counts / RLS stay correct.

-- ============================================================================
-- 0) Top-level category
-- ============================================================================
insert into public.room_categories (slug, label, description, icon, position, is_adult) values
  ('bnb', 'Bed & Breakfast', 'B&B stays — hosts list a room, guests find a bed.', '🛏️', 32, false)
on conflict (slug) do update
  set label = excluded.label,
      description = excluded.description,
      icon = excluded.icon,
      position = excluded.position,
      is_adult = excluded.is_adult;

-- ============================================================================
-- 1) Subcategories
-- ============================================================================
insert into public.room_subcategories (category_slug, slug, label, position) values
  ('bnb','bnb-hosts',   'Hosts — list your place', 10),
  ('bnb','bnb-guests',  'Guests — find a stay',    20),
  ('bnb','bnb-india',   'India · homestays',       30),
  ('bnb','bnb-global',  'Worldwide',               40),
  ('bnb','bnb-deals',   'Deals & long stays',      50),
  ('bnb','bnb-reviews', 'Reviews & host tips',     60)
on conflict (category_slug, slug) do update
  set label = excluded.label, position = excluded.position;

-- ============================================================================
-- 2) browse_catalog() — include user-created public/listed rooms
--    (same signature / return shape; only the WHERE clause changes:
--     the `is_official = true` restriction is lifted so user rooms filed
--     under a category surface in the tree too).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.browse_catalog(
  p_category_slug text DEFAULT NULL::text,
  p_subcategory_slug text DEFAULT NULL::text,
  p_limit integer DEFAULT 100
)
 RETURNS TABLE(id uuid, name text, topic text, category_slug text, subcategory_slug text, visibility text, voice_enabled boolean, cam_enabled boolean, verified_only boolean, verified_kind text, is_adult boolean, capacity integer, scale_index integer, member_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    r.id, r.name, r.topic, r.category_slug, r.subcategory_slug,
    r.visibility, r.voice_enabled, r.cam_enabled, r.verified_only,
    r.verified_kind,
    coalesce(
      (select rc.is_adult from public.room_categories rc where rc.slug = r.category_slug),
      false
    ) as is_adult,
    r.capacity, r.scale_index,
    (select count(*)::int from public.room_members rm where rm.room_id = r.id) as member_count
  from public.rooms r
  where r.is_dm    is not true
    and r.is_saved is not true
    and r.is_vault is not true
    and r.visibility in ('public','listed')
    and (p_category_slug    is null or r.category_slug    = p_category_slug)
    and (p_subcategory_slug is null or r.subcategory_slug = p_subcategory_slug)
  order by
    (select count(*) from public.room_members rm where rm.room_id = r.id) desc,
    r.scale_index asc,
    r.name asc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$function$;

-- ============================================================================
-- 3) Seed rooms — official scaffolding so the category isn't empty.
--    Mirrors the 0052 marketplace style. People still create their own
--    rooms on top of these via the normal create-room path.
-- ============================================================================
do $$
declare
  v_destinations text[] := array[
    'Goa','Manali','Rishikesh','Jaipur','Udaipur','Munnar','Coorg','Shimla',
    'Darjeeling','Pondicherry','Ladakh','Andaman Islands','Varanasi',
    'Kerala Backwaters','Ooty','Mussoorie','Nainital','Mahabaleshwar',
    'Gokarna','Hampi'
  ];
  v_countries text[] := array[
    'United States','United Kingdom','United Arab Emirates','Canada','Australia',
    'Singapore','Germany','France','Italy','Spain','Thailand','New Zealand',
    'Ireland','Switzerland'
  ];
  d text;
  k text;
begin
  -- India homestays — by destination
  foreach d in array v_destinations loop
    perform public.ensure_official_room('bnb','bnb-india',
      'B&B · ' || d, 'Bed & breakfast stays and homestays in ' || d || '.',
      'public', false, false, false, null, 100);
  end loop;

  -- Worldwide — by country
  foreach k in array v_countries loop
    perform public.ensure_official_room('bnb','bnb-global',
      'B&B · ' || k, 'Bed & breakfast stays in ' || k || '.',
      'public', false, false, false, null, 80);
  end loop;

  -- Hosts
  perform public.ensure_official_room('bnb','bnb-hosts','Hosts lounge','List your place, swap hosting tips.','public',false,false,false,null,120);
  perform public.ensure_official_room('bnb','bnb-hosts','New hosts — getting started','Setup, pricing, first guests.','public',false,false,false,null,100);
  perform public.ensure_official_room('bnb','bnb-hosts','Superhosts & pros','Scaling, automation, multi-property.','public',false,false,false,null,80);
  perform public.ensure_official_room('bnb','bnb-hosts','Farm & nature stays','Off-grid, farm, forest homestays.','public',false,false,false,null,80);

  -- Guests
  perform public.ensure_official_room('bnb','bnb-guests','Find a stay','Travellers looking for a bed & breakfast.','public',false,false,false,null,150);
  perform public.ensure_official_room('bnb','bnb-guests','Solo travellers','Safe, social homestays for solos.','public',false,false,false,null,100);
  perform public.ensure_official_room('bnb','bnb-guests','Families & groups','Bigger places, family-friendly hosts.','public',false,false,false,null,100);
  perform public.ensure_official_room('bnb','bnb-guests','Pet-friendly stays','Bring the dog. Find pet-OK hosts.','public',false,false,false,null,80);

  -- Deals & long stays
  perform public.ensure_official_room('bnb','bnb-deals','Last-minute deals','Tonight & this-weekend openings.','public',false,false,false,null,120);
  perform public.ensure_official_room('bnb','bnb-deals','Long stays & monthly','Weeks-to-months, nomad-friendly.','public',false,false,false,null,100);
  perform public.ensure_official_room('bnb','bnb-deals','Workation stays','Wi-Fi, desk, good coffee.','public',false,false,false,null,80);

  -- Reviews & tips
  perform public.ensure_official_room('bnb','bnb-reviews','Stay reviews','Honest reviews of places people stayed.','public',false,false,false,null,120);
  perform public.ensure_official_room('bnb','bnb-reviews','Host tips & how-to','Photos, listings, guest comms.','public',false,false,false,null,80);
end$$;
