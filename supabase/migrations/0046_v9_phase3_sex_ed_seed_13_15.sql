-- Karochat — v9 Phase 3 sex-ed seed (part 1 of 4): 13-15 tier.
-- 4 articles covering bodies, consent, identity, and safety.
-- Idempotent: on conflict (slug) do update.

insert into public.sex_ed_articles
  (slug, title, body_markdown, topic, age_band, language, published, created_at)
values

('puberty-and-your-changing-body',
 'Puberty and your changing body',
 $art$
Puberty is the multi-year process where your body shifts from a child's body into an adult one. Most people start somewhere between **8 and 14**, finish in their late teens, and feel awkward about parts of it the whole time. That's normal.

### What changes for most people
- **Growth spurts** — sometimes hands and feet first, then the rest of you catches up.
- **Body hair** — under the arms, around the genitals, and (for some) face, chest, and legs.
- **Skin and sweat** — oilier skin, acne for many, stronger body odour.
- **Voice** — a deeper voice for many; some experience cracking for a while.
- **Mood swings** — hormones move fast. Big feelings about small things is a phase, not a flaw.

### Changes that depend on your body
- **If you have ovaries**: breasts develop, hips widen, periods start (usually 2-3 years after breast buds first appear).
- **If you have testes**: testicles enlarge first, then the penis grows; you'll start producing semen and may have spontaneous erections, including during sleep.

### Things that confuse people but are normal
- One breast or testicle being bigger than the other.
- Random erections.
- Periods being irregular for the first 1-2 years.
- Crying for no reason. Laughing for no reason. Both in one afternoon.
- Not feeling ready for any of this. That's also fine — your body has its own clock.

### When to talk to a doctor
- Periods that soak through a pad in under an hour.
- A lump that doesn't go away.
- Pain that interferes with school or sleep.
- No signs of puberty by 14 (with ovaries) or 15 (with testes).
- Strong distress about the changes — there are counsellors trained for exactly this.

**Your body is yours.** Nobody — not friends, not family, not a partner — gets to comment on its rate of change in a way that makes you feel small. If they do, that's about them.
$art$,
 'puberty', '13_15', 'en', true, now() - interval '0 minutes'),

('consent-yes-no-and-the-right-to-change-your-mind',
 'Consent: yes, no, and the right to change your mind',
 $art$
Consent means **everyone involved freely agrees, every time, and can stop at any point.** This applies to hugs, kisses, dating, sending photos, sharing secrets — every kind of closeness, not just sex.

### What real consent looks like
- **Free** — not pressured, guilt-tripped, or "convinced".
- **Informed** — you know what you're agreeing to.
- **Specific** — saying yes to one thing isn't a yes to anything else.
- **Reversible** — you can change your mind at any moment, including mid-way through.
- **Enthusiastic** — a hesitant "I guess" is not a yes. Look for clear, willing engagement.

### What consent does NOT look like
- Silence is not yes.
- Sleeping is not yes.
- Being drunk or high is not yes.
- Saying yes because you're scared of what happens if you say no.
- Saying yes once and being treated as if it's permanent.

### Saying no without explaining
"No" is a complete sentence. You don't owe anyone a reason. Practising the phrase out loud helps — "I don't want to", "stop", "not today".

### When someone you like keeps pushing
If someone you like keeps trying to "convince" you, that's not love or chemistry — that's pressure. Real care looks like the opposite: relief that you said how you actually felt.

### When the lines blur — get help
If someone touched you in a way you didn't agree to, or you're not sure if what happened was OK, it wasn't your fault and you can talk to someone. In India you can call **Childline (1098)** any time, free and 24/7. We list more options on every page of this section.

### Practising consent in small ways
- Ask before hugging a friend who's having a hard day.
- Ask before sharing someone else's photo.
- Notice when a friend says "I'm okay" but their face says otherwise — and ask again.

Consent isn't a script. It's a habit of treating yourself and other people as the experts on their own bodies.
$art$,
 'consent', '13_15', 'en', true, now() - interval '1 minutes'),

('identity-and-orientation-an-introduction',
 'Identity and orientation: an introduction',
 $art$
You'll hear a lot of words about gender and sexuality — some you'll recognise, some you won't, and some you'll use differently a year from now. That's fine. **Most people figure this out over time, and there's no deadline.**

### Two different things people sometimes mix up
- **Gender identity** — who you are. Girl, boy, both, neither, something else.
- **Sexual orientation** — who you're drawn to romantically or sexually. Or whether you're drawn to anyone yet.

You can have any combination of these. A trans girl can be a lesbian. A nonbinary person can be straight. Identity isn't a checklist.

### Common identity words
- **Cisgender (cis)** — your gender matches the one assigned at birth.
- **Transgender (trans)** — your gender doesn't match the one assigned at birth.
- **Nonbinary** — not strictly a girl or boy.
- **Genderfluid** — changes for you over time.

### Common orientation words
- **Straight** — attracted to a different gender.
- **Gay / lesbian** — attracted to the same gender.
- **Bisexual / pansexual** — attracted to more than one gender.
- **Asexual** — little or no sexual attraction to anyone (this is real and valid; it doesn't mean broken).
- **Queer** — an umbrella word many people use when none of the above fits exactly.

### How do I know?
You don't have to *know*. You can notice: who you think about, who you want to be near, who you don't. Some people know at 8, others at 28. Crushes change. Words change. **You are not signing a contract by trying out a label.**

### If you're not safe to come out
You don't have to. Especially if family or community would react badly. Your safety is more important than anyone else's clarity about you. Online spaces like Karochat (and supportive helplines like **iCall** in India, **The Trevor Project** globally) are places where you can talk anonymously while you figure things out.

### One thing that's true for everyone
Whoever you turn out to be, **you are not a problem to be solved.** You're a person to be known.
$art$,
 'identity', '13_15', 'en', true, now() - interval '2 minutes'),

('safety-pressure-and-where-to-ask-for-help',
 'Safety, pressure, and where to ask for help',
 $art$
Most people in your life mean well. But some don't — and the patterns to watch for are the same online and in real life. If you notice these, **it's not your fault, and you can ask for help.**

### Pressure that crosses lines
- An older person who pays special attention to you, gives you gifts, and asks you not to tell your parents.
- Someone (online or off) who asks for photos, then asks for more, then threatens to share them if you don't keep going. This is called **sextortion** and it's a crime — the police will help you.
- A partner who threatens to break up with you, hurt themselves, or "tell everyone" if you don't do something sexual.
- Anyone touching you under your clothes, or making you touch them, when you didn't say yes — including a relative, a teacher, a coach, a tutor, a religious figure, anyone.

**None of these are your fault.** Not because of what you wore, what you said, what messages you sent, or what you didn't say. The blame is always with the person who crossed the line.

### Online safety: quick rules
- The person you talk to online may not be who they say. Adults posing as kids is a real thing.
- Never send a nude photo. Even to someone you trust — phones get stolen, accounts get hacked, relationships end.
- If someone asks for a photo and won't take no for an answer, leave the chat and tell an adult you trust. You don't owe them politeness.
- Screenshots are evidence. If something feels off, screenshot it before you block.

### Who to tell
Pick **one trusted adult** — a parent, a teacher, a doctor, an aunt or uncle, a counsellor. If the first person you tell doesn't take you seriously, tell another one. Keep telling until someone listens.

### Free, confidential helplines
- **Childline India (1098)** — 24/7, free from any phone, in many languages.
- **One-Stop Centre (181)** — for sexual violence support.
- **iCall (+91-9152987821)** — free counselling, Mon-Sat 8am-10pm.
- **tele-MANAS (14416)** — government mental-health helpline, 24/7, 20+ languages.

Karochat will surface these automatically if you ever mention you're not safe.

### If a friend tells you something happened to them
Believe them. Don't ask "are you sure". Don't ask what they were wearing. Just say: **"I believe you. What do you need right now?"** Then help them find an adult or helpline above.
$art$,
 'safety', '13_15', 'en', true, now() - interval '3 minutes')

on conflict (slug) do update set
  title = excluded.title,
  body_markdown = excluded.body_markdown,
  topic = excluded.topic,
  age_band = excluded.age_band,
  language = excluded.language,
  published = excluded.published,
  updated_at = now();
