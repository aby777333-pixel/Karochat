-- Karochat — v9 Phase 2 fix: resolve get_book column ambiguity.
--
-- The original get_book() declares RETURNS TABLE (id uuid, ...). plpgsql
-- treats that as a local OUT-parameter named `id`, which collides with
-- the `id` column on public.books inside the UPDATE that bumps
-- read_count. Postgres raises:
--
--   42702: column reference "id" is ambiguous
--   DETAIL: It could refer to either a PL/pgSQL variable or a table column.
--   QUERY:  update public.books set read_count = read_count + 1
--      where id = p_id and status = 'live' and visibility = 'public'
--
-- Effect on prod: every /books/[id] page call to get_book() raised, so
-- no book detail page rendered. Bug never surfaced only because no books
-- were uploaded yet between Phase 2 ship and verification.
--
-- Fix: alias the table inside the UPDATE and fully-qualify the column.
-- Function signature is unchanged. Idempotent (create or replace).

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
  update public.books b
     set read_count = b.read_count + 1
   where b.id = p_id and b.status = 'live' and b.visibility = 'public';

  return query
  select b.id, b.title, b.author, b.uploader_profile_id,
         p.username, p.display_name,
         b.language, b.file_url, b.file_size_bytes,
         b.format, b.cover_url, b.isbn, b.page_count, b.word_count,
         b.license_type, b.cc_license_code, b.license_metadata,
         b.genres, b.syllabus_codes, b.age_suitability,
         b.visibility, b.download_count, b.read_count,
         b.avg_rating, b.rating_count, b.status, b.uploaded_at,
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
