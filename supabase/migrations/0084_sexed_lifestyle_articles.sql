-- Karochat — Sex-ed library expansion: adult relationship & lifestyle topics.
--
-- Adds published 18+ articles covering casual dating, FWB, open/poly/ENM,
-- swinging, relationship dynamics, orientations, naturism, mature dating,
-- lifestyle events, and safer sex with multiple partners — mapped to the
-- existing /sexed topic groups so they slot straight into the library.
--
-- Educational, consent- and safety-forward. Additive + idempotent
-- (on conflict (slug) do update). Nothing existing is changed.

insert into public.sex_ed_articles (slug, title, body_markdown, topic, language, age_band, published)
values
('casual-dating-nsa', 'Casual dating & no-strings connections',
$a$Casual or "no-strings-attached" (NSA) dating means enjoying connection — dates, companionship, sometimes sex — without building toward a committed relationship. Done well, it's honest and fun. Done badly, someone gets hurt.

**Make it work:**
- Say what you want up front. "I'm looking for something casual" saves everyone pain.
- Check in. Feelings can change; a quick "are we still on the same page?" keeps it clean.
- Keep using protection and get tested regularly — casual doesn't mean careless.
- Respect a "no" instantly, and give them the same right to walk away.
- Don't ghost. A short, kind message beats silence.

Casual works best between people who are clear, considerate, and free to choose. If you notice you're catching feelings, name it — you're allowed to renegotiate or step back.

*Education, not medical advice. For testing and contraception, see a clinician.*$a$,
'relationships', 'en', '18plus', true),

('friends-with-benefits', 'Friends with benefits, without the mess',
$a$A "friends with benefits" (FWB) arrangement adds physical intimacy to a friendship without romance or commitment. The hard part isn't the sex — it's protecting the friendship and each other's feelings.

**Ground rules that help:**
- Agree what this is (and isn't) before, not after.
- Talk about exclusivity and protection — are you seeing others? Get tested.
- Decide how you'll handle it if one of you starts catching feelings.
- Keep some normal-friend time so it doesn't become only sex.
- Either person can end the "benefits" without ending the friendship — ideally.

FWB suits people who genuinely like each other, communicate easily, and want low-pressure intimacy. If jealousy, secrecy, or resentment creep in, pause and talk honestly.

*This is general education, not relationship therapy.*$a$,
'relationships', 'en', '18plus', true),

('hookups-safety', 'Hookups & first-meet safety',
$a$Meeting someone new for a casual encounter can be exciting — and safe, if you plan a little.

**Before you meet:**
- Video-call or voice-call first to confirm they're real.
- Tell a trusted friend where you're going and who with; share your live location.
- Meet first in public if you can; arrange your own transport home.

**During:**
- Trust your gut — you can leave at any moment, for any reason.
- Watch your drink; don't leave it unattended.
- Carry and use barrier protection (condoms); discuss boundaries and a stop word.

**After:**
- Check in with your friend. Get tested a couple of weeks later.

Consent is ongoing and can be withdrawn at any time. Alcohol or drugs can make consent impossible — when in doubt, stop.

*If you're ever hurt or coerced, that's assault — reach out to a local helpline or the police.*$a$,
'safety', 'en', '18plus', true),

('open-relationships', 'Open relationships, explained',
$a$An open relationship is a committed partnership where both people agree that one or both may have sexual (and sometimes romantic) connections with others. The foundation is honesty and mutual agreement — not secrecy.

**It tends to work when partners:**
- Open up from a *strong* place, not to patch a broken relationship.
- Agree clear rules (who, what, when, safer-sex, what you tell each other).
- Keep talking — agreements get revisited as feelings surface.
- Treat outside partners as people, with respect and honesty too.

**Common pitfalls:** using "open" to avoid breaking up, unequal rules, or one partner agreeing under pressure. Opening up should be a free, enthusiastic *yes* from both.

There's no single right model — the healthiest one is the one you both genuinely choose.

*General education. A poly-aware counsellor can help couples navigate this.*$a$,
'relationships', 'en', '18plus', true),

('polyamory-basics', 'Polyamory: loving more than one',
$a$Polyamory is having multiple loving relationships at once, with everyone's knowledge and consent. It's about *love and relationships*, not just sex, and it comes in many shapes — from a close "polycule" to independent solo-poly living.

**Core ideas:**
- **Consent & honesty:** everyone involved knows and agrees.
- **No hierarchy is required, but many use one** (e.g. a "primary" partner) — say which you want.
- **Communication is the skill** — scheduling, needs, jealousy, and check-ins.
- **Time and energy are real limits** — be honest about what you can give.

Polyamory isn't cheating (cheating is breaking agreements) and isn't a fix for an unhappy relationship. It asks for more communication than monogamy, not less.

*Education only. Books like "The Ethical Slut" and "Polysecure" go deeper.*$a$,
'relationships', 'en', '18plus', true),

('ethical-non-monogamy', 'Ethical non-monogamy: the ground rules',
$a$Ethical non-monogamy (ENM) is an umbrella for any relationship style where people have more than one partner *with everyone's informed consent* — open relationships, polyamory, swinging, relationship anarchy and more.

**The "ethical" part means:**
- **Informed consent** from everyone involved — no deceiving anyone.
- **Honesty** about other partners, status, and safer-sex practices.
- **Respect** for agreed boundaries — and renegotiating them openly, not breaking them.
- **Care** for outside partners' feelings and health, not just your own.

ENM isn't a loophole for cheating, and it isn't for everyone — and that's fine. What makes it healthy is the same thing that makes monogamy healthy: communication, respect, and consent.

*General education, not advice for your specific relationship.*$a$,
'relationships', 'en', '18plus', true),

('swinging-intro', 'The swinging lifestyle: a respectful primer',
$a$"Swinging" usually means committed couples (and singles) who share recreational sexual experiences with others, often together, as a shared activity rather than separate romances.

**If you're curious:**
- Talk *thoroughly* with your partner first — motivations, limits, jealousy, and a plan to stop if either feels off.
- Agree rules together (same room only? safer-sex always? no exchanging numbers?).
- Newcomers often start by watching/socialising at lifestyle events before anything physical.
- Consent and "no pressure" are the culture — a respectful "no thanks" is always fine.
- Use barrier protection and test regularly; many in the community take STI testing seriously.

The healthiest swinging is unhurried, honest, and equally wanted by both partners. If one says yes only to please the other, slow down.

*Education only — every couple's comfort is different.*$a$,
'relationships', 'en', '18plus', true),

('jealousy-compersion', 'Jealousy, compersion & big feelings',
$a$Jealousy isn't a character flaw — it's information. In any non-monogamous arrangement (and plenty of monogamous ones), it shows up. The goal isn't to never feel it, but to handle it well.

**Working with jealousy:**
- Get specific: is it fear of being replaced? Left out? Not enough time? Name the real need under it.
- Ask for reassurance or a concrete change, rather than a rule made in panic.
- Self-soothe too — your security can't be entirely someone else's job.

**Compersion** is the opposite, joyful feeling — being happy that your partner is happy with someone else. Many people grow into it with time and trust.

Big feelings are normal. Talk about them early, kindly, and often.

*General education. A counsellor can help if jealousy feels overwhelming.*$a$,
'relationships', 'en', '18plus', true),

('boundaries-agreements', 'Boundaries & agreements in non-monogamy',
$a$Boundaries are about *you* ("I need to know before you stay overnight"); agreements are shared *rules* ("we always use condoms with others"). Both keep multi-partner relationships safe and kind.

**Useful things to agree on:**
- Safer-sex practices and testing schedules.
- What you do and don't want to know about other partners.
- Time, sleepovers, and how you protect your core relationship.
- Whether partners can meet, and how new people are introduced.
- A way to pause and renegotiate when something isn't working.

Good agreements are specific, mutual, and revisited — not set in stone forever. A boundary is yours to hold; you don't get to control another adult, only decide your own response.

*Education only — write your own agreements together, honestly.*$a$,
'consent', 'en', '18plus', true),

('threesomes-group-play', 'Threesomes & group play (MFM, FMF & more)',
$a$Group play — threesomes (MFM = two men + one woman, FMF = two women + one man, and many other combinations), foursomes, or larger — can be a fun shared adventure when everyone's enthusiastic and informed.

**Make it good for everyone:**
- Talk first: who does what with whom, hard limits, and a clear stop word.
- Everyone is an equal participant — no one is a prop. Enthusiastic consent from *all*.
- Plenty of barrier protection; change condoms between partners to avoid passing infections.
- Decide in advance how you'll handle jealousy or someone wanting to stop.
- Aftercare matters — check in with each other emotionally afterwards.

If you're introducing a third into a couple, protect your relationship: agree boundaries, and either person can call it off, no questions asked.

*General education. Get STI-tested regularly if you have multiple partners.*$a$,
'technique', 'en', '18plus', true),

('cuckold-hotwife', 'Cuckolding & hotwifing: dynamics & consent',
$a$Cuckolding and hotwifing are consensual fantasy dynamics where one partner enjoys their partner being intimate with someone else — sometimes watching, sometimes just hearing about it. The thrill, for many, is the trust and the mix of emotions, not humiliation unless that's specifically wanted.

**Keep it healthy:**
- It only works as an *enthusiastically shared* fantasy — never pressure a partner into it.
- Talk through exactly what's wanted: watching? Just stories? A real third person?
- Agree firm boundaries, safer-sex rules, and a way to stop instantly.
- Choose third parties who respect your relationship and your rules.
- Debrief and reconnect afterwards — reassurance keeps the bond strong.

Like all kink, the rules are: safe, sane, consensual, and reversible the moment anyone wants out.

*Education only — these are adult, consensual dynamics, not a relationship prescription.*$a$,
'kink', 'en', '18plus', true),

('bisexuality-explained', 'Bisexuality, explained',
$a$Bisexual people are attracted to more than one gender. That attraction can be equal or not, and it can shift over time — bisexuality is real whether or not you've dated multiple genders, and it doesn't disappear when you're in any one relationship.

**Worth knowing:**
- Bi, pan, queer, and fluid are related labels — use whichever fits you; you can change your mind.
- Being bi isn't "a phase," "greedy," or "halfway to gay/straight." It's its own complete identity.
- Bi people exist in straight-looking and queer-looking relationships alike.
- "Bi erasure" — having your identity doubted — is common; you don't owe anyone proof.

You define your own orientation. There's no test to pass and no quota to meet.

*Education and affirmation, not a label you must adopt.*$a$,
'queer', 'en', '18plus', true),

('queer-dating', 'Queer dating & finding your people',
$a$Queer dating has its own joys and challenges — smaller dating pools in some places, figuring out who's "family," and balancing safety with openness.

**Helpful pointers:**
- Find community first: queer-friendly rooms, events, sports, and online spaces make dating feel less like a needle in a haystack.
- Be clear about your identity and what you're looking for — labels help others find you.
- Safety: in less-accepting areas, meet in known-safe spaces and tell a friend.
- Communicate about bodies, words, and boundaries — everyone's relationship with their body is different.
- Rejection isn't a verdict on your worth; the right people exist.

Whether you want something casual, a partner, or chosen family, you deserve connection that's safe and affirming.

*General education. Local LGBTQ+ orgs can point you to safe community spaces.*$a$,
'queer', 'en', '18plus', true),

('naturism-nudism', 'Naturism & clothing-optional living',
$a$Naturism (or nudism) is the practice of going without clothes — at home, on certain beaches, or at clothing-optional resorts and events — for comfort, freedom, and body acceptance. Importantly, **naturism is non-sexual**; it's about being at ease in your own skin.

**Etiquette & safety:**
- Consent and respect rule: no staring, no photos without explicit permission, no sexual behaviour in naturist spaces.
- Sit on your own towel; carry one everywhere for hygiene.
- Only undress where it's legal and welcome — designated beaches, clubs, or private property.
- Everyone's body belongs there; naturism is famously body-positive and all-ages-of-adulthood friendly.

Many people find it relaxing and confidence-building. Start somewhere established and welcoming if you're new.

*Education only. Check local laws — public nudity rules vary widely.*$a$,
'identity', 'en', '18plus', true),

('mature-dating-intimacy', 'Dating & intimacy at 40, 50, 60+',
$a$Desire and connection don't have an expiry date. Dating later in life — after divorce, loss, or simply solo for a while — can be freeing, with more self-knowledge and less to prove.

**Things that help:**
- Know what you want this time; you've earned the right to be choosy.
- Bodies change — lubrication, erections, energy, and recovery shift with age and health. That's normal and often manageable; talk to a doctor about options.
- Keep practising safer sex: STIs rise among older adults, partly because pregnancy isn't a worry. Use protection and test.
- Online and in-person communities for mature singles make meeting easier.

Intimacy can be slower, more communicative, and more satisfying with experience. Confidence is attractive at every age.

*General education. Discuss medication, heart health, and sexual function with your doctor.*$a$,
'relationships', 'en', '18plus', true),

('lifestyle-events-clubs', 'Lifestyle clubs, parties & events: what to expect',
$a$Lifestyle and "play" parties, clubs, and travel meetups are social spaces for open-minded adults. First-timers are usually welcome — and the vibe is friendlier and more rules-based than people expect.

**Newcomer tips:**
- Read the rules before you go: dress code, photography (usually banned), and consent policy.
- "No means no, and no answer means no." Ask before touching anyone or anything.
- You're never obligated to do anything — watching and socialising is completely fine.
- Go with your partner on the same page about limits and a signal to leave.
- Hygiene and safer-sex supplies are expected; respect staff and other guests.

The culture is built on consent and discretion. If a place or person doesn't respect that, leave.

*Education only. Choose reputable, well-reviewed venues and events.*$a$,
'relationships', 'en', '18plus', true),

('safer-sex-multiple-partners', 'Safer sex with multiple partners',
$a$More partners means a bit more planning to stay healthy — and it's very doable.

**The toolkit:**
- **Barriers:** condoms and dental dams for vaginal, anal, and oral sex; change condoms between partners and between body parts.
- **Testing:** get a full STI screen regularly (many people test every 3 months or before new partners) and share status honestly.
- **Vaccines:** HPV and hepatitis B vaccines protect you — ask your clinic.
- **PrEP:** if HIV is a risk for you, PrEP is highly effective — talk to a doctor.
- **Communication:** agree safer-sex rules with partners and stick to them; tell partners promptly if you test positive for anything.

Pleasure and protection go together. A routine makes it effortless.

*This is general education. A sexual-health clinic can advise on testing, PrEP, and vaccines for you.*$a$,
'sti', 'en', '18plus', true),

('consent-group-settings', 'Consent in group & party settings',
$a$Consent is just as essential in groups, parties, and lifestyle events as one-on-one — arguably more, because there are more people and more moving parts.

**The essentials:**
- Ask, specifically, before touching anyone — and accept "no" or hesitation gracefully.
- Consent is per-person and per-act: agreeing to one thing, or with one person, isn't agreeing to everything or everyone.
- Intoxication limits consent. Someone very drunk or high can't meaningfully agree.
- Anyone can withdraw consent at any time, including mid-activity — stopping is non-negotiable.
- Look out for each other; if someone seems uncomfortable, check in or speak up.

Great group experiences are built on enthusiastic, ongoing, freely-given yeses. When in doubt, pause and ask.

*Education only. Coercion or sex without consent is assault — seek help from a local helpline.*$a$,
'consent', 'en', '18plus', true)

on conflict (slug) do update
  set title = excluded.title,
      body_markdown = excluded.body_markdown,
      topic = excluded.topic,
      age_band = excluded.age_band,
      published = true,
      updated_at = now();
