-- Karochat — Wave 19.13: lower min student age to 13 + add guardian phone.
--
-- Most younger students don't have edu emails — they need a guardian-
-- consent path with the parent's email AND phone. This migration:
--   1. Adds student_verifications.guardian_phone.
--   2. Replaces start_verification with a new signature that accepts
--      guardian_phone, and enforces:
--        - minimum age 13 (was 16),
--        - 13-17 → is_minor = true,
--        - 13-17 + guardian_consent method → guardian_email + phone
--          are both required.
--
-- Additive + idempotent. The old 9-arg signature is dropped so the
-- client-side typed call resolves to the new one cleanly.

alter table public.student_verifications
  add column if not exists guardian_phone text;

-- Drop the older signature so the new one is the only resolved match.
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

  -- 13–17 must use guardian_consent if they're not using edu_email or
  -- result_upload — and guardian_consent requires both contact details.
  if v_minor and p_method = 'guardian_consent' then
    if coalesce(nullif(trim(p_guardian_email), ''), '') = '' then
      raise exception 'guardian email required';
    end if;
    if coalesce(nullif(trim(p_guardian_phone), ''), '') = '' then
      raise exception 'guardian phone required';
    end if;
  end if;

  -- Wipe any previous pending row so the user can resubmit cleanly.
  delete from public.student_verifications
   where profile_id = v_user and status = 'pending';

  v_id := gen_random_uuid();
  insert into public.student_verifications
    (id, profile_id, status, country, education_level, syllabus,
     institution, verification_method, verification_metadata,
     subject_affinities, guardian_email, guardian_phone, is_minor)
  values
    (v_id, v_user, 'pending', p_country, p_education_level, p_syllabus,
     p_institution, p_method, coalesce(p_metadata, '{}'::jsonb),
     coalesce(p_subjects, '{}'),
     p_guardian_email, p_guardian_phone, v_minor);

  update public.profiles set student_network_optin = true where id = v_user;

  return v_id;
end;
$$;

revoke all on function public.start_verification(
  text, text, text, text, text, jsonb, text[], text, text, date
) from public;
grant execute on function public.start_verification(
  text, text, text, text, text, jsonb, text[], text, text, date
) to authenticated;
