-- Karochat — "Files & Apps" hub: user-shared files (PDFs, eBooks, software…).
--
-- A general file-sharing space: users upload a file with a heading, caption,
-- description and category, mark it public or private, and others can read /
-- download / install it. Mirrors the proven shorts/videos/adult_media patterns
-- (public bucket + RLS-gated table). Purely additive + idempotent.
--
-- Karochat does not host the rights to, scan or vet these files — uploaders are
-- responsible for their content; downloaders act at their own risk (the UI shows
-- a clear disclaimer).

create table if not exists public.shared_files (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  caption        text,
  description    text,
  category       text,          -- PDF, eBook, Document, Software, App (APK), Archive, Other
  file_url       text not null,
  file_name      text,
  file_size      bigint,
  file_mime      text,
  is_public      boolean not null default true,
  download_count integer not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists shared_files_feed_idx
  on public.shared_files (is_public, created_at desc) where is_public = true;
create index if not exists shared_files_owner_idx
  on public.shared_files (owner_id, created_at desc);
create index if not exists shared_files_category_idx
  on public.shared_files (category) where category is not null;

alter table public.shared_files enable row level security;

drop policy if exists "shared_files_read" on public.shared_files;
create policy "shared_files_read" on public.shared_files
  for select to authenticated
  using (is_public = true or owner_id = auth.uid());

drop policy if exists "shared_files_insert" on public.shared_files;
create policy "shared_files_insert" on public.shared_files
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "shared_files_update_own" on public.shared_files;
create policy "shared_files_update_own" on public.shared_files
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "shared_files_delete_own" on public.shared_files;
create policy "shared_files_delete_own" on public.shared_files
  for delete to authenticated using (owner_id = auth.uid());

grant select, insert, update, delete on public.shared_files to authenticated;

-- Bump a download counter without needing UPDATE rights on others' rows.
create or replace function public.increment_file_download(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.shared_files
     set download_count = download_count + 1
   where id = p_id and is_public = true;
end;
$$;
revoke all on function public.increment_file_download(uuid) from public;
grant execute on function public.increment_file_download(uuid) to authenticated;

-- Author-joined view (security_invoker → RLS above still applies to the reader).
drop view if exists public.shared_files_with_author;
create view public.shared_files_with_author
with (security_invoker = true) as
select
  f.id, f.owner_id, f.title, f.caption, f.description, f.category,
  f.file_url, f.file_name, f.file_size, f.file_mime, f.is_public,
  f.download_count, f.created_at,
  p.username     as author_username,
  p.display_name as author_display_name
from public.shared_files f
left join public.profiles p on p.id = f.owner_id;

grant select on public.shared_files_with_author to authenticated;

-- Storage bucket — public so download links resolve; large cap; any file type
-- (software/installers included). Writes are scoped to the user's own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('shared-files', 'shared-files', true, 524288000, null)
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "shared_files_storage_read" on storage.objects;
create policy "shared_files_storage_read" on storage.objects
  for select to authenticated using (bucket_id = 'shared-files');

drop policy if exists "shared_files_storage_insert" on storage.objects;
create policy "shared_files_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'shared-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "shared_files_storage_delete" on storage.objects;
create policy "shared_files_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'shared-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
