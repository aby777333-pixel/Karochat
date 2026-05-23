-- Karochat — v9 Phase 2: books library buckets + RPCs.
--
-- The v9 Phase 1 migration (0042) created the books schema. This one
-- adds:
--   • two storage buckets — books-files (private, 100MB cap, pdf/epub/mobi)
--     and book-covers (public, 5MB cap, image/*)
--   • storage policies — owner can write under <user-id>/, admin can
--     read everywhere, public read on book-covers
--   • RPCs the upload / listing / detail / admin pages need:
--       register_book_upload   — caller-owned, after client uploads file
--       list_public_books      — paged, filtered grid for /books
--       get_book               — single-book detail + read_count bump
--       record_book_download   — download_count bump
--       upsert_book_bookmark   — bookmark / resume position
--       add_book_highlight     — saves text + note + color
--       report_book_copyright  — anon-callable; opens a complaint
--       list_pending_books     — admin only
--       list_open_complaints   — admin only
--       admin_approve_book     — admin only, status='live'
--       admin_takedown_book    — admin only, status='takedown' + resolves complaint
--
-- Idempotent + additive. Safe to re-run.

-- =====================================================================
-- 1) BUCKETS
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'books-files', 'books-files', false,
  100 * 1024 * 1024,
  array['application/pdf','application/epub+zip','application/x-mobipocket-ebook',
        'application/octet-stream']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-covers', 'book-covers', true,
  5 * 1024 * 1024,
  array['image/png','image/jpeg','image/jpg','image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2) STORAGE POLICIES -------------------------------------------------

drop policy if exists "books_files_owner_insert" on storage.objects;
drop policy if exists "books_files_owner_update" on storage.objects;
drop policy if exists "books_files_owner_delete" on storage.objects;
drop policy if exists "books_files_owner_select" on storage.objects;
drop policy if exists "books_files_admin_select" on storage.objects;

create policy "books_files_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'books-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "books_files_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'books-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'books-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "books_files_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'books-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "books_files_owner_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'books-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "books_files_admin_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'books-files'
    and exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.is_admin is true)
  );

drop policy if exists "book_covers_owner_insert" on storage.objects;
drop policy if exists "book_covers_owner_update" on storage.objects;
drop policy if exists "book_covers_owner_delete" on storage.objects;
create policy "book_covers_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'book-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "book_covers_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'book-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'book-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "book_covers_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'book-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3) Takedown registry (separate from books to keep ban survivors across
-- delete + re-upload).
create table if not exists public.book_takedown_hashes (
  perceptual_hash text primary key,
  reason text,
  claimant text,
  created_at timestamptz default now()
);
alter table public.book_takedown_hashes enable row level security;
-- No public read; admin RPCs only.

-- =====================================================================
-- 4) UPLOAD / LISTING / DETAIL RPCs
-- =====================================================================

create or replace function public.register_book_upload(
  p_title           text,
  p_author          text,
  p_language        text,
  p_file_url        text,           -- storage path inside books-files
  p_file_size_bytes bigint,
  p_format          text,           -- 'pdf' | 'epub' | 'mobi'
  p_cover_url       text,
  p_isbn            text,
  p_page_count      int,
  p_word_count      int,
  p_license_type    text,
  p_license_metadata jsonb,
  p_cc_license_code text,
  p_genres          text[],
  p_syllabus_codes  text[],
  p_age_suitability text,
  p_visibility      text,
  p_perceptual_hash text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_status text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if coalesce(nullif(trim(p_title), ''), '') = '' then
    raise exception 'title required';
  end if;
  if coalesce(nullif(trim(p_file_url), ''), '') = '' then
    raise exception 'file_url required';
  end if;
  if p_format not in ('pdf','epub','mobi') then
    raise exception 'format must be pdf, epub, or mobi';
  end if;
  if p_license_type not in
    ('public_domain','creative_commons','author_uploaded','author_permission','fair_use') then
    raise exception 'license_type must be one of: public_domain, creative_commons, author_uploaded, author_permission, fair_use';
  end if;
  if p_visibility not in ('public','listed_private','private') then
    raise exception 'visibility invalid';
  end if;
  if p_age_suitability is not null
     and p_age_suitability not in ('all','13plus','16plus','18plus') then
    raise exception 'age_suitability invalid';
  end if;

  -- Reject re-uploads of previously taken-down works.
  if p_perceptual_hash is not null
     and exists (select 1 from public.book_takedown_hashes h
                  where h.perceptual_hash = p_perceptual_hash) then
    raise exception 'this file matches a previous DMCA takedown and cannot be uploaded';
  end if;

  -- 3-strike uploader ban (Section 1.7 of the spec).
  if (select count(*) from public.books b
       where b.uploader_profile_id = v_user
         and b.status = 'takedown') >= 3 then
    raise exception 'upload disabled: this account has 3 valid copyright complaints on file';
  end if;

  -- Author-uploaded / public-domain land live; everything else queues
  -- for review. (author_permission + fair_use carry the highest risk so
  -- always reviewed.)
  if p_license_type in ('public_domain','author_uploaded') then
    v_status := 'live';
  else
    v_status := 'pending_review';
  end if;

  insert into public.books
    (title, author, uploader_profile_id, language, file_url, file_size_bytes,
     format, cover_url, isbn, page_count, word_count, license_type,
     license_metadata, cc_license_code, genres, syllabus_codes, age_suitability,
     visibility, perceptual_hash, status)
  values
    (trim(p_title), nullif(trim(p_author), ''), v_user, coalesce(nullif(trim(p_language),''), 'en'),
     p_file_url, p_file_size_bytes, p_format, p_cover_url, nullif(trim(p_isbn),''),
     p_page_count, p_word_count, p_license_type,
     coalesce(p_license_metadata, '{}'::jsonb), p_cc_license_code,
     coalesce(p_genres, '{}'), coalesce(p_syllabus_codes, '{}'),
     coalesce(p_age_suitability, 'all'),
     coalesce(p_visibility, 'public'),
     p_perceptual_hash, v_status)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.register_book_upload(
  text, text, text, text, bigint, text, text, text, int, int,
  text, jsonb, text, text[], text[], text, text, text
) from public;
grant execute on function public.register_book_upload(
  text, text, text, text, bigint, text, text, text, int, int,
  text, jsonb, text, text[], text[], text, text, text
) to authenticated;

create or replace function public.list_public_books(
  p_query   text default null,
  p_genre   text default null,
  p_language text default null,
  p_limit   int default 60,
  p_offset  int default 0
)
returns table (
  id uuid, title text, author text, language text, cover_url text,
  format text, license_type text, age_suitability text, genres text[],
  page_count int, download_count int, read_count int, avg_rating real,
  uploaded_at timestamptz
)
language sql security definer set search_path = public stable
as $$
  select
    b.id, b.title, b.author, b.language, b.cover_url, b.format,
    b.license_type, b.age_suitability, b.genres, b.page_count,
    b.download_count, b.read_count, b.avg_rating, b.uploaded_at
  from public.books b
  where b.visibility = 'public'
    and b.status = 'live'
    and (p_query is null
         or b.title ilike '%' || p_query || '%'
         or coalesce(b.author, '') ilike '%' || p_query || '%')
    and (p_genre is null or p_genre = any(b.genres))
    and (p_language is null or b.language = p_language)
  order by b.uploaded_at desc
  limit greatest(1, least(coalesce(p_limit, 60), 200))
  offset greatest(0, coalesce(p_offset, 0));
$$;
revoke all on function public.list_public_books(text, text, text, int, int) from public;
grant execute on function public.list_public_books(text, text, text, int, int) to anon, authenticated;

create or replace function public.list_my_books()
returns table (
  id uuid, title text, author text, cover_url text, format text,
  license_type text, status text, visibility text,
  download_count int, read_count int, uploaded_at timestamptz
)
language sql security definer set search_path = public stable
as $$
  select b.id, b.title, b.author, b.cover_url, b.format,
         b.license_type, b.status, b.visibility,
         b.download_count, b.read_count, b.uploaded_at
  from public.books b
  where b.uploader_profile_id = auth.uid()
  order by b.uploaded_at desc;
$$;
revoke all on function public.list_my_books() from public;
grant execute on function public.list_my_books() to authenticated;

create or replace function public.get_book(p_id uuid)
returns table (
  id uuid, title text, author text, uploader_profile_id uuid,
  uploader_username text, uploader_display_name text,
  language text, file_url text, file_size_bytes bigint,
  format text, cover_url text, isbn text, page_count int, word_count int,
  license_type text, cc_license_code text, license_metadata jsonb,
  genres text[], syllabus_codes text[], age_suitability text,
  visibility text, download_count int, read_count int,
  avg_rating real, rating_count int, status text, uploaded_at timestamptz,
  can_read boolean, is_owner boolean
)
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  -- Bump read_count for live + visible reads. Stays best-effort (no error if RLS denies).
  update public.books
     set read_count = read_count + 1
   where id = p_id and status = 'live' and visibility = 'public';

  return query
  select b.id, b.title, b.author, b.uploader_profile_id,
         p.username, p.display_name,
         b.language, b.file_url, b.file_size_bytes,
         b.format, b.cover_url, b.isbn, b.page_count, b.word_count,
         b.license_type, b.cc_license_code, b.license_metadata,
         b.genres, b.syllabus_codes, b.age_suitability,
         b.visibility, b.download_count, b.read_count,
         b.avg_rating, b.rating_count, b.status, b.uploaded_at,
         -- can_read: live + public, OR owner, OR listed_private (the link
         -- alone is the gate today; per-link auth comes in a later phase).
         (
           (b.status = 'live' and b.visibility = 'public')
           or b.uploader_profile_id = v_user
           or (b.status = 'live' and b.visibility = 'listed_private')
         ),
         (b.uploader_profile_id = v_user)
  from public.books b
  left join public.profiles p on p.id = b.uploader_profile_id
  where b.id = p_id;
end;
$$;
revoke all on function public.get_book(uuid) from public;
grant execute on function public.get_book(uuid) to anon, authenticated;

create or replace function public.record_book_download(p_id uuid)
returns void
language sql security definer set search_path = public
as $$
  update public.books set download_count = download_count + 1
   where id = p_id and status = 'live' and visibility = 'public';
$$;
revoke all on function public.record_book_download(uuid) from public;
grant execute on function public.record_book_download(uuid) to anon, authenticated;

create or replace function public.upsert_book_bookmark(
  p_book_id uuid, p_page_or_cfi text
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  insert into public.book_bookmarks (profile_id, book_id, page_or_cfi, updated_at)
  values (v_user, p_book_id, p_page_or_cfi, now())
  on conflict (profile_id, book_id) do update
    set page_or_cfi = excluded.page_or_cfi, updated_at = now();
end;
$$;
revoke all on function public.upsert_book_bookmark(uuid, text) from public;
grant execute on function public.upsert_book_bookmark(uuid, text) to authenticated;

create or replace function public.add_book_highlight(
  p_book_id uuid, p_page_or_cfi text, p_text text, p_color text, p_note text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  insert into public.book_highlights (profile_id, book_id, page_or_cfi, text_selection, color, note)
  values (v_user, p_book_id, p_page_or_cfi, p_text, coalesce(p_color,'yellow'), p_note)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.add_book_highlight(uuid, text, text, text, text) from public;
grant execute on function public.add_book_highlight(uuid, text, text, text, text) to authenticated;

-- =====================================================================
-- 5) COPYRIGHT COMPLAINTS
-- =====================================================================

create or replace function public.report_book_copyright(
  p_book_id uuid,
  p_claimant_name text,
  p_claimant_email text,
  p_claim_basis text,
  p_evidence_url text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if coalesce(nullif(trim(p_claimant_name), ''), '') = '' then
    raise exception 'claimant name required';
  end if;
  if coalesce(nullif(trim(p_claimant_email), ''), '') = '' then
    raise exception 'claimant email required';
  end if;
  if coalesce(nullif(trim(p_claim_basis), ''), '') = '' then
    raise exception 'claim basis required';
  end if;
  insert into public.book_copyright_complaints
    (book_id, claimant_name, claimant_email, claim_basis, evidence_url, status)
  values
    (p_book_id, trim(p_claimant_name), trim(p_claimant_email),
     trim(p_claim_basis), p_evidence_url, 'pending')
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.report_book_copyright(uuid, text, text, text, text) from public;
grant execute on function public.report_book_copyright(uuid, text, text, text, text) to anon, authenticated;

-- =====================================================================
-- 6) ADMIN QUEUE RPCs
-- =====================================================================

create or replace function public.list_pending_books(p_limit int default 100)
returns table (
  id uuid, title text, author text, uploader_username text,
  language text, format text, license_type text, age_suitability text,
  cover_url text, file_url text, page_count int, file_size_bytes bigint,
  uploaded_at timestamptz
)
language sql security definer set search_path = public stable
as $$
  select b.id, b.title, b.author, p.username,
         b.language, b.format, b.license_type, b.age_suitability,
         b.cover_url, b.file_url, b.page_count, b.file_size_bytes,
         b.uploaded_at
  from public.books b
  left join public.profiles p on p.id = b.uploader_profile_id
  where b.status = 'pending_review'
    and exists (select 1 from public.profiles a
                 where a.id = auth.uid() and a.is_admin is true)
  order by b.uploaded_at asc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;
revoke all on function public.list_pending_books(int) from public;
grant execute on function public.list_pending_books(int) to authenticated;

create or replace function public.list_open_complaints(p_limit int default 100)
returns table (
  id uuid, book_id uuid, book_title text, book_author text,
  book_status text, claimant_name text, claimant_email text,
  claim_basis text, evidence_url text, filed_at timestamptz
)
language sql security definer set search_path = public stable
as $$
  select c.id, c.book_id, b.title, b.author, b.status,
         c.claimant_name, c.claimant_email, c.claim_basis,
         c.evidence_url, c.filed_at
  from public.book_copyright_complaints c
  join public.books b on b.id = c.book_id
  where c.status = 'pending'
    and exists (select 1 from public.profiles a
                 where a.id = auth.uid() and a.is_admin is true)
  order by c.filed_at asc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;
revoke all on function public.list_open_complaints(int) from public;
grant execute on function public.list_open_complaints(int) to authenticated;

create or replace function public.admin_approve_book(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_admin boolean; v_updated int;
begin
  select coalesce(p.is_admin, false) into v_admin
    from public.profiles p where p.id = auth.uid();
  if not v_admin then raise exception 'admin only'; end if;
  update public.books set status = 'live'
   where id = p_id and status = 'pending_review';
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;
revoke all on function public.admin_approve_book(uuid) from public;
grant execute on function public.admin_approve_book(uuid) to authenticated;

create or replace function public.admin_takedown_book(
  p_id uuid,
  p_claimant text default null,
  p_reason text default null,
  p_complaint_id uuid default null
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_admin boolean;
  v_book public.books%rowtype;
begin
  select coalesce(p.is_admin, false) into v_admin
    from public.profiles p where p.id = auth.uid();
  if not v_admin then raise exception 'admin only'; end if;

  select * into v_book from public.books where id = p_id;
  if not found then return false; end if;

  update public.books
     set status = 'takedown',
         takedown_reason = coalesce(p_reason, takedown_reason),
         takedown_claimant = coalesce(p_claimant, takedown_claimant),
         taken_down_at = now()
   where id = p_id;

  -- Remember the hash so a future upload of the same file is auto-blocked.
  if v_book.perceptual_hash is not null then
    insert into public.book_takedown_hashes (perceptual_hash, reason, claimant)
    values (v_book.perceptual_hash, coalesce(p_reason, 'admin takedown'), p_claimant)
    on conflict (perceptual_hash) do nothing;
  end if;

  if p_complaint_id is not null then
    update public.book_copyright_complaints
       set status = 'upheld', reviewer_id = auth.uid(), resolved_at = now(),
           reviewer_note = coalesce(reviewer_note, p_reason)
     where id = p_complaint_id;
  end if;
  return true;
end;
$$;
revoke all on function public.admin_takedown_book(uuid, text, text, uuid) from public;
grant execute on function public.admin_takedown_book(uuid, text, text, uuid) to authenticated;

create or replace function public.admin_reject_complaint(p_complaint_id uuid, p_note text default null)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_admin boolean; v_updated int;
begin
  select coalesce(p.is_admin, false) into v_admin
    from public.profiles p where p.id = auth.uid();
  if not v_admin then raise exception 'admin only'; end if;
  update public.book_copyright_complaints
     set status = 'rejected', reviewer_id = auth.uid(), resolved_at = now(),
         reviewer_note = coalesce(p_note, reviewer_note)
   where id = p_complaint_id;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;
revoke all on function public.admin_reject_complaint(uuid, text) from public;
grant execute on function public.admin_reject_complaint(uuid, text) to authenticated;
