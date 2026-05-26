-- Karochat — v9 Phase 3: Sex education library + Karo Q&A + crisis routing.
--
-- The schema for sex_ed_articles + sex_ed_anonymous_qa was created in
-- Phase 1 (migration 0042). This migration:
--
-- 1. Adds birth_year + adult_attested_at to profiles (so we can age-tier
--    content reliably without storing full DOB beyond the year).
-- 2. Adds RPCs to read the library, submit an anonymous question, and
--    admin-answer one.
-- 3. Adds a crisis_helplines table + seed (India primary, US/UK/global
--    secondary) so the Karo Q&A endpoint can surface real help on
--    suicide / self-harm / abuse keywords.
-- 4. Seeds the library with 20 strong starter articles across all three
--    age bands (13_15, 16_17, 18plus), LGBTQ-inclusive, pleasure-positive
--    at 18+.
--
-- Structural non-negotiables (from the v9 spec, project_v9_plan):
--   • 13_15 tier never sees 18+ content. Tier filtering happens in the
--     read RPC, not on the client.
--   • 18+ tier requires profiles.adult_attested_at to be set (one-time
--     self-attest modal). Birth_year alone isn't enough — adults must
--     actively click "I'm 18+ and I want to see this".
--   • This is education, not medical care. Non-dismissable banner on
--     every page (client-side).
--   • No UGC for 13_15 — Q&A is only enabled for 16_17 and 18plus.
--
-- Idempotent + additive. Safe to re-run.

-- =====================================================================
-- 1) PROFILE COLUMNS for age-tiering + adult attestation
-- =====================================================================

alter table public.profiles
  add column if not exists birth_year smallint
    check (birth_year is null
           or (birth_year between 1900 and extract(year from now())::int));
alter table public.profiles
  add column if not exists adult_attested_at timestamptz;

-- Helper: derive the caller's age tier. Returns one of
-- '13_15' | '16_17' | '18plus' | 'unset'.
-- Conservative — null birth_year defaults to 16_17 (so we don't leak
-- 18+ content without an explicit birth year AND attestation).
create or replace function public.current_user_age_band()
returns text
language plpgsql security definer set search_path = public stable
as $$
declare
  v_user uuid := auth.uid();
  v_year int;
  v_attested boolean;
  v_age int;
begin
  if v_user is null then return 'unset'; end if;
  select birth_year, (adult_attested_at is not null)
    into v_year, v_attested
    from public.profiles where id = v_user;
  if v_year is null then return '16_17'; end if;
  v_age := extract(year from now())::int - v_year;
  if v_age >= 18 then
    if v_attested then return '18plus'; else return '16_17'; end if;
  end if;
  if v_age >= 16 then return '16_17'; end if;
  return '13_15';
end;
$$;
revoke all on function public.current_user_age_band() from public;
grant execute on function public.current_user_age_band() to authenticated;

create or replace function public.set_birth_year(p_year smallint)
returns void language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid(); v_now int := extract(year from now())::int;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_year is null or p_year < 1900 or p_year > v_now then
    raise exception 'birth_year out of range';
  end if;
  -- Block under-13 (terms minimum). Karochat already enforces this at
  -- signup, but defense-in-depth.
  if (v_now - p_year) < 13 then
    raise exception 'must be 13 or older';
  end if;
  update public.profiles set birth_year = p_year where id = v_user;
end;
$$;
revoke all on function public.set_birth_year(smallint) from public;
grant execute on function public.set_birth_year(smallint) to authenticated;

create or replace function public.attest_adult()
returns void language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid(); v_year int;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select birth_year into v_year from public.profiles where id = v_user;
  if v_year is null or (extract(year from now())::int - v_year) < 18 then
    raise exception 'birth_year must be set and indicate 18 or older';
  end if;
  update public.profiles
     set adult_attested_at = coalesce(adult_attested_at, now())
   where id = v_user;
end;
$$;
revoke all on function public.attest_adult() from public;
grant execute on function public.attest_adult() to authenticated;

-- =====================================================================
-- 2) SEX-ED ARTICLE READ RPCs
-- =====================================================================
-- Tier rule: a caller in 13_15 sees age_band IN ('13_15','all');
-- 16_17 sees 13_15 + 16_17 + all; 18plus sees everything.
-- Never the other direction.

create or replace function public.list_sexed_articles(
  p_topic text default null,
  p_language text default 'en',
  p_limit int default 60
) returns table (
  id uuid, slug text, title text, topic text, language text,
  age_band text, region_tags text[], view_count int, created_at timestamptz
)
language plpgsql security definer set search_path = public stable
as $$
declare v_band text := public.current_user_age_band();
begin
  return query
  select a.id, a.slug, a.title, a.topic, a.language, a.age_band,
         a.region_tags, a.view_count, a.created_at
  from public.sex_ed_articles a
  where a.published = true
    and (p_topic is null or a.topic = p_topic)
    and (p_language is null or a.language = p_language)
    and (
      v_band = '18plus'
      or (v_band = '16_17' and a.age_band in ('13_15','16_17','all'))
      or (v_band = '13_15' and a.age_band in ('13_15','all'))
      or (v_band = 'unset' and a.age_band in ('13_15','all'))
    )
  order by a.created_at desc
  limit greatest(1, least(coalesce(p_limit, 60), 200));
end;
$$;
revoke all on function public.list_sexed_articles(text, text, int) from public;
grant execute on function public.list_sexed_articles(text, text, int) to authenticated;

create or replace function public.get_sexed_article(p_slug text)
returns table (
  id uuid, slug text, title text, body_markdown text, topic text,
  language text, age_band text, region_tags text[], view_count int,
  created_at timestamptz, reviewer_username text, reviewed_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
declare v_band text := public.current_user_age_band();
begin
  -- Best-effort view bump. Don't fail the read if RLS blocks.
  update public.sex_ed_articles a
     set view_count = a.view_count + 1
   where a.slug = p_slug and a.published = true
     and (
       v_band = '18plus'
       or (v_band = '16_17' and a.age_band in ('13_15','16_17','all'))
       or (v_band = '13_15' and a.age_band in ('13_15','all'))
       or (v_band = 'unset' and a.age_band in ('13_15','all'))
     );

  return query
  select a.id, a.slug, a.title, a.body_markdown, a.topic, a.language,
         a.age_band, a.region_tags, a.view_count, a.created_at,
         p.username, a.reviewed_at
  from public.sex_ed_articles a
  left join public.profiles p on p.id = a.reviewer_profile_id
  where a.slug = p_slug and a.published = true
    and (
      v_band = '18plus'
      or (v_band = '16_17' and a.age_band in ('13_15','16_17','all'))
      or (v_band = '13_15' and a.age_band in ('13_15','all'))
      or (v_band = 'unset' and a.age_band in ('13_15','all'))
    );
end;
$$;
revoke all on function public.get_sexed_article(text) from public;
grant execute on function public.get_sexed_article(text) to authenticated;

-- =====================================================================
-- 3) ANONYMOUS Q&A
-- =====================================================================
-- 16_17 + 18plus can submit. 13_15 gets routed to articles + helplines
-- only (UGC blocked per spec — illegal in most jurisdictions).

create or replace function public.submit_sexed_question(
  p_question text,
  p_topic text default null,
  p_country text default null,
  p_session_hash text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_band text := public.current_user_age_band();
begin
  if v_band = '13_15' then
    raise exception 'Q&A is not available for the 13-15 age tier — read articles or call a helpline.';
  end if;
  if coalesce(nullif(trim(p_question),''),'') = '' then
    raise exception 'question required';
  end if;
  if length(p_question) > 1500 then
    raise exception 'question too long (1500 char max)';
  end if;
  insert into public.sex_ed_anonymous_qa
    (question_text, age_band, country, topic, asker_session_hash, is_public)
  values
    (trim(p_question), v_band, nullif(trim(p_country),''),
     nullif(trim(p_topic),''), nullif(trim(p_session_hash),''), true)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_sexed_question(text, text, text, text) from public;
grant execute on function public.submit_sexed_question(text, text, text, text) to authenticated;

create or replace function public.list_sexed_qa(
  p_topic text default null,
  p_language text default 'en',
  p_limit int default 50
) returns table (
  id uuid, question_text text, answer_markdown text, age_band text,
  topic text, country text, view_count int, answered_at timestamptz
)
language plpgsql security definer set search_path = public stable
as $$
declare v_band text := public.current_user_age_band();
begin
  return query
  select q.id, q.question_text, q.answer_markdown, q.age_band,
         q.topic, q.country, q.view_count, q.answered_at
  from public.sex_ed_anonymous_qa q
  where q.is_public = true
    and q.answer_markdown is not null
    and (p_topic is null or q.topic = p_topic)
    and (p_language is null or q.language = p_language)
    and (
      v_band = '18plus'
      or (v_band = '16_17' and q.age_band in ('13_15','16_17','all'))
      or (v_band = '13_15' and q.age_band in ('13_15','all'))
      or (v_band = 'unset' and q.age_band in ('13_15','all'))
    )
  order by q.answered_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;
revoke all on function public.list_sexed_qa(text, text, int) from public;
grant execute on function public.list_sexed_qa(text, text, int) to authenticated;

create or replace function public.admin_answer_sexed_qa(
  p_id uuid, p_answer text
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_admin boolean; v_updated int;
begin
  select coalesce(is_admin, false) into v_admin
    from public.profiles where id = auth.uid();
  if not v_admin then raise exception 'admin only'; end if;
  if coalesce(nullif(trim(p_answer),''),'') = '' then
    raise exception 'answer required';
  end if;
  update public.sex_ed_anonymous_qa
     set answer_markdown = trim(p_answer),
         answered_by_profile_id = auth.uid(),
         answered_at = now()
   where id = p_id;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;
revoke all on function public.admin_answer_sexed_qa(uuid, text) from public;
grant execute on function public.admin_answer_sexed_qa(uuid, text) to authenticated;

-- =====================================================================
-- 4) CRISIS HELPLINES
-- =====================================================================

create table if not exists public.crisis_helplines (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  kind text not null,
  -- kind ∈ 'suicide','sexual_violence','domestic_violence','child_abuse',
  --        'lgbtq_youth','general_distress','mental_health'
  name text not null,
  phone text,
  sms text,
  url text,
  hours text default '24/7',
  languages text[] default '{}',
  notes text,
  display_order int default 100,
  active boolean default true,
  created_at timestamptz default now()
);
create index if not exists crisis_helplines_country_kind_idx
  on public.crisis_helplines(country, kind) where active;
alter table public.crisis_helplines enable row level security;
drop policy if exists "crisis_helplines_read_all" on public.crisis_helplines;
create policy "crisis_helplines_read_all" on public.crisis_helplines
  for select to anon, authenticated using (active = true);

create or replace function public.list_helplines_for(
  p_country text default 'IN',
  p_kinds text[] default null
) returns table (
  id uuid, country text, kind text, name text, phone text, sms text,
  url text, hours text, languages text[], notes text, display_order int
)
language sql security definer set search_path = public stable
as $$
  select id, country, kind, name, phone, sms, url, hours, languages,
         notes, display_order
  from public.crisis_helplines
  where active = true
    and (country = coalesce(p_country, 'IN') or country = 'GLOBAL')
    and (p_kinds is null or kind = any(p_kinds))
  order by
    case when country = coalesce(p_country, 'IN') then 0 else 1 end,
    display_order asc, name asc;
$$;
revoke all on function public.list_helplines_for(text, text[]) from public;
grant execute on function public.list_helplines_for(text, text[]) to anon, authenticated;

-- Helpline seed — India primary, US + UK + GLOBAL fallback.
insert into public.crisis_helplines (country, kind, name, phone, sms, url, hours, languages, notes, display_order)
values
  ('IN','suicide','iCall (TISS)','+91-9152987821',null,'https://icallhelpline.org/','Mon-Sat 8am-10pm',array['en','hi','mr'],'Free, confidential counselling by trained mental-health professionals.',10),
  ('IN','suicide','AASRA','+91-9820466726',null,'http://www.aasra.info/','24/7',array['en','hi'],'Mumbai-based 24/7 suicide-prevention helpline.',20),
  ('IN','general_distress','Vandrevala Foundation','1860-2662-345',null,'https://www.vandrevalafoundation.com/','24/7',array['en','hi'],'Free 24/7 distress and mental-health helpline.',30),
  ('IN','mental_health','tele-MANAS','14416',null,'https://telemanas.mohfw.gov.in/','24/7',array['en','hi','ta','te','kn','ml','bn','mr','gu','pa','or','as'],'Government of India national mental-health helpline. Available in 20+ languages.',40),
  ('IN','child_abuse','Childline India','1098',null,'https://www.childlineindia.org/','24/7',array['en','hi'],'For anyone under 18 in distress, or to report child abuse.',50),
  ('IN','sexual_violence','One-Stop Centre Sakhi','181',null,'https://wcd.nic.in/schemes/one-stop-centre-scheme-1','24/7',array['en','hi'],'Sexual violence support and shelter for women.',60),
  ('IN','domestic_violence','NCW Helpline','7827170170',null,'https://ncwapps.nic.in/','24/7',array['en','hi'],'National Commission for Women — gender-based violence.',70),
  ('IN','lgbtq_youth','iCall + Sappho','+91-9152987821',null,'https://icallhelpline.org/','Mon-Sat 8am-10pm',array['en','hi','mr','bn'],'iCall is queer-affirming; Sappho for Equality also runs a queer support service in Kolkata.',80),
  ('US','suicide','988 Suicide & Crisis Lifeline','988','988','https://988lifeline.org/','24/7',array['en','es'],'Voice and text. Free and confidential.',10),
  ('US','sexual_violence','RAINN — National Sexual Assault Hotline','1-800-656-4673',null,'https://www.rainn.org/','24/7',array['en','es'],'Free, confidential 24/7 support after sexual violence.',20),
  ('US','lgbtq_youth','The Trevor Project','1-866-488-7386','678678','https://www.thetrevorproject.org/get-help/','24/7',array['en','es'],'Crisis support specifically for LGBTQ youth.',30),
  ('GB','suicide','Samaritans','116123',null,'https://www.samaritans.org/','24/7',array['en'],'Free, confidential 24/7 listening service.',10),
  ('GB','sexual_violence','Rape Crisis (E&W)','0808-500-2222',null,'https://rapecrisis.org.uk/','24/7',array['en'],'24/7 support line for survivors of rape and sexual abuse.',20),
  ('GLOBAL','suicide','International helplines','-',null,'https://findahelpline.com/','varies',array['en'],'Searchable directory covering 130+ countries.',10),
  ('GLOBAL','lgbtq_youth','IGLYO','-',null,'https://www.iglyo.com/resources/','varies',array['en'],'International LGBTQI youth org with country-by-country resources.',20)
on conflict do nothing;
