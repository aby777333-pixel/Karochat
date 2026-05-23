-- Karochat — Wave 20.2: comprehensive Karochat students rooms seed.
--
-- Greatly expands the official student catalog so the verified-only
-- catalog tab inside /students feels populated everywhere — every
-- syllabus, every standardised exam, every major university cohort,
-- and every common meta/discussion thread gets a real room.
--
-- Categories touched (slugs already exist in the live DB):
--   • students            — exam-prep + campus-life + international + iits-iims
--   • students-subject    — cbse + icse + state-boards-in + ap-us + ib + a-level-uk + undergrad + postgrad + new igcse / gcse / state-overseas
--   • students-exam       — jee + neet + usmle + … + new ssc / banking / cloud / tech-certs
--   • students-cohort     — india-iit + india-nit + india-aiims + us-ivy + … + new oxbridge / india-iim / india-bits / asia-top
--   • students-meta       — office-hours + mentorship + … + new wellness / accommodations / streams
--
-- Idempotent — uses ensure_official_room, keyed on
-- (category_slug, subcategory_slug, name). Safe to re-run.
-- Adds ~330 new rooms.

-- ============================================================================
-- 0) Subcategory rows for any new buckets we want.
-- ============================================================================
insert into public.room_subcategories (category_slug, slug, label, position) values
  -- subject
  ('students-subject', 'igcse',          'IGCSE (Cambridge global)',  85),
  ('students-subject', 'gcse-uk',        'GCSE (UK)',                 87),
  ('students-subject', 'languages',      'Languages & literature',   200),
  ('students-subject', 'humanities',     'History & humanities',     210),
  ('students-subject', 'cs',             'Computer science',         220),
  ('students-subject', 'engineering',    'Engineering',              230),
  ('students-subject', 'pre-med',        'Pre-med / med-school',     240),
  ('students-subject', 'business',       'Business & economics',     250),
  ('students-subject', 'arts',           'Arts, design, music',      260),
  -- exam
  ('students-exam', 'ssc-india',         'SSC + Banking (India)',    400),
  ('students-exam', 'rrb-india',         'Railways (RRB, India)',    410),
  ('students-exam', 'ndas-india',        'NDA / CDS (India)',        420),
  ('students-exam', 'india-teaching',    'CTET / TET / NET (India)', 430),
  ('students-exam', 'cloud-certs',       'Cloud certs (AWS/GCP/Azure)', 440),
  ('students-exam', 'kubernetes',        'CKA / CKAD / CKS',         450),
  ('students-exam', 'security-certs',    'OSCP / CISSP / Sec+',      460),
  ('students-exam', 'data-certs',        'Data + ML certs',          470),
  ('students-exam', 'eu-medical',        'EU medical entry (TMS/BMAT/IMAT)', 480),
  ('students-exam', 'language-tests',    'IELTS / TOEFL / Duolingo', 490),
  -- cohort
  ('students-cohort', 'india-iim',       'IIMs (India)',             140),
  ('students-cohort', 'india-bits',      'BITS Pilani (India)',      145),
  ('students-cohort', 'india-other',     'Other top Indian (IISc/ISI/CMI)', 150),
  ('students-cohort', 'oxbridge',        'Oxford + Cambridge',       160),
  ('students-cohort', 'europe-tech',     'ETH / EPFL / TUM / TU Delft', 170),
  ('students-cohort', 'asia-china-jp',   'China + Japan top',        180),
  ('students-cohort', 'asia-singapore',  'NUS / NTU / SMU',          185),
  ('students-cohort', 'asia-korea',      'SNU / KAIST / POSTECH',    188),
  -- meta
  ('students-meta', 'wellness',          'Wellness & burnout',       210),
  ('students-meta', 'accommodations',    'Accessibility & accommodations', 220),
  ('students-meta', 'streams',           'Study streams (live)',     230),
  ('students-meta', 'first-gen',         'First-gen students',       240)
on conflict (category_slug, slug) do update
  set label    = excluded.label,
      position = excluded.position;

-- ============================================================================
-- 1) students/exam-prep — round out the prep options.
-- ============================================================================
do $$
begin
  perform public.ensure_official_room('students','exam-prep','SAT prep — math grind','Practice problems + tactics','public',true,false,false,null,100);
  perform public.ensure_official_room('students','exam-prep','SAT prep — reading + writing','Passage drills together','public',true,false,false,null,80);
  perform public.ensure_official_room('students','exam-prep','ACT prep','English/Math/Reading/Science','public',true,false,false,null,80);
  perform public.ensure_official_room('students','exam-prep','LSAT prep','Logic games and arguments','public',true,false,false,null,80);
  perform public.ensure_official_room('students','exam-prep','LNAT prep (UK law)','Comprehension + essay coaching','public',true,false,false,null,60);
  perform public.ensure_official_room('students','exam-prep','BMAT / UCAT (UK med)','Aptitude practice','public',true,false,false,null,60);
  perform public.ensure_official_room('students','exam-prep','PCAT (US pharmacy)','Pharmacy entrance grind','public',true,false,false,null,40);
  perform public.ensure_official_room('students','exam-prep','DAT (US dentistry)','Dental entrance grind','public',true,false,false,null,40);
  perform public.ensure_official_room('students','exam-prep','MAT (UK Math)','Maths Admissions Test','public',true,false,false,null,40);
  perform public.ensure_official_room('students','exam-prep','PAT (Oxford Physics)','Physics Aptitude Test','public',true,false,false,null,40);
  perform public.ensure_official_room('students','exam-prep','TMUA (Test of Math UA)','Cambridge / Warwick prep','public',true,false,false,null,40);
  perform public.ensure_official_room('students','exam-prep','SSC CGL prep','Combined Graduate Level','public',true,false,false,null,120);
  perform public.ensure_official_room('students','exam-prep','SSC CHSL prep','Higher Secondary Level','public',true,false,false,null,80);
  perform public.ensure_official_room('students','exam-prep','IBPS PO prep','Bank PO together','public',true,false,false,null,100);
  perform public.ensure_official_room('students','exam-prep','SBI PO prep','SBI PO + Clerk together','public',true,false,false,null,100);
  perform public.ensure_official_room('students','exam-prep','RBI Grade B prep','Phase I + Phase II','public',true,false,false,null,80);
  perform public.ensure_official_room('students','exam-prep','NDA / CDS prep','Defence entry exams','public',true,false,false,null,80);
  perform public.ensure_official_room('students','exam-prep','CTET / TET prep','Teaching eligibility','public',true,false,false,null,60);
  perform public.ensure_official_room('students','exam-prep','NET-JRF prep','UGC / CSIR NET','public',true,false,false,null,60);
  perform public.ensure_official_room('students','exam-prep','CLAT prep','Law entrance UG/PG','public',true,false,false,null,80);
end$$;

-- ============================================================================
-- 2) students/campus-life — additional campus topics.
-- ============================================================================
do $$
begin
  perform public.ensure_official_room('students','campus-life','Hostel & dorm life','Roommates, mess, life on campus','public',true,false,false,null,150);
  perform public.ensure_official_room('students','campus-life','Clubs & societies','Find a club, run a club','public',true,false,false,null,120);
  perform public.ensure_official_room('students','campus-life','Fests & cultural events','Tech + cultural fests across campuses','public',true,false,false,null,100);
  perform public.ensure_official_room('students','campus-life','Sports & gym','Inter-college sports, gym buddies','public',true,false,false,null,80);
  perform public.ensure_official_room('students','campus-life','Coding clubs','GDSC, ACM, comp programming','public',true,false,false,null,100);
  perform public.ensure_official_room('students','campus-life','Quizzing','College + open quiz circuits','public',true,false,false,null,60);
  perform public.ensure_official_room('students','campus-life','Hackathons','Find teammates / share challenges','public',true,false,false,null,100);
  perform public.ensure_official_room('students','campus-life','Placements & interviews','Internships → full-time','public',true,false,false,null,200);
  perform public.ensure_official_room('students','campus-life','Co-op programs','Sandwich/co-op placements','public',true,false,false,null,60);
end$$;

-- ============================================================================
-- 3) students/international — every major destination + life topics.
-- ============================================================================
do $$
begin
  perform public.ensure_official_room('students','international','Studying in USA','F-1, OPT, life talk','public',true,false,false,null,300);
  perform public.ensure_official_room('students','international','Studying in UK','Tier 4 / Graduate route','public',true,false,false,null,250);
  perform public.ensure_official_room('students','international','Studying in Canada','Study permit + PGWP talk','public',true,false,false,null,250);
  perform public.ensure_official_room('students','international','Studying in Australia','Subclass 500 + 485 talk','public',true,false,false,null,200);
  perform public.ensure_official_room('students','international','Studying in Germany','Free tuition, blocked account','public',true,false,false,null,200);
  perform public.ensure_official_room('students','international','Studying in France','Campus France + life','public',true,false,false,null,150);
  perform public.ensure_official_room('students','international','Studying in Netherlands','Dutch UAS / research','public',true,false,false,null,120);
  perform public.ensure_official_room('students','international','Studying in Ireland','Critical skills + stay-back','public',true,false,false,null,100);
  perform public.ensure_official_room('students','international','Studying in NZ','Post-study work','public',true,false,false,null,80);
  perform public.ensure_official_room('students','international','Studying in Sweden','Free for EU, lakh+ for INR','public',true,false,false,null,80);
  perform public.ensure_official_room('students','international','Studying in Italy','Bocconi, Polimi, art','public',true,false,false,null,80);
  perform public.ensure_official_room('students','international','Studying in Spain','Tuition + life talk','public',true,false,false,null,80);
  perform public.ensure_official_room('students','international','Studying in Japan','MEXT + private unis','public',true,false,false,null,80);
  perform public.ensure_official_room('students','international','Studying in Korea','GKS + KAIST + SNU','public',true,false,false,null,80);
  perform public.ensure_official_room('students','international','Studying in Singapore','NUS / NTU / SMU','public',true,false,false,null,80);
  perform public.ensure_official_room('students','international','Studying in UAE',     'Dubai / Sharjah / Abu Dhabi','public',true,false,false,null,60);
  perform public.ensure_official_room('students','international','Visa interviews','F1, T4, GS — what got asked','public',true,false,false,null,150);
  perform public.ensure_official_room('students','international','Loan & finance','Edu loans across countries','public',true,false,false,null,100);
end$$;

-- ============================================================================
-- 4) students/iits-iims — full IIT roster.
-- ============================================================================
do $$
begin
  perform public.ensure_official_room('students','iits-iims','IIT Hyderabad','Students + alumni','public',true,false,false,null,80);
  perform public.ensure_official_room('students','iits-iims','IIT Guwahati','Students + alumni','public',true,false,false,null,80);
  perform public.ensure_official_room('students','iits-iims','IIT BHU (Varanasi)','Students + alumni','public',true,false,false,null,80);
  perform public.ensure_official_room('students','iits-iims','IIT ISM Dhanbad','Students + alumni','public',true,false,false,null,80);
  perform public.ensure_official_room('students','iits-iims','IIT Indore','Students + alumni','public',true,false,false,null,60);
  perform public.ensure_official_room('students','iits-iims','IIT Mandi','Students + alumni','public',true,false,false,null,60);
  perform public.ensure_official_room('students','iits-iims','IIT Ropar','Students + alumni','public',true,false,false,null,60);
  perform public.ensure_official_room('students','iits-iims','IIT Patna','Students + alumni','public',true,false,false,null,60);
  perform public.ensure_official_room('students','iits-iims','IIT Bhilai','Students + alumni','public',true,false,false,null,40);
  perform public.ensure_official_room('students','iits-iims','IIT Goa','Students + alumni','public',true,false,false,null,40);
  perform public.ensure_official_room('students','iits-iims','IIT Jammu','Students + alumni','public',true,false,false,null,40);
  perform public.ensure_official_room('students','iits-iims','IIT Tirupati','Students + alumni','public',true,false,false,null,40);
  perform public.ensure_official_room('students','iits-iims','IIT Jodhpur','Students + alumni','public',true,false,false,null,40);
  perform public.ensure_official_room('students','iits-iims','IIT Palakkad','Students + alumni','public',true,false,false,null,40);
  perform public.ensure_official_room('students','iits-iims','IIT Dharwad','Students + alumni','public',true,false,false,null,40);
  perform public.ensure_official_room('students','iits-iims','IIM Lucknow','Students + alumni','public',true,false,false,null,60);
  perform public.ensure_official_room('students','iits-iims','IIM Kozhikode','Students + alumni','public',true,false,false,null,60);
  perform public.ensure_official_room('students','iits-iims','IIM Indore','Students + alumni','public',true,false,false,null,60);
  perform public.ensure_official_room('students','iits-iims','IIM Shillong','Students + alumni','public',true,false,false,null,40);
end$$;

-- ============================================================================
-- 5) students-subject/ap-us — full AP roster (37+ subjects).
-- ============================================================================
do $$
begin
  perform public.ensure_official_room('students-subject','ap-us','AP Calculus AB','Limits, derivatives, integrals','public',true,false,false,null,200);
  perform public.ensure_official_room('students-subject','ap-us','AP Calculus BC','Series + parametric','public',true,false,false,null,180);
  perform public.ensure_official_room('students-subject','ap-us','AP Statistics','Sampling, inference','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','ap-us','AP Precalculus','New-format prep','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','ap-us','AP Physics 1','Algebra-based mechanics','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','ap-us','AP Physics 2','Fluids, thermo, optics','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','ap-us','AP Physics C: Mechanics','Calculus mechanics','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','ap-us','AP Physics C: E&M','Calculus EM','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','ap-us','AP Chemistry','Stoich → kinetics','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','ap-us','AP Biology','Cells → ecology','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','ap-us','AP Environmental Science','APES grind','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','ap-us','AP Computer Science A','Java + OOP','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','ap-us','AP Computer Science Principles','Big ideas + portfolio','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','ap-us','AP English Language','Rhetoric + arguments','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','ap-us','AP English Literature','Lit analysis','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','ap-us','AP US History','APUSH grind','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','ap-us','AP World History: Modern','1200 to present','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','ap-us','AP European History','Renaissance to now','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','ap-us','AP US Government','Politics + court cases','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','ap-us','AP Comparative Government','6 country systems','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','ap-us','AP Macroeconomics','Macro grind','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','ap-us','AP Microeconomics','Micro grind','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','ap-us','AP Psychology','Cognitive → social','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','ap-us','AP Human Geography','HuG vibes','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','ap-us','AP Spanish Language','Reading + speaking','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','ap-us','AP Spanish Literature','Lit reading','public',true,false,false,null,40);
  perform public.ensure_official_room('students-subject','ap-us','AP French Language','En français','public',true,false,false,null,40);
  perform public.ensure_official_room('students-subject','ap-us','AP Chinese Language','中文','public',true,false,false,null,40);
  perform public.ensure_official_room('students-subject','ap-us','AP Japanese Language','日本語','public',true,false,false,null,40);
  perform public.ensure_official_room('students-subject','ap-us','AP German Language','Auf Deutsch','public',true,false,false,null,40);
  perform public.ensure_official_room('students-subject','ap-us','AP Latin','Caesar + Vergil','public',true,false,false,null,40);
  perform public.ensure_official_room('students-subject','ap-us','AP Art History','From cave to contemporary','public',true,false,false,null,40);
  perform public.ensure_official_room('students-subject','ap-us','AP Studio Art / 2D','Portfolio swap','public',true,false,false,null,40);
  perform public.ensure_official_room('students-subject','ap-us','AP Music Theory','Voice leading + dictation','public',true,false,false,null,40);
  perform public.ensure_official_room('students-subject','ap-us','AP Seminar','Research + presentations','public',true,false,false,null,40);
  perform public.ensure_official_room('students-subject','ap-us','AP Research','Capstone proposals','public',true,false,false,null,40);
  perform public.ensure_official_room('students-subject','ap-us','AP African American Studies','New course discussion','public',true,false,false,null,60);
end$$;

-- ============================================================================
-- 6) students-subject/ib — IB Diploma full set.
-- ============================================================================
do $$
begin
  perform public.ensure_official_room('students-subject','ib','IB Math AA HL','Analysis & Approaches HL','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','ib','IB Math AA SL','Analysis & Approaches SL','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','ib','IB Math AI HL','Applications & Interpretation HL','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','ib','IB Math AI SL','Applications & Interpretation SL','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','ib','IB Physics HL','Topics + Option','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','ib','IB Physics SL','Topics + Option','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','ib','IB Chemistry HL','Topics + Option','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','ib','IB Chemistry SL','Topics + Option','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','ib','IB Biology HL','Topics + Option','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','ib','IB Biology SL','Topics + Option','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','ib','IB English A: Lit HL','Lit-focused','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','ib','IB English B HL','Language acquisition','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','ib','IB History HL','Paper 1/2/3','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','ib','IB Economics HL','Micro + Macro + Global + Dev','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','ib','IB Business Mgmt HL','BM toolkit','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','ib','IB Psychology HL','Bio/Cognitive/Social','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','ib','IB Geography HL','Paper 1/2/3','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','ib','IB Computer Science HL','Java + topics','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','ib','IB Visual Arts HL','Exhibition / CS / PP','public',true,false,false,null,40);
  perform public.ensure_official_room('students-subject','ib','IB Theory of Knowledge (TOK)','Essay + Exhibition','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','ib','IB Extended Essay (EE)','Mentor + drafts','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','ib','IB CAS','Creativity / Activity / Service','public',true,false,false,null,80);
end$$;

-- ============================================================================
-- 7) students-subject/a-level-uk — common A-Level subjects.
-- ============================================================================
do $$
begin
  perform public.ensure_official_room('students-subject','a-level-uk','A-Level Maths','Pure + Stats + Mech','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','a-level-uk','A-Level Further Maths','FP1+, vectors, complex','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','a-level-uk','A-Level Physics','OCR / AQA / Edexcel','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','a-level-uk','A-Level Chemistry','Organic + inorganic','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','a-level-uk','A-Level Biology','Cells → ecosystems','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','a-level-uk','A-Level Economics','Micro + Macro','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','a-level-uk','A-Level Business','Strategy + accounting','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','a-level-uk','A-Level Psychology','AQA topics','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','a-level-uk','A-Level Computer Science','Pseudo + theory','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','a-level-uk','A-Level English Lit','Set texts grind','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','a-level-uk','A-Level English Lang','Lang & lit','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','a-level-uk','A-Level History','Topics + sources','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','a-level-uk','A-Level Geography','Phys + human','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','a-level-uk','A-Level Sociology','Family → globalisation','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','a-level-uk','A-Level Politics','UK + USA + political ideas','public',true,false,false,null,60);
end$$;

-- ============================================================================
-- 8) students-subject/igcse — bring up to par.
-- ============================================================================
do $$
begin
  perform public.ensure_official_room('students-subject','igcse','IGCSE Maths (0580/0606)','Core + extended','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','igcse','IGCSE Physics (0625)','Core + extended','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','igcse','IGCSE Chemistry (0620)','Core + extended','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','igcse','IGCSE Biology (0610)','Core + extended','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','igcse','IGCSE English Lang (0500)','First language','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','igcse','IGCSE English Lit (0475)','Set texts','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','igcse','IGCSE Economics (0455)','Micro + Macro','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','igcse','IGCSE Business (0450)','BM IGCSE','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','igcse','IGCSE History (0470)','Sources + essays','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','igcse','IGCSE Computer Science (0478)','Theory + algorithms','public',true,false,false,null,60);
end$$;

-- ============================================================================
-- 9) students-subject/gcse-uk — common GCSE subjects.
-- ============================================================================
do $$
begin
  perform public.ensure_official_room('students-subject','gcse-uk','GCSE Maths','Higher + foundation','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','gcse-uk','GCSE English Lang','Paper 1/2','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','gcse-uk','GCSE English Lit','Set texts + poetry','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','gcse-uk','GCSE Combined Science','Trilogy','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','gcse-uk','GCSE Triple Science','Sep Sci','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','gcse-uk','GCSE History','Modern + medieval','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','gcse-uk','GCSE Geography','Phys + human','public',true,false,false,null,60);
end$$;

-- ============================================================================
-- 10) students-subject/cbse — class-wise rooms.
-- ============================================================================
do $$
begin
  perform public.ensure_official_room('students-subject','cbse','CBSE Class 12 Physics','NCERT + boards','public',true,false,false,null,200);
  perform public.ensure_official_room('students-subject','cbse','CBSE Class 12 Chemistry','NCERT + boards','public',true,false,false,null,200);
  perform public.ensure_official_room('students-subject','cbse','CBSE Class 12 Maths','NCERT + boards','public',true,false,false,null,200);
  perform public.ensure_official_room('students-subject','cbse','CBSE Class 12 Biology','NCERT + boards','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','cbse','CBSE Class 12 English','Flamingo + Vistas','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','cbse','CBSE Class 12 Computer Science','Python + DB','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','cbse','CBSE Class 12 Economics','Macro + Indian econ','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','cbse','CBSE Class 12 Accountancy','Accountancy part 1/2','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','cbse','CBSE Class 12 Business Studies','BST grind','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','cbse','CBSE Class 11 Physics','NCERT + JEE prep','public',true,false,false,null,180);
  perform public.ensure_official_room('students-subject','cbse','CBSE Class 11 Chemistry','NCERT + JEE prep','public',true,false,false,null,180);
  perform public.ensure_official_room('students-subject','cbse','CBSE Class 11 Maths','NCERT + JEE prep','public',true,false,false,null,180);
  perform public.ensure_official_room('students-subject','cbse','CBSE Class 11 Biology','NCERT + NEET prep','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','cbse','CBSE Class 10 board prep','All subjects','public',true,false,false,null,200);
  perform public.ensure_official_room('students-subject','cbse','CBSE Class 9 study room','Foundation strong','public',true,false,false,null,120);
end$$;

-- ============================================================================
-- 11) students-subject/state-boards-in — major state boards.
-- ============================================================================
do $$
begin
  perform public.ensure_official_room('students-subject','state-boards-in','Tamil Nadu State Board (Class 11-12)','+1 / +2 syllabus','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','state-boards-in','Maharashtra HSC Board (11-12)','MH HSC syllabus','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','state-boards-in','Karnataka PUC (I + II)','KA PUC syllabus','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','state-boards-in','Andhra Pradesh Intermediate','BIE-AP syllabus','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','state-boards-in','Telangana Intermediate','BIE-TS syllabus','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','state-boards-in','Kerala HSE (Plus One/Two)','SCERT-KL syllabus','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','state-boards-in','West Bengal HS (11-12)','WBCHSE syllabus','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','state-boards-in','UP Board (Intermediate)','UPMSP syllabus','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','state-boards-in','Rajasthan Board (RBSE)','RBSE syllabus','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','state-boards-in','Gujarat HSC (GSHSEB)','GSHSEB syllabus','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','state-boards-in','Punjab Board (PSEB)','PSEB syllabus','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','state-boards-in','Haryana Board (HBSE)','HBSE syllabus','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','state-boards-in','Bihar Board (BSEB)','BSEB syllabus','public',true,false,false,null,80);
end$$;

-- ============================================================================
-- 12) students-subject/undergrad — common UG disciplines.
-- ============================================================================
do $$
begin
  perform public.ensure_official_room('students-subject','undergrad','UG · Calculus I','Limits → derivatives','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','undergrad','UG · Calculus II','Integration + series','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','undergrad','UG · Multivariable Calculus','Vector calc','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','undergrad','UG · Linear Algebra','Matrices + eigenvectors','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','undergrad','UG · Differential Equations','ODEs','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','undergrad','UG · Probability','Random variables → CLT','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','undergrad','UG · Statistics','Inference, regression','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','undergrad','UG · Discrete Math','Logic, sets, graphs','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','undergrad','UG · Data Structures','Lists → trees → graphs','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','undergrad','UG · Algorithms','Sort/DP/Greedy','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','undergrad','UG · Operating Systems','Processes, memory, FS','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','undergrad','UG · DBMS','SQL → indexing','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','undergrad','UG · Computer Networks','OSI → TCP','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','undergrad','UG · Theory of Computation','Automata + NP','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','undergrad','UG · Compilers','Lexer → semantic','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','undergrad','UG · ML 101','Intro ML/DL','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','undergrad','UG · Microeconomics 101','Theory of the firm','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','undergrad','UG · Macroeconomics 101','IS-LM, ADAS','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','undergrad','UG · Econometrics','OLS → IV','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','undergrad','UG · Accounting Principles','Debits, credits, statements','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','undergrad','UG · Corporate Finance','TVM → WACC','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','undergrad','UG · Organic Chemistry','Mechanisms','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','undergrad','UG · Inorganic Chemistry','Solid state, coordination','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','undergrad','UG · Physical Chemistry','Thermo + kinetics','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','undergrad','UG · Genetics','Mendel → CRISPR','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','undergrad','UG · Anatomy & Physiology','Systems-wise','public',true,false,false,null,80);
end$$;

-- ============================================================================
-- 13) students-subject/cs / engineering / pre-med / business / arts / etc.
-- ============================================================================
do $$
begin
  perform public.ensure_official_room('students-subject','cs','Competitive Programming','Codeforces / Leetcode','public',true,false,false,null,200);
  perform public.ensure_official_room('students-subject','cs','Frontend Engineering','React/Vue/Svelte/Solid','public',true,false,false,null,120);
  perform public.ensure_official_room('students-subject','cs','Backend Engineering','Node / Django / Rails / Go','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','cs','Mobile Engineering','Swift / Kotlin / Flutter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','cs','Systems Programming','Rust / C / Zig','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','cs','Machine Learning study','From basics → research','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','cs','Deep Learning study','Karpathy + Goodfellow','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','cs','LLMs & RAG','Prompting → fine-tuning','public',true,false,false,null,150);
  perform public.ensure_official_room('students-subject','cs','Cybersecurity 101','CTF + careers','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','engineering','Mechanical Engineering','UG + design','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','engineering','Electrical Engineering','Circuits → power','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','engineering','Civil Engineering','RCC, steel, environment','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','engineering','Chemical Engineering','Process + reaction','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','engineering','Aerospace Engineering','Aero + structures','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','engineering','Biomedical Engineering','Bio + EE crossover','public',true,false,false,null,40);
  perform public.ensure_official_room('students-subject','engineering','Robotics','ROS + manipulation','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','pre-med','Pre-med biochem','Metabolism','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','pre-med','Pre-med organic','Reactions you''ll see','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','pre-med','Med school personal statements','Drafts + peer review','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','pre-med','MMI interview prep','Mock together','public',true,false,false,null,40);
  perform public.ensure_official_room('students-subject','business','Strategy & cases','MBB case practice','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','business','Marketing & brand','4Ps → growth','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','business','Finance — public markets','Equities + macro','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','business','Finance — private markets','PE + VC','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','business','Operations & supply chain','SCM + ops','public',true,false,false,null,40);
  perform public.ensure_official_room('students-subject','arts','Studio art & sketching','Daily drawings','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','arts','Graphic design','Posters / typography','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','arts','Music theory','Voice leading + analysis','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','arts','Music performance','Crit + practice','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','arts','Film studies','Crit + analysis','public',true,false,false,null,40);
  perform public.ensure_official_room('students-subject','humanities','Philosophy 101','Logic → ethics','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','humanities','Modern world history','19th c → now','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','humanities','Political theory','Hobbes → Rawls','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','humanities','Anthropology','Cultural + linguistic','public',true,false,false,null,40);
  perform public.ensure_official_room('students-subject','humanities','Sociology','Theory + methods','public',true,false,false,null,40);
  perform public.ensure_official_room('students-subject','languages','Spanish learners','Práctica diaria','public',true,false,false,null,100);
  perform public.ensure_official_room('students-subject','languages','French learners','Conversations en français','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','languages','German learners','Sprachpraxis','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','languages','Japanese learners','日本語学習','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','languages','Korean learners','한국어 공부','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','languages','Mandarin learners','学习中文','public',true,false,false,null,80);
  perform public.ensure_official_room('students-subject','languages','Arabic learners','تعلم العربية','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','languages','Tamil literature','இலக்கியம்','public',true,false,false,null,60);
  perform public.ensure_official_room('students-subject','languages','Hindi literature','हिंदी साहित्य','public',true,false,false,null,60);
end$$;

-- ============================================================================
-- 14) students-exam expansion — new + existing subcats.
-- ============================================================================
do $$
begin
  -- JEE subject-wise
  perform public.ensure_official_room('students-exam','jee','JEE · Physics deep-dive','Mechanics → modern','public',true,false,false,null,200);
  perform public.ensure_official_room('students-exam','jee','JEE · Chemistry deep-dive','Phy + Org + Inorg','public',true,false,false,null,200);
  perform public.ensure_official_room('students-exam','jee','JEE · Maths deep-dive','Algebra → calc','public',true,false,false,null,200);
  perform public.ensure_official_room('students-exam','jee','JEE 2028 aspirants','Class 11 starters','public',true,false,false,null,100);
  -- NEET subject-wise
  perform public.ensure_official_room('students-exam','neet','NEET · Biology grind','Botany + Zoology','public',true,false,false,null,200);
  perform public.ensure_official_room('students-exam','neet','NEET · Physics + Chem','Conceptual problems','public',true,false,false,null,150);
  -- USMLE
  perform public.ensure_official_room('students-exam','usmle','USMLE Step 1','First Aid + UWorld','public',true,false,false,null,120);
  perform public.ensure_official_room('students-exam','usmle','USMLE Step 2 CK','CMS + UWorld','public',true,false,false,null,100);
  perform public.ensure_official_room('students-exam','usmle','USMLE Step 3','CCS cases','public',true,false,false,null,60);
  -- GATE branches
  perform public.ensure_official_room('students-exam','gate','GATE CSE','Compilers, DSA, theory','public',true,false,false,null,120);
  perform public.ensure_official_room('students-exam','gate','GATE ECE','Signals, devices, comms','public',true,false,false,null,100);
  perform public.ensure_official_room('students-exam','gate','GATE ME','Thermo, dynamics, manuf','public',true,false,false,null,80);
  perform public.ensure_official_room('students-exam','gate','GATE EE','Power, machines, control','public',true,false,false,null,80);
  perform public.ensure_official_room('students-exam','gate','GATE Civil','Geotech, structural','public',true,false,false,null,60);
  -- CAT
  perform public.ensure_official_room('students-exam','cat','CAT · Quant grind','Arith, alg, geo','public',true,false,false,null,150);
  perform public.ensure_official_room('students-exam','cat','CAT · VARC grind','Reading + grammar','public',true,false,false,null,120);
  perform public.ensure_official_room('students-exam','cat','CAT · LRDI grind','Sets + caselets','public',true,false,false,null,120);
  -- UPSC
  perform public.ensure_official_room('students-exam','upsc','UPSC · Prelims general studies','Static + current','public',true,false,false,null,150);
  perform public.ensure_official_room('students-exam','upsc','UPSC · Optional: History','Modern + ancient','public',true,false,false,null,60);
  perform public.ensure_official_room('students-exam','upsc','UPSC · Optional: PSIR','Political science','public',true,false,false,null,60);
  perform public.ensure_official_room('students-exam','upsc','UPSC · Optional: Geography','Phys + human','public',true,false,false,null,60);
  perform public.ensure_official_room('students-exam','upsc','UPSC · Optional: Sociology','Theory + thinkers','public',true,false,false,null,60);
  -- New: SSC + Banking
  perform public.ensure_official_room('students-exam','ssc-india','SSC CGL · Tier I','Reasoning + GK + Math','public',true,false,false,null,150);
  perform public.ensure_official_room('students-exam','ssc-india','SSC CGL · Tier II','Math + English advanced','public',true,false,false,null,100);
  perform public.ensure_official_room('students-exam','ssc-india','SSC CHSL','Higher Secondary','public',true,false,false,null,100);
  perform public.ensure_official_room('students-exam','ssc-india','SSC MTS / GD','Multi-tasking + general duty','public',true,false,false,null,80);
  perform public.ensure_official_room('students-exam','ssc-india','IBPS PO + Clerk','Bank PO + Clerk','public',true,false,false,null,150);
  perform public.ensure_official_room('students-exam','ssc-india','SBI PO + Clerk','SBI bank exams','public',true,false,false,null,120);
  perform public.ensure_official_room('students-exam','ssc-india','RBI Grade B','Phase I + Phase II','public',true,false,false,null,80);
  perform public.ensure_official_room('students-exam','ssc-india','NABARD Grade A/B','Agri + rural focus','public',true,false,false,null,60);
  -- RRB
  perform public.ensure_official_room('students-exam','rrb-india','RRB NTPC','Non-tech popular','public',true,false,false,null,100);
  perform public.ensure_official_room('students-exam','rrb-india','RRB Group D','Group D drills','public',true,false,false,null,80);
  perform public.ensure_official_room('students-exam','rrb-india','RRB ALP','Asst Loco Pilot','public',true,false,false,null,80);
  -- NDA / CDS
  perform public.ensure_official_room('students-exam','ndas-india','NDA written prep','GAT + Maths','public',true,false,false,null,100);
  perform public.ensure_official_room('students-exam','ndas-india','CDS written prep','English + GK + Math','public',true,false,false,null,80);
  perform public.ensure_official_room('students-exam','ndas-india','SSB interview prep','SSB techniques','public',true,false,false,null,80);
  -- Teaching
  perform public.ensure_official_room('students-exam','india-teaching','CTET (Paper I + II)','Pedagogy + content','public',true,false,false,null,80);
  perform public.ensure_official_room('students-exam','india-teaching','State TET','REET / TET-style','public',true,false,false,null,60);
  perform public.ensure_official_room('students-exam','india-teaching','UGC NET','Paper I + Paper II','public',true,false,false,null,80);
  perform public.ensure_official_room('students-exam','india-teaching','CSIR NET','Science research entry','public',true,false,false,null,60);
  -- Cloud certs
  perform public.ensure_official_room('students-exam','cloud-certs','AWS · Cloud Practitioner','Beginner cert','public',true,false,false,null,100);
  perform public.ensure_official_room('students-exam','cloud-certs','AWS · Solutions Architect — Associate','SAA-C03','public',true,false,false,null,100);
  perform public.ensure_official_room('students-exam','cloud-certs','AWS · Solutions Architect — Pro','SAP-C02','public',true,false,false,null,60);
  perform public.ensure_official_room('students-exam','cloud-certs','AWS · Developer / DevOps','DVA-C02 / DOP-C02','public',true,false,false,null,60);
  perform public.ensure_official_room('students-exam','cloud-certs','GCP · Associate Cloud Engineer','ACE','public',true,false,false,null,60);
  perform public.ensure_official_room('students-exam','cloud-certs','GCP · Professional Cloud Architect','PCA','public',true,false,false,null,40);
  perform public.ensure_official_room('students-exam','cloud-certs','Azure · AZ-900 Fundamentals','Beginner cert','public',true,false,false,null,60);
  perform public.ensure_official_room('students-exam','cloud-certs','Azure · AZ-104 Administrator','Admin track','public',true,false,false,null,40);
  perform public.ensure_official_room('students-exam','cloud-certs','Azure · AZ-204 Developer','Dev track','public',true,false,false,null,40);
  -- Kubernetes
  perform public.ensure_official_room('students-exam','kubernetes','CKA · Certified Kubernetes Admin','Linux Foundation','public',true,false,false,null,60);
  perform public.ensure_official_room('students-exam','kubernetes','CKAD · K8s App Developer','LF dev cert','public',true,false,false,null,60);
  perform public.ensure_official_room('students-exam','kubernetes','CKS · K8s Security','Hardening + audits','public',true,false,false,null,40);
  -- Security
  perform public.ensure_official_room('students-exam','security-certs','OSCP','PWK + 24h exam','public',true,false,false,null,80);
  perform public.ensure_official_room('students-exam','security-certs','CISSP','Holistic security mgmt','public',true,false,false,null,60);
  perform public.ensure_official_room('students-exam','security-certs','CompTIA Security+','Entry-level','public',true,false,false,null,60);
  perform public.ensure_official_room('students-exam','security-certs','CEH','Ethical hacking cert','public',true,false,false,null,40);
  perform public.ensure_official_room('students-exam','security-certs','eJPT / eCPPT','Junior/practical pen-test','public',true,false,false,null,40);
  -- Data + ML
  perform public.ensure_official_room('students-exam','data-certs','TensorFlow Developer','TF cert','public',true,false,false,null,60);
  perform public.ensure_official_room('students-exam','data-certs','AWS ML Specialty','MLS-C01','public',true,false,false,null,40);
  perform public.ensure_official_room('students-exam','data-certs','Databricks Data Engineer','DE Associate / Pro','public',true,false,false,null,40);
  perform public.ensure_official_room('students-exam','data-certs','Snowflake SnowPro Core','SnowPro Core','public',true,false,false,null,40);
  -- EU medical
  perform public.ensure_official_room('students-exam','eu-medical','TMS (Germany med entry)','MedAT-style','public',true,false,false,null,60);
  perform public.ensure_official_room('students-exam','eu-medical','BMAT (UK med entry)','Aptitude + sci','public',true,false,false,null,60);
  perform public.ensure_official_room('students-exam','eu-medical','IMAT (Italy med entry)','English-taught med entry','public',true,false,false,null,60);
  perform public.ensure_official_room('students-exam','eu-medical','GAMSAT (UK/AU/IE)','Grad med entry','public',true,false,false,null,40);
  -- Language tests
  perform public.ensure_official_room('students-exam','language-tests','IELTS Academic','All 4 modules','public',true,false,false,null,150);
  perform public.ensure_official_room('students-exam','language-tests','IELTS General','Migration + work','public',true,false,false,null,100);
  perform public.ensure_official_room('students-exam','language-tests','TOEFL iBT','Reading → speaking → writing','public',true,false,false,null,100);
  perform public.ensure_official_room('students-exam','language-tests','Duolingo English Test','DET grind','public',true,false,false,null,80);
  perform public.ensure_official_room('students-exam','language-tests','PTE Academic','Pearson PTE','public',true,false,false,null,60);
  perform public.ensure_official_room('students-exam','language-tests','TestDaF / DSH (German)','Med + uni German','public',true,false,false,null,40);
  perform public.ensure_official_room('students-exam','language-tests','DELF / DALF (French)','A1 → C2','public',true,false,false,null,40);
  perform public.ensure_official_room('students-exam','language-tests','HSK (Mandarin)','HSK 1-6','public',true,false,false,null,40);
end$$;

-- ============================================================================
-- 15) students-cohort expansion — globally.
-- ============================================================================
do $$
begin
  perform public.ensure_official_room('students-cohort','india-iit','IIT Hyderabad cohort','IITH chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','india-iit','IIT Guwahati cohort','IITG chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','india-iit','IIT BHU cohort','IITBHU chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','india-iit','IIT ISM Dhanbad cohort','IITISM chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','india-iit','IIT Indore cohort','IITI chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','india-iit','IIT Mandi cohort','IITMandi chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','india-iit','IIT Ropar cohort','IITRPR chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','india-iit','IIT Patna cohort','IITP chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','india-iit','IIT Jodhpur cohort','IITJ chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','india-iit','IIT Tirupati cohort','IITTP chapter','public',true,false,false,null,40);

  perform public.ensure_official_room('students-cohort','india-nit','NIT Trichy cohort','NITT chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','india-nit','NIT Surathkal cohort','NITK chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','india-nit','NIT Warangal cohort','NITW chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','india-nit','NIT Calicut cohort','NITC chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','india-nit','NIT Allahabad cohort','MNNIT chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','india-nit','NIT Nagpur cohort','VNIT chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','india-nit','NIT Rourkela cohort','NITRKL chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','india-nit','IIIT Hyderabad cohort','IIITH chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','india-nit','IIIT Bangalore cohort','IIITB chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','india-nit','IIIT Delhi cohort','IIITD chapter','public',true,false,false,null,60);

  perform public.ensure_official_room('students-cohort','india-iim','IIM Ahmedabad cohort','IIMA chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','india-iim','IIM Bangalore cohort','IIMB chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','india-iim','IIM Calcutta cohort','IIMC chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','india-iim','IIM Lucknow cohort','IIML chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','india-iim','IIM Kozhikode cohort','IIMK chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','india-iim','IIM Indore cohort','IIMI chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','india-iim','IIM Shillong cohort','IIMShi chapter','public',true,false,false,null,40);
  perform public.ensure_official_room('students-cohort','india-iim','XLRI Jamshedpur cohort','XLRI chapter','public',true,false,false,null,60);

  perform public.ensure_official_room('students-cohort','india-bits','BITS Pilani — Pilani campus','Goa + Hyd + Dubai under here','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','india-bits','BITS Pilani — Goa campus','BITS Goa chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','india-bits','BITS Pilani — Hyderabad campus','BITS Hyd chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','india-bits','BITS Pilani — Dubai campus','BITS Dubai chapter','public',true,false,false,null,40);

  perform public.ensure_official_room('students-cohort','india-other','IISc Bangalore','India''s top research','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','india-other','ISI Kolkata','Stats + math','public',true,false,false,null,40);
  perform public.ensure_official_room('students-cohort','india-other','CMI Chennai','Math + CS undergrad','public',true,false,false,null,40);
  perform public.ensure_official_room('students-cohort','india-other','TIFR Mumbai','Tata fundamental research','public',true,false,false,null,40);
  perform public.ensure_official_room('students-cohort','india-other','IIIT Allahabad','IIITA chapter','public',true,false,false,null,40);

  perform public.ensure_official_room('students-cohort','us-ivy','Harvard','Harvard students + alumni','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','us-ivy','Yale','Yale students + alumni','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','us-ivy','Princeton','Princeton students + alumni','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','us-ivy','Brown','Brown students + alumni','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','us-ivy','Cornell','Cornell students + alumni','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','us-ivy','Columbia','Columbia students + alumni','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','us-ivy','Dartmouth','Dartmouth students + alumni','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','us-ivy','UPenn','UPenn students + alumni','public',true,false,false,null,60);

  perform public.ensure_official_room('students-cohort','us-public','UC Berkeley','Cal students + alumni','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','us-public','UCLA','UCLA students + alumni','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','us-public','UC San Diego','UCSD students + alumni','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','us-public','U Michigan (Ann Arbor)','UMich chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','us-public','UNC Chapel Hill','UNC chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','us-public','UT Austin','UT Austin chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','us-public','Georgia Tech','GT chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','us-public','U Illinois Urbana-Champaign','UIUC chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','us-public','U Wisconsin Madison','UWisc chapter','public',true,false,false,null,40);

  perform public.ensure_official_room('students-cohort','oxbridge','Oxford — undergrad','Tutorial system + life','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','oxbridge','Cambridge — undergrad','Supervisions + life','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','oxbridge','Oxford — postgrad','MSc + DPhil','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','oxbridge','Cambridge — postgrad','MPhil + PhD','public',true,false,false,null,60);

  perform public.ensure_official_room('students-cohort','uk-russell','Imperial College London','Imperial chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','uk-russell','UCL','UCL chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','uk-russell','LSE','LSE chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','uk-russell','King''s College London (KCL)','KCL chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','uk-russell','U Edinburgh','UoE chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','uk-russell','U Manchester','UoM chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','uk-russell','U Warwick','Warwick chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','uk-russell','U Bristol','Bristol chapter','public',true,false,false,null,40);
  perform public.ensure_official_room('students-cohort','uk-russell','U Durham','Durham chapter','public',true,false,false,null,40);

  perform public.ensure_official_room('students-cohort','canada-u15','U Toronto','UofT chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','canada-u15','U British Columbia (UBC)','UBC chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','canada-u15','McGill U','McGill chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','canada-u15','U Waterloo','Waterloo chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','canada-u15','McMaster U','McMaster chapter','public',true,false,false,null,40);
  perform public.ensure_official_room('students-cohort','canada-u15','Queen''s U','Queens chapter','public',true,false,false,null,40);

  perform public.ensure_official_room('students-cohort','australia-go8','U Melbourne','UoM AU chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','australia-go8','U Sydney','USyd chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','australia-go8','ANU','ANU chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','australia-go8','Monash U','Monash chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','australia-go8','UNSW','UNSW chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','australia-go8','U Queensland (UQ)','UQ chapter','public',true,false,false,null,40);

  perform public.ensure_official_room('students-cohort','europe-tech','ETH Zurich','ETHZ chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','europe-tech','EPFL','EPFL chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','europe-tech','TU Munich (TUM)','TUM chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','europe-tech','TU Delft','TUD chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','europe-tech','KTH Stockholm','KTH chapter','public',true,false,false,null,40);
  perform public.ensure_official_room('students-cohort','europe-tech','RWTH Aachen','RWTH chapter','public',true,false,false,null,40);

  perform public.ensure_official_room('students-cohort','asia-china-jp','Tsinghua U','清华 chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','asia-china-jp','Peking U','北大 chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','asia-china-jp','U Tokyo','東大 chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','asia-china-jp','Kyoto U','京大 chapter','public',true,false,false,null,40);
  perform public.ensure_official_room('students-cohort','asia-china-jp','Osaka U','阪大 chapter','public',true,false,false,null,40);

  perform public.ensure_official_room('students-cohort','asia-singapore','NUS','NUS chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','asia-singapore','NTU Singapore','NTU chapter','public',true,false,false,null,80);
  perform public.ensure_official_room('students-cohort','asia-singapore','SMU','SMU chapter','public',true,false,false,null,40);

  perform public.ensure_official_room('students-cohort','asia-korea','Seoul National U (SNU)','서울대 chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','asia-korea','KAIST','KAIST chapter','public',true,false,false,null,60);
  perform public.ensure_official_room('students-cohort','asia-korea','POSTECH','POSTECH chapter','public',true,false,false,null,40);
end$$;

-- ============================================================================
-- 16) students-meta expansion — discussion, wellness, accessibility.
-- ============================================================================
do $$
begin
  perform public.ensure_official_room('students-meta','wellness','Burnout & recovery','For when school is breaking you','public',true,false,false,null,150);
  perform public.ensure_official_room('students-meta','wellness','Anxiety, exams, ADHD','Coping while learning','public',true,false,false,null,120);
  perform public.ensure_official_room('students-meta','wellness','Sleep + circadian','Sleep hygiene swap','public',true,false,false,null,80);
  perform public.ensure_official_room('students-meta','wellness','Nutrition & study','Brain food talk','public',true,false,false,null,60);
  perform public.ensure_official_room('students-meta','accommodations','Dyslexia + accommodations','Tools + advocacy','public',true,false,false,null,60);
  perform public.ensure_official_room('students-meta','accommodations','Low vision / blindness','Screen reader life','public',true,false,false,null,40);
  perform public.ensure_official_room('students-meta','accommodations','Hearing accessibility','Captions + transcripts','public',true,false,false,null,40);
  perform public.ensure_official_room('students-meta','accommodations','Chronic illness + uni','Pacing + flares','public',true,false,false,null,40);
  perform public.ensure_official_room('students-meta','streams','24/7 study with me · global','Stay accountable','public',true,true,false,null,200);
  perform public.ensure_official_room('students-meta','streams','Pomodoro stream · 25/5','Live timer + chat','public',true,true,false,null,150);
  perform public.ensure_official_room('students-meta','streams','Quiet library stream','Silent + ambient','public',true,true,false,null,150);
  perform public.ensure_official_room('students-meta','streams','Whiteboard streams','Open canvas + chat','public',true,true,false,null,100);
  perform public.ensure_official_room('students-meta','first-gen','First-gen students','First in family at uni','public',true,false,false,null,80);
  perform public.ensure_official_room('students-meta','first-gen','First-gen → grad school','Crossing the moat','public',true,false,false,null,40);
  perform public.ensure_official_room('students-meta','study-buddies','Find a study buddy · math','Pair up on problem sets','public',true,false,false,null,100);
  perform public.ensure_official_room('students-meta','study-buddies','Find a study buddy · CS','Pair up on projects','public',true,false,false,null,100);
  perform public.ensure_official_room('students-meta','study-buddies','Find a study buddy · medicine','Anki + cases','public',true,false,false,null,80);
  perform public.ensure_official_room('students-meta','study-buddies','Find a study buddy · law','Cases + briefs','public',true,false,false,null,60);
  perform public.ensure_official_room('students-meta','stupid-questions','No-such-thing-as-a-dumb-question · STEM','Anything goes','public',true,false,false,null,150);
  perform public.ensure_official_room('students-meta','stupid-questions','No-such-thing-as-a-dumb-question · humanities','Anything goes','public',true,false,false,null,100);
  perform public.ensure_official_room('students-meta','past-papers','Past papers · UK A-Level','PDFs + walkthroughs','public',true,false,false,null,80);
  perform public.ensure_official_room('students-meta','past-papers','Past papers · IB','PDFs + walkthroughs','public',true,false,false,null,80);
  perform public.ensure_official_room('students-meta','past-papers','Past papers · IGCSE','PDFs + walkthroughs','public',true,false,false,null,80);
  perform public.ensure_official_room('students-meta','past-papers','Past papers · CBSE','PDFs + walkthroughs','public',true,false,false,null,80);
  perform public.ensure_official_room('students-meta','past-papers','Past papers · JEE','PYQs + solutions','public',true,false,false,null,120);
  perform public.ensure_official_room('students-meta','past-papers','Past papers · NEET','PYQs + solutions','public',true,false,false,null,120);
  perform public.ensure_official_room('students-meta','past-papers','Past papers · USMLE','UWorld breakdowns','public',true,false,false,null,80);
  perform public.ensure_official_room('students-meta','exam-war-rooms','Exam war room · JEE 2026','Final push','public',true,false,false,null,150);
  perform public.ensure_official_room('students-meta','exam-war-rooms','Exam war room · NEET 2026','Final push','public',true,false,false,null,150);
  perform public.ensure_official_room('students-meta','exam-war-rooms','Exam war room · CBSE Class 12 2026','Final push','public',true,false,false,null,150);
  perform public.ensure_official_room('students-meta','exam-war-rooms','Exam war room · A-Levels June 2026','Final push','public',true,false,false,null,80);
  perform public.ensure_official_room('students-meta','exam-war-rooms','Exam war room · IB May 2026','Final push','public',true,false,false,null,80);
  perform public.ensure_official_room('students-meta','exam-war-rooms','Exam war room · GCSE June 2026','Final push','public',true,false,false,null,80);
  perform public.ensure_official_room('students-meta','exam-war-rooms','Exam war room · SAT — next test date','Drills + check-ins','public',true,false,false,null,80);
  perform public.ensure_official_room('students-meta','mentorship','Mentor me · CS → SDE','Find a senior in CS','public',true,false,false,null,120);
  perform public.ensure_official_room('students-meta','mentorship','Mentor me · medicine → residency','Med mentors','public',true,false,false,null,80);
  perform public.ensure_official_room('students-meta','mentorship','Mentor me · finance → IBD/PE','Finance mentors','public',true,false,false,null,80);
  perform public.ensure_official_room('students-meta','mentorship','Mentor me · academia → grad school','Profs + grad students','public',true,false,false,null,60);
  perform public.ensure_official_room('students-meta','office-hours','Volunteer office hours · math','Free help, rotating volunteers','listed',true,false,true,'helpers',60);
  perform public.ensure_official_room('students-meta','office-hours','Volunteer office hours · CS','Free help, rotating volunteers','listed',true,false,true,'helpers',60);
  perform public.ensure_official_room('students-meta','office-hours','Volunteer office hours · biology','Free help, rotating volunteers','listed',true,false,true,'helpers',60);
  perform public.ensure_official_room('students-meta','office-hours','Volunteer office hours · physics','Free help, rotating volunteers','listed',true,false,true,'helpers',60);
end$$;
