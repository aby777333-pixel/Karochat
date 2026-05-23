-- Karochat — Wave 20.11: actually send the consent / verification messages
-- instead of silently auto-approving.
--
-- Before: start_verification (migration 0038) flipped every submission to
-- status='verified' immediately and stored guardian_email / guardian_phone
-- as nothing more than an audit field. No email or SMS was ever sent.
--
-- After:
--   • edu_email and guardian_consent submissions start as 'pending' and
--     get a one-time consent_token. The Next.js /api/students/verify/send
--     route reads that token and dispatches an email (Resend) plus an
--     SMS (Twilio) — see lib/mail and lib/sms. Status only flips to
--     'verified' once the recipient clicks the link, which calls the new
--     confirm_verification_token RPC.
--   • id_upload and result_upload keep auto-approving (legacy behaviour
--     preserved — the operator still has no admin queue to review them,
--     and we don't want to lock those users out mid-launch).
--
-- get_my_verification is extended to return the consent_token + send +
-- confirmation timestamps so the client can render a faithful "we sent
-- the link, click the inbox" state and let the user trigger a resend.
--
-- Idempotent + additive. Safe to re-run.

-- 1) Columns ------------------------------------------------------------

alter table public.student_verifications
  add column if not exists consent_token         text,
  add column if not exists consent_email_sent_at timestamptz,
  add column if not exists consent_phone_sent_at timestamptz,
  add column if not exists consent_confirmed_at  timestamptz,
  add column if not exists consent_confirmed_via text;

create unique index if not exists student_verifications_consent_token_uq
  on public.student_verifications (consent_token)
  where consent_token is not null;

-- 2) start_verification (replaces the 0038 auto-approve version) ---------

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
  v_user   uuid := auth.uid();
  v_id     uuid;
  v_minor  boolean;
  v_age    int;
  v_status text;
  v_token  text;
  v_needs_confirm boolean;
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
    if coalesce(nullif(trim(coalesce(p_metadata->>'edu_email','')), ''), '') = '' then
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

  -- Wipe any previous pending/rejected/expired row so resubmits work
  -- cleanly. Keeps any current 'verified' row alive.
  delete from public.student_verifications
   where profile_id = v_user
     and status in ('pending','rejected','expired');

  v_needs_confirm := p_method in ('edu_email','guardian_consent');

  if v_needs_confirm then
    v_status := 'pending';
    -- URL-safe ~32-char token. Base64url so it's link-safe without
    -- percent-encoding.
    v_token := translate(
      encode(gen_random_bytes(24), 'base64'),
      '+/=', '-_ '
    );
    v_token := replace(v_token, ' ', '');
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
     verified_at, expires_at)
  values
    (v_id, v_user, v_status, p_country, p_education_level, p_syllabus,
     p_institution, p_method, coalesce(p_metadata, '{}'::jsonb),
     coalesce(p_subjects, '{}'),
     p_guardian_email, p_guardian_phone, v_minor,
     'student', v_token,
     case when v_status = 'verified' then now() else null end,
     case when v_status = 'verified' then now() + interval '12 months' else null end);

  -- Only flip the network opt-in when we're actually verifying right
  -- away. For pending rows the opt-in flips inside confirm_verification_token.
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

-- 3) confirm_verification_token ------------------------------------------
-- Anon-callable so the parent (who is not logged in) can click the link
-- and have it work. Idempotent: a second click returns the same "verified"
-- result instead of erroring.

create or replace function public.confirm_verification_token(
  p_token text,
  p_via   text default 'email'
) returns table (
  ok          boolean,
  status      text,
  message     text,
  is_minor    boolean
)
language plpgsql security definer set search_path = public
as $$
declare
  v_row student_verifications%rowtype;
begin
  if p_token is null or length(trim(p_token)) < 8 then
    return query select false, null::text, 'Invalid or missing link.'::text, null::boolean;
    return;
  end if;
  if p_via not in ('email','phone') then p_via := 'email'; end if;

  select * into v_row
  from public.student_verifications
  where consent_token = p_token
  limit 1;

  if not found then
    return query select false, null::text,
      'This link is no longer valid — it may have been replaced by a newer submission.'::text,
      null::boolean;
    return;
  end if;

  if v_row.status = 'verified' then
    return query select true, 'verified'::text,
      'Already verified — thanks!'::text, v_row.is_minor;
    return;
  end if;

  update public.student_verifications
     set status = 'verified',
         verified_at = coalesce(verified_at, now()),
         expires_at = coalesce(expires_at, now() + interval '12 months'),
         consent_confirmed_at = coalesce(consent_confirmed_at, now()),
         consent_confirmed_via = coalesce(consent_confirmed_via, p_via)
   where id = v_row.id;

  update public.profiles
     set student_network_optin = true
   where id = v_row.profile_id;

  return query select true, 'verified'::text,
    'Thanks — verification confirmed.'::text, v_row.is_minor;
end;
$$;

revoke all on function public.confirm_verification_token(text, text) from public;
grant execute on function public.confirm_verification_token(text, text) to anon, authenticated;

-- 4) record_verification_send --------------------------------------------
-- Server-only helper. Stamps the sent timestamp for the matching channel
-- so the client can show "sent at" and the resend logic can throttle.

create or replace function public.record_verification_send(
  p_verification_id uuid,
  p_channel         text
) returns void
language sql security definer set search_path = public
as $$
  update public.student_verifications
     set consent_email_sent_at = case when p_channel = 'email' then now()
                                       else consent_email_sent_at end,
         consent_phone_sent_at = case when p_channel = 'phone' then now()
                                       else consent_phone_sent_at end
   where id = p_verification_id;
$$;

revoke all on function public.record_verification_send(uuid, text) from public;
grant execute on function public.record_verification_send(uuid, text)
  to authenticated, service_role;

-- 5) get_my_verification — extended to surface the new fields ------------
-- Backwards-compatible at the call site: the existing columns are still
-- returned in the same order; the new ones append at the end. Postgres
-- doesn't allow create-or-replace when the return columns change, so we
-- drop the prior signature first.
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
  consent_confirmed_via    text
)
language sql security definer set search_path = public stable
as $$
  select
    sv.id, sv.status, sv.country, sv.education_level, sv.syllabus,
    sv.institution, sv.badge_tier, sv.subject_affinities, sv.is_minor,
    sv.verified_at, sv.expires_at,
    sv.verification_method, sv.guardian_email, sv.guardian_phone,
    sv.consent_token, sv.consent_email_sent_at, sv.consent_phone_sent_at,
    sv.consent_confirmed_at, sv.consent_confirmed_via
  from public.student_verifications sv
  where sv.profile_id = auth.uid()
  order by sv.created_at desc
  limit 1;
$$;
revoke all on function public.get_my_verification() from public;
grant execute on function public.get_my_verification() to authenticated;
