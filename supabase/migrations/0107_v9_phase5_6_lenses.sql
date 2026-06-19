-- Karochat — v9 Phase 5.6: AR Lenses (MediaPipe face-tracking selfie lenses).
-- Wires the dormant `lenses` table (0042). Lenses are data-driven: each row's
-- mediapipe_spec describes an optional canvas filter + emoji overlays anchored
-- to face landmarks; the /lenses camera renders the spec live (MediaPipe
-- FaceLandmarker on-device). Idempotent.
--
-- mediapipe_spec shape:
--   { "filter": "<css filter string>"?,                 -- whole-frame FX
--     "overlays": [ { "emoji": "😎",
--                     "anchor": "eyes|each_eye|crown|nose|fullface",
--                     "scale": 1.0 } ]? }

create unique index if not exists lenses_slug_key on public.lenses(slug);

-- security_invoker is irrelevant here (plain table); ensure the read grant
-- exists alongside the existing lenses_read_all RLS policy.
grant select on public.lenses to anon, authenticated;

insert into public.lenses (slug, name, description, category, festival_tag, mediapipe_spec, is_active) values
  ('cool',   'Cool',        'Classic shades',         'face',  null,
     '{"overlays":[{"emoji":"😎","anchor":"eyes","scale":1.2}]}', true),
  ('shades', 'Neon Shades', 'Shades + neon glow',     'face',  null,
     '{"filter":"saturate(2) hue-rotate(20deg) contrast(1.2)","overlays":[{"emoji":"🕶️","anchor":"eyes","scale":1.25}]}', true),
  ('love',   'Heart Eyes',  'Hearts in your eyes',    'face',  null,
     '{"filter":"brightness(1.05) saturate(1.2)","overlays":[{"emoji":"❤️","anchor":"each_eye","scale":0.6}]}', true),
  ('star',   'Star Eyes',   'Seeing stars',           'face',  null,
     '{"overlays":[{"emoji":"⭐","anchor":"each_eye","scale":0.55}]}', true),
  ('royal',  'Royal',       'A crown fit for you',    'face',  null,
     '{"overlays":[{"emoji":"👑","anchor":"crown","scale":1.0}]}', true),
  ('clown',  'Clown Nose',  'Red nose day',           'face',  null,
     '{"overlays":[{"emoji":"🔴","anchor":"nose","scale":0.5}]}', true),
  ('party',  'Party',       'Confetti + pop',         'face',  null,
     '{"filter":"saturate(1.5) contrast(1.1)","overlays":[{"emoji":"🎉","anchor":"crown","scale":0.9}]}', true),
  ('noir',   'Noir',        'Moody black & white',    'color', null,
     '{"filter":"grayscale(1) contrast(1.15)"}', true),
  ('vivid',  'Vivid',       'Punchy colours',         'color', null,
     '{"filter":"saturate(1.7) contrast(1.1)"}', true),
  ('diwali', 'Diwali',      'Festival of lights',     'festival', 'diwali',
     '{"filter":"brightness(1.05) saturate(1.2)","overlays":[{"emoji":"🪔","anchor":"crown","scale":0.8}]}', true),
  ('holi',   'Holi',        'Splash of colour',       'festival', 'holi',
     '{"filter":"saturate(1.6)","overlays":[{"emoji":"🌈","anchor":"crown","scale":1.0}]}', true)
on conflict (slug) do update set
  name          = excluded.name,
  description   = excluded.description,
  category      = excluded.category,
  festival_tag  = excluded.festival_tag,
  mediapipe_spec= excluded.mediapipe_spec,
  is_active     = excluded.is_active;
