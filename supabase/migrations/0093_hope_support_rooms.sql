-- Karochat — "Hope & Support" rooms category for the Hope tab.
--
-- Real, joinable rooms behind the Hope page's "talk to someone", "peer support"
-- and "helpers" actions. Additive + idempotent (ensure_official_room, 0015).
-- Nothing existing is changed. These are peer-support spaces, NOT a substitute
-- for crisis services — the Hope page leads with helplines.

insert into public.room_categories (slug, label, description, icon, position, is_adult) values
  ('support', 'Hope & Support', 'Talk, be heard, support each other & help others.', '🫂', 38, false)
on conflict (slug) do update
  set label = excluded.label, description = excluded.description,
      icon = excluded.icon, position = excluded.position;

insert into public.room_subcategories (category_slug, slug, label, position) values
  ('support','sup-talk',    'Talk & be heard',       10),
  ('support','sup-peer',    'Peer support',          20),
  ('support','sup-helpers', 'Helpers & volunteers',  30),
  ('support','sup-give',    'Give & fundraise',      40)
on conflict (category_slug, slug) do update
  set label = excluded.label, position = excluded.position;

do $$
begin
  -- Talk & be heard (voice on so people can actually talk).
  perform public.ensure_official_room('support','sup-talk','Listening Ear','A kind space to talk and be heard — no judgement.','public',true,false,false,null,120);
  perform public.ensure_official_room('support','sup-talk','Vent Space','Let it out. Someone is here to listen.','public',true,false,false,null,120);
  perform public.ensure_official_room('support','sup-talk','Late-night & Lonely','Can''t sleep, feeling alone? Come sit with us.','public',true,false,false,null,120);
  perform public.ensure_official_room('support','sup-talk','Just Need to Talk','Anything on your mind — we''re here.','public',true,false,false,null,120);

  -- Peer support groups.
  perform public.ensure_official_room('support','sup-peer','Anxiety Support','Share, breathe, support each other through anxiety.','public',true,false,false,null,120);
  perform public.ensure_official_room('support','sup-peer','Depression Support','You are not alone. A gentle peer-support circle.','public',true,false,false,null,120);
  perform public.ensure_official_room('support','sup-peer','Grief & Loss','For anyone grieving — share and remember together.','public',true,false,false,null,100);
  perform public.ensure_official_room('support','sup-peer','Loneliness & Connection','Reach out, make a friend, feel less alone.','public',true,false,false,null,120);
  perform public.ensure_official_room('support','sup-peer','Recovery & Sobriety','Support for addiction recovery, one day at a time.','public',true,false,false,null,100);
  perform public.ensure_official_room('support','sup-peer','Students under Stress','Exam stress, burnout, pressure — talk it out.','public',true,false,false,null,120);

  -- Helpers & volunteers.
  perform public.ensure_official_room('support','sup-helpers','Helpers Lounge','For people who want to support others — coordinate & care.','public',true,false,false,null,100);
  perform public.ensure_official_room('support','sup-helpers','Trained Listeners','Listeners & volunteers offering a caring ear.','public',true,false,false,null,100);
  perform public.ensure_official_room('support','sup-helpers','Befrienders Circle','Befriend someone going through a hard time.','public',true,false,false,null,100);

  -- Give & fundraise.
  perform public.ensure_official_room('support','sup-give','Fundraisers & Causes','Share a cause, raise help, rally support.','public',false,false,false,null,150);
  perform public.ensure_official_room('support','sup-give','Help a Child Educate','Sponsor, mentor or fund a child''s education.','public',false,false,false,null,120);
  perform public.ensure_official_room('support','sup-give','Pay it Forward','Small acts of help — give what you can, take what you need.','public',false,false,false,null,120);
end$$;
