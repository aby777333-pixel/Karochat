-- Karochat — v9 Phase 3 sex-ed seed (part 2 of 4): 16-17 tier (first batch of 4).
-- Covers readiness, contraception, STIs, masturbation.

insert into public.sex_ed_articles
  (slug, title, body_markdown, topic, age_band, language, published, created_at)
values

('am-i-ready-for-sex',
 'Am I ready for sex?',
 $art$
"Ready" isn't an age. It's a set of conditions you can check honestly with yourself.

### Signs you're not there yet
- You'd only do it because they want to.
- You'd be okay with it but secretly hope something interrupts.
- You can't say the word out loud, in your head, without flinching.
- You haven't talked about contraception or STIs because the conversation feels too embarrassing.
- You're worried about being dumped if you say no.

### Signs you might be
- You want to — not just want them to want you to.
- You can talk to your partner about what to do if a condom breaks, what protection you'll use, and what you'll do if a test comes back positive for something.
- You know how to access contraception and STI testing in your city.
- You'd feel okay if your partner changed their mind mid-way and stopped.
- You'd feel okay if you changed your mind mid-way and stopped.

### Things that don't actually matter
- How long you've been dating.
- How many of your friends have already done it.
- "Everyone our age".
- A specific birthday.
- Whether you'll seem "uncool".

### "First time" doesn't only mean penis-in-vagina
First-time anything — first kiss, first time someone touches you under your clothes, first time you touch yourself in front of them, first time naked together, first time using your mouth, first time penetration of any kind — is a first time worth thinking about. Each has its own readiness check.

### LGBTQ first times
There's no script for first times that don't fit the straight, cis playbook. Pace yourself. Talk a lot. You're allowed to stop and Google a thing. You're allowed to laugh when it's awkward. You're allowed to do something once and decide that's not for you.

### A practical pre-conversation list
Before any first time, you and your partner should be able to answer:
1. What protection are we using?
2. Where can we get it tonight if we run out?
3. What's our STI status, and when were we last tested?
4. Where can we go if a condom breaks or someone misses a pill?
5. What's our signal to stop, no questions asked?
6. Do we both actually want this — without pressure, alcohol, or the clock?

If you can't have that conversation comfortably, you're not ready to do the thing. **The conversation is harder than the act for almost everyone, and that's a feature, not a bug.**
$art$,
 'readiness', '16_17', 'en', true, now() - interval '4 minutes'),

('contraception-every-method-explained',
 'Contraception: every method explained',
 $art$
There is no "best" method — there's the best method **for your body, your life, and this year**. People often switch over time.

### Hormonal methods
- **The pill** — taken daily. 99% effective with perfect use, ~91% with typical use (because remembering daily is hard). Some shrink periods, reduce acne, ease cramps. Can cause mood, weight, or libido changes for some.
- **Patch / ring** — once a week or once a month. Same hormones as the pill, different delivery.
- **The shot (Depo-Provera)** — every 3 months. Convenient but periods can disappear; fertility can take 6-12 months to return after stopping.
- **Hormonal IUD (Mirena, Kyleena, Liletta)** — placed in the uterus, lasts 3-8 years. >99% effective. Periods get lighter or stop. Insertion is uncomfortable but quick.
- **Implant (Nexplanon)** — matchstick-sized rod under the skin of the upper arm. 3 years, >99% effective.

### Non-hormonal methods
- **Copper IUD (Paragard)** — 10-12 years. >99% effective. Periods may get heavier and crampier.
- **Condoms (external / "male")** — the only common method that also reduces STI transmission. ~98% effective with perfect use, ~85% with typical use. Use water- or silicone-based lube, not oil.
- **Condoms (internal / "female")** — inserted into the vagina or anus before sex. Also reduces STIs. ~95% perfect, ~79% typical.
- **Diaphragm / cervical cap** — with spermicide. Lower-effectiveness, but hormone-free.
- **Spermicide** — alone, ~85% perfect / ~71% typical. Pair with something else.

### Emergency contraception (after the fact)
- **Levonorgestrel ("Plan B", "i-pill", "Unwanted-72")** — most effective within 72 hours, somewhat effective up to 5 days. Available without prescription at most Indian pharmacies. Less effective above ~70-80 kg.
- **Ulipristal acetate ("ella")** — more effective for higher body weight; up to 5 days.
- **Copper IUD inserted within 5 days** — the most effective EC available, and then you have a long-term method too.

EC is not an abortion. It works by delaying ovulation. It's safe.

### Permanent methods (for adults certain of decision)
- **Tubal ligation / salpingectomy** — surgical.
- **Vasectomy** — outpatient procedure. Easier, cheaper, and lower-risk than tubal ligation. Often reversible but plan as if it isn't.

### Things that are not contraception
- Withdrawal ("pulling out") alone — ~78% typical effective. Use only as a backup, not a primary method.
- "Tracking" alone — fertility-awareness methods can work but require commitment and accurate cycles.
- Lactation — partial; not reliable on its own past 6 months postpartum.
- "Just this once".

### Where to get it (India)
Most pharmacies stock condoms and emergency contraception without prescription. For hormonal methods and IUDs, see a gynaecologist; many cities have **Marie Stopes** clinics and **Family Planning Association of India** centres with discreet, low-cost services. Government CHCs offer free condoms and pills.

### Talking to a partner about contraception
"I want to use X. Can we?" is a complete sentence. A partner who refuses to use the protection you've chosen is a partner who doesn't get to have sex with you.
$art$,
 'contraception', '16_17', 'en', true, now() - interval '5 minutes'),

('stis-prevention-testing-and-treatment',
 'STIs: prevention, testing, and treatment',
 $art$
Sexually transmitted infections are common, mostly treatable, and almost never visible — which is why testing is the actual safety net, not "they look healthy".

### The ones to know
- **Chlamydia, gonorrhoea** — bacterial, treated with antibiotics. Often no symptoms. Untreated, can damage fertility.
- **Syphilis** — bacterial, treated with antibiotics. Big resurgence globally; presents in stages.
- **HIV** — viral. Modern treatment makes it a chronic, manageable condition. **Undetectable = Untransmittable (U=U):** people on consistent treatment with an undetectable viral load do not transmit HIV sexually.
- **Herpes (HSV-1 / HSV-2)** — viral, lifelong, manageable with antivirals. Very common — most adults have HSV-1. Stigma is worse than the infection for most people.
- **HPV** — viral. Some strains cause genital warts, some cause cancers. **Vaccinate** (Gardasil, ideally before sexual debut, but useful through age 26+).
- **Trichomoniasis** — parasitic, single-dose treatment.
- **Hepatitis B** — viral, vaccine-preventable; check your vaccination status.

### Prevention layers (stack them)
- **Condoms (internal or external)** for vaginal, anal, and oral sex (yes, oral — for STIs other than pregnancy).
- **Dental dams** for cunnilingus and anilingus (oral on a vulva or anus).
- **PrEP** — daily pill or injection that prevents HIV. Highly effective. Available in India through clinics and organisations like **Humsafar Trust**, **Lakshya**, **Sahodaran**.
- **PEP** — emergency 28-day HIV-prevention course. Start within 72 hours of possible exposure.
- **HPV + Hep B vaccines** — both highly effective; ask a doctor.

### How often to test
- After every new partner.
- Every 3-6 months if you have multiple partners.
- Annually as a baseline if you're sexually active at all.
- Before stopping condoms in a new relationship.

### What a "full test" usually covers
- Blood: HIV, syphilis, hep B/C.
- Urine: chlamydia, gonorrhoea.
- Swab: throat and rectum if you've had oral or anal sex (this is the part many clinics skip — ask for it).
- Visual exam for herpes / HPV if there's something to look at.

### Where to test (India)
- **ICTC centres** (Integrated Counselling and Testing Centres) — free HIV testing at government hospitals.
- **YRG CARE** (Chennai), **Humsafar Trust** (Mumbai) — sex-positive, confidential, often queer-friendly.
- Most private labs run "STI panels" — call ahead about which infections are included.
- **Home self-test kits** — available in some Indian cities, useful for HIV.

### If something comes back positive
- Bacterial (chlamydia, gonorrhoea, syphilis) → antibiotic course; partner(s) need treatment too.
- Viral (HIV, herpes, HPV) → manageable with care, partner conversation, and sometimes vaccines/antivirals.
- **It doesn't mean anyone cheated.** Most STIs can sit symptomless for months or years.

### How to tell partners
Direct beats clever. "I tested positive for X. You should get tested." Apps like **Tell Your Partner** (US) and the Indian Ministry of Health's anonymous notification SMS service exist if you'd rather notify without the conversation.

The shame attached to STIs is older than the medicine and far less accurate. **Tested, treated, communicating — that's the actual gold standard.**
$art$,
 'sti', '16_17', 'en', true, now() - interval '6 minutes'),

('masturbation-and-solo-pleasure',
 'Masturbation and solo pleasure',
 $art$
Masturbation is the safest, lowest-stakes way to learn what your body likes. **It doesn't waste anything. It doesn't damage anything. It doesn't change your face, your stamina, your spine, or your relationship with God.** Most people across most cultures masturbate; many don't talk about it.

### What it's useful for
- Learning your own anatomy and what feels good.
- Falling asleep.
- Easing menstrual cramps (for some).
- Reducing stress.
- Knowing what to ask for from a partner later — you can't tell someone what works if you've never tried.

### The "is something wrong with me?" list — usually no
- Doing it daily: fine.
- Doing it once a month: fine.
- Doing it never: fine — some asexual and demisexual people don't, and that's also fine.
- Taking a long time: fine.
- Finishing quickly: fine.
- Needing fantasy to finish: extremely common.
- Needing porn to finish: also common — and worth keeping an eye on (see below).

### A note on porn
Porn is a performance, not a documentary. If a lot of your masturbation is paired with porn, two real things to notice:
1. **Porn-induced expectation** — bodies, durations, and reactions in porn are heavily curated. Real bodies don't always look or behave that way. Real partners aren't camera-aware.
2. **Habituation** — using more extreme content over time, or struggling to feel anything without it, is worth taking a break to reset. It usually rebalances within weeks.

Neither of these means you're broken. It means the medium is loud and your nervous system is paying attention.

### What feels good is personal
For vulvas, the **clitoris** has ~10,000 nerve endings — most of the pleasure-relevant ones. Stroke around the clitoral hood, not just directly on the head (which is often too sensitive for direct touch). External-only orgasm is the norm, not the exception.

For penises, most stimulation is the **frenulum** (the soft fold underneath, just below the head) and the head itself. Most people learn one grip and assume that's the only way — try slowing down, varying pressure, adding lubricant (saliva works in a pinch; proper lube works better and isn't drying).

For nipples, ears, scalp, inner thighs, perineum — every body has more pleasure zones than the obvious ones. Explore.

### A small permission slip
You're allowed to do this. You're allowed to enjoy it. You're allowed to tell future partners "I learned that I like X by myself" — and they'll be relieved that one of you already knows the answer.
$art$,
 'pleasure', '16_17', 'en', true, now() - interval '7 minutes')

on conflict (slug) do update set
  title = excluded.title,
  body_markdown = excluded.body_markdown,
  topic = excluded.topic,
  age_band = excluded.age_band,
  language = excluded.language,
  published = excluded.published,
  updated_at = now();
