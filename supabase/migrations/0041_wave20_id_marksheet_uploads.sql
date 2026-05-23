-- Karochat — Wave 20.12: real ID-card and marksheet uploads.
--
-- Before: picking "Student ID upload" or "Recent result / marksheet" did
-- not show a file picker at all — the user just hit Submit and the row
-- auto-verified. There was no actual proof on file.
--
-- After:
--   • student_verifications grows id_card_url + id_expiry_date and
--     marksheet_url + result_date. (URLs are storage paths inside the
--     new private 'student-verifications' bucket.)
--   • start_verification now requires those fields when the method is
--     id_upload or result_upload, and the row starts as 'pending' (no
--     auto-verify). The operator approves via the new admin RPCs.
--   • New 'student-verifications' storage bucket (private). Owner can
--     write to their own folder; only admins / service_role can read.
--   • New admin RPCs (gated on profiles.is_admin, same pattern as the
--     reports queue):
--       - list_pending_verifications(limit)
--       - admin_approve_verification(id)
--       - admin_reject_verification(id, note)
--
-- Idempotent + additive. Safe to re-run. The Wave 20.11 consent/email
-- flow is untouched — edu_email and guardian_consent still confirm via
-- /api/students/verify/send + /students/verify/[token].

-- 1) Columns ------------------------------------------------------------

alter table public.student_verifications
  add column if not exists id_card_url     text,
  add column if not exists id_expiry_date  date,
  add column if not exists marksheet_url   text,
  add column if not exists result_date     date;

-- 2) Storage bucket -----------------------------------------------------
-- Private bucket. Owner-write inside their own folder; admin / service
-- read. Used to hold ID-card and marksheet photos. Capped at 5 MB.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-verifications', 'student-verifications', false,
  5 * 1024 * 1024,
  array['image/png','image/jpeg','image/jpg','image/webp','image/heic','application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Wipe any previous policies on this bucket so re-runs leave a clean slate.
drop policy if exists "student_verif_owner_insert" on storage.objects;
drop policy if exists "student_verif_owner_update" on storage.objects;
drop policy if exists "student_verif_owner_delete" on storage.objects;
drop policy if exists "student_verif_owner_select" on storage.objects;
drop policy if exists "student_verif_admin_select" on storage.objects;

-- The owner can write/read/replace anything inside `<their-uid>/...`.
create policy "student_verif_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'student-verifications'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "student_verif_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'student-verifications'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'student-verifications'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "student_verif_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'student-verifications'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can read their own files (e.g. to confirm the upload via signed URL).
create policy "student_verif_owner_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'student-verifications'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read every object in the bucket so the approval queue can
-- mint signed URLs for review.
create policy "student_verif_admin_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'student-verifications'
    and exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.is_admin is true
    )
  );

-- 3) start_verification (replaces the Wave 20.11 version) ---------------
-- Adds the id_card_url / id_expiry_date / marksheet_url / result_date
-- requirements for id_upload and result_upload, and stops auto-verifying
-- them. edu_email + guardian_consent behaviour is unchanged.

drop function if exists public.start_verification(
  text, text, text, text, text, jsonb, text[], text, text, date
);

create or replace function public.start_verification(
  p_country         text,
  p_education_level text,
  p_syllabus        text,
  p_institution     text,
  p_method          text,
  p_metadata        jsonb,
  p_subjects        text[],
  p_guardian_email  text,
  p_guardian_phone  text,
  p_dob             date
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user           uuid := auth.uid();
  v_id             uuid;
  v_minor          boolean;
  v_age            int;
  v_status         text;
  v_token          text;
  v_needs_confirm  boolean;
  v_id_card_url    text;
  v_id_expiry      date;
  v_marksheet_url  text;
  v_result_date    date;
  v_edu_email      text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_method not in ('edu_email','id_upload','result_upload','guardian_consent') then
    raise exception 'invalid method %', p_method;
  end if;
  if p_dob is null then raise exception 'date of birth required'; end if;
  v_age := date_part('year', age(now(), p_dob));
  if v_age < 13 then raise exception 'minimum age 13'; end if;
  v_minor := v_age < 18;

  -- Method-specific requirement checks.
  if p_method = 'edu_email' then
    v_edu_email := nullif(trim(coalesce(p_metadata->>'edu_email','')), '');
    if v_edu_email is null then
      raise exception 'edu email required for edu_email method';
    end if;
  end if;

  if v_minor and p_method = 'guardian_consent' then
    if coalesce(nullif(trim(p_guardian_email), ''), '') = '' then
      raise exception 'guardian email required';
    end if;
    if coalesce(nullif(trim(p_guardian_phone), ''), '') = '' then
      raise exception 'guardian phone required';
    end if;
  end if;

  if p_method = 'id_upload' then
    v_id_card_url := nullif(trim(coalesce(p_metadata->>'id_card_url','')), '');
    if v_id_card_url is null then
      raise exception 'ID card photo upload is required';
    end if;
    begin
      v_id_expiry := (p_metadata->>'id_expiry_date')::date;
    exception when others then
      v_id_expiry := null;
    end;
    if v_id_expiry is null then
      raise exception 'ID expiry date is required';
    end if;
    if v_id_expiry < current_date then
      raise exception 'ID expiry date must be in the future';
    end if;
  end if;

  if p_method = 'result_upload' then
    v_marksheet_url := nullif(trim(coalesce(p_metadata->>'marksheet_url','')), '');
    if v_marksheet_url is null then
      raise exception 'Marksheet / result photo upload is required';
    end if;
    begin
      v_result_date := (p_metadata->>'result_date')::date;
    exception when others then
      v_result_date := null;
    end;
    if v_result_date is null then
      raise exception 'Exam / result date is required';
    end if;
    if v_result_date > current_date then
      raise exception 'Exam / result date cannot be in the future';
    end if;
    if v_result_date < current_date - interval '25 years' then
      raise exception 'Exam / result date is too far in the past';
    end if;
  end if;

  -- Wipe any previous pending/rejected/expired row so the user can
  -- resubmit cleanly. Keeps any current 'verified' row alive.
  delete from public.student_verifications
   where profile_id = v_user
     and status in ('pending','rejected','expired');

  v_needs_confirm := p_method in ('edu_email','guardian_consent');

  -- Wave 20.12 — id_upload and result_upload now require operator
  -- review, so they also start pending (without a consent token; admin
  -- approval is the unblock instead of a recipient click).
  if v_needs_confirm then
    v_status := 'pending';
    v_token := translate(
      encode(gen_random_bytes(24), 'base64'),
      '+/=', '-_ '
    );
    v_token := replace(v_token, ' ', '');
  elsif p_method in ('id_upload','result_upload') then
    v_status := 'pending';
    v_token  := null;
  else
    v_status := 'verified';
    v_token  := null;
  end if;

  v_id := gen_random_uuid();
  insert into public.student_verifications
    (id, profile_id, status, country, education_level, syllabus,
     institution, verification_method, verification_metadata,
     subject_affinities, guardian_email, guardian_phone, is_minor,
     badge_tier, consent_token,
     id_card_url, id_expiry_date, marksheet_url, result_date,
     verified_at, expires_at)
  values
    (v_id, v_user, v_status, p_country, p_education_level, p_syllabus,
     p_institution, p_method, coalesce(p_metadata, '{}'::jsonb),
     coalesce(p_subjects, '{}'),
     p_guardian_email, p_guardian_phone, v_minor,
     'student', v_token,
     v_id_card_url, v_id_expiry, v_marksheet_url, v_result_date,
     case when v_status = 'verified' then now() else null end,
     case when v_status = 'verified' then now() + interval '12 months' else null end);

  if v_status = 'verified' then
    update public.profiles
       set student_network_optin = true
     where id = v_user;
  end if;

  return v_id;
end;
$$;

revoke all on function public.start_verification(
  text, text, text, text, text, jsonb, text[], text, text, date
) from public;
grant execute on function public.start_verification(
  text, text, text, text, text, jsonb, text[], text, text, date
) to authenticated;

-- 4) Admin queue RPCs ---------------------------------------------------

create or replace function public.list_pending_verifications(p_limit int default 200)
returns table (
  id                   uuid,
  profile_id           uuid,
  username             text,
  display_name         text,
  is_guest             boolean,
  status               text,
  country              text,
  education_level      text,
  syllabus             text,
  institution          text,
  verification_method  text,
  is_minor             boolean,
  guardian_email       text,
  guardian_phone       text,
  id_card_url          text,
  id_expiry_date       date,
  marksheet_url        text,
  result_date          date,
  created_at           timestamptz
)
language sql security definer set search_path = public stable
as $$
  select
    sv.id, sv.profile_id, p.username, p.display_name, p.is_guest,
    sv.status, sv.country, sv.education_level, sv.syllabus, sv.institution,
    sv.verification_method, sv.is_minor, sv.guardian_email, sv.guardian_phone,
    sv.id_card_url, sv.id_expiry_date, sv.marksheet_url, sv.result_date,
    sv.created_at
  from public.student_verifications sv
  join public.profiles p on p.id = sv.profile_id
  where sv.status = 'pending'
    and sv.verification_method in ('id_upload','result_upload')
    and exists (select 1 from public.profiles a
                 where a.id = auth.uid() and a.is_admin is true)
  order by sv.created_at asc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;
revoke all on function public.list_pending_verifications(int) from public;
grant execute on function public.list_pending_verifications(int) to authenticated;

create or replace function public.admin_approve_verification(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_admin boolean;
  v_owner uuid;
begin
  select coalesce(p.is_admin, false) into v_admin
    from public.profiles p where p.id = auth.uid();
  if not v_admin then raise exception 'admin only'; end if;

  update public.student_verifications
     set status = 'verified',
         verified_at = coalesce(verified_at, now()),
         expires_at = coalesce(expires_at, now() + interval '12 months'),
         reviewer_id = auth.uid()
   where id = p_id
   returning profile_id into v_owner;

  if v_owner is null then return false; end if;

  update public.profiles
     set student_network_optin = true
   where id = v_owner;

  return true;
end;
$$;
revoke all on function public.admin_approve_verification(uuid) from public;
grant execute on function public.admin_approve_verification(uuid) to authenticated;

create or replace function public.admin_reject_verification(p_id uuid, p_note text default null)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_admin boolean;
  v_updated int;
begin
  select coalesce(p.is_admin, false) into v_admin
    from public.profiles p where p.id = auth.uid();
  if not v_admin then raise exception 'admin only'; end if;

  update public.student_verifications
     set status = 'rejected',
         reviewer_id = auth.uid(),
         reviewer_note = coalesce(p_note, reviewer_note)
   where id = p_id;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;
revoke all on function public.admin_reject_verification(uuid, text) from public;
grant execute on function public.admin_reject_verification(uuid, text) to authenticated;

-- 5) get_my_verification — append the four new columns -----------------
-- Same backwards-compatible append pattern as Wave 20.11.

drop function if exists public.get_my_verification();

create or replace function public.get_my_verification()
returns table (
  id                       uuid,
  status                   text,
  country                  text,
  education_level          text,
  syllabus                 text,
  institution              text,
  badge_tier               text,
  subject_affinities       text[],
  is_minor                 boolean,
  verified_at              timestamptz,
  expires_at               timestamptz,
  verification_method      text,
  guardian_email           text,
  guardian_phone           text,
  consent_token            text,
  consent_email_sent_at    timestamptz,
  consent_phone_sent_at    timestamptz,
  consent_confirmed_at     timestamptz,
  consent_confirmed_via    text,
  id_card_url              text,
  id_expiry_date           date,
  marksheet_url            text,
  result_date              date,
  reviewer_note            text
)
language sql security definer set search_path = public stable
as $$
  select
    sv.id, sv.status, sv.country, sv.education_level, sv.syllabus,
    sv.institution, sv.badge_tier, sv.subject_affinities, sv.is_minor,
    sv.verified_at, sv.expires_at,
    sv.verification_method, sv.guardian_email, sv.guardian_phone,
    sv.consent_token, sv.consent_email_sent_at, sv.consent_phone_sent_at,
    sv.consent_confirmed_at, sv.consent_confirmed_via,
    sv.id_card_url, sv.id_expiry_date, sv.marksheet_url, sv.result_date,
    sv.reviewer_note
  from public.student_verifications sv
  where sv.profile_id = auth.uid()
  order by sv.created_at desc
  limit 1;
$$;
revoke all on function public.get_my_verification() from public;
grant execute on function public.get_my_verification() to authenticated;
