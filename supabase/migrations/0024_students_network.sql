-- Karochat — v8 Wave 18: Students Network.
-- Verified-students learning surface. Schema covers: verification + badges,
-- 4-phase help beacons, beacon sessions + recordings, multi-cursor
-- whiteboards (multi-page), study squads, student notes + spaced repetition
-- flashcards, office hours marketplace (free + paid), and the
-- syllabus/subject/topic catalog tree.
-- Run AFTER 0023_global_lgbtq_and_regional.sql. Idempotent.

-- ============================================================================
-- 1) student_verifications — gates everything else in the network.
-- ============================================================================
create table if not exists public.student_verifications (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references public.profiles(id) on delete cascade,
  status                text not null default 'pending'
                        check (status in ('pending','verified','rejected','expired')),
  country               text not null,
  education_level       text not null,
  syllabus              text,
  institution           text,
  enrollment_start_date date,
  enrollment_end_date   date,
  verification_method   text not null
                        check (verification_method in
                              ('edu_email','id_upload','result_upload','guardian_consent')),
  verification_metadata jsonb not null default '{}'::jsonb,
  badge_tier            text not null default 'student'
                        check (badge_tier in
                              ('student','senior_student','educator','professor','domain_expert')),
  subject_affinities    text[] not null default '{}',
  guardian_email        text,
  is_minor              boolean not null default false,
  reviewer_id           uuid references public.profiles(id) on delete set null,
  reviewer_note         text,
  verified_at           timestamptz,
  expires_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index if not exists student_verifications_profile_idx
  on public.student_verifications (profile_id)
  where status in ('pending','verified');

create index if not exists student_verifications_status_idx
  on public.student_verifications (status, badge_tier);

alter table public.student_verifications enable row level security;

drop policy if exists "sv_read_self_or_admin" on public.student_verifications;
create policy "sv_read_self_or_admin" on public.student_verifications
  for select to authenticated using (
    profile_id = auth.uid()
    or exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.is_admin = true)
  );

-- Writes go through start_verification / submit_verification RPCs.

-- ============================================================================
-- 2) Help beacons + routing trail + sessions.
-- ============================================================================
create table if not exists public.help_beacons (
  id                     uuid primary key default gen_random_uuid(),
  asker_profile_id       uuid not null references public.profiles(id) on delete cascade,
  subject                text not null,
  topic                  text,
  level                  text,
  syllabus               text,
  country                text,
  question_text          text,
  question_voice_url     text,
  question_image_url     text,
  karo_rewritten_question text,
  context_note           text,
  urgency                text not null default 'casual'
                          check (urgency in ('casual','urgent','live')),
  status                 text not null default 'routing'
                          check (status in ('routing','answered','expired','cancelled')),
  routing_phase          int not null default 1 check (routing_phase between 1 and 4),
  answered_by_profile_id uuid references public.profiles(id) on delete set null,
  session_id             uuid,
  classification         jsonb,
  created_at             timestamptz not null default now(),
  answered_at            timestamptz,
  expired_at             timestamptz
);

create index if not exists help_beacons_status_idx
  on public.help_beacons (status, created_at desc);
create index if not exists help_beacons_subject_idx
  on public.help_beacons (subject, status);
create index if not exists help_beacons_asker_idx
  on public.help_beacons (asker_profile_id, created_at desc);

alter table public.help_beacons enable row level security;

drop policy if exists "hb_read_asker_helper_admin" on public.help_beacons;
create policy "hb_read_asker_helper_admin" on public.help_beacons
  for select to authenticated using (
    asker_profile_id = auth.uid()
    or answered_by_profile_id = auth.uid()
    or exists (select 1 from public.beacon_routes br
                where br.beacon_id = help_beacons.id and br.helper_profile_id = auth.uid())
    or exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.is_admin = true)
  );

-- per-helper route trail
create table if not exists public.beacon_routes (
  beacon_id          uuid not null references public.help_beacons(id) on delete cascade,
  helper_profile_id  uuid not null references public.profiles(id) on delete cascade,
  phase              int not null check (phase between 1 and 4),
  routed_at          timestamptz not null default now(),
  acknowledged       text not null default 'seen'
                      check (acknowledged in ('seen','passed','accepted','snoozed','ghosted')),
  responded_at       timestamptz,
  primary key (beacon_id, helper_profile_id)
);

create index if not exists beacon_routes_helper_idx
  on public.beacon_routes (helper_profile_id, acknowledged, routed_at desc);

alter table public.beacon_routes enable row level security;

drop policy if exists "br_read_self_or_admin" on public.beacon_routes;
create policy "br_read_self_or_admin" on public.beacon_routes
  for select to authenticated using (
    helper_profile_id = auth.uid()
    or exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.is_admin = true)
  );

-- beacon_sessions — the actual live audio + whiteboard room.
create table if not exists public.beacon_sessions (
  id                  uuid primary key default gen_random_uuid(),
  beacon_id           uuid references public.help_beacons(id) on delete set null,
  asker_profile_id    uuid not null references public.profiles(id) on delete cascade,
  helper_profile_id   uuid not null references public.profiles(id) on delete cascade,
  livekit_room_name   text,
  whiteboard_id       uuid,
  karo_summary        text,
  karo_transcript     text,
  asker_rating        int check (asker_rating between 1 and 5),
  helper_rating       int check (helper_rating between 1 and 5),
  duration_seconds    int,
  is_recorded         boolean not null default false,
  recording_url       text,
  started_at          timestamptz not null default now(),
  ended_at            timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists beacon_sessions_asker_idx
  on public.beacon_sessions (asker_profile_id, started_at desc);
create index if not exists beacon_sessions_helper_idx
  on public.beacon_sessions (helper_profile_id, started_at desc);

alter table public.beacon_sessions enable row level security;

drop policy if exists "bs_read_party_admin" on public.beacon_sessions;
create policy "bs_read_party_admin" on public.beacon_sessions
  for select to authenticated using (
    asker_profile_id = auth.uid()
    or helper_profile_id = auth.uid()
    or exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.is_admin = true)
  );

-- ============================================================================
-- 3) Whiteboards (multi-page).
-- ============================================================================
create table if not exists public.whiteboards (
  id                uuid primary key default gen_random_uuid(),
  owner_profile_id  uuid not null references public.profiles(id) on delete cascade,
  session_id        uuid references public.beacon_sessions(id) on delete set null,
  squad_id          uuid,
  title             text,
  -- Page count for quick metadata; content lives in whiteboard_pages.
  page_count        int not null default 1,
  thumbnail_url     text,
  is_published      boolean not null default false,
  language          text,
  subject           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists whiteboards_owner_idx
  on public.whiteboards (owner_profile_id, updated_at desc);
create index if not exists whiteboards_session_idx
  on public.whiteboards (session_id);
create index if not exists whiteboards_squad_idx
  on public.whiteboards (squad_id);

alter table public.whiteboards enable row level security;

drop policy if exists "wb_read_owner_published_session" on public.whiteboards;
create policy "wb_read_owner_published_session" on public.whiteboards
  for select to authenticated using (
    owner_profile_id = auth.uid()
    or is_published = true
    or exists (
      select 1 from public.beacon_sessions bs
       where bs.id = whiteboards.session_id
         and (bs.asker_profile_id = auth.uid() or bs.helper_profile_id = auth.uid())
    )
    or exists (
      select 1 from public.study_squad_members ssm
       where ssm.squad_id = whiteboards.squad_id and ssm.profile_id = auth.uid()
    )
  );

drop policy if exists "wb_write_owner" on public.whiteboards;
create policy "wb_write_owner" on public.whiteboards
  for insert to authenticated with check (owner_profile_id = auth.uid());
drop policy if exists "wb_update_owner" on public.whiteboards;
create policy "wb_update_owner" on public.whiteboards
  for update to authenticated using (owner_profile_id = auth.uid())
                                with check (owner_profile_id = auth.uid());

create table if not exists public.whiteboard_pages (
  whiteboard_id  uuid not null references public.whiteboards(id) on delete cascade,
  page_index     int not null,
  -- We store a JSON snapshot of the drawing graph. Yjs/CRDT binary support
  -- can be layered on top by adding a `data_yjs bytea` column later.
  data           jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now(),
  primary key (whiteboard_id, page_index)
);

alter table public.whiteboard_pages enable row level security;

drop policy if exists "wbp_read_via_whiteboard" on public.whiteboard_pages;
create policy "wbp_read_via_whiteboard" on public.whiteboard_pages
  for select to authenticated using (
    exists (select 1 from public.whiteboards w
              where w.id = whiteboard_pages.whiteboard_id
                and (w.owner_profile_id = auth.uid()
                     or w.is_published = true
                     or exists (
                       select 1 from public.beacon_sessions bs
                        where bs.id = w.session_id
                          and (bs.asker_profile_id = auth.uid()
                               or bs.helper_profile_id = auth.uid())
                     )
                     or exists (
                       select 1 from public.study_squad_members ssm
                        where ssm.squad_id = w.squad_id and ssm.profile_id = auth.uid()
                     )))
  );

drop policy if exists "wbp_write_via_whiteboard" on public.whiteboard_pages;
create policy "wbp_write_via_whiteboard" on public.whiteboard_pages
  for all to authenticated using (
    exists (select 1 from public.whiteboards w
              where w.id = whiteboard_pages.whiteboard_id
                and (w.owner_profile_id = auth.uid()
                     or exists (
                       select 1 from public.beacon_sessions bs
                        where bs.id = w.session_id
                          and (bs.asker_profile_id = auth.uid()
                               or bs.helper_profile_id = auth.uid())
                     )
                     or exists (
                       select 1 from public.study_squad_members ssm
                        where ssm.squad_id = w.squad_id and ssm.profile_id = auth.uid()
                     )))
  ) with check (true);

-- ============================================================================
-- 4) Study squads.
-- ============================================================================
create table if not exists public.study_squads (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  owner_profile_id    uuid not null references public.profiles(id) on delete cascade,
  subject             text,
  level               text,
  syllabus            text,
  description         text,
  visibility          text not null default 'private'
                       check (visibility in ('private','listed_private','unlisted')),
  member_count        int not null default 1,
  max_members         int not null default 20,
  health_score        int not null default 100,
  last_session_at     timestamptz,
  archived_at         timestamptz,
  created_at          timestamptz not null default now()
);

create table if not exists public.study_squad_members (
  squad_id   uuid not null references public.study_squads(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner','mentor','member')),
  joined_at  timestamptz not null default now(),
  primary key (squad_id, profile_id)
);

alter table public.study_squads enable row level security;
alter table public.study_squad_members enable row level security;

drop policy if exists "ss_read_member_or_listed" on public.study_squads;
create policy "ss_read_member_or_listed" on public.study_squads
  for select to authenticated using (
    visibility = 'listed_private'
    or exists (select 1 from public.study_squad_members ssm
                where ssm.squad_id = study_squads.id
                  and ssm.profile_id = auth.uid())
  );

drop policy if exists "ssm_read_self_or_squad" on public.study_squad_members;
create policy "ssm_read_self_or_squad" on public.study_squad_members
  for select to authenticated using (
    profile_id = auth.uid()
    or exists (select 1 from public.study_squad_members me
                where me.squad_id = study_squad_members.squad_id
                  and me.profile_id = auth.uid())
  );

-- ============================================================================
-- 5) student_notes — personal knowledge layer w/ flashcards for spaced rep.
-- ============================================================================
create table if not exists public.student_notes (
  id                 uuid primary key default gen_random_uuid(),
  owner_profile_id   uuid not null references public.profiles(id) on delete cascade,
  subject            text,
  topic              text,
  syllabus           text,
  title              text not null,
  body_markdown      text,
  whiteboard_id      uuid references public.whiteboards(id) on delete set null,
  session_id         uuid references public.beacon_sessions(id) on delete set null,
  karo_summary       text,
  flashcards         jsonb not null default '[]'::jsonb,
  tags               text[] not null default '{}',
  is_published       boolean not null default false,
  capsule_token      text,         -- public share token; if non-null, anon can view
  capsule_expires_at timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists student_notes_owner_idx
  on public.student_notes (owner_profile_id, updated_at desc);
create index if not exists student_notes_subject_idx
  on public.student_notes (subject);
create unique index if not exists student_notes_capsule_idx
  on public.student_notes (capsule_token)
  where capsule_token is not null;

alter table public.student_notes enable row level security;

drop policy if exists "sn_read_owner_or_published" on public.student_notes;
create policy "sn_read_owner_or_published" on public.student_notes
  for select to authenticated using (
    owner_profile_id = auth.uid() or is_published = true
  );

drop policy if exists "sn_write_owner" on public.student_notes;
create policy "sn_write_owner" on public.student_notes
  for all to authenticated using (owner_profile_id = auth.uid())
                                with check (owner_profile_id = auth.uid());

-- Capsules (public-readable by token) — separate select policy for anon.
drop policy if exists "sn_anon_capsule_read" on public.student_notes;
create policy "sn_anon_capsule_read" on public.student_notes
  for select to anon using (
    capsule_token is not null
    and (capsule_expires_at is null or capsule_expires_at > now())
  );

-- ============================================================================
-- 6) office_hours_slots — paid + free.
-- ============================================================================
create table if not exists public.office_hours_slots (
  id                    uuid primary key default gen_random_uuid(),
  professor_profile_id  uuid not null references public.profiles(id) on delete cascade,
  subject               text not null,
  topic                 text,
  starts_at             timestamptz not null,
  duration_minutes      int not null default 30,
  is_paid               boolean not null default false,
  price_cents           int,
  currency              text,
  capacity              int not null default 1,
  attendees_profile_ids uuid[] not null default '{}',
  status                text not null default 'open'
                         check (status in ('open','booked','completed','cancelled')),
  notes                 text,
  created_at            timestamptz not null default now()
);

create index if not exists office_hours_open_idx
  on public.office_hours_slots (subject, starts_at)
  where status = 'open';
create index if not exists office_hours_prof_idx
  on public.office_hours_slots (professor_profile_id, starts_at desc);

alter table public.office_hours_slots enable row level security;

drop policy if exists "oh_read_open_or_attendee_or_prof" on public.office_hours_slots;
create policy "oh_read_open_or_attendee_or_prof" on public.office_hours_slots
  for select to authenticated using (
    status = 'open'
    or professor_profile_id = auth.uid()
    or auth.uid() = any(attendees_profile_ids)
  );

-- ============================================================================
-- 7) Syllabus / subject / topic catalog tree.
-- ============================================================================
create table if not exists public.syllabuses (
  id            uuid primary key default gen_random_uuid(),
  country       text not null,
  level         text not null,
  syllabus_code text not null,
  display_name  text not null,
  position      int not null default 1000,
  unique (country, level, syllabus_code)
);

create table if not exists public.syllabus_subjects (
  id            uuid primary key default gen_random_uuid(),
  syllabus_id   uuid not null references public.syllabuses(id) on delete cascade,
  subject_slug  text not null,
  subject_name  text not null,
  position      int not null default 1000,
  unique (syllabus_id, subject_slug)
);

create table if not exists public.syllabus_topics (
  id                     uuid primary key default gen_random_uuid(),
  subject_id             uuid not null references public.syllabus_subjects(id) on delete cascade,
  topic_slug             text not null,
  topic_name             text not null,
  prerequisite_topic_ids uuid[] not null default '{}',
  position               int not null default 1000,
  unique (subject_id, topic_slug)
);

alter table public.syllabuses enable row level security;
alter table public.syllabus_subjects enable row level security;
alter table public.syllabus_topics enable row level security;

drop policy if exists "syll_read_all" on public.syllabuses;
create policy "syll_read_all" on public.syllabuses
  for select to anon, authenticated using (true);
drop policy if exists "sylls_read_all" on public.syllabus_subjects;
create policy "sylls_read_all" on public.syllabus_subjects
  for select to anon, authenticated using (true);
drop policy if exists "syllt_read_all" on public.syllabus_topics;
create policy "syllt_read_all" on public.syllabus_topics
  for select to anon, authenticated using (true);

-- ============================================================================
-- 8) Helpful views — what the router queries.
-- ============================================================================
-- A flat "helper candidate" view that the BeaconRouter's HelperStore.listOnlineCandidates
-- pulls from. The router scores + filters; we just join the four tables we need.
drop view if exists public.beacon_helper_candidates_view;
create view public.beacon_helper_candidates_view as
select
  p.id                                  as profile_id,
  sv.badge_tier,
  sv.country,
  sv.education_level                    as current_education_level,
  sv.syllabus,
  sv.subject_affinities,
  (p.presence_state in ('online','busy','away')
     and p.last_seen is not null
     and p.last_seen > now() - interval '5 minutes')         as is_online,
  coalesce(p.beacons_paused, false)     as beacons_paused,
  p.beacons_dnd_until                   as dnd_until,
  -- Active beacons count: ones currently 'routing' that we've routed to them
  -- and they haven't acknowledged yet.
  (select count(*)::int from public.beacon_routes br
    join public.help_beacons hb on hb.id = br.beacon_id
    where br.helper_profile_id = p.id
      and br.acknowledged = 'seen'
      and hb.status = 'routing')           as active_beacon_count,
  -- Average rating from sessions where this user was helper.
  (select avg(bs.asker_rating)::numeric(3,2) from public.beacon_sessions bs
    where bs.helper_profile_id = p.id and bs.asker_rating is not null) as avg_rating,
  (select count(*)::int from public.beacon_sessions bs
    where bs.helper_profile_id = p.id and bs.ended_at is not null)     as sessions_completed,
  (select count(*)::int from public.beacon_routes br
    where br.helper_profile_id = p.id
      and br.acknowledged = 'ghosted'
      and br.routed_at > now() - interval '7 days')                    as ghosts_last_7d
from public.profiles p
left join public.student_verifications sv
       on sv.profile_id = p.id and sv.status = 'verified'
where sv.id is not null;

grant select on public.beacon_helper_candidates_view to authenticated;

-- ============================================================================
-- 9) Profile columns the view above expects (extend gracefully).
-- ============================================================================
alter table public.profiles
  add column if not exists beacons_paused        boolean not null default false,
  add column if not exists beacons_dnd_until     timestamptz,
  add column if not exists student_network_optin boolean not null default false;

-- ============================================================================
-- 10) RPCs — verification + beacon CRUD callable from the client.
-- ============================================================================

-- start_verification — caller submits their first verification attempt.
create or replace function public.start_verification(
  p_country         text,
  p_education_level text,
  p_syllabus        text,
  p_institution     text,
  p_method          text,
  p_metadata        jsonb,
  p_subjects        text[],
  p_guardian_email  text,
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
  if v_age < 16 then raise exception 'minimum age 16'; end if;
  v_minor := v_age < 18;
  if v_minor and p_guardian_email is null and p_method = 'guardian_consent' then
    raise exception 'guardian email required';
  end if;

  -- Wipe any previous pending row so the user can resubmit cleanly.
  delete from public.student_verifications
   where profile_id = v_user and status = 'pending';

  v_id := gen_random_uuid();
  insert into public.student_verifications
    (id, profile_id, status, country, education_level, syllabus,
     institution, verification_method, verification_metadata,
     subject_affinities, guardian_email, is_minor)
  values
    (v_id, v_user, 'pending', p_country, p_education_level, p_syllabus,
     p_institution, p_method, coalesce(p_metadata, '{}'::jsonb),
     coalesce(p_subjects, '{}'), p_guardian_email, v_minor);

  -- Flip the opt-in flag so the user becomes findable as a candidate
  -- (filtered to status='verified' in the view, so pending is still gated).
  update public.profiles set student_network_optin = true where id = v_user;

  return v_id;
end;
$$;

revoke all on function public.start_verification(text,text,text,text,text,jsonb,text[],text,date) from public;
grant execute on function public.start_verification(text,text,text,text,text,jsonb,text[],text,date) to authenticated;

-- approve_verification — admin path. Sets status='verified' + picks badge_tier.
create or replace function public.approve_verification(
  p_id       uuid,
  p_tier     text,
  p_note     text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.is_admin = true) then
    raise exception 'admin only';
  end if;
  if p_tier not in ('student','senior_student','educator','professor','domain_expert') then
    raise exception 'invalid tier';
  end if;
  update public.student_verifications
     set status = 'verified',
         badge_tier = p_tier,
         reviewer_id = auth.uid(),
         reviewer_note = p_note,
         verified_at = now(),
         expires_at  = now() + interval '12 months',
         updated_at  = now()
   where id = p_id;
end;
$$;

revoke all on function public.approve_verification(uuid, text, text) from public;
grant execute on function public.approve_verification(uuid, text, text) to authenticated;

create or replace function public.reject_verification(p_id uuid, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.is_admin = true) then
    raise exception 'admin only';
  end if;
  update public.student_verifications
     set status = 'rejected',
         reviewer_id = auth.uid(),
         reviewer_note = p_note,
         updated_at = now()
   where id = p_id;
end;
$$;
revoke all on function public.reject_verification(uuid, text) from public;
grant execute on function public.reject_verification(uuid, text) to authenticated;

-- get_my_verification — caller checks their own status.
create or replace function public.get_my_verification()
returns table (
  id              uuid,
  status          text,
  country         text,
  education_level text,
  syllabus        text,
  institution     text,
  badge_tier      text,
  subject_affinities text[],
  is_minor        boolean,
  verified_at     timestamptz,
  expires_at      timestamptz
)
language sql security definer set search_path = public stable
as $$
  select
    sv.id, sv.status, sv.country, sv.education_level, sv.syllabus,
    sv.institution, sv.badge_tier, sv.subject_affinities, sv.is_minor,
    sv.verified_at, sv.expires_at
  from public.student_verifications sv
  where sv.profile_id = auth.uid()
  order by sv.created_at desc
  limit 1;
$$;
revoke all on function public.get_my_verification() from public;
grant execute on function public.get_my_verification() to authenticated;

-- Helper: am_i_verified — quick boolean gate.
create or replace function public.am_i_verified()
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.student_verifications
     where profile_id = auth.uid() and status = 'verified'
       and (expires_at is null or expires_at > now())
  );
$$;
revoke all on function public.am_i_verified() from public;
grant execute on function public.am_i_verified() to anon, authenticated;

-- create_beacon — stores the raw beacon row. The router runs server-side
-- against this row.
create or replace function public.create_beacon(
  p_question_text     text,
  p_question_voice_url text,
  p_question_image_url text,
  p_context_note      text,
  p_urgency           text,
  p_subject           text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id   uuid;
  v_active int;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.student_verifications
                  where profile_id = v_user and status = 'verified') then
    raise exception 'verification required';
  end if;
  if p_urgency not in ('casual','urgent','live') then
    raise exception 'invalid urgency';
  end if;

  -- Rate limit: max 3 active beacons.
  select count(*) into v_active from public.help_beacons
   where asker_profile_id = v_user and status = 'routing';
  if v_active >= 3 then
    raise exception 'you already have 3 beacons in flight — wait for one to resolve';
  end if;

  v_id := gen_random_uuid();
  insert into public.help_beacons
    (id, asker_profile_id, subject, question_text, question_voice_url,
     question_image_url, context_note, urgency, status)
  values
    (v_id, v_user, coalesce(p_subject, 'unknown'),
     p_question_text, p_question_voice_url, p_question_image_url,
     p_context_note, p_urgency, 'routing');
  return v_id;
end;
$$;
revoke all on function public.create_beacon(text,text,text,text,text,text) from public;
grant execute on function public.create_beacon(text,text,text,text,text,text) to authenticated;

-- accept_beacon — called by a routed helper.
create or replace function public.accept_beacon(p_beacon_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_asker   uuid;
  v_status  text;
  v_session uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select asker_profile_id, status into v_asker, v_status
    from public.help_beacons where id = p_beacon_id for update;
  if v_asker is null then raise exception 'beacon not found'; end if;
  if v_asker = v_user then raise exception 'cannot accept your own beacon'; end if;
  if v_status <> 'routing' then return null; end if;

  v_session := gen_random_uuid();
  insert into public.beacon_sessions
    (id, beacon_id, asker_profile_id, helper_profile_id)
  values (v_session, p_beacon_id, v_asker, v_user);

  update public.help_beacons
     set status = 'answered',
         answered_by_profile_id = v_user,
         session_id = v_session,
         answered_at = now()
   where id = p_beacon_id;

  -- record the acceptance in the route trail (in case the route row exists)
  update public.beacon_routes
     set acknowledged = 'accepted', responded_at = now()
   where beacon_id = p_beacon_id and helper_profile_id = v_user;

  return v_session;
end;
$$;
revoke all on function public.accept_beacon(uuid) from public;
grant execute on function public.accept_beacon(uuid) to authenticated;

create or replace function public.cancel_beacon(p_beacon_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  update public.help_beacons
     set status = 'cancelled', expired_at = now()
   where id = p_beacon_id and asker_profile_id = v_user and status = 'routing';
end;
$$;
revoke all on function public.cancel_beacon(uuid) from public;
grant execute on function public.cancel_beacon(uuid) to authenticated;

-- ============================================================================
-- 11) Study squad RPCs.
-- ============================================================================
create or replace function public.create_study_squad(
  p_name        text,
  p_subject     text,
  p_level       text,
  p_syllabus    text,
  p_description text,
  p_visibility  text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_visibility not in ('private','listed_private','unlisted') then
    raise exception 'invalid visibility';
  end if;
  v_id := gen_random_uuid();
  insert into public.study_squads
    (id, name, owner_profile_id, subject, level, syllabus, description, visibility)
  values (v_id, p_name, v_user, p_subject, p_level, p_syllabus, p_description, p_visibility);
  insert into public.study_squad_members (squad_id, profile_id, role)
       values (v_id, v_user, 'owner');
  return v_id;
end;
$$;
revoke all on function public.create_study_squad(text,text,text,text,text,text) from public;
grant execute on function public.create_study_squad(text,text,text,text,text,text) to authenticated;

create or replace function public.join_study_squad(p_squad_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_mem  int;
  v_max  int;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select member_count, max_members into v_mem, v_max
    from public.study_squads where id = p_squad_id;
  if v_mem is null then raise exception 'squad not found'; end if;
  if v_mem >= v_max then raise exception 'squad full'; end if;
  insert into public.study_squad_members (squad_id, profile_id, role)
       values (p_squad_id, v_user, 'member')
  on conflict do nothing;
  update public.study_squads set member_count = member_count + 1 where id = p_squad_id;
end;
$$;
revoke all on function public.join_study_squad(uuid) from public;
grant execute on function public.join_study_squad(uuid) to authenticated;

-- ============================================================================
-- 12) Note + capsule helpers.
-- ============================================================================
create or replace function public.create_capsule(p_note_id uuid, p_days int)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_owner uuid;
  v_token text;
  v_days  int := greatest(1, least(coalesce(p_days, 30), 90));
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select owner_profile_id into v_owner from public.student_notes where id = p_note_id;
  if v_owner is null then raise exception 'note not found'; end if;
  if v_owner <> v_user then raise exception 'not owner'; end if;
  v_token := replace(gen_random_uuid()::text, '-', '');
  update public.student_notes
     set capsule_token = v_token,
         capsule_expires_at = now() + (v_days * interval '1 day'),
         updated_at = now()
   where id = p_note_id;
  return v_token;
end;
$$;
revoke all on function public.create_capsule(uuid, int) from public;
grant execute on function public.create_capsule(uuid, int) to authenticated;

-- ============================================================================
-- 13) Realtime publication for live beacon updates.
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'help_beacons'
  ) then
    execute 'alter publication supabase_realtime add table public.help_beacons';
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'beacon_routes'
  ) then
    execute 'alter publication supabase_realtime add table public.beacon_routes';
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'whiteboard_pages'
  ) then
    execute 'alter publication supabase_realtime add table public.whiteboard_pages';
  end if;
end$$;
