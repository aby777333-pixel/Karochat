-- Karochat — Sex-ed library: more chapters.
--
-- Adds educational, consent- and safety-forward articles across the existing
-- topics (contraception, STIs, consent, safety, puberty, readiness, queer,
-- relationships, identity, pleasure), mapped to the existing /sexed groups and
-- age bands. Additive + idempotent (on conflict (slug) do update). Nothing
-- existing is changed.

insert into public.sex_ed_articles (slug, title, body_markdown, topic, language, age_band, published)
values
('contraception-options-guide', 'Contraception: your options at a glance',
$a$There's no single "best" contraceptive — the best one is the one you'll actually use consistently, that fits your body and life.

**Common methods:**
- **Condoms** — the only method that also lowers STI risk. Use them every time.
- **The pill** — taken daily; needs routine to work well.
- **Implant / injection / IUD** — "fit and forget" for months or years; very effective.
- **Emergency contraception** — a backup after unprotected sex, not a regular method.

**Choosing:**
- Think about effectiveness, side-effects, how often you must think about it, and STI protection.
- Many people pair condoms (for STIs) with a longer-acting method (for pregnancy) — "double Dutch".

A clinician or family-planning clinic can talk you through what suits you, often free and confidential.

*Education, not medical advice.*$a$,
'contraception', 'en', '16_17', true),

('emergency-contraception', 'Emergency contraception, explained',
$a$Emergency contraception (EC) helps prevent pregnancy after unprotected sex, a burst condom, or a missed pill. It is a backup — not a routine method.

**Two main kinds:**
- **EC pills** ("morning-after pill") — work best the sooner you take them; some work up to 3 days, others up to 5. Available at pharmacies in many places.
- **Copper IUD** — fitted by a clinician within ~5 days; also becomes ongoing contraception.

**Good to know:**
- EC does not cause an abortion; it mainly delays ovulation.
- It does not protect against STIs — consider testing if the sex was unprotected.
- If your period is very late afterwards, take a pregnancy test.

Sooner is better, so don't wait. A pharmacist or clinic can advise quickly and confidentially.

*Education, not medical advice.*$a$,
'contraception', 'en', '16_17', true),

('condoms-how-to', 'How to use a condom correctly',
$a$Used properly, condoms are great at preventing both pregnancy and STIs. Most "failures" are actually user error.

**Step by step:**
- Check the expiry date and that the packet has an air bubble (intact). Open carefully — no teeth or scissors.
- Pinch the tip to leave space, and roll it all the way down once erect, before any genital contact.
- Use plenty of water- or silicone-based lube (oil damages latex).
- After ejaculation, hold the base and withdraw while still firm. Tie it off and bin it — never flush or reuse.

**Tips:** one at a time (never two), and switch to a fresh one between different types of sex. If it breaks, stop and consider emergency contraception and STI testing.

*Education, not medical advice.*$a$,
'contraception', 'en', '16_17', true),

('sti-testing-basics', 'STI testing: what, when and why',
$a$Getting tested is a normal, responsible part of a healthy sex life — not something to be ashamed of. Many STIs have no symptoms, so testing is the only way to know.

**When to test:**
- Before sex with a new partner (and ask them to as well).
- After unprotected sex or a condom mishap.
- Regularly if you have multiple partners — every few months is common.

**What it involves:** usually a urine sample, a swab, and/or a blood test. Many clinics are free, fast and confidential; home test kits also exist.

**If a test is positive:** most STIs are easily treated, and the rest are manageable. Tell recent partners so they can test too — clinics can help you do this anonymously.

Testing protects you and the people you care about.

*Education, not medical advice.*$a$,
'sti', 'en', '16_17', true),

('hiv-prep-pep', 'HIV, PrEP and PEP explained',
$a$HIV is a manageable condition today, and there are powerful tools to prevent it.

- **PrEP** (pre-exposure prophylaxis): medicine taken *before* possible exposure that makes getting HIV extremely unlikely. Good for people at higher risk.
- **PEP** (post-exposure prophylaxis): emergency medicine started *within 72 hours* after a possible exposure, taken for ~28 days. Sooner is better — treat it as urgent.
- **U=U** (Undetectable = Untransmittable): a person on effective treatment with an undetectable viral load cannot pass HIV on sexually.

Condoms still help against HIV and other STIs. A sexual-health clinic can advise on PrEP, PEP and testing — often free and confidential.

*Education, not medical advice. If you think you've been exposed, seek PEP urgently.*$a$,
'sti', 'en', '18plus', true),

('consent-enthusiastic', 'Enthusiastic consent, in plain words',
$a$Consent means everyone involved actively, freely wants what's happening — not just "didn't say no".

**It is:** a clear, enthusiastic *yes*; freely given (no pressure, threats, or someone too drunk/high to decide); specific (yes to one thing isn't yes to everything); and reversible — anyone can change their mind at any point.

**In practice:** ask and check in — "is this ok?", "do you want to…?", "want to keep going?". Watch body language as well as words; if someone goes quiet, tense or unsure, pause and ask.

Silence, a freeze response, or being asleep are **not** consent. And nobody owes anybody sex — not after a date, a gift, or a relationship.

Good lovers make consent part of the fun, not an awkward formality.

*Education, not legal advice.*$a$,
'consent', 'en', '13_15', true),

('online-safety-sexting', 'Sexting & staying safe online',
$a$If you choose to share intimate messages or images, do it as safely as you can — and know the risks.

**Before you send:**
- Only ever with someone you trust, and only if *you* want to (never under pressure).
- Once it's sent, you lose control of it. Could you live with it being shared?
- Keep faces and identifying details (tattoos, room, uniform) out where you can.

**The law:** sharing sexual images of anyone under 18 is illegal — even of yourself. And sharing someone's private images without consent ("revenge porn") is a crime in many places.

**If an image is shared or you're threatened:** it's not your fault. Save evidence, don't pay blackmailers, and tell a trusted adult or a helpline. Many platforms and services can help get images removed.

*Education, not legal advice.*$a$,
'safety', 'en', '16_17', true),

('puberty-what-changes', 'Puberty: what changes and when',
$a$Puberty is your body maturing — it starts and finishes at different times for everyone (roughly ages 8–14 to begin), and that's all normal.

**Common changes:** growth spurts; body hair; skin and hair getting oilier (hello, spots); stronger body odour; and mood ups and downs as hormones shift.

- **For many girls:** breasts develop and periods begin.
- **For many boys:** the voice deepens, the genitals grow, and erections and wet dreams happen.

Comparing yourself to friends rarely helps — bodies run on their own clock. There's a wide range of "normal" for height, shape, and timing.

If something worries you — pain, very early/late changes, or feeling low — talk to a parent, school nurse, or doctor.

*Education, not medical advice.*$a$,
'puberty', 'en', '13_15', true),

('menstrual-health', 'Periods & menstrual health',
$a$A period is the monthly shedding of the womb lining — a normal, healthy sign your body is working.

**The basics:** cycles average ~28 days but anywhere from 21–35 is common; bleeding lasts ~2–7 days. Early periods can be irregular for a year or two.

**Managing it:** pads, tampons, period pants or menstrual cups all work — use what's comfortable (change tampons regularly). A hot-water bottle, gentle movement and pain relief help cramps.

**See someone if:** periods are extremely heavy or painful, stop for months (and pregnancy is possible), or come with fever — these are worth checking.

Periods are nothing to be ashamed of, and everyone deserves products and clean facilities to manage them with dignity.

*Education, not medical advice.*$a$,
'puberty', 'en', '13_15', true),

('first-time-readiness', 'Am I ready? Thinking it through',
$a$There's no "right age" beyond the legal one, and no rush. Ready means *you* want it — not your partner, your friends, or the moment pushing you.

**Signs you might be ready:**
- You can talk openly with your partner about protection and boundaries.
- You both genuinely want to, free of pressure.
- You'd be okay if the relationship changed afterwards.
- You know how you'll prevent pregnancy and STIs.

**Signs to wait:** doing it to keep someone, to fit in, or because you feel you "should". Those rarely feel good afterwards.

Whatever you decide, you can change your mind at any point — before or during. "Not yet" is a complete answer.

*Education, not advice about your specific situation.*$a$,
'readiness', 'en', '16_17', true),

('queer-coming-out', 'Coming out, at your own pace',
$a$Coming out is sharing that you're LGBTQ+ — and it's always *your* choice: whether, when, how, and to whom. There's no deadline and no single right way.

**Some things that help:**
- Start with someone you trust to be kind. You don't have to tell everyone at once.
- Your identity is valid whether or not anyone else "gets it" — and it can evolve.
- Have a support in place: a friend, a group, or an LGBTQ+ helpline.

**Safety first:** if coming out could put your housing or safety at risk, it's completely okay to wait until you're independent or in a safer place.

You are not alone, and you don't owe anyone an explanation or a label before you're ready.

*Education and support, not advice about your specific situation.*$a$,
'queer', 'en', '13_15', true),

('healthy-relationships-signs', 'Green flags & red flags in relationships',
$a$Healthy relationships feel safe, respectful and free — you can be yourself.

**Green flags:** you can disagree without fear; your "no" is respected; they're happy for you to have friends, hobbies and space; honesty and apologies go both ways; you feel calmer, not anxious.

**Red flags:** controlling who you see or what you wear; constant jealousy or checking your phone; put-downs "as a joke"; pressure for sex or photos; blaming you for their anger; or threats. Love-bombing then control is a pattern, not romance.

**If it's unhealthy:** it's not your fault, and "they only do it because they love me" isn't love. Talk to someone you trust, and reach out to a local helpline — leaving can be hard, and support helps.

You deserve to feel respected and free.

*Education and support, not advice about your specific situation.*$a$,
'relationships', 'en', 'all', true)
on conflict (slug) do update
  set title = excluded.title,
      body_markdown = excluded.body_markdown,
      topic = excluded.topic,
      language = excluded.language,
      age_band = excluded.age_band,
      published = excluded.published;
