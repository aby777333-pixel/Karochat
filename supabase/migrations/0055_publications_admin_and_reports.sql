-- Karochat — Publications: admin moderation surface + user reports.
--
-- Adds two things on top of migration 0054:
--
--   1. Admin-side RPCs that bypass RLS via SECURITY DEFINER and gate on
--      profiles.is_admin (same pattern used by books / reports today):
--        • admin_list_publications  — every publication, any status, any
--          author, paginated + filterable by status/category/author/search
--        • admin_set_publication_status — flip a publication between
--          'draft' | 'published' | 'hidden'. 'hidden' is an admin-only
--          state (authors can only go draft <-> published themselves).
--
--   2. A `publication_reports` table for user-submitted reports against
--      a publication, plus:
--        • report_publication(p_id, p_reason) — anyone signed-in (incl.
--          anon-auth) can file. Trim + cap reason at 1000 chars. Dedupe
--          on (reporter, publication) while the previous report is still
--          'open' so a user can't spam.
--        • admin_list_publication_reports(p_status, p_limit, p_offset)
--        • admin_update_publication_report(p_id, p_status, p_note) —
--          status in ('open','closed').
--
-- Idempotent. Safe to re-run.

-- =====================================================================
-- 1) ADMIN: read every publication
-- =====================================================================

create or replace function public.admin_list_publications(
  p_status text default null,         -- 'draft' | 'published' | 'hidden' | null=all
  p_category text default null,
  p_author uuid default null,
  p_search text default null,
  p_limit int default 50,
  p_offset int default 0
) returns table (
  id uuid, slug text, title text, subtitle text,
  category_slug text, status text, is_adult boolean,
  pen_name text,
  author_profile_id uuid, author_username text, author_display_name text,
  cover_image_url text, view_count int, language text, tags text[],
  body_markdown text,
  open_report_count bigint,
  published_at timestamptz, created_at timestamptz, updated_at timestamptz
)
language plpgsql security definer set search_path = public stable
as $$
declare v_admin boolean;
begin
  select coalesce(pr.is_admin, false) into v_admin
    from public.profiles pr where pr.id = auth.uid();
  if not coalesce(v_admin, false) then
    raise exception 'admin only';
  end if;

  return query
  select p.id, p.slug, p.title, p.subtitle,
         p.category_slug, p.status, p.is_adult,
         p.pen_name,
         p.author_profile_id, pr.username, pr.display_name,
         p.cover_image_url, p.view_count, p.language, p.tags,
         p.body_markdown,
         coalesce((
           select count(*) from public.publication_reports r
            where r.publication_id = p.id and r.status = 'open'
         ), 0) as open_report_count,
         p.published_at, p.created_at, p.updated_at
    from public.publications p
    left join public.profiles pr on pr.id = p.author_profile_id
   where (p_status is null or p.status = p_status)
     and (p_category is null or p.category_slug = p_category)
     and (p_author is null or p.author_profile_id = p_author)
     and (
       p_search is null
       or p.title    ilike '%' || p_search || '%'
       or p.subtitle ilike '%' || p_search || '%'
       or coalesce(pr.username,'')     ilike '%' || p_search || '%'
       or coalesce(pr.display_name,'') ilike '%' || p_search || '%'
       or coalesce(p.pen_name,'')      ilike '%' || p_search || '%'
     )
   order by p.created_at desc
   limit  greatest(1, least(coalesce(p_limit, 50), 200))
   offset greatest(0, coalesce(p_offset, 0));
end;
$$;
revoke all on function public.admin_list_publications(text, text, uuid, text, int, int) from public;
grant execute on function public.admin_list_publications(text, text, uuid, text, int, int)
  to authenticated;

-- =====================================================================
-- 2) ADMIN: flip status (incl. 'hidden')
-- =====================================================================

create or replace function public.admin_set_publication_status(
  p_id uuid,
  p_status text
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_admin boolean; v_updated int;
begin
  select coalesce(pr.is_admin, false) into v_admin
    from public.profiles pr where pr.id = auth.uid();
  if not coalesce(v_admin, false) then
    raise exception 'admin only';
  end if;

  if p_status not in ('draft','published','hidden') then
    raise exception 'invalid status: %', p_status;
  end if;

  update public.publications
     set status = p_status,
         published_at = case
           when p_status = 'published' then coalesce(published_at, now())
           else published_at
         end
   where id = p_id;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;
revoke all on function public.admin_set_publication_status(uuid, text) from public;
grant execute on function public.admin_set_publication_status(uuid, text) to authenticated;

-- =====================================================================
-- 3) USER REPORTS
-- =====================================================================

create table if not exists public.publication_reports (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  status text not null default 'open'
    check (status in ('open','closed')),
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_note text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);
create index if not exists publication_reports_status_idx
  on public.publication_reports(status, created_at desc);
create index if not exists publication_reports_pub_idx
  on public.publication_reports(publication_id);
create index if not exists publication_reports_reporter_idx
  on public.publication_reports(reporter_id);
-- One open report per (reporter, publication) — prevents spam, lets the
-- same reporter re-file after their previous report is closed.
create unique index if not exists publication_reports_open_unique
  on public.publication_reports(reporter_id, publication_id)
  where status = 'open';

alter table public.publication_reports enable row level security;

-- Reporters can see their own filings; nobody else (other than admin via
-- the SECURITY DEFINER RPC) can read this table.
drop policy if exists "publication_reports_read_own" on public.publication_reports;
create policy "publication_reports_read_own"
  on public.publication_reports for select
  to authenticated
  using (reporter_id = auth.uid());

-- All writes go through the SECURITY DEFINER RPC; no direct INSERT path.

-- =====================================================================
-- 4) RPC: file a report
-- =====================================================================

create or replace function public.report_publication(
  p_id uuid,
  p_reason text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_reason text;
  v_existing_id uuid;
  v_new_id uuid;
begin
  if v_user is null then
    raise exception 'sign in to report';
  end if;
  if p_id is null then
    raise exception 'publication id required';
  end if;
  if not exists (select 1 from public.publications where id = p_id) then
    raise exception 'publication not found';
  end if;

  v_reason := substr(trim(coalesce(p_reason,'')), 1, 1000);
  if v_reason = '' then
    raise exception 'please describe why you''re reporting this';
  end if;

  -- Reuse the existing open report if the reporter already filed one,
  -- updating the reason rather than erroring on the unique index.
  select id into v_existing_id
    from public.publication_reports
   where reporter_id = v_user
     and publication_id = p_id
     and status = 'open';
  if v_existing_id is not null then
    update public.publication_reports
       set reason = v_reason,
           created_at = now()
     where id = v_existing_id;
    return v_existing_id;
  end if;

  insert into public.publication_reports
    (publication_id, reporter_id, reason)
  values
    (p_id, v_user, v_reason)
  returning id into v_new_id;
  return v_new_id;
end;
$$;
revoke all on function public.report_publication(uuid, text) from public;
grant execute on function public.report_publication(uuid, text) to authenticated;

-- =====================================================================
-- 5) RPCs: admin report queue
-- =====================================================================

create or replace function public.admin_list_publication_reports(
  p_status text default 'open',
  p_limit int default 100,
  p_offset int default 0
) returns table (
  id uuid,
  publication_id uuid,
  publication_slug text,
  publication_title text,
  publication_status text,
  publication_is_adult boolean,
  reporter_id uuid,
  reporter_username text,
  reason text,
  status text,
  reviewer_id uuid,
  reviewer_note text,
  created_at timestamptz,
  resolved_at timestamptz
)
language plpgsql security definer set search_path = public stable
as $$
declare v_admin boolean;
begin
  select coalesce(pr.is_admin, false) into v_admin
    from public.profiles pr where pr.id = auth.uid();
  if not coalesce(v_admin, false) then
    raise exception 'admin only';
  end if;

  return query
  select r.id,
         r.publication_id, p.slug, p.title, p.status, p.is_adult,
         r.reporter_id, rep.username,
         r.reason, r.status, r.reviewer_id, r.reviewer_note,
         r.created_at, r.resolved_at
    from public.publication_reports r
    left join public.publications p on p.id = r.publication_id
    left join public.profiles rep   on rep.id = r.reporter_id
   where (p_status is null or r.status = p_status)
   order by r.created_at desc
   limit  greatest(1, least(coalesce(p_limit, 100), 500))
   offset greatest(0, coalesce(p_offset, 0));
end;
$$;
revoke all on function public.admin_list_publication_reports(text, int, int) from public;
grant execute on function public.admin_list_publication_reports(text, int, int)
  to authenticated;

create or replace function public.admin_update_publication_report(
  p_id uuid,
  p_status text,
  p_note text default null
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_admin boolean; v_updated int;
begin
  select coalesce(pr.is_admin, false) into v_admin
    from public.profiles pr where pr.id = auth.uid();
  if not coalesce(v_admin, false) then
    raise exception 'admin only';
  end if;
  if p_status not in ('open','closed') then
    raise exception 'invalid status: %', p_status;
  end if;

  update public.publication_reports
     set status = p_status,
         reviewer_id = auth.uid(),
         reviewer_note = coalesce(nullif(trim(coalesce(p_note,'')),''), reviewer_note),
         resolved_at = case when p_status = 'closed' then now() else null end
   where id = p_id;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;
revoke all on function public.admin_update_publication_report(uuid, text, text) from public;
grant execute on function public.admin_update_publication_report(uuid, text, text)
  to authenticated;
