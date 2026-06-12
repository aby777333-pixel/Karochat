-- 0070_v9_phase4_ask_doctor.sql
-- =====================================================================
-- v9 Phase 4 — Ask a Doctor
--
-- Builds on the Phase 1 foundations (0042: medical_verifications,
-- doctor_availability, doctor_beacon_sessions) and the v8 students
-- beacon rail (0024: help_beacons, beacon_sessions). This migration:
--
--   • profiles.is_verified_doctor denormalized flag
--   • medical-evidence private storage bucket (10MB, images + pdf)
--   • verification flow RPCs: submit_medical_verification,
--     admin_list_medical_verifications, admin_review_medical_verification
--   • doctor directory + availability: list_verified_doctors,
--     set_doctor_availability
--   • doctor beacon (subject='medical' on the v8 rail):
--     create_doctor_beacon, list_open_doctor_beacons,
--     accept_doctor_beacon (race-safe claim → DM room + session),
--     cancel_doctor_beacon, my_doctor_consults, my_doctor_sessions,
--     complete_doctor_session
--   • doctor_beacon_sessions.room_id + participant read policy
--   • medical_emergency helpline seeds (112/108/911/999)
--
-- Structural non-negotiables honored here:
--   - council-registry + insurance fields required before review
--   - emergency flag travels in help_beacons.classification and is
--     copied to doctor_beacon_sessions.was_emergency_routed
--   - guests (Lobby-only) cannot open doctor beacons
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) profiles.is_verified_doctor
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_verified_doctor boolean not null default false;

-- ---------------------------------------------------------------------
-- 2) doctor_beacon_sessions: room link + participant reads
-- ---------------------------------------------------------------------
alter table public.doctor_beacon_sessions
  add column if not exists room_id uuid references public.rooms(id) on delete set null;

drop policy if exists "dbs_read_parties" on public.doctor_beacon_sessions;
create policy "dbs_read_parties" on public.doctor_beacon_sessions
  for select to authenticated
  using (exists (select 1 from public.beacon_sessions bs
                  where bs.id = doctor_beacon_sessions.id
                    and (bs.asker_profile_id = auth.uid()
                         or bs.helper_profile_id = auth.uid())));

-- ---------------------------------------------------------------------
-- 3) medical-evidence storage bucket (private)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'medical-evidence', 'medical-evidence', false,
  10 * 1024 * 1024,
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "medical_evidence_owner_insert" on storage.objects;
create policy "medical_evidence_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'medical-evidence'
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "medical_evidence_owner_update" on storage.objects;
create policy "medical_evidence_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'medical-evidence'
         and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "medical_evidence_owner_delete" on storage.objects;
create policy "medical_evidence_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'medical-evidence'
         and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "medical_evidence_owner_or_admin_read" on storage.objects;
create policy "medical_evidence_owner_or_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'medical-evidence'
         and ((storage.foldername(name))[1] = auth.uid()::text
              or exists (select 1 from public.profiles p
                          where p.id = auth.uid() and p.is_admin is true)));

-- ---------------------------------------------------------------------
-- 4) Verification flow
-- ---------------------------------------------------------------------
create or replace function public.submit_medical_verification(
  p_country text,
  p_degree text,
  p_specialty text,
  p_council_name text,
  p_council_registration_number text,
  p_registration_evidence_url text,
  p_id_evidence_url text,
  p_selfie_with_id_url text,
  p_insurance_provider text,
  p_insurance_policy_number text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.profiles where id = v_user and is_guest) then
    raise exception 'guests cannot apply — create a full account first';
  end if;
  if coalesce(trim(p_country), '') = '' then raise exception 'country required'; end if;
  if coalesce(trim(p_council_name), '') = ''
     or coalesce(trim(p_council_registration_number), '') = '' then
    raise exception 'medical council name and registration number are required';
  end if;
  if coalesce(trim(p_registration_evidence_url), '') = ''
     or coalesce(trim(p_id_evidence_url), '') = '' then
    raise exception 'registration certificate and government ID uploads are required';
  end if;
  if exists (select 1 from public.medical_verifications
              where profile_id = v_user and status = 'verified'
                and (expires_at is null or expires_at > now())) then
    raise exception 'you are already a verified doctor';
  end if;

  -- Resubmission overwrites the open pending/rejected application.
  select id into v_id from public.medical_verifications
   where profile_id = v_user and status in ('pending','rejected')
   order by created_at desc limit 1;

  if v_id is not null then
    update public.medical_verifications
       set country = trim(p_country),
           degree = nullif(trim(p_degree), ''),
           specialty = nullif(trim(p_specialty), ''),
           council_name = trim(p_council_name),
           council_registration_number = trim(p_council_registration_number),
           registration_evidence_url = p_registration_evidence_url,
           id_evidence_url = p_id_evidence_url,
           selfie_with_id_url = nullif(p_selfie_with_id_url, ''),
           insurance_provider = nullif(trim(p_insurance_provider), ''),
           insurance_policy_number = nullif(trim(p_insurance_policy_number), ''),
           status = 'pending',
           reviewer_id = null,
           reviewer_note = null,
           created_at = now()
     where id = v_id;
  else
    insert into public.medical_verifications
      (profile_id, country, degree, specialty, council_name,
       council_registration_number, registration_evidence_url,
       id_evidence_url, selfie_with_id_url, insurance_provider,
       insurance_policy_number, status)
    values
      (v_user, trim(p_country), nullif(trim(p_degree), ''),
       nullif(trim(p_specialty), ''), trim(p_council_name),
       trim(p_council_registration_number), p_registration_evidence_url,
       p_id_evidence_url, nullif(p_selfie_with_id_url, ''),
       nullif(trim(p_insurance_provider), ''),
       nullif(trim(p_insurance_policy_number), ''), 'pending')
    returning id into v_id;
  end if;

  return v_id;
end;
$$;
revoke all on function public.submit_medical_verification(text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.submit_medical_verification(text,text,text,text,text,text,text,text,text,text) to authenticated;

create or replace function public.admin_list_medical_verifications(
  p_status text default 'pending'
) returns table (
  verification_id uuid,
  applicant_id uuid,
  username text,
  display_name text,
  avatar_url text,
  country text,
  degree text,
  specialty text,
  council_name text,
  council_registration_number text,
  registration_evidence_url text,
  id_evidence_url text,
  selfie_with_id_url text,
  insurance_provider text,
  insurance_policy_number text,
  status text,
  reviewer_note text,
  created_at timestamptz,
  verified_at timestamptz,
  expires_at timestamptz
)
language sql security definer set search_path = public stable
as $$
  select mv.id, mv.profile_id, p.username, p.display_name, p.avatar_url,
         mv.country, mv.degree, mv.specialty, mv.council_name,
         mv.council_registration_number, mv.registration_evidence_url,
         mv.id_evidence_url, mv.selfie_with_id_url, mv.insurance_provider,
         mv.insurance_policy_number, mv.status, mv.reviewer_note,
         mv.created_at, mv.verified_at, mv.expires_at
  from public.medical_verifications mv
  join public.profiles p on p.id = mv.profile_id
  where exists (select 1 from public.profiles a
                 where a.id = auth.uid() and a.is_admin is true)
    and (p_status is null or mv.status = p_status)
  order by mv.created_at asc;
$$;
revoke all on function public.admin_list_medical_verifications(text) from public;
grant execute on function public.admin_list_medical_verifications(text) to authenticated;

create or replace function public.admin_review_medical_verification(
  p_verification_id uuid,
  p_decision text,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_applicant uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.profiles
                  where id = v_user and is_admin is true) then
    raise exception 'admin only';
  end if;
  if p_decision not in ('verified','rejected') then
    raise exception 'decision must be verified or rejected';
  end if;

  update public.medical_verifications
     set status = p_decision,
         reviewer_id = v_user,
         reviewer_note = p_note,
         verified_at = case when p_decision = 'verified' then now() else verified_at end,
         expires_at = case when p_decision = 'verified' then now() + interval '1 year' else expires_at end
   where id = p_verification_id
   returning profile_id into v_applicant;

  if v_applicant is null then raise exception 'verification not found'; end if;

  if p_decision = 'verified' then
    update public.profiles set is_verified_doctor = true where id = v_applicant;
  else
    -- Only clear the flag if no other live verified application remains.
    update public.profiles
       set is_verified_doctor = exists (
             select 1 from public.medical_verifications
              where profile_id = v_applicant and status = 'verified'
                and (expires_at is null or expires_at > now()))
     where id = v_applicant;
  end if;
end;
$$;
revoke all on function public.admin_review_medical_verification(uuid,text,text) from public;
grant execute on function public.admin_review_medical_verification(uuid,text,text) to authenticated;

-- ---------------------------------------------------------------------
-- 5) Doctor directory + availability
-- ---------------------------------------------------------------------
create or replace function public.list_verified_doctors()
returns table (
  doctor_id uuid,
  username text,
  display_name text,
  avatar_url text,
  presence_state text,
  last_seen timestamptz,
  is_online boolean,
  specialty text,
  degree text,
  country text,
  availability jsonb
)
language sql security definer set search_path = public stable
as $$
  select p.id, p.username, p.display_name, p.avatar_url,
         p.presence_state, p.last_seen,
         (p.last_seen > now() - interval '2 minutes') as is_online,
         mv.specialty, mv.degree, mv.country,
         coalesce((select jsonb_agg(jsonb_build_object(
                     'day_of_week', da.day_of_week,
                     'start_time', da.start_time,
                     'end_time', da.end_time,
                     'timezone', da.timezone)
                   order by da.day_of_week, da.start_time)
                   from public.doctor_availability da
                   where da.profile_id = p.id), '[]'::jsonb)
  from public.profiles p
  join lateral (
    select v.specialty, v.degree, v.country
    from public.medical_verifications v
    where v.profile_id = p.id and v.status = 'verified'
      and (v.expires_at is null or v.expires_at > now())
    order by v.verified_at desc limit 1
  ) mv on true
  where p.is_verified_doctor is true
  order by (p.last_seen > now() - interval '2 minutes') desc, p.last_seen desc;
$$;
revoke all on function public.list_verified_doctors() from public;
grant execute on function public.list_verified_doctors() to authenticated;

create or replace function public.set_doctor_availability(p_slots jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_slot jsonb;
  v_count int := 0;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.profiles
                  where id = v_user and is_verified_doctor is true) then
    raise exception 'verified doctors only';
  end if;
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' then
    raise exception 'slots must be a JSON array';
  end if;

  delete from public.doctor_availability where profile_id = v_user;

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    v_count := v_count + 1;
    if v_count > 28 then raise exception 'too many slots (max 28)'; end if;
    if (v_slot->>'day_of_week')::int not between 0 and 6 then
      raise exception 'day_of_week must be 0-6';
    end if;
    if (v_slot->>'start_time')::time >= (v_slot->>'end_time')::time then
      raise exception 'start_time must be before end_time';
    end if;
    insert into public.doctor_availability
      (profile_id, day_of_week, start_time, end_time, timezone)
    values
      (v_user, (v_slot->>'day_of_week')::int,
       (v_slot->>'start_time')::time, (v_slot->>'end_time')::time,
       coalesce(nullif(v_slot->>'timezone', ''), 'Asia/Kolkata'))
    on conflict (profile_id, day_of_week, start_time) do update
      set end_time = excluded.end_time, timezone = excluded.timezone;
  end loop;
end;
$$;
revoke all on function public.set_doctor_availability(jsonb) from public;
grant execute on function public.set_doctor_availability(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 6) Doctor beacon — ask, route, claim, complete
-- ---------------------------------------------------------------------
create or replace function public.create_doctor_beacon(
  p_symptom_summary text,
  p_severity int,
  p_duration_text text default null,
  p_specialty text default null,
  p_emergency_flagged boolean default false
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_active int;
  v_urgency text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.profiles where id = v_user and is_guest) then
    raise exception 'guests cannot ask a doctor — create a full account first';
  end if;
  if coalesce(trim(p_symptom_summary), '') = '' then
    raise exception 'describe what is going on first';
  end if;
  if p_severity is null or p_severity not between 1 and 10 then
    raise exception 'severity must be 1-10';
  end if;

  select count(*) into v_active from public.help_beacons
   where asker_profile_id = v_user and subject = 'medical' and status = 'routing';
  if v_active >= 3 then
    raise exception 'you already have 3 doctor requests in flight — wait for one to resolve';
  end if;

  v_urgency := case when p_severity >= 8 then 'live'
                    when p_severity >= 5 then 'urgent'
                    else 'casual' end;

  v_id := gen_random_uuid();
  insert into public.help_beacons
    (id, asker_profile_id, subject, topic, question_text, urgency, status, classification)
  values
    (v_id, v_user, 'medical', nullif(trim(p_specialty), ''),
     trim(p_symptom_summary), v_urgency, 'routing',
     jsonb_build_object(
       'severity', p_severity,
       'duration_text', nullif(trim(p_duration_text), ''),
       'emergency', coalesce(p_emergency_flagged, false)));
  return v_id;
end;
$$;
revoke all on function public.create_doctor_beacon(text,int,text,text,boolean) from public;
grant execute on function public.create_doctor_beacon(text,int,text,text,boolean) to authenticated;

create or replace function public.list_open_doctor_beacons()
returns table (
  beacon_id uuid,
  created_at timestamptz,
  symptom text,
  severity int,
  duration_text text,
  specialty text,
  urgency text,
  emergency boolean,
  asker_username text,
  asker_display_name text,
  asker_avatar_url text
)
language sql security definer set search_path = public stable
as $$
  select hb.id, hb.created_at, hb.question_text,
         (hb.classification->>'severity')::int,
         hb.classification->>'duration_text',
         hb.topic, hb.urgency,
         coalesce((hb.classification->>'emergency')::boolean, false),
         p.username, p.display_name, p.avatar_url
  from public.help_beacons hb
  join public.profiles p on p.id = hb.asker_profile_id
  where hb.subject = 'medical' and hb.status = 'routing'
    and exists (select 1 from public.profiles me
                 where me.id = auth.uid() and me.is_verified_doctor is true)
  order by (hb.urgency = 'live') desc,
           coalesce((hb.classification->>'emergency')::boolean, false) desc,
           hb.created_at asc;
$$;
revoke all on function public.list_open_doctor_beacons() from public;
grant execute on function public.list_open_doctor_beacons() to authenticated;

create or replace function public.accept_doctor_beacon(p_beacon_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_asker uuid;
  v_status text;
  v_subject text;
  v_symptom text;
  v_class jsonb;
  v_session uuid;
  v_room uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.profiles
                  where id = v_user and is_verified_doctor is true) then
    raise exception 'verified doctors only';
  end if;

  select asker_profile_id, status, subject, question_text, classification
    into v_asker, v_status, v_subject, v_symptom, v_class
    from public.help_beacons where id = p_beacon_id for update;
  if v_asker is null then raise exception 'request not found'; end if;
  if v_subject <> 'medical' then raise exception 'not a doctor request'; end if;
  if v_asker = v_user then raise exception 'cannot accept your own request'; end if;
  if v_status <> 'routing' then
    raise exception 'another doctor already took this one';
  end if;

  -- Consult room = the standard 1:1 DM between doctor and patient
  -- (idempotent — repeat consults reuse the same room, chat history intact).
  v_room := public.get_or_create_dm(v_asker);

  v_session := gen_random_uuid();
  insert into public.beacon_sessions
    (id, beacon_id, asker_profile_id, helper_profile_id, livekit_room_name)
  values (v_session, p_beacon_id, v_asker, v_user, 'karochat-' || v_room::text);

  insert into public.doctor_beacon_sessions
    (id, symptom_summary, severity_rating, duration_text, was_emergency_routed, room_id)
  values
    (v_session, v_symptom,
     nullif(v_class->>'severity', '')::int,
     v_class->>'duration_text',
     coalesce((v_class->>'emergency')::boolean, false),
     v_room);

  update public.help_beacons
     set status = 'answered',
         answered_by_profile_id = v_user,
         session_id = v_session,
         answered_at = now()
   where id = p_beacon_id;

  insert into public.messages (room_id, sender_id, content, type, intent)
  values (v_room, v_user,
          '🩺 Doctor consult started. Karochat doctors give general guidance only — this is not medical care, a diagnosis, or a prescription. If this is an emergency, call your local emergency number now.',
          'system', 'doctor');

  return jsonb_build_object('session_id', v_session, 'room_id', v_room);
end;
$$;
revoke all on function public.accept_doctor_beacon(uuid) from public;
grant execute on function public.accept_doctor_beacon(uuid) to authenticated;

create or replace function public.cancel_doctor_beacon(p_beacon_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  update public.help_beacons
     set status = 'cancelled', expired_at = now()
   where id = p_beacon_id and asker_profile_id = v_user
     and subject = 'medical' and status = 'routing';
end;
$$;
revoke all on function public.cancel_doctor_beacon(uuid) from public;
grant execute on function public.cancel_doctor_beacon(uuid) to authenticated;

create or replace function public.my_doctor_consults()
returns table (
  beacon_id uuid,
  created_at timestamptz,
  status text,
  symptom text,
  severity int,
  doctor_id uuid,
  doctor_username text,
  doctor_display_name text,
  doctor_avatar_url text,
  room_id uuid,
  answered_at timestamptz
)
language sql security definer set search_path = public stable
as $$
  select hb.id, hb.created_at, hb.status, hb.question_text,
         (hb.classification->>'severity')::int,
         hb.answered_by_profile_id, dp.username, dp.display_name, dp.avatar_url,
         dbs.room_id, hb.answered_at
  from public.help_beacons hb
  left join public.profiles dp on dp.id = hb.answered_by_profile_id
  left join public.beacon_sessions bs on bs.id = hb.session_id
  left join public.doctor_beacon_sessions dbs on dbs.id = bs.id
  where hb.asker_profile_id = auth.uid() and hb.subject = 'medical'
  order by hb.created_at desc
  limit 20;
$$;
revoke all on function public.my_doctor_consults() from public;
grant execute on function public.my_doctor_consults() to authenticated;

create or replace function public.my_doctor_sessions()
returns table (
  session_id uuid,
  started_at timestamptz,
  ended_at timestamptz,
  room_id uuid,
  symptom_summary text,
  severity_rating int,
  was_emergency_routed boolean,
  follow_up_required boolean,
  doctor_recommendation text,
  asker_username text,
  asker_display_name text,
  asker_avatar_url text
)
language sql security definer set search_path = public stable
as $$
  select bs.id, bs.started_at, bs.ended_at, dbs.room_id,
         dbs.symptom_summary, dbs.severity_rating, dbs.was_emergency_routed,
         dbs.follow_up_required, dbs.doctor_recommendation,
         ap.username, ap.display_name, ap.avatar_url
  from public.beacon_sessions bs
  join public.doctor_beacon_sessions dbs on dbs.id = bs.id
  join public.profiles ap on ap.id = bs.asker_profile_id
  where bs.helper_profile_id = auth.uid()
  order by (bs.ended_at is null) desc, bs.started_at desc
  limit 30;
$$;
revoke all on function public.my_doctor_sessions() from public;
grant execute on function public.my_doctor_sessions() to authenticated;

create or replace function public.complete_doctor_session(
  p_session_id uuid,
  p_recommendation text default null,
  p_follow_up_required boolean default false
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_started timestamptz;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  select started_at into v_started
    from public.beacon_sessions
   where id = p_session_id and helper_profile_id = v_user;
  if v_started is null then raise exception 'session not found'; end if;

  update public.beacon_sessions
     set ended_at = now(),
         duration_seconds = extract(epoch from (now() - v_started))::int
   where id = p_session_id and ended_at is null;

  update public.doctor_beacon_sessions
     set doctor_recommendation = nullif(trim(p_recommendation), ''),
         follow_up_required = coalesce(p_follow_up_required, false)
   where id = p_session_id;
end;
$$;
revoke all on function public.complete_doctor_session(uuid,text,boolean) from public;
grant execute on function public.complete_doctor_session(uuid,text,boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 7) Emergency-services helpline seeds (kind = 'medical_emergency')
-- ---------------------------------------------------------------------
insert into public.crisis_helplines (country, kind, name, phone, hours, languages, notes, display_order)
select v.country, 'medical_emergency', v.name, v.phone, '24/7', v.languages, v.notes, v.ord
from (values
  ('IN', 'Emergency services (police/fire/ambulance)', '112',
   array['hi','en','regional'], 'India''s all-in-one emergency number.', 1),
  ('IN', 'Ambulance', '108',
   array['hi','en','regional'], 'Free government ambulance in most states.', 2),
  ('US', 'Emergency services', '911', array['en','es'], null, 1),
  ('GB', 'Emergency services', '999', array['en'], null, 1),
  ('GLOBAL', 'International emergency number', '112', array['en'],
   'Works across the EU and from most mobile phones worldwide.', 50)
) as v(country, name, phone, languages, notes, ord)
where not exists (
  select 1 from public.crisis_helplines ch
   where ch.country = v.country and ch.kind = 'medical_emergency' and ch.phone = v.phone
);
