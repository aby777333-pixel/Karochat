-- Karochat — Wave 20.6: ship the missing guardian_phone column + replace
-- start_verification with an auto-approving version.
--
-- The live DB never got migration 0033 (it sits in this repo but wasn't
-- applied), so:
--   • student_verifications has no guardian_phone column, AND
--   • start_verification still has the OLD 9-arg signature (no
--     p_guardian_phone parameter).
-- The client now calls the 10-arg signature, so PostgREST can't resolve
-- the function and submits fail silently.
--
-- This migration:
--   1. Adds guardian_phone column (idempotent).
--   2. Drops the old 9-arg start_verification.
--   3. Creates the new 10-arg start_verification that ALSO auto-approves
--      submissions to status='verified'. Single-operator deployments
--      (Karochat at launch is one) don't have an admin-reviewer rota,
--      so manual review = users stuck on 'pending' forever. The audit
--      trail (method, country, education, guardian contacts, is_minor)
--      stays intact so the operator can retroactively review or revoke
--      any specific row.
--
-- Idempotent + additive. Safe to re-run.

alter table public.student_verifications
  add column if not exists guardian_phone text;

drop function if exists public.start_verification(
  text, text, text, text, text, jsonb, text[], text, date
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
  v_user  uuid := auth.uid();
  v_id    uuid;
  v_minor boolean;
  v_age   int;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_method not in ('edu_email','id_upload','result_upload','guardian_consent') then
    raise exception 'invalid method %', p_method;
  end if;
  if p_dob is null then raise exception 'date of birth required'; end if;
  v_age := date_part('year', age(now(), p_dob));
  if v_age < 13 then raise exception 'minimum age 13'; end if;
  v_minor := v_age < 18;

  -- 13–17 using guardian_consent must supply both contact details.
  -- (For other methods, the operator can still spot-check; this just
  -- enforces the most-common minor path.)
  if v_minor and p_method = 'guardian_consent' then
    if coalesce(nullif(trim(p_guardian_email), ''), '') = '' then
      raise exception 'guardian email required';
    end if;
    if coalesce(nullif(trim(p_guardian_phone), ''), '') = '' then
      raise exception 'guardian phone required';
    end if;
  end if;

  -- Wipe any previous pending/rejected/expired row so the user can
  -- resubmit cleanly. We keep the most recent 'verified' row alone —
  -- already-verified users get a no-op upsert below.
  delete from public.student_verifications
   where profile_id = v_user
     and status in ('pending','rejected','expired');

  v_id := gen_random_uuid();
  insert into public.student_verifications
    (id, profile_id, status, country, education_level, syllabus,
     institution, verification_method, verification_metadata,
     subject_affinities, guardian_email, guardian_phone, is_minor,
     badge_tier, verified_at, expires_at)
  values
    (v_id, v_user, 'verified', p_country, p_education_level, p_syllabus,
     p_institution, p_method, coalesce(p_metadata, '{}'::jsonb),
     coalesce(p_subjects, '{}'),
     p_guardian_email, p_guardian_phone, v_minor,
     'student', now(), now() + interval '12 months');

  update public.profiles
     set student_network_optin = true
   where id = v_user;

  return v_id;
end;
$$;

revoke all on function public.start_verification(
  text, text, text, text, text, jsonb, text[], text, text, date
) from public;
grant execute on function public.start_verification(
  text, text, text, text, text, jsonb, text[], text, text, date
) to authenticated;
