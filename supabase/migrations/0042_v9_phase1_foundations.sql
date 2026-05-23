-- Karochat — v9 Phase 1: foundations.
--
-- Single additive migration creating every table the v9 "Everything
-- Drop" needs across books, doctor verification, sex ed, snap+ig media,
-- multi-identity personas, privacy mode levels, and the closed-loop
-- wallet. Plus the RPCs the persona / privacy / wallet header switchers
-- need to function.
--
-- This is FOUNDATION ONLY. Feature wiring (upload flow, reader,
-- broadcast publish, etc.) ships per-phase. Tables get RLS + minimal
-- owner-write policies so the schema is safe to deploy without the
-- corresponding UI.
--
-- Idempotent + additive. Safe to re-run.
-- Build order index lives in memory/project_v9_plan.md.

-- =====================================================================
-- 1) BOOKS
-- =====================================================================

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  uploader_profile_id uuid references public.profiles(id) on delete set null,
  language text not null default 'en',
  file_url text not null,
  file_size_bytes bigint,
  format text check (format in ('pdf','epub','mobi')),
  cover_url text,
  isbn text,
  page_count int,
  word_count int,
  license_type text check (license_type in
    ('public_domain','creative_commons','author_uploaded',
     'author_permission','fair_use','unspecified')) default 'unspecified',
  license_metadata jsonb default '{}'::jsonb,
  cc_license_code text,
  genres text[] default '{}',
  syllabus_codes text[] default '{}',
  age_suitability text check (age_suitability in ('all','13plus','16plus','18plus')) default 'all',
  visibility text check (visibility in ('public','listed_private','private')) default 'public',
  perceptual_hash text,
  download_count int default 0,
  read_count int default 0,
  avg_rating real,
  rating_count int default 0,
  status text check (status in ('pending_review','live','takedown','rejected')) default 'pending_review',
  takedown_reason text,
  takedown_claimant text,
  taken_down_at timestamptz,
  uploaded_at timestamptz default now()
);
create unique index if not exists books_perceptual_hash_uq
  on public.books(perceptual_hash) where perceptual_hash is not null;
create index if not exists books_genres_idx on public.books using gin (genres);
create index if not exists books_syllabus_idx on public.books using gin (syllabus_codes);
create index if not exists books_status_idx on public.books(status);
alter table public.books enable row level security;
drop policy if exists "books_read_public" on public.books;
create policy "books_read_public" on public.books for select to anon, authenticated
  using (visibility = 'public' and status = 'live');
drop policy if exists "books_owner_all" on public.books;
create policy "books_owner_all" on public.books for all to authenticated
  using (uploader_profile_id = auth.uid())
  with check (uploader_profile_id = auth.uid());

create table if not exists public.book_bookmarks (
  profile_id uuid references public.profiles(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  page_or_cfi text,
  updated_at timestamptz default now(),
  primary key (profile_id, book_id)
);
alter table public.book_bookmarks enable row level security;
drop policy if exists "book_bookmarks_owner_all" on public.book_bookmarks;
create policy "book_bookmarks_owner_all" on public.book_bookmarks for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create table if not exists public.book_highlights (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  page_or_cfi text,
  text_selection text,
  note text,
  color text default 'yellow',
  created_at timestamptz default now()
);
create index if not exists book_highlights_owner_book_idx
  on public.book_highlights(profile_id, book_id);
alter table public.book_highlights enable row level security;
drop policy if exists "book_highlights_owner_all" on public.book_highlights;
create policy "book_highlights_owner_all" on public.book_highlights for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create table if not exists public.book_clubs (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books(id) on delete cascade,
  squad_id uuid references public.study_squads(id) on delete cascade,
  reading_pace_days int,
  current_chapter int default 0,
  started_at timestamptz default now()
);
create index if not exists book_clubs_book_idx on public.book_clubs(book_id);
create index if not exists book_clubs_squad_idx on public.book_clubs(squad_id);
alter table public.book_clubs enable row level security;
drop policy if exists "book_clubs_member_read" on public.book_clubs;
create policy "book_clubs_member_read" on public.book_clubs for select to authenticated
  using (
    exists (select 1 from public.study_squad_members ssm
             where ssm.squad_id = book_clubs.squad_id
               and ssm.profile_id = auth.uid())
  );

create table if not exists public.book_copyright_complaints (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books(id) on delete cascade,
  claimant_name text,
  claimant_email text,
  claim_basis text,
  evidence_url text,
  status text check (status in ('pending','upheld','rejected')) default 'pending',
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_note text,
  filed_at timestamptz default now(),
  resolved_at timestamptz
);
alter table public.book_copyright_complaints enable row level security;
-- No public read; admins use SECURITY DEFINER RPCs (built in Phase 2).

-- =====================================================================
-- 2) DOCTORS
-- =====================================================================

create table if not exists public.medical_verifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  country text not null,
  degree text,
  specialty text,
  council_name text,
  council_registration_number text,
  registration_evidence_url text,
  id_evidence_url text,
  selfie_with_id_url text,
  insurance_provider text,
  insurance_policy_number text,
  status text check (status in ('pending','verified','rejected','expired')) default 'pending',
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_note text,
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists medical_verifications_profile_idx
  on public.medical_verifications(profile_id);
create index if not exists medical_verifications_status_idx
  on public.medical_verifications(status);
alter table public.medical_verifications enable row level security;
drop policy if exists "medical_verifications_owner_read" on public.medical_verifications;
create policy "medical_verifications_owner_read" on public.medical_verifications
  for select to authenticated
  using (profile_id = auth.uid());
drop policy if exists "medical_verifications_admin_all" on public.medical_verifications;
create policy "medical_verifications_admin_all" on public.medical_verifications
  for all to authenticated
  using (exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.is_admin is true))
  with check (exists (select 1 from public.profiles p
                       where p.id = auth.uid() and p.is_admin is true));

create table if not exists public.doctor_availability (
  profile_id uuid references public.profiles(id) on delete cascade,
  day_of_week int check (day_of_week between 0 and 6),
  start_time time,
  end_time time,
  timezone text default 'UTC',
  primary key (profile_id, day_of_week, start_time)
);
alter table public.doctor_availability enable row level security;
drop policy if exists "doctor_availability_read_all" on public.doctor_availability;
create policy "doctor_availability_read_all" on public.doctor_availability
  for select to anon, authenticated using (true);
drop policy if exists "doctor_availability_owner_write" on public.doctor_availability;
create policy "doctor_availability_owner_write" on public.doctor_availability
  for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create table if not exists public.doctor_beacon_sessions (
  id uuid primary key references public.beacon_sessions(id) on delete cascade,
  symptom_summary text,
  severity_rating int check (severity_rating between 1 and 10),
  duration_text text,
  was_emergency_routed boolean default false,
  doctor_recommendation text,
  follow_up_required boolean default false,
  follow_up_telemedicine_link text,
  created_at timestamptz default now()
);
alter table public.doctor_beacon_sessions enable row level security;
-- RLS read inherited via beacon_sessions joins; admin via SECURITY DEFINER RPCs.

-- =====================================================================
-- 3) SEX ED
-- =====================================================================

create table if not exists public.sex_ed_articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  body_markdown text not null,
  topic text,
  language text default 'en',
  age_band text check (age_band in ('13_15','16_17','18plus','all')) default 'all',
  author_profile_id uuid references public.profiles(id) on delete set null,
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  region_tags text[] default '{}',
  published boolean default false,
  view_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists sex_ed_articles_topic_idx on public.sex_ed_articles(topic);
create index if not exists sex_ed_articles_lang_idx on public.sex_ed_articles(language);
create index if not exists sex_ed_articles_age_idx on public.sex_ed_articles(age_band);
alter table public.sex_ed_articles enable row level security;
drop policy if exists "sex_ed_articles_read_published" on public.sex_ed_articles;
create policy "sex_ed_articles_read_published" on public.sex_ed_articles
  for select to anon, authenticated using (published = true);
drop policy if exists "sex_ed_articles_admin_all" on public.sex_ed_articles;
create policy "sex_ed_articles_admin_all" on public.sex_ed_articles
  for all to authenticated
  using (exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.is_admin is true))
  with check (exists (select 1 from public.profiles p
                       where p.id = auth.uid() and p.is_admin is true));

create table if not exists public.sex_ed_anonymous_qa (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  answer_markdown text,
  answered_by_profile_id uuid references public.profiles(id) on delete set null,
  age_band text check (age_band in ('13_15','16_17','18plus','all')) default 'all',
  language text default 'en',
  country text,
  topic text,
  is_public boolean default true,
  asker_session_hash text,
  view_count int default 0,
  created_at timestamptz default now(),
  answered_at timestamptz
);
create index if not exists sex_ed_qa_public_age_idx on public.sex_ed_anonymous_qa(is_public, age_band);
alter table public.sex_ed_anonymous_qa enable row level security;
drop policy if exists "sex_ed_qa_read_public" on public.sex_ed_anonymous_qa;
create policy "sex_ed_qa_read_public" on public.sex_ed_anonymous_qa
  for select to anon, authenticated using (is_public = true and answer_markdown is not null);

-- =====================================================================
-- 4) SNAP + INSTAGRAM media
-- =====================================================================

create table if not exists public.snaps (
  id uuid primary key default gen_random_uuid(),
  sender_profile_id uuid references public.profiles(id) on delete cascade,
  recipient_profile_id uuid references public.profiles(id) on delete cascade,
  recipient_room_id uuid references public.rooms(id) on delete cascade,
  media_url text not null,
  media_kind text check (media_kind in ('photo','video')) default 'photo',
  caption text,
  duration_ms int default 10000,
  expires_at timestamptz default (now() + interval '24 hours'),
  viewed_at timestamptz,
  replayed_at timestamptz,
  screenshotted_at timestamptz,
  created_at timestamptz default now(),
  check (recipient_profile_id is not null or recipient_room_id is not null)
);
create index if not exists snaps_recipient_profile_idx on public.snaps(recipient_profile_id);
create index if not exists snaps_recipient_room_idx on public.snaps(recipient_room_id);
create index if not exists snaps_expires_idx on public.snaps(expires_at);
alter table public.snaps enable row level security;
drop policy if exists "snaps_sender_or_recipient_read" on public.snaps;
create policy "snaps_sender_or_recipient_read" on public.snaps
  for select to authenticated
  using (
    sender_profile_id = auth.uid()
    or recipient_profile_id = auth.uid()
    or (recipient_room_id is not null
        and public.is_room_member(recipient_room_id, auth.uid()))
  );
drop policy if exists "snaps_sender_insert" on public.snaps;
create policy "snaps_sender_insert" on public.snaps
  for insert to authenticated
  with check (sender_profile_id = auth.uid());
drop policy if exists "snaps_recipient_update_views" on public.snaps;
create policy "snaps_recipient_update_views" on public.snaps
  for update to authenticated
  using (recipient_profile_id = auth.uid())
  with check (recipient_profile_id = auth.uid());

create table if not exists public.story_highlights (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid references public.profiles(id) on delete cascade,
  label text not null,
  cover_url text,
  story_ids uuid[] default '{}',
  position int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists story_highlights_owner_idx on public.story_highlights(owner_profile_id);
alter table public.story_highlights enable row level security;
drop policy if exists "story_highlights_read_all" on public.story_highlights;
create policy "story_highlights_read_all" on public.story_highlights
  for select to anon, authenticated using (true);
drop policy if exists "story_highlights_owner_write" on public.story_highlights;
create policy "story_highlights_owner_write" on public.story_highlights
  for all to authenticated
  using (owner_profile_id = auth.uid())
  with check (owner_profile_id = auth.uid());

create table if not exists public.streaks (
  -- We store the pair sorted (a < b) so each friendship has one row.
  profile_a_id uuid not null references public.profiles(id) on delete cascade,
  profile_b_id uuid not null references public.profiles(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_message_at timestamptz,
  mercy_used_at timestamptz,
  created_at timestamptz default now(),
  primary key (profile_a_id, profile_b_id),
  check (profile_a_id < profile_b_id)
);
alter table public.streaks enable row level security;
drop policy if exists "streaks_pair_read" on public.streaks;
create policy "streaks_pair_read" on public.streaks
  for select to authenticated
  using (profile_a_id = auth.uid() or profile_b_id = auth.uid());

create table if not exists public.close_friends (
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  friend_profile_id uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz default now(),
  primary key (owner_profile_id, friend_profile_id)
);
alter table public.close_friends enable row level security;
drop policy if exists "close_friends_owner_all" on public.close_friends;
create policy "close_friends_owner_all" on public.close_friends
  for all to authenticated
  using (owner_profile_id = auth.uid())
  with check (owner_profile_id = auth.uid());
drop policy if exists "close_friends_friend_read_self" on public.close_friends;
create policy "close_friends_friend_read_self" on public.close_friends
  for select to authenticated
  using (friend_profile_id = auth.uid());

create table if not exists public.karochat_map_pins (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  latitude double precision,
  longitude double precision,
  precision_m int default 1000,
  visibility text check (visibility in ('ghost','close_friends','friends','public')) default 'ghost',
  expires_at timestamptz,
  updated_at timestamptz default now()
);
alter table public.karochat_map_pins enable row level security;
drop policy if exists "karochat_map_owner_all" on public.karochat_map_pins;
create policy "karochat_map_owner_all" on public.karochat_map_pins
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
-- Visibility-aware read RPC ships in Phase 5; ghost mode means table reads
-- from outside the owner shouldn't happen at all.

create table if not exists public.lenses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  thumbnail_url text,
  mediapipe_spec jsonb,
  category text,
  festival_tag text,
  season text,
  is_active boolean default true,
  created_at timestamptz default now()
);
alter table public.lenses enable row level security;
drop policy if exists "lenses_read_all" on public.lenses;
create policy "lenses_read_all" on public.lenses
  for select to anon, authenticated using (is_active = true);

create table if not exists public.broadcast_channels (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  avatar_url text,
  subscriber_count int default 0,
  created_at timestamptz default now()
);
create index if not exists broadcast_channels_owner_idx on public.broadcast_channels(owner_profile_id);
alter table public.broadcast_channels enable row level security;
drop policy if exists "broadcast_channels_read_all" on public.broadcast_channels;
create policy "broadcast_channels_read_all" on public.broadcast_channels
  for select to anon, authenticated using (true);
drop policy if exists "broadcast_channels_owner_write" on public.broadcast_channels;
create policy "broadcast_channels_owner_write" on public.broadcast_channels
  for all to authenticated
  using (owner_profile_id = auth.uid())
  with check (owner_profile_id = auth.uid());

create table if not exists public.broadcast_channel_subscriptions (
  channel_id uuid not null references public.broadcast_channels(id) on delete cascade,
  subscriber_profile_id uuid not null references public.profiles(id) on delete cascade,
  subscribed_at timestamptz default now(),
  primary key (channel_id, subscriber_profile_id)
);
alter table public.broadcast_channel_subscriptions enable row level security;
drop policy if exists "broadcast_subs_self_all" on public.broadcast_channel_subscriptions;
create policy "broadcast_subs_self_all" on public.broadcast_channel_subscriptions
  for all to authenticated
  using (subscriber_profile_id = auth.uid())
  with check (subscriber_profile_id = auth.uid());

create table if not exists public.broadcast_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.broadcast_channels(id) on delete cascade,
  body_markdown text,
  media_url text,
  poll_data jsonb,
  created_at timestamptz default now()
);
create index if not exists broadcast_messages_channel_idx on public.broadcast_messages(channel_id, created_at desc);
alter table public.broadcast_messages enable row level security;
drop policy if exists "broadcast_messages_read_subscribers" on public.broadcast_messages;
create policy "broadcast_messages_read_subscribers" on public.broadcast_messages
  for select to authenticated
  using (
    exists (select 1 from public.broadcast_channel_subscriptions bcs
             where bcs.channel_id = broadcast_messages.channel_id
               and bcs.subscriber_profile_id = auth.uid())
    or exists (select 1 from public.broadcast_channels bc
                where bc.id = broadcast_messages.channel_id
                  and bc.owner_profile_id = auth.uid())
  );

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid references public.profiles(id) on delete cascade,
  body_markdown text,
  hashtags text[] default '{}',
  location text,
  media_urls text[] default '{}',
  is_carousel boolean default false,
  is_adult boolean default false,
  audience_kind text check (audience_kind in ('public','followers','close_friends','private')) default 'public',
  like_count int default 0,
  comment_count int default 0,
  save_count int default 0,
  share_count int default 0,
  created_at timestamptz default now()
);
create index if not exists posts_author_idx on public.posts(author_profile_id, created_at desc);
create index if not exists posts_hashtags_idx on public.posts using gin (hashtags);
alter table public.posts enable row level security;
drop policy if exists "posts_read_public_or_owner" on public.posts;
create policy "posts_read_public_or_owner" on public.posts
  for select to authenticated
  using (audience_kind = 'public' or author_profile_id = auth.uid());
drop policy if exists "posts_owner_write" on public.posts;
create policy "posts_owner_write" on public.posts
  for all to authenticated
  using (author_profile_id = auth.uid())
  with check (author_profile_id = auth.uid());

create table if not exists public.post_carousel_items (
  post_id uuid references public.posts(id) on delete cascade,
  position int not null,
  media_url text not null,
  caption text,
  primary key (post_id, position)
);
alter table public.post_carousel_items enable row level security;
drop policy if exists "post_carousel_read_via_post" on public.post_carousel_items;
create policy "post_carousel_read_via_post" on public.post_carousel_items
  for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_carousel_items.post_id));

create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid references public.profiles(id) on delete cascade,
  video_url text not null,
  music_track text,
  caption text,
  duration_ms int,
  view_count int default 0,
  like_count int default 0,
  comment_count int default 0,
  share_count int default 0,
  is_adult boolean default false,
  audience_kind text check (audience_kind in ('public','followers','close_friends','private')) default 'public',
  created_at timestamptz default now()
);
create index if not exists reels_author_idx on public.reels(author_profile_id, created_at desc);
alter table public.reels enable row level security;
drop policy if exists "reels_read_public_or_owner" on public.reels;
create policy "reels_read_public_or_owner" on public.reels
  for select to authenticated
  using (audience_kind = 'public' or author_profile_id = auth.uid());
drop policy if exists "reels_owner_write" on public.reels;
create policy "reels_owner_write" on public.reels
  for all to authenticated
  using (author_profile_id = auth.uid())
  with check (author_profile_id = auth.uid());

create table if not exists public.notes (
  -- Instagram-style 24h text status, not to be confused with student_notes.
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid references public.profiles(id) on delete cascade,
  body text not null,
  audience_kind text check (audience_kind in ('public','followers','close_friends')) default 'followers',
  expires_at timestamptz default (now() + interval '24 hours'),
  created_at timestamptz default now()
);
create index if not exists notes_author_idx on public.notes(author_profile_id, expires_at);
alter table public.notes enable row level security;
drop policy if exists "notes_read_unexpired" on public.notes;
create policy "notes_read_unexpired" on public.notes
  for select to authenticated using (expires_at > now());
drop policy if exists "notes_owner_write" on public.notes;
create policy "notes_owner_write" on public.notes
  for all to authenticated
  using (author_profile_id = auth.uid())
  with check (author_profile_id = auth.uid());

create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),
  host_profile_id uuid references public.profiles(id) on delete cascade,
  cohost_profile_id uuid references public.profiles(id) on delete set null,
  title text,
  started_at timestamptz default now(),
  ended_at timestamptz,
  peak_viewers int default 0,
  recording_url text,
  is_adult boolean default false
);
create index if not exists live_streams_host_idx on public.live_streams(host_profile_id, started_at desc);
alter table public.live_streams enable row level security;
drop policy if exists "live_streams_read_all" on public.live_streams;
create policy "live_streams_read_all" on public.live_streams
  for select to anon, authenticated using (true);
drop policy if exists "live_streams_host_write" on public.live_streams;
create policy "live_streams_host_write" on public.live_streams
  for all to authenticated
  using (host_profile_id = auth.uid() or cohost_profile_id = auth.uid())
  with check (host_profile_id = auth.uid() or cohost_profile_id = auth.uid());

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid references public.profiles(id) on delete cascade,
  source_kind text check (source_kind in ('snap','story','post','reel')) not null,
  source_id uuid not null,
  thumbnail_url text,
  created_at timestamptz default now()
);
create index if not exists memories_owner_idx on public.memories(owner_profile_id, created_at desc);
alter table public.memories enable row level security;
drop policy if exists "memories_owner_all" on public.memories;
create policy "memories_owner_all" on public.memories
  for all to authenticated
  using (owner_profile_id = auth.uid())
  with check (owner_profile_id = auth.uid());

-- =====================================================================
-- 5) MULTI-IDENTITY PERSONAS
-- =====================================================================

create table if not exists public.personas (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  handle text not null,
  display_name text,
  avatar_url text,
  bio text,
  visible_to_other_personas boolean default false,
  created_at timestamptz default now(),
  active_at timestamptz
);
create index if not exists personas_owner_idx on public.personas(owner_profile_id);
create unique index if not exists personas_owner_handle_uq
  on public.personas(owner_profile_id, lower(handle));
alter table public.personas enable row level security;
drop policy if exists "personas_owner_all" on public.personas;
create policy "personas_owner_all" on public.personas
  for all to authenticated
  using (owner_profile_id = auth.uid())
  with check (owner_profile_id = auth.uid());

-- Enforce max 3 personas per account via trigger.
create or replace function public.enforce_persona_cap()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.personas
       where owner_profile_id = new.owner_profile_id) >= 3 then
    raise exception 'persona cap reached (max 3 per account)';
  end if;
  return new;
end;
$$;
drop trigger if exists personas_cap_trg on public.personas;
create trigger personas_cap_trg
  before insert on public.personas
  for each row execute function public.enforce_persona_cap();

-- Track which persona the user is currently acting as. NULL = main profile.
alter table public.profiles
  add column if not exists active_persona_id uuid references public.personas(id) on delete set null;

-- =====================================================================
-- 6) PRIVACY MODE LEVELS
-- =====================================================================

alter table public.profiles
  add column if not exists privacy_mode text default 'open';

-- Allowed values: 'open' | 'friends_only' | 'invisible' | 'decoy' | 'stealth'.
-- Enforced via the set_privacy_mode RPC (free-text column kept so legacy
-- rows don't bork on the constraint).
do $$ begin
  if not exists (
    select 1 from information_schema.check_constraints
     where constraint_name = 'profiles_privacy_mode_check'
       and constraint_schema = 'public'
  ) then
    alter table public.profiles
      add constraint profiles_privacy_mode_check
      check (privacy_mode in ('open','friends_only','invisible','decoy','stealth'));
  end if;
end $$;

create table if not exists public.decoy_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  decoy_handle text,
  decoy_display_name text,
  decoy_avatar_url text,
  decoy_bio text,
  duress_code_hash text,
  activated_at timestamptz,
  updated_at timestamptz default now()
);
alter table public.decoy_settings enable row level security;
drop policy if exists "decoy_settings_owner_all" on public.decoy_settings;
create policy "decoy_settings_owner_all" on public.decoy_settings
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- =====================================================================
-- 7) WALLET (closed-loop credits)
-- =====================================================================

create table if not exists public.wallets (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  balance_credits int not null default 0 check (balance_credits >= 0),
  currency text not null default 'KRC',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.wallets enable row level security;
drop policy if exists "wallets_owner_read" on public.wallets;
create policy "wallets_owner_read" on public.wallets
  for select to authenticated
  using (profile_id = auth.uid());

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  delta_credits int not null,
  kind text not null check (kind in
    ('topup','transfer_out','transfer_in','refund','spend','tip','fee')),
  memo text,
  related_profile_id uuid references public.profiles(id) on delete set null,
  related_resource_kind text,
  related_resource_id uuid,
  created_at timestamptz default now()
);
create index if not exists wallet_tx_profile_idx
  on public.wallet_transactions(profile_id, created_at desc);
alter table public.wallet_transactions enable row level security;
drop policy if exists "wallet_tx_owner_read" on public.wallet_transactions;
create policy "wallet_tx_owner_read" on public.wallet_transactions
  for select to authenticated
  using (profile_id = auth.uid());

-- =====================================================================
-- 8) RPCs the Phase 1 UI surfaces need
-- =====================================================================

-- list_my_personas
create or replace function public.list_my_personas()
returns table (
  id uuid,
  handle text,
  display_name text,
  avatar_url text,
  bio text,
  active boolean,
  created_at timestamptz
)
language sql security definer set search_path = public stable
as $$
  select p.id, p.handle, p.display_name, p.avatar_url, p.bio,
         (pr.active_persona_id is not null and pr.active_persona_id = p.id) as active,
         p.created_at
  from public.personas p
  join public.profiles pr on pr.id = p.owner_profile_id
  where p.owner_profile_id = auth.uid()
  order by p.created_at;
$$;
revoke all on function public.list_my_personas() from public;
grant execute on function public.list_my_personas() to authenticated;

-- create_persona
create or replace function public.create_persona(
  p_handle text,
  p_display_name text default null,
  p_avatar_url text default null,
  p_bio text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_handle text := lower(trim(p_handle));
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if v_handle is null or length(v_handle) < 3 then
    raise exception 'handle must be at least 3 characters';
  end if;
  if v_handle !~ '^[a-z0-9_-]+$' then
    raise exception 'handle may only contain a-z, 0-9, _ or -';
  end if;
  insert into public.personas (owner_profile_id, handle, display_name, avatar_url, bio)
  values (v_user, v_handle, coalesce(p_display_name, v_handle), p_avatar_url, p_bio)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_persona(text, text, text, text) from public;
grant execute on function public.create_persona(text, text, text, text) to authenticated;

-- switch_active_persona — pass null to return to the main profile.
create or replace function public.switch_active_persona(p_persona_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ok boolean;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_persona_id is null then
    update public.profiles set active_persona_id = null where id = v_user;
    return true;
  end if;
  -- Only allow switching to a persona this user owns.
  select exists (select 1 from public.personas
                  where id = p_persona_id and owner_profile_id = v_user)
    into v_ok;
  if not v_ok then raise exception 'persona not owned by caller'; end if;
  update public.profiles set active_persona_id = p_persona_id where id = v_user;
  update public.personas set active_at = now() where id = p_persona_id;
  return true;
end;
$$;
revoke all on function public.switch_active_persona(uuid) from public;
grant execute on function public.switch_active_persona(uuid) to authenticated;

-- delete_persona
create or replace function public.delete_persona(p_persona_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_updated int;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  -- Clear active pointer if we're deleting the active one.
  update public.profiles
     set active_persona_id = null
   where id = v_user and active_persona_id = p_persona_id;
  delete from public.personas
   where id = p_persona_id and owner_profile_id = v_user;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;
revoke all on function public.delete_persona(uuid) from public;
grant execute on function public.delete_persona(uuid) to authenticated;

-- set_privacy_mode
create or replace function public.set_privacy_mode(p_mode text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_mode not in ('open','friends_only','invisible','decoy','stealth') then
    raise exception 'invalid privacy mode %', p_mode;
  end if;
  update public.profiles set privacy_mode = p_mode where id = v_user;
  return p_mode;
end;
$$;
revoke all on function public.set_privacy_mode(text) from public;
grant execute on function public.set_privacy_mode(text) to authenticated;

-- am_i_visible_to — used by presence / friend-finder UIs to respect
-- another user's privacy mode. Designed so any caller can ask "should I
-- show this user as online?" without exposing the privacy_mode itself.
create or replace function public.am_i_visible_to(p_other uuid)
returns boolean
language plpgsql security definer set search_path = public stable
as $$
declare
  v_self uuid := auth.uid();
  v_mode text;
  v_friend boolean;
begin
  if v_self is null then return false; end if;
  if v_self = p_other then return true; end if;
  select privacy_mode into v_mode from public.profiles where id = p_other;
  if v_mode is null then v_mode := 'open'; end if;
  if v_mode = 'invisible' then return false; end if;
  if v_mode in ('open','stealth','decoy') then return true; end if;
  if v_mode = 'friends_only' then
    select exists (
      select 1 from public.friendships f
       where f.status = 'accepted'
         and ((f.requester_id = v_self and f.recipient_id = p_other)
              or (f.recipient_id = v_self and f.requester_id = p_other))
    ) into v_friend;
    return coalesce(v_friend, false);
  end if;
  return true;
end;
$$;
revoke all on function public.am_i_visible_to(uuid) from public;
grant execute on function public.am_i_visible_to(uuid) to anon, authenticated;

-- get_my_wallet — auto-creates the wallet row on first call.
create or replace function public.get_my_wallet()
returns table (balance_credits int, currency text, updated_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  insert into public.wallets (profile_id) values (v_user)
    on conflict (profile_id) do nothing;
  return query
    select w.balance_credits, w.currency, w.updated_at
      from public.wallets w where w.profile_id = v_user;
end;
$$;
revoke all on function public.get_my_wallet() from public;
grant execute on function public.get_my_wallet() to authenticated;

-- wallet_transfer — caller pays p_amount credits to p_to_profile.
-- Single statement, race-safe via SELECT FOR UPDATE.
create or replace function public.wallet_transfer(
  p_to_profile uuid,
  p_amount int,
  p_memo text default null
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_balance int;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_to_profile = v_user then raise exception 'cannot transfer to self'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;

  -- Ensure both wallets exist + lock the sender's row.
  insert into public.wallets (profile_id) values (v_user)
    on conflict (profile_id) do nothing;
  insert into public.wallets (profile_id) values (p_to_profile)
    on conflict (profile_id) do nothing;

  select balance_credits into v_balance
    from public.wallets where profile_id = v_user for update;
  if v_balance < p_amount then
    raise exception 'insufficient balance';
  end if;

  update public.wallets
     set balance_credits = balance_credits - p_amount, updated_at = now()
   where profile_id = v_user;
  update public.wallets
     set balance_credits = balance_credits + p_amount, updated_at = now()
   where profile_id = p_to_profile;

  insert into public.wallet_transactions
    (profile_id, delta_credits, kind, memo, related_profile_id)
  values
    (v_user, -p_amount, 'transfer_out', p_memo, p_to_profile),
    (p_to_profile, p_amount, 'transfer_in', p_memo, v_user);

  return true;
end;
$$;
revoke all on function public.wallet_transfer(uuid, int, text) from public;
grant execute on function public.wallet_transfer(uuid, int, text) to authenticated;
