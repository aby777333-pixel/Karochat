-- Karochat — v12 Wave 8: v6 catalog schema.
-- Yahoo!-Chat-style category → subcategory → official-room hierarchy that
-- ships alongside (and is queryable next to) user-created rooms.
-- Run AFTER 0014_virality_v5.sql. Idempotent.

-- Ensure realtime can deliver friendship + membership updates to the UI.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships'
  ) then
    execute 'alter publication supabase_realtime add table public.friendships';
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_members'
  ) then
    execute 'alter publication supabase_realtime add table public.room_members';
  end if;
end$$;

-- ============================================================================
-- Top-level categories (Regional India, Students, Career, …)
-- ============================================================================
create table if not exists public.room_categories (
  slug        text primary key,
  label       text not null,
  description text,
  icon        text,
  position    int  not null default 1000,
  is_adult    boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.room_categories enable row level security;

drop policy if exists "room_categories_read_all" on public.room_categories;
create policy "room_categories_read_all" on public.room_categories
  for select to anon, authenticated using (true);

-- Subcategories: composite key (category, slug) so per-category slugs can repeat.
create table if not exists public.room_subcategories (
  category_slug  text not null references public.room_categories(slug) on delete cascade,
  slug           text not null,
  label          text not null,
  description    text,
  position       int  not null default 1000,
  created_at     timestamptz not null default now(),
  primary key (category_slug, slug)
);

alter table public.room_subcategories enable row level security;

drop policy if exists "room_subcategories_read_all" on public.room_subcategories;
create policy "room_subcategories_read_all" on public.room_subcategories
  for select to anon, authenticated using (true);

-- ============================================================================
-- Extra rooms columns for the catalog
-- ============================================================================
alter table public.rooms
  add column if not exists category_slug    text references public.room_categories(slug) on delete set null,
  add column if not exists subcategory_slug text,
  add column if not exists topic            text,
  add column if not exists is_official      boolean not null default false,
  add column if not exists voice_enabled    boolean not null default false,
  add column if not exists cam_enabled      boolean not null default false,
  add column if not exists verified_only    boolean not null default false,
  add column if not exists verified_kind    text,
  add column if not exists capacity         int  not null default 50,
  add column if not exists scale_index      int  not null default 1;

create index if not exists rooms_category_lookup_idx
  on public.rooms (category_slug, subcategory_slug, scale_index)
  where is_official = true;

-- ============================================================================
-- Browse RPC — anyone (anon + authenticated) can list official rooms by
-- category. Joins live member_count so the lobby tree can show real numbers.
-- ============================================================================
create or replace function public.browse_catalog(
  p_category_slug    text default null,
  p_subcategory_slug text default null,
  p_limit            int  default 100
) returns table (
  id              uuid,
  name            text,
  topic           text,
  category_slug   text,
  subcategory_slug text,
  visibility      text,
  voice_enabled   boolean,
  cam_enabled     boolean,
  verified_only   boolean,
  verified_kind   text,
  is_adult        boolean,
  capacity        int,
  scale_index     int,
  member_count    int
)
language sql security definer set search_path = public stable
as $$
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
  where r.is_official = true
    and r.is_dm = false
    and r.is_saved = false
    and r.visibility in ('public','listed')
    and (p_category_slug    is null or r.category_slug    = p_category_slug)
    and (p_subcategory_slug is null or r.subcategory_slug = p_subcategory_slug)
  order by
    (select count(*) from public.room_members rm where rm.room_id = r.id) desc,
    r.scale_index asc,
    r.name asc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke all on function public.browse_catalog(text, text, int) from public;
grant execute on function public.browse_catalog(text, text, int) to anon, authenticated;

-- ============================================================================
-- Helper: ensure_official_room — idempotent upsert keyed on
-- (category_slug, subcategory_slug, name). The seed migration calls this
-- thousands of times; safe to re-run.
-- ============================================================================
create or replace function public.ensure_official_room(
  p_category_slug    text,
  p_subcategory_slug text,
  p_name             text,
  p_topic            text default null,
  p_visibility       text default 'public',
  p_voice_enabled    boolean default false,
  p_cam_enabled      boolean default false,
  p_verified_only    boolean default false,
  p_verified_kind    text default null,
  p_capacity         int default 50
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_visibility not in ('public','listed','unlisted','secret') then
    raise exception 'invalid visibility %', p_visibility;
  end if;

  select id into v_id from public.rooms
   where is_official = true
     and category_slug = p_category_slug
     and subcategory_slug = p_subcategory_slug
     and name = p_name
   limit 1;

  if v_id is not null then
    update public.rooms
       set topic          = coalesce(p_topic, topic),
           voice_enabled  = p_voice_enabled,
           cam_enabled    = p_cam_enabled,
           verified_only  = p_verified_only,
           verified_kind  = p_verified_kind,
           capacity       = greatest(coalesce(p_capacity, 50), 10),
           visibility     = p_visibility
     where id = v_id;
    return v_id;
  end if;

  v_id := gen_random_uuid();
  insert into public.rooms (
    id, name, description, visibility, owner_id, is_dm, is_saved,
    category_slug, subcategory_slug, topic, is_official,
    voice_enabled, cam_enabled, verified_only, verified_kind,
    capacity, scale_index
  ) values (
    v_id, p_name, null, p_visibility, null, false, false,
    p_category_slug, p_subcategory_slug, p_topic, true,
    p_voice_enabled, p_cam_enabled, p_verified_only, p_verified_kind,
    greatest(coalesce(p_capacity, 50), 10), 1
  );
  return v_id;
end;
$$;

revoke all on function public.ensure_official_room(
  text, text, text, text, text, boolean, boolean, boolean, text, int
) from public;
grant execute on function public.ensure_official_room(
  text, text, text, text, text, boolean, boolean, boolean, text, int
) to service_role;
