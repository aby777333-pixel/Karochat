-- Karochat — Publications platform.
--
-- A user-generated long-form publishing system that lives alongside
-- (not on top of) the existing books/sex-ed/rooms surfaces. Users can:
--   • write stories, experiences, blogs, journals
--   • publish under their handle OR a pen name (pseudonymous)
--   • attach images, PDFs, video, audio
--   • save drafts, edit, publish, unpublish, delete
--   • categorize for discovery (incl. adult-flagged content)
--
-- Constraints, enforced server-side via RLS + RPC checks:
--   1. Only authenticated, *non-anonymous* users (i.e. registered via
--      email — which on Supabase Auth means `auth.users.is_anonymous IS
--      false`) can create or modify content.
--   2. Anyone — anon guests included — can READ published, non-adult
--      content. Reading adult-flagged publications requires the same
--      attestation /sexed already uses (`profiles.adult_attested_at`
--      not null AND birth_year indicates 18+).
--   3. Drafts are visible only to their author.
--
-- Idempotent. Safe to re-run. Does not touch any existing table.

-- =====================================================================
-- 1) HELPERS
-- =====================================================================

-- Email-verified, non-anonymous caller? Used in every write policy.
create or replace function public.current_user_is_email_user()
returns boolean
language plpgsql security definer set search_path = public stable
as $$
declare v_anon boolean;
begin
  if auth.uid() is null then return false; end if;
  select coalesce(u.is_anonymous, false)
    into v_anon
    from auth.users u
   where u.id = auth.uid();
  return not coalesce(v_anon, false);
end;
$$;
revoke all on function public.current_user_is_email_user() from public;
grant execute on function public.current_user_is_email_user()
  to authenticated, anon;

-- Caller permitted to see 18+ publications? Mirrors /sexed gating.
create or replace function public.current_user_can_view_adult()
returns boolean
language plpgsql security definer set search_path = public stable
as $$
declare
  v_year int;
  v_attested boolean;
begin
  if auth.uid() is null then return false; end if;
  select birth_year, (adult_attested_at is not null)
    into v_year, v_attested
    from public.profiles where id = auth.uid();
  if v_year is null or not coalesce(v_attested, false) then return false; end if;
  return (extract(year from now())::int - v_year) >= 18;
end;
$$;
revoke all on function public.current_user_can_view_adult() from public;
grant execute on function public.current_user_can_view_adult()
  to authenticated, anon;

-- =====================================================================
-- 2) CATEGORIES
-- =====================================================================

create table if not exists public.publication_categories (
  slug text primary key,
  label text not null,
  description text,
  icon text,
  position int default 100,
  is_adult boolean default false,
  active boolean default true,
  created_at timestamptz default now()
);
alter table public.publication_categories enable row level security;
drop policy if exists "publication_categories_read_all"
  on public.publication_categories;
create policy "publication_categories_read_all"
  on public.publication_categories for select
  to anon, authenticated
  using (active = true);

insert into public.publication_categories
  (slug, label, description, icon, position, is_adult)
values
  ('fiction',     'Fiction',           'Short stories, novellas, serialised fiction.',  '📖',  10, false),
  ('essay',       'Essays',            'Opinion, analysis, longform commentary.',       '🖋️',  20, false),
  ('journal',     'Journal',           'Personal journals, diaries, reflections.',      '📓',  30, false),
  ('travel',      'Travel',            'Trip journals, place writing, guides.',         '🧳',  40, false),
  ('food',        'Food',              'Recipes, food writing, restaurant reviews.',    '🍜',  50, false),
  ('tech',        'Tech & code',       'Tutorials, deep dives, build logs.',            '💻',  60, false),
  ('philosophy',  'Philosophy',        'Big questions, slow thoughts.',                 '🧠',  70, false),
  ('poetry',      'Poetry',            'Verse, prose-poetry, lyric writing.',           '✒️',  80, false),
  ('relationships','Relationships',    'Love, friendship, family — non-explicit.',      '💞',  90, false),
  ('experience',  'Lived experiences', 'First-person stories from real life.',          '🪞', 100, false),
  ('adult-experience', 'Adult experiences', 'First-person 18+ stories. Behind the adult gate.', '🔞', 200, true),
  ('adult-fiction',    'Adult fiction',      'Explicit fiction, erotica. Behind the adult gate.', '🌶️', 210, true),
  ('adult-relationships','Adult relationships', 'Explicit relationship writing.',     '❤️‍🔥', 220, true)
on conflict (slug) do update set
  label = excluded.label,
  description = excluded.description,
  icon = excluded.icon,
  position = excluded.position,
  is_adult = excluded.is_adult;

-- =====================================================================
-- 3) PUBLICATIONS
-- =====================================================================

create table if not exists public.publications (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  author_profile_id uuid not null references public.profiles(id) on delete cascade,
  pen_name text,                       -- displayed instead of profile.display_name if set
  title text not null check (length(title) between 1 and 200),
  subtitle text,
  body_markdown text not null default '',
  category_slug text references public.publication_categories(slug),
  tags text[] default '{}',
  cover_image_url text,
  status text not null default 'draft'
    check (status in ('draft','published','hidden')),
  is_adult boolean default false,
  language text default 'en',
  view_count int default 0,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists publications_author_idx
  on public.publications(author_profile_id);
create index if not exists publications_status_idx
  on public.publications(status);
create index if not exists publications_category_idx
  on public.publications(category_slug);
create index if not exists publications_published_at_idx
  on public.publications(published_at desc nulls last);

alter table public.publications enable row level security;

drop policy if exists "publications_read_published" on public.publications;
create policy "publications_read_published"
  on public.publications for select
  to anon, authenticated
  using (
    status = 'published'
    and (is_adult = false or public.current_user_can_view_adult())
  );

drop policy if exists "publications_read_own" on public.publications;
create policy "publications_read_own"
  on public.publications for select
  to authenticated
  using (author_profile_id = auth.uid());

-- All writes go through SECURITY DEFINER RPCs below, but we still grant
-- INSERT/UPDATE to email-verified owners so direct queries work for power
-- users. (Anonymous guests blocked.)
drop policy if exists "publications_owner_insert" on public.publications;
create policy "publications_owner_insert"
  on public.publications for insert
  to authenticated
  with check (
    author_profile_id = auth.uid()
    and public.current_user_is_email_user()
  );
drop policy if exists "publications_owner_update" on public.publications;
create policy "publications_owner_update"
  on public.publications for update
  to authenticated
  using (author_profile_id = auth.uid() and public.current_user_is_email_user())
  with check (author_profile_id = auth.uid() and public.current_user_is_email_user());
drop policy if exists "publications_owner_delete" on public.publications;
create policy "publications_owner_delete"
  on public.publications for delete
  to authenticated
  using (author_profile_id = auth.uid() and public.current_user_is_email_user());

-- Keep updated_at fresh.
create or replace function public._publications_touch_updated()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists publications_touch_updated on public.publications;
create trigger publications_touch_updated
  before update on public.publications
  for each row execute function public._publications_touch_updated();

-- =====================================================================
-- 4) MEDIA ATTACHMENTS
-- =====================================================================
-- One publication may have many media items (additional images, PDFs,
-- video clips, audio). The cover image lives on publications.cover_image_url
-- directly because it's queried in list pages.

create table if not exists public.publication_media (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  kind text not null check (kind in ('image','pdf','video','audio')),
  url text not null,
  storage_path text,
  caption text,
  position int default 100,
  created_at timestamptz default now()
);
create index if not exists publication_media_pub_idx
  on public.publication_media(publication_id, position);
alter table public.publication_media enable row level security;

drop policy if exists "publication_media_read_via_pub" on public.publication_media;
create policy "publication_media_read_via_pub"
  on public.publication_media for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.publications p
       where p.id = publication_media.publication_id
         and (
           (p.status = 'published'
             and (p.is_adult = false or public.current_user_can_view_adult()))
           or p.author_profile_id = auth.uid()
         )
    )
  );

drop policy if exists "publication_media_owner_write" on public.publication_media;
create policy "publication_media_owner_write"
  on public.publication_media for all
  to authenticated
  using (
    exists (select 1 from public.publications p
             where p.id = publication_media.publication_id
               and p.author_profile_id = auth.uid())
    and public.current_user_is_email_user()
  )
  with check (
    exists (select 1 from public.publications p
             where p.id = publication_media.publication_id
               and p.author_profile_id = auth.uid())
    and public.current_user_is_email_user()
  );

-- =====================================================================
-- 5) STORAGE BUCKETS
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'publications', 'publications', true,
  50 * 1024 * 1024,
  array[
    'image/png','image/jpeg','image/jpg','image/webp','image/gif',
    'application/pdf',
    'video/mp4','video/webm','video/quicktime',
    'audio/mpeg','audio/mp4','audio/wav','audio/webm'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "publications_obj_owner_insert" on storage.objects;
drop policy if exists "publications_obj_owner_update" on storage.objects;
drop policy if exists "publications_obj_owner_delete" on storage.objects;
drop policy if exists "publications_obj_public_select" on storage.objects;

create policy "publications_obj_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'publications'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_user_is_email_user()
  );
create policy "publications_obj_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'publications'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'publications'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_user_is_email_user()
  );
create policy "publications_obj_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'publications'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
-- Public read (bucket is public anyway; explicit policy makes it readable
-- via the API even for anon callers).
create policy "publications_obj_public_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'publications');

-- =====================================================================
-- 6) RPCs — read
-- =====================================================================

-- Auto-slug helper. Trims, lowercases, replaces non [a-z0-9] with '-',
-- collapses runs of '-', strips leading/trailing '-'. Appends a short
-- random suffix to avoid collisions when called.
create or replace function public._slugify_unique(p_title text)
returns text language plpgsql as $$
declare
  v_base text;
  v_try text;
  v_attempt int := 0;
begin
  v_base := lower(coalesce(p_title, ''));
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := regexp_replace(v_base, '(^-|-$)', '', 'g');
  if v_base = '' then v_base := 'untitled'; end if;
  v_base := substr(v_base, 1, 80);
  loop
    v_try := case when v_attempt = 0
                  then v_base
                  else v_base || '-' || lpad(floor(random()*9000+1000)::text, 4, '0')
             end;
    if not exists (select 1 from public.publications where slug = v_try) then
      return v_try;
    end if;
    v_attempt := v_attempt + 1;
    exit when v_attempt > 8;
  end loop;
  -- Fallback: append timestamp.
  return v_base || '-' || extract(epoch from now())::bigint;
end;
$$;

create or replace function public.list_publications(
  p_category text default null,
  p_include_adult boolean default null,  -- null = auto (use can_view_adult)
  p_search text default null,
  p_limit int default 30,
  p_offset int default 0
) returns table (
  id uuid, slug text, title text, subtitle text, category_slug text,
  pen_name text, author_username text, author_display_name text,
  cover_image_url text, is_adult boolean, view_count int,
  published_at timestamptz, language text, tags text[]
)
language plpgsql security definer set search_path = public stable
as $$
declare v_allow_adult boolean;
begin
  v_allow_adult := coalesce(p_include_adult, public.current_user_can_view_adult());
  return query
  select p.id, p.slug, p.title, p.subtitle, p.category_slug,
         p.pen_name, pr.username, pr.display_name,
         p.cover_image_url, p.is_adult, p.view_count,
         p.published_at, p.language, p.tags
    from public.publications p
    left join public.profiles pr on pr.id = p.author_profile_id
   where p.status = 'published'
     and (p_category is null or p.category_slug = p_category)
     and (p.is_adult = false or v_allow_adult)
     and (
       p_search is null
       or p.title ilike '%' || p_search || '%'
       or p.subtitle ilike '%' || p_search || '%'
       or coalesce(p.body_markdown,'') ilike '%' || p_search || '%'
     )
   order by p.published_at desc nulls last, p.created_at desc
   limit greatest(1, least(coalesce(p_limit, 30), 100))
   offset greatest(0, coalesce(p_offset, 0));
end;
$$;
revoke all on function public.list_publications(text, boolean, text, int, int) from public;
grant execute on function public.list_publications(text, boolean, text, int, int)
  to anon, authenticated;

create or replace function public.get_publication(p_slug text)
returns table (
  id uuid, slug text, title text, subtitle text, body_markdown text,
  category_slug text, pen_name text,
  author_profile_id uuid, author_username text, author_display_name text,
  cover_image_url text, is_adult boolean, status text,
  view_count int, language text, tags text[],
  published_at timestamptz, created_at timestamptz, updated_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
declare v_allow_adult boolean;
begin
  v_allow_adult := public.current_user_can_view_adult();
  -- Best-effort view bump for published reads we'll return.
  update public.publications p
     set view_count = p.view_count + 1
   where p.slug = p_slug
     and p.status = 'published'
     and (p.is_adult = false or v_allow_adult);

  return query
  select p.id, p.slug, p.title, p.subtitle, p.body_markdown,
         p.category_slug, p.pen_name,
         p.author_profile_id, pr.username, pr.display_name,
         p.cover_image_url, p.is_adult, p.status,
         p.view_count, p.language, p.tags,
         p.published_at, p.created_at, p.updated_at
    from public.publications p
    left join public.profiles pr on pr.id = p.author_profile_id
   where p.slug = p_slug
     and (
       (p.status = 'published' and (p.is_adult = false or v_allow_adult))
       or p.author_profile_id = auth.uid()
     );
end;
$$;
revoke all on function public.get_publication(text) from public;
grant execute on function public.get_publication(text)
  to anon, authenticated;

create or replace function public.list_publication_media(p_publication_id uuid)
returns table (
  id uuid, kind text, url text, storage_path text,
  caption text, "position" int, created_at timestamptz
)
language sql security definer set search_path = public stable
as $$
  select m.id, m.kind, m.url, m.storage_path, m.caption, m.position, m.created_at
    from public.publication_media m
    join public.publications p on p.id = m.publication_id
   where m.publication_id = p_publication_id
     and (
       (p.status = 'published'
          and (p.is_adult = false or public.current_user_can_view_adult()))
       or p.author_profile_id = auth.uid()
     )
   order by m.position asc, m.created_at asc;
$$;
revoke all on function public.list_publication_media(uuid) from public;
grant execute on function public.list_publication_media(uuid)
  to anon, authenticated;

create or replace function public.my_publications()
returns table (
  id uuid, slug text, title text, status text, category_slug text,
  is_adult boolean, view_count int, published_at timestamptz,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not public.current_user_is_email_user() then
    raise exception 'sign in with an email to see your publications';
  end if;
  return query
  select p.id, p.slug, p.title, p.status, p.category_slug,
         p.is_adult, p.view_count, p.published_at,
         p.created_at, p.updated_at
    from public.publications p
   where p.author_profile_id = auth.uid()
   order by p.updated_at desc;
end;
$$;
revoke all on function public.my_publications() from public;
grant execute on function public.my_publications() to authenticated;

-- =====================================================================
-- 7) RPCs — write
-- =====================================================================

create or replace function public.create_publication(
  p_title text,
  p_body_markdown text default '',
  p_category_slug text default null,
  p_pen_name text default null,
  p_subtitle text default null,
  p_tags text[] default '{}',
  p_is_adult boolean default false,
  p_cover_image_url text default null,
  p_publish boolean default false
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_slug text;
  v_user uuid := auth.uid();
  v_cat record;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if not public.current_user_is_email_user() then
    raise exception 'only email-registered users can publish — please sign up with an email';
  end if;
  if coalesce(nullif(trim(p_title),''),'') = '' then
    raise exception 'title required';
  end if;

  -- If the category itself is adult, force is_adult = true.
  if p_category_slug is not null then
    select * into v_cat
      from public.publication_categories
     where slug = p_category_slug and active = true;
    if not found then
      raise exception 'unknown category: %', p_category_slug;
    end if;
    if v_cat.is_adult then p_is_adult := true; end if;
  end if;

  v_slug := public._slugify_unique(p_title);

  insert into public.publications
    (slug, author_profile_id, pen_name, title, subtitle, body_markdown,
     category_slug, tags, cover_image_url, is_adult, status, published_at)
  values
    (v_slug, v_user, nullif(trim(coalesce(p_pen_name,'')),''),
     trim(p_title), nullif(trim(coalesce(p_subtitle,'')),''),
     coalesce(p_body_markdown,''), p_category_slug,
     coalesce(p_tags, '{}'), nullif(trim(coalesce(p_cover_image_url,'')),''),
     coalesce(p_is_adult, false),
     case when p_publish then 'published' else 'draft' end,
     case when p_publish then now() else null end)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_publication(text, text, text, text, text, text[], boolean, text, boolean) from public;
grant execute on function public.create_publication(text, text, text, text, text, text[], boolean, text, boolean) to authenticated;

create or replace function public.update_publication(
  p_id uuid,
  p_title text default null,
  p_body_markdown text default null,
  p_category_slug text default null,
  p_pen_name text default null,
  p_subtitle text default null,
  p_tags text[] default null,
  p_is_adult boolean default null,
  p_cover_image_url text default null
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_cat record;
  v_force_adult boolean := null;
  v_owner uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if not public.current_user_is_email_user() then
    raise exception 'only email-registered users can edit publications';
  end if;
  select author_profile_id into v_owner
    from public.publications where id = p_id;
  if v_owner is null then return false; end if;
  if v_owner <> v_user then raise exception 'not the owner'; end if;

  if p_category_slug is not null then
    select * into v_cat
      from public.publication_categories
     where slug = p_category_slug and active = true;
    if not found then raise exception 'unknown category'; end if;
    if v_cat.is_adult then v_force_adult := true; end if;
  end if;

  update public.publications p
     set title = coalesce(nullif(trim(coalesce(p_title, p.title)),''), p.title),
         body_markdown = coalesce(p_body_markdown, p.body_markdown),
         category_slug = coalesce(p_category_slug, p.category_slug),
         pen_name = coalesce(nullif(trim(coalesce(p_pen_name, p.pen_name, '')),''), p.pen_name),
         subtitle = coalesce(nullif(trim(coalesce(p_subtitle, p.subtitle, '')),''), p.subtitle),
         tags = coalesce(p_tags, p.tags),
         is_adult = coalesce(v_force_adult, p_is_adult, p.is_adult),
         cover_image_url = coalesce(nullif(trim(coalesce(p_cover_image_url, p.cover_image_url, '')),''), p.cover_image_url)
   where p.id = p_id;
  return true;
end;
$$;
revoke all on function public.update_publication(uuid, text, text, text, text, text, text[], boolean, text) from public;
grant execute on function public.update_publication(uuid, text, text, text, text, text, text[], boolean, text) to authenticated;

create or replace function public.publish_publication(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid(); v_owner uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if not public.current_user_is_email_user() then
    raise exception 'only email-registered users can publish';
  end if;
  select author_profile_id into v_owner from public.publications where id = p_id;
  if v_owner is null then return false; end if;
  if v_owner <> v_user then raise exception 'not the owner'; end if;
  update public.publications
     set status = 'published',
         published_at = coalesce(published_at, now())
   where id = p_id;
  return true;
end;
$$;
revoke all on function public.publish_publication(uuid) from public;
grant execute on function public.publish_publication(uuid) to authenticated;

create or replace function public.unpublish_publication(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid(); v_owner uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select author_profile_id into v_owner from public.publications where id = p_id;
  if v_owner is null then return false; end if;
  if v_owner <> v_user then raise exception 'not the owner'; end if;
  update public.publications set status = 'draft' where id = p_id;
  return true;
end;
$$;
revoke all on function public.unpublish_publication(uuid) from public;
grant execute on function public.unpublish_publication(uuid) to authenticated;

create or replace function public.delete_publication(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid(); v_owner uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select author_profile_id into v_owner from public.publications where id = p_id;
  if v_owner is null then return false; end if;
  if v_owner <> v_user then raise exception 'not the owner'; end if;
  delete from public.publications where id = p_id;
  return true;
end;
$$;
revoke all on function public.delete_publication(uuid) from public;
grant execute on function public.delete_publication(uuid) to authenticated;

create or replace function public.register_publication_media(
  p_publication_id uuid,
  p_kind text,
  p_url text,
  p_storage_path text default null,
  p_caption text default null,
  p_position int default 100
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid; v_owner uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.current_user_is_email_user() then
    raise exception 'only email-registered users can attach media';
  end if;
  if p_kind not in ('image','pdf','video','audio') then
    raise exception 'invalid kind';
  end if;
  if coalesce(nullif(trim(coalesce(p_url,'')),''),'') = '' then
    raise exception 'url required';
  end if;
  select author_profile_id into v_owner
    from public.publications where id = p_publication_id;
  if v_owner is null then raise exception 'publication not found'; end if;
  if v_owner <> auth.uid() then raise exception 'not the owner'; end if;

  insert into public.publication_media
    (publication_id, kind, url, storage_path, caption, position)
  values
    (p_publication_id, p_kind, trim(p_url),
     nullif(trim(coalesce(p_storage_path,'')),''),
     nullif(trim(coalesce(p_caption,'')),''),
     coalesce(p_position, 100))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.register_publication_media(uuid, text, text, text, text, int) from public;
grant execute on function public.register_publication_media(uuid, text, text, text, text, int) to authenticated;

create or replace function public.delete_publication_media(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_owner uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select p.author_profile_id into v_owner
    from public.publication_media m
    join public.publications p on p.id = m.publication_id
   where m.id = p_id;
  if v_owner is null then return false; end if;
  if v_owner <> auth.uid() then raise exception 'not the owner'; end if;
  delete from public.publication_media where id = p_id;
  return true;
end;
$$;
revoke all on function public.delete_publication_media(uuid) from public;
grant execute on function public.delete_publication_media(uuid) to authenticated;
