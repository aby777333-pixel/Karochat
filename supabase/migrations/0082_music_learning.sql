-- Karochat — Learn & Teach Music (teacher / student modules).
--
-- Adds music-education subcategories to the existing `infotainment` category:
-- instrument lessons, vocals & theory, genre studies, teacher class-hosting
-- and student practice/jam rooms. All voice+cam enabled so teachers host live
-- classes and students join — reuses rooms + LiveKit (no new infra). Teachers
-- and students simply use the create-room CTA to spin up their own lessons too.
-- Additive + idempotent. Nothing existing changed.

insert into public.room_subcategories (category_slug, slug, label, position) values
  ('infotainment','info-learn-instruments','Learn — Instruments',     140),
  ('infotainment','info-learn-vocals',     'Learn — Vocals & Theory',  150),
  ('infotainment','info-learn-genres',     'Learn — by Genre',         160),
  ('infotainment','info-teach',            'Teach Music — host classes',170),
  ('infotainment','info-practice',         'Practice & Jam Rooms',     180)
on conflict (category_slug, slug) do update
  set label = excluded.label, position = excluded.position;

do $$
declare
  t text;
  v_instruments text[] := array['Piano','Guitar','Violin','Drums','Keyboard','Bass Guitar','Flute','Saxophone','Ukulele','Tabla','Harmonium','Sitar','Veena','Cello','Trumpet','Mridangam'];
  v_vocals      text[] := array['Vocal Training','Music Theory','Ear Training','Songwriting','Sight Reading','Rhythm & Timing','Harmony','Composition','Music Production Basics','Mixing & Mastering'];
  v_genres      text[] := array['Classical','Jazz','Rock','Pop','Hip-Hop','EDM','Blues','Country','Folk','Carnatic','Hindustani','Bollywood','Gospel','R&B','Metal','Reggae','K-Pop','Latin','Lo-Fi','Acoustic'];
  v_teach       text[] := array['Teachers Lounge','Find Students','Masterclasses','Group Classes','1-on-1 Coaching','Beginner Classes','Intermediate Classes','Advanced Classes','Certification & Exams','Teaching Resources'];
  v_practice    text[] := array['Beginners Practice','Jam Sessions','Practice Buddies','Feedback & Critique','Student Recitals','Open Practice Stage','Daily Practice Club','Scales & Warmups'];
begin
  foreach t in array v_instruments loop
    perform public.ensure_official_room('infotainment','info-learn-instruments',
      'Learn ' || t, 'Live ' || t || ' lessons — teachers host, students learn. 🎼', 'public', true, true, false, null, 100);
  end loop;
  foreach t in array v_vocals loop
    perform public.ensure_official_room('infotainment','info-learn-vocals',
      t, 'Live ' || t || ' lessons & practice.', 'public', true, true, false, null, 100);
  end loop;
  foreach t in array v_genres loop
    perform public.ensure_official_room('infotainment','info-learn-genres',
      t || ' Lessons', 'Learn to play & sing ' || t || ' — teachers & students welcome.', 'public', true, true, false, null, 100);
  end loop;
  foreach t in array v_teach loop
    perform public.ensure_official_room('infotainment','info-teach',
      t, t || ' — host classes, build your students.', 'public', true, true, false, null, 100);
  end loop;
  foreach t in array v_practice loop
    perform public.ensure_official_room('infotainment','info-practice',
      t, t || ' — practice together, get better.', 'public', true, true, false, null, 100);
  end loop;
end$$;
