-- Karochat — "Infotainment" category: entertainment, creators, live & music.
--
-- A new top-level category that gives the Infotainment hub real, joinable
-- rooms: live stages/broadcasts, karaoke (solo/duet/sing-along/group),
-- podcasts, internet radio, watch parties, music collab, talent shows,
-- creator channels, and free / royalty-free media spaces. Live, karaoke,
-- duet, radio, podcast and watch-party rooms are voice/cam enabled so people
-- can actually go live and bring an audience (reusing the existing LiveKit +
-- ring/push call layer).
--
-- Public by default. People create + name their own rooms via the existing
-- "+ Create your own room" CTA. Purely additive + idempotent (ensure_official_
-- room, migration 0015). Nothing existing is removed, renamed, or renumbered.

-- ── Top-level category (position 35, after Alternative Lifestyle = 34) ───────
insert into public.room_categories (slug, label, description, icon, position, is_adult) values
  ('infotainment', 'Infotainment',
   'Free movies & music, karaoke, podcasts, radio, watch parties — go live & broadcast to KaroChat.',
   '🎬', 35, false)
on conflict (slug) do update
  set label = excluded.label, description = excluded.description,
      icon = excluded.icon, position = excluded.position, is_adult = excluded.is_adult;

-- ── Subcategories ───────────────────────────────────────────────────────────
insert into public.room_subcategories (category_slug, slug, label, position) values
  ('infotainment','info-live',       'Live Stages & Broadcasts', 10),
  ('infotainment','info-karaoke',    'Karaoke',                  20),
  ('infotainment','info-singalong',  'Sing-Along',               30),
  ('infotainment','info-duet',       'Duet Karaoke',             40),
  ('infotainment','info-music',      'Music & Artists',          50),
  ('infotainment','info-podcasts',   'Podcasts',                 60),
  ('infotainment','info-radio',      'Internet Radio',           70),
  ('infotainment','info-watch',      'Watch Parties',            80),
  ('infotainment','info-collab',     'Music Collaboration',      90),
  ('infotainment','info-talent',     'Talent & Competitions',    100),
  ('infotainment','info-creators',   'Creators & Channels',      110),
  ('infotainment','info-freemedia',  'Free Movies & Music',      120),
  ('infotainment','info-royalty',    'Royalty-Free Media',       130)
on conflict (category_slug, slug) do update
  set label = excluded.label, position = excluded.position;

-- ── Rooms ───────────────────────────────────────────────────────────────────
-- helper note: ensure_official_room(cat, sub, name, topic, visibility,
--   voice_enabled, cam_enabled, verified_only, verified_kind, capacity)
do $$
declare
  t text;
  v_live      text[] := array['Main Live Stage','Live Music Show','Live Concert','Live DJ Set','Live Podcast','Open Mic Night','Community Live','Live Q&A','Creator Live Lounge','Live Gaming'];
  v_karaoke   text[] := array['Karaoke Lounge','Solo Karaoke','Open Mic Karaoke','Karaoke Battles','Karaoke Competition','Bollywood Karaoke','Tamil Karaoke','English Karaoke','Hindi Karaoke','90s Karaoke'];
  v_singalong text[] := array['Sing-Along Room','Group Sing-Along','Acoustic Sing-Along','Campfire Sing-Along','Worship Sing-Along','Antakshari'];
  v_duet      text[] := array['Duet Karaoke Lounge','Duet · Male + Female','Duet · Male + Male','Duet · Female + Female','Open Duets','Group Duets','Random Duet Matching','Live Duet Matching','Virtual Choir'];
  v_music     text[] := array['New Music & Artists','Trending Music','Discover Music','Music Charts','Artist Lounge','Indie Artists','Producers & Beatmakers','Cover Artists','Singer-Songwriters'];
  v_podcasts  text[] := array['News Podcasts','Entertainment Podcasts','Business Podcasts','Education Podcasts','Technology Podcasts','Relationships Podcasts','Storytelling Podcasts','Religion Podcasts','Sports Podcasts','Comedy Podcasts'];
  v_radio     text[] := array['Community Radio','Music Radio','Talk Radio','Live DJ Sessions','Lo-Fi Radio','Devotional Radio','Retro Radio'];
  v_watch     text[] := array['Movie Watch Party','Music Video Party','Live Event Watch','Series Binge Party','Documentary Night','Community Watch'];
  v_collab    text[] := array['Virtual Bands','Songwriting Room','Beat Exchange','Remix Competition','Producer Community','Artist Collaboration','Lyrics Workshop'];
  v_talent    text[] := array['Singing Competition','Karaoke Championship','Talent Show','Creator Awards','Music Awards','Open Talent Stage','Community Voting'];
  v_creators  text[] := array['Video Channels','Music Channels','Podcast Channels','Radio Channels','Education Channels','Entertainment Channels','New Creators Lounge'];
  v_free      text[] := array['Free Movies','Public Domain Films','Classic Cinema','Free Documentaries','Free Music','Free Concerts','Movie Recommendations','Music Recommendations'];
  v_royalty   text[] := array['Royalty-Free Music','Creative Commons Music','Public Domain Music','Stock Music','Royalty-Free Video','Stock Footage','Creator Resources','Background Music & SFX'];
begin
  foreach t in array v_live loop
    perform public.ensure_official_room('infotainment','info-live', t, t || ' — go live, host & bring an audience.', 'public', true, true, false, null, 200);
  end loop;
  foreach t in array v_karaoke loop
    perform public.ensure_official_room('infotainment','info-karaoke', t, t || ' — grab the mic and sing.', 'public', true, true, false, null, 100);
  end loop;
  foreach t in array v_singalong loop
    perform public.ensure_official_room('infotainment','info-singalong', t, t || ' — everyone sings together.', 'public', true, false, false, null, 100);
  end loop;
  foreach t in array v_duet loop
    perform public.ensure_official_room('infotainment','info-duet', t, t || ' — pair up and sing a duet.', 'public', true, true, false, null, 60);
  end loop;
  foreach t in array v_music loop
    perform public.ensure_official_room('infotainment','info-music', t, t || ' — share, discover & discuss music.', 'public', true, false, false, null, 100);
  end loop;
  foreach t in array v_podcasts loop
    perform public.ensure_official_room('infotainment','info-podcasts', t, t || ' — listen, host & discuss podcasts.', 'public', true, false, false, null, 100);
  end loop;
  foreach t in array v_radio loop
    perform public.ensure_official_room('infotainment','info-radio', t, t || ' — tune in or host your own show.', 'public', true, false, false, null, 100);
  end loop;
  foreach t in array v_watch loop
    perform public.ensure_official_room('infotainment','info-watch', t, t || ' — watch together, chat & react.', 'public', true, true, false, null, 100);
  end loop;
  foreach t in array v_collab loop
    perform public.ensure_official_room('infotainment','info-collab', t, t || ' — make music together.', 'public', true, false, false, null, 60);
  end loop;
  foreach t in array v_talent loop
    perform public.ensure_official_room('infotainment','info-talent', t, t || ' — compete, perform & get discovered.', 'public', true, true, false, null, 200);
  end loop;
  foreach t in array v_creators loop
    perform public.ensure_official_room('infotainment','info-creators', t, t || ' — build your channel & audience.', 'public', false, false, false, null, 100);
  end loop;
  foreach t in array v_free loop
    perform public.ensure_official_room('infotainment','info-freemedia', t, t || ' — free, legal movies & music to enjoy and share.', 'public', false, false, false, null, 100);
  end loop;
  foreach t in array v_royalty loop
    perform public.ensure_official_room('infotainment','info-royalty', t, t || ' — royalty-free assets for your projects.', 'public', false, false, false, null, 100);
  end loop;
end$$;
