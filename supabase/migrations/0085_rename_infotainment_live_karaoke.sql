-- Karochat — rename the "Infotainment" category → "Live & Karaoke music".
--
-- Pure display rename. The category SLUG stays `infotainment`, so every existing
-- room, subcategory, route (/infotainment) and code reference keeps working
-- unchanged — only the human-facing label / description / icon change. The
-- 168 rooms inside (karaoke, sing-along, duet, live stages, music, etc.) are
-- untouched. Idempotent: re-running just re-applies the same values.

update public.room_categories
   set label       = 'Live & Karaoke music',
       description  = 'Karaoke & sing-along, live stages, duets, world & India state-wise tracks, podcasts, radio & watch parties — pick a track, go live and sing together.',
       icon         = '🎤'
 where slug = 'infotainment';
