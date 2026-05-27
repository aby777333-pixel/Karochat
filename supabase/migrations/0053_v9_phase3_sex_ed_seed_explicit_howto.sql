-- Karochat — v9 Phase 3 (follow-up): explicit 18+ how-to articles.
--
-- Additive seed. Eight new 18+ articles that complement the original
-- starter set (which already covers vaginal, oral, anal, manual, MLM,
-- WLW, toys, trans-affirming, and kink). These go *deeper* on:
--   • Straight (heterosexual) sex — start to finish.
--   • Foreplay as its own skill set.
--   • Positions — what works, why, and when (with diagram).
--   • Orgasm — give and receive.
--   • Solo for vulva owners — beyond the basics.
--   • Solo for penis owners — beyond the basics.
--   • Lesbian / WLW deep dive — strap-ons, scissoring, mouth craft.
--   • Gay / MLM deep dive — top, bottom, vers rhythm.
--
-- Tier rules per migration 0045 already gate access — 18+ articles
-- never reach the 13_15 or 16_17 tiers unless the user is attested
-- adult. Idempotent: on conflict (slug) do update.
--
-- Illustrations live in /public/sexed/*.svg and are referenced via
-- markdown image syntax ![alt](/sexed/...svg). Markdown.tsx renders
-- those as <figure> blocks.

insert into public.sex_ed_articles
  (slug, title, body_markdown, topic, age_band, language, published, created_at)
values

('heterosexual-sex-deep-how-to',
 'Heterosexual sex — a deep how-to',
 $art$
"Straight sex" is a category, not a script. Two bodies with a penis and a vulva can have dozens of completely different kinds of good sex — and the partners who treat it as one choreographed thing ("foreplay, penetration, finish") tend to have the most mediocre sex. So treat this less as instructions, more as a tool kit.

![Labeled vulva diagram](/sexed/anatomy-vulva.svg)

![Labeled penis diagram](/sexed/anatomy-penis.svg)

### Before you start — the conditions that change everything
- **Sober enough to talk.** Drunk sex is rarely good sex.
- **Clean, hydrated, fed.** Sex when you're hungry or dehydrated is a recipe for cramps and exits.
- **No phone in the room.** A buzzing notification interrupts arousal more efficiently than almost anything else.
- **Lube within reach.** Whether or not you "think you'll need it" — having it nearby means you'll use it when you do.
- **An honest conversation about contraception and STI status, once, sober, before this becomes a recurring thing.** This isn't romantic; it's the difference between adult sex and gambling.

### Foreplay — the part that runs the rest of the show
For most vulva-having partners, the arousal curve is a slope, not a switch. Penetration before that slope has climbed produces friction, not pleasure. Spend more time here than you think you need.

- **Kissing for a long time.** Mouths first, hands later. People who skip this are skipping the part that *makes the rest hot*.
- **Hands over clothes, then under.** Slow. Listen for breath changes.
- **Breasts, nipples, neck, inner thighs.** Tease the area *around* the genitals before going there.
- **Manual stimulation of the clitoris.** Lube on the fingertip. Circles around the clitoral hood, not direct pressure on the glans (too intense at first). Build for several minutes.
- **Oral sex** if both partners are into it. (See the dedicated oral-sex article — it goes deeper.)
- **Don't ignore the penis-having partner's foreplay needs either** — many people assume "he's hard, he's ready" but slower kissing, neck, nipples, perineum, and inner-thigh touch make a substantial difference to his experience too.

### Entry — when, how, and how to not screw it up
- **The receiving partner is wet, asking for more, or actively reaching for it.** If you're not sure, ask.
- **Apply more lube** even if you think she's wet. Wetness fluctuates with breath, mood, and where in the cycle she is.
- **The receiver guides you in, or guides themselves down onto you.** Don't aim and push.
- **Once in: stay still for a moment.** Eye contact, breathe together. Let the body adjust.
- **First strokes: slow, shallow, watching her face.** The first inch is the most sensitive — short shallow thrusts in the first inch wake up more nerves than deep ones.

### Pace — the actual technique
Sex is a rhythm, not a constant tempo. Beginners thrust at one speed and one depth until something happens. Better sex:

- **Vary depth.** A run of shallow, then a deep one. Then more shallow. Then two slow deep ones.
- **Vary speed.** Speed up, slow down, almost-pause. The almost-pause is hugely under-used.
- **Pause completely sometimes.** Stay in, fully still, kiss her, then slowly move again. People who learn the still-pause have notably better-rated sex.
- **Watch her body.** Hips lifting toward you = more. Breath catching = stay there.

### Positions — when each one matters

![Eight common position diagrams](/sexed/positions-grid.svg)

- **Missionary** — intimate, eye contact, good for the partner who wants to feel held. Often gets unfairly dismissed; it's a starter for a reason and a fine ending too.
- **Cowgirl / her on top** — she controls depth, angle, pace. For many vulva-having partners, this is the position that delivers orgasm.
- **Reverse cowgirl** — different angle, more stimulation against the front wall.
- **Doggy** — deeper, more intense angle, often hits the front wall. Many people love it; some find it uncomfortable. Pace down on entry, speed comes later.
- **Spooning** — side by side, slow, intimate. Excellent for tired sex, pregnancy, post-injury, lazy mornings.
- **Standing** — for shower sex, against a wall, or when one of you is sitting on something. Logistical, but novel changes neurochemistry.
- **Seated / lap** — she sits on you on a chair or edge of the bed. Eye contact, deep, fully hands-free.

A position that gives the vulva-having partner control of angle and depth tends to produce orgasm more often than positions where the penis-having partner is driving.

### Clitoris during intercourse — non-negotiable for most people
Penetration alone produces orgasm in roughly 1 in 5 women. That means **80% of vulva-having partners need direct clitoral stimulation alongside penetration to come.** Don't make her pretend otherwise.

- **Her hand on her own clit during penetration.** Sexy, efficient, and the most common path to orgasm in long-term couples.
- **Your hand on her clit during penetration.** Especially good in spooning and reverse cowgirl.
- **A small vibrator between you in missionary.** Wearable couples vibrators (We-Vibe and similar) sit on the clit and stay there during penetration.
- **Position that grinds the clit against you** — riding on top, leaning forward and grinding, can produce orgasm without any hand at all.

### When he's close to coming and she's not
This is the classic mismatch. The fix isn't "she has to come first" or "he has to last longer" as a moral demand — it's a tool kit.

- **He pauses inside.** Fully still. Kissing, hands on her, but no thrusting. 30-60 seconds resets him without losing the moment.
- **Switch to manual or oral on her.** Take pressure off him, put pleasure on her.
- **She finishes with a vibrator first.** Then penetration is dessert, not the main event.
- **Or, just both finish at your own pace.** Mutual simultaneous orgasms are great occasionally, not a target. People who chase them ruin a lot of otherwise good sex.

### Finishing and aftercare
- **Pull-out is not contraception.** Treat condom-or-pill-or-IUD as a planned, separate decision.
- **After he comes, don't roll off and check phone.** Stay in for a minute. Kiss. Breathe.
- **Pee within 30 minutes** (especially women — prevents UTIs).
- **Water, light snack, a 5-minute talk.** "What did you like?" is a sexier question than people realise — it sets up the *next* time.

### Mistakes that show up over and over
- Going to penetration too fast.
- Pumping at one speed.
- Ignoring the clitoris.
- Treating his orgasm as the end of the session.
- Skipping aftercare.

Fix those five and you've fixed most heterosexual sex problems on Earth.
$art$,
 'technique', '18plus', 'en', true, now() - interval '1 minute'),

('foreplay-the-part-that-makes-it-work',
 'Foreplay — the part that makes everything else work',
 $art$
Most sex that disappoints would have worked fine if foreplay had run twice as long. Foreplay isn't a warm-up lap; it's a chunk of the sex itself.

### What "aroused" actually means
For vulva-having partners, arousal involves the clitoris swelling (it's mostly internal — the visible glans is the tip of a much larger structure), the vaginal canal lengthening, the front wall getting more responsive, and natural lubrication flowing. **This takes 15-30 minutes for most people.** Penetration before that point is friction, not pleasure.

For penis-having partners, arousal is faster on average, but slower and more layered when foreplay is generous — and slower, layered arousal tends to produce longer, more controlled sex.

### The principle: build attention before sensation
- **Eye contact.** Long. Almost too long.
- **Talk.** Even a few sentences. The voice activates more of the brain than touch does.
- **Slow undressing of just *one* item of clothing.** Then more kissing.
- **Hands above the neck before hands below the waist.** Hair, ears, jaw, neck.

### The body map — in order
1. **Mouth.** Soft, then varied. Tongue, then teeth-gentle. Long kisses, then little ones. Then back to long.
2. **Neck and ears.** Light kisses, breath, light bite. Whisper. Many people find this almost as intense as direct genital contact.
3. **Chest, breasts, nipples.** Hands first, mouth second. Around the nipple, not on it, until they're hard and reaching for you. Then on.
4. **Stomach, hips, inner thighs.** Drag a hand. Drag your mouth. The inner thigh is full of nerve endings most people leave un-touched their whole lives.
5. **Mons / pubic mound, labia, perineum, taint** — depending on anatomy. *Around* the genitals before *on* them. Pressure, breath, light fingertip drag.
6. **Genital touch — finally.** By now the body is asking for it.

This order isn't a recipe; it's a default. Skipping steps is fine if you read the signal. Most people don't skip *enough* steps; they go too fast.

### Words — the under-rated foreplay
- "Tell me what you want."
- "I've been thinking about this all day."
- "What if I just kissed your neck for ten minutes?"
- "I want to slow down."
- "Show me."

Voice is foreplay. People who never speak during sex are leaving the easiest tool on the table.

### Make-out-only nights
Some of the best couples report regular "no genital contact, just hands and mouths above the waist" sessions — sometimes for *the whole evening*. Bodies that have been built up over an hour respond completely differently than bodies that were touched cold. Try one Friday with no goal of penetration. Your subsequent sex will be different.

### Foreplay for the partner who "doesn't need it"
Some partners — often penis-having partners — say "I'm ready, let's go". They're usually wrong about what they like. Slow foreplay produces longer erections, more layered orgasms, and partners who report more satisfaction from sex they have *with* you specifically. It's worth the patience.

### When foreplay isn't enough
If foreplay is generous and the receiver still feels dry, tight, or anxious, that's not a "you need more foreplay" problem — it could be hormones, medication, pelvic floor tension, stress, or a medical issue (vaginismus, endometriosis, vulvodynia). Lube helps; a doctor helps more. Don't push through pain.
$art$,
 'technique', '18plus', 'en', true, now() - interval '2 minutes'),

('sex-positions-what-works-and-why',
 'Sex positions — what works, why, and when',
 $art$
There's no "best position" — there are positions that solve specific problems. Pick the position that matches what you're trying to do, instead of working through a Cosmo list.

![Eight common positions](/sexed/positions-grid.svg)

### Positions sorted by what they're for

**You want intimacy and eye contact.**
- *Missionary* — the classic. Slow, close, vulnerable.
- *Seated / lap-sit* — facing each other, fully clothed-from-the-waist-up if you want, intense eye contact.
- *Standing face-to-face* — full-body pressed contact.

**You want the receiver to control everything.**
- *Cowgirl (rider on top)* — depth, speed, angle all hers.
- *Reverse cowgirl* — same, plus a different internal angle.
- *Seated, partner sitting, receiver on top* — partner on chair or edge of bed, receiver settles down onto them.

**You want depth and intensity.**
- *Doggy / from behind* — the classic deep angle. Pace down on entry.
- *Standing, receiver bent over* — deep, intense, novelty.
- *Folded / receiver on back with knees to chest* — short canal, deep stimulation.

**You want gentle or low-effort.**
- *Spooning* — side by side, behind. Lazy morning, post-injury, or tired.
- *Side-by-side facing* — relaxed, easy on the body, hand access to each other.

**You want clitoral stimulation built in.**
- *Cowgirl with forward lean* — grinds the clit against the partner.
- *Spooning + her hand or a vibrator* — easy access.
- *Coital alignment technique (CAT)* — modified missionary, his body shifted up, base of his penis presses her clit on every stroke. Look it up; learn it.

**You want anal sex.**
- *Receiver on back, hips raised* — easy first time, eye contact, control of pace by lifting/lowering hips.
- *Spooning* — gentlest entry, slowest, recommended for first-time anal.
- *Receiver on top* — receiver fully controls depth.
- (Doggy is the *worst* first-time anal position — too deep, too fast.)

**You want it to last.**
- *Spooning* — slow rhythm, harder to over-stimulate, often produces the longest-lasting sessions.
- *Cowgirl with him still* — she does the moving, he can pause anytime.

**You want a quickie.**
- *Standing against a wall.*
- *Bent over a counter / table.*
- *Cowgirl on a chair.*

### Mechanical truth nobody tells you
- **Height differences matter.** A 30 cm height gap changes which positions work. Standing sex usually requires a height assist (one partner on a step, against a wall, on the edge of the bed).
- **Penis-length-and-curve also matters.** A penis that curves up + receiver on top with forward lean = front-wall pressure that produces orgasm faster. A long penis + doggy can hit the cervix and *hurt*; angle down or shorten the stroke.
- **Vagina depth changes with arousal.** Deep positions that hurt cold feel great fully aroused.

### Don't underestimate the boring positions
Missionary and cowgirl are statistically the positions most couples report as their go-to and most often-orgasmic. Novelty positions are fun; building real skill at one or two go-to positions does more for your sex life than learning twenty.

### Switching mid-session
Healthy. Common. The two-minute warm-down between positions — re-applying lube, kissing, re-finding the rhythm — is itself foreplay. People who stay in one position the whole time leave a lot on the table.
$art$,
 'technique', '18plus', 'en', true, now() - interval '3 minutes'),

('orgasms-how-to-have-give',
 'Orgasms — how to have one, how to give one',
 $art$
An orgasm is a reflex. You can't force a reflex; you can only create the conditions in which it happens. Most "orgasm problems" are condition problems.

### What an orgasm actually is
A rhythmic muscular contraction (PC muscles, anal sphincter, often the uterus / abdominal wall) triggered when arousal hits a threshold. It's accompanied by a flood of oxytocin and a brief drop in cortical activity — which is why it feels like a small altered state. After: refractory period (longer in penis-havers, often non-existent in vulva-havers).

### For people with vulvas — the truth that should have been said earlier
- **The clitoris is the engine.** All orgasms in this body are clitoral orgasms — including "vaginal" ones. The internal arms of the clitoris wrap around the vaginal opening; deep penetration stimulates them indirectly. There is no "real" orgasm vs "fake" orgasm distinction.
- **80% can't come from penetration alone.** You're not broken. You need clitoral contact.
- **Edging works.** Build to almost-coming, back off, build again. Three or four cycles produces stronger orgasms.
- **G-spot orgasms exist for some people.** Front wall of the vagina, ~5-7 cm in, firm pressure, "come here" finger curl or toy. Different feeling — deeper, sometimes with squirting.
- **Multiple orgasms are possible.** Some vulva-havers can come again within seconds; others need a few minutes; some build to a big one and want to stop. All normal.

### For people with penises — also a longer story than you were told
- **The standard orgasm is penis-shaft-and-glans triggered.** Friction, build, ejaculate, refractory.
- **Edging extends and intensifies it.** Same principle: build to near-orgasm, back off, restart. Many penis-havers report the third or fourth peak being the most intense.
- **Prostate orgasms exist.** Different feeling — deeper, wave-like, sometimes without ejaculation, sometimes with a much smaller refractory period. Requires anal stimulation (toy, finger, or partner's penis). See the prostate diagram and anal-sex article for technique.

![Prostate side-section](/sexed/prostate-location.svg)

- **Nipple orgasms are possible** for a small number of penis-havers — usually with extensive nipple stimulation while edged.
- **You can come without ejaculating** (separates with practice — Tantric / KSMO techniques). Optional.

### How to make a vulva-having partner come
Almost universally:
1. **Generous foreplay.** Body warm, breath active, kissing extensive.
2. **Direct clitoral attention** — manual or oral or vibrator — with consistent rhythm once you find what works.
3. **Don't change technique when she's close.** People do this and undo five minutes of work. *Keep doing exactly the thing she was reacting to.*
4. **Penetration optional.** Add it if she wants; not all clitoral orgasms benefit from it.
5. **Aftercare.** Don't pull away post-orgasm — the body is hyper-sensitive for ~30 seconds. Slow exit, soft touch.

### How to make a penis-having partner come (the slower way that's better)
1. **Edge.** Stop when he's at ~80%. Reset. Continue. Repeat 3-4 times.
2. **Vary technique.** Hand → mouth → hand-and-mouth → just-mouth → back to hand. Each switch resets the clock and adds layers.
3. **Add perineum pressure.** Press the spot between scrotum and anus with two fingers as he's about to come. Strong orgasms.
4. **Eye contact.** People skip this; it changes the orgasm.

### Squirting / female ejaculation — briefly
Some vulva-havers expel fluid (from the Skene's glands, sometimes mixed with urine) during orgasm or G-spot stimulation. It's neither pee nor "fake" — it's a real, real phenomenon. Not all vulva-havers do it; not all who do, do it every time. Don't make it a target — pressure ruins it.

### "I can't come."
Common reasons:
- Antidepressants (SSRIs) — the #1 reason in adults. Talk to the prescriber.
- Hormonal contraception in some people.
- Pelvic floor tension.
- Anxiety about coming.
- Wrong technique for your body.
- Substance use.
- Past trauma.

Solo masturbation, varied technique, low-pressure environment, and (if persistent) a pelvic floor physiotherapist or sex therapist are the standard interventions.

### "I come too fast." (penis-havers)
- **Edging in solo practice.** Build endurance.
- **Start-stop method.** During partner sex, stop fully when at 80%. Resume.
- **Squeeze technique.** Firm squeeze just below the head when at 80% — reduces the urgency.
- **Reduce friction with a thicker condom + lube** — sometimes the simplest fix.
- **SSRIs in low dose** are sometimes prescribed for medically diagnosed premature ejaculation — talk to a doctor.

### One thing that makes everything else easier
Stop performing. Sex with the camera-in-your-head turned off is, every time, better than sex where you're watching yourself. Eyes closed, breath audible, attention on the sensation. The orgasm tends to follow.
$art$,
 'pleasure', '18plus', 'en', true, now() - interval '4 minutes'),

('solo-pleasure-vulva-advanced',
 'Solo pleasure for vulva owners — beyond the basics',
 $art$
Solo sex is the lab where every partnered sex skill is built. People who masturbate skilfully tend to have better partnered sex — they know what they like, they can show a partner, and they're not relying on someone else to figure it out.

![Vulva anatomy with clitoris and G-spot reference](/sexed/anatomy-vulva.svg)

### Set-up
- **Privacy and time.** Lock the door. 30 minutes, not 5.
- **Lube.** Even if you "don't need it" — it changes the sensation.
- **Sensory layer.** Smell (candle), texture (warm shower first, soft sheets, a robe), and *not* a screen — at least sometimes. Porn shortens the arc.
- **Pillows.** Under your hips, between your knees — small angle changes feel huge.

### Build a longer arc
1. **Skin first.** Hands on the stomach, chest, neck, thighs. Five minutes minimum.
2. **Around the genitals.** Mons, outer labia, perineum. Not on the clitoris.
3. **Outer labia and clitoral hood.** Gentle circles. Through the hood, not direct on the glans.
4. **Direct clitoral contact** — when the body is asking for it. Pull back the hood with one hand; light fingertip circles with the other. Or: lube + circles with the heel of your hand for broader pressure.
5. **Edge.** Build to almost-orgasm, back off completely for 30 seconds, breathe, restart. Three cycles = a much bigger finish than going straight through.

### Techniques people don't think of
- **The "shower-head" technique.** Detachable shower head on a medium-to-strong setting, pointed at the clitoris from a few inches away. Many vulva-havers have their first non-hand orgasm this way.
- **Grinding against a pillow.** Pillow between your thighs, gentle hip rocking. The whole vulva area gets contact instead of one spot — different orgasm.
- **Two-hand technique.** One hand on the clit, the other inside (two fingers, "come here" curl). Combined stim usually produces a deeper orgasm than either alone.

![Two-finger curl, thumb-on-clitoris technique](/sexed/fingering-technique.svg)

- **Toys.**
  - *Bullet vibrator* on the clit, low setting, build slowly.
  - *Air-pulse / suction toy* (Womanizer / Satisfyer) — no contact, pulses air on the clitoris. Often produces orgasms within 30-60 seconds; many vulva-havers describe their first one as *startling*.
  - *G-spot vibrator* — curved, internal, paired with external clitoral stimulation.
  - *Wand vibrator* (Hitachi-style) — broad-pressure, intense. The classic.
- **Edging to extreme.** Build, back off, build, back off — for an hour. The eventual orgasm is qualitatively different.

### Stop chasing the same orgasm
A common rut: same technique, same speed, same arc, same outcome. Mix one variable each week:
- New time of day.
- New location.
- No vibrator (or only vibrator).
- No screen.
- Eyes open / mirror.
- Try to come without touching the clitoris directly (nipples, fantasy, breath).
- Try not to come at all — pure sensation for 30 minutes.

### Multiple orgasms
- **Don't withdraw.** Most people pull the hand or toy away after orgasm because it's too intense; if you stay through that ~10-second hypersensitivity window with very light pressure, you can roll into the next one.
- **Switch to a different sensation** — vibrator → finger, internal → external. The second orgasm comes from a slightly different angle.
- **Build practice.** It takes some vulva-havers weeks to find the pattern. Patience.

### Pelvic floor
- **Kegels (mild).** Squeeze the muscles you'd use to stop urinating, hold 3 seconds, release. Sets of 10. Stronger pelvic floor = stronger orgasms.
- **Reverse kegels.** Push out (gently) instead of squeezing. Most people are over-tight, not under-tight; learning to *release* the floor improves orgasms more than tightening it.

### When the orgasm won't come
- **Cycle.** Most vulva-havers report orgasms come easier in some phases of their cycle than others. Not a flaw — biology.
- **Stress / cortisol.** Cortisol blocks the cascade. Sometimes a walk first works better than ten more minutes.
- **Medication.** SSRIs and some hormonal contraceptives blunt orgasm. Talk to your prescriber, not the internet.
- **Sleep.** Tired bodies orgasm worse. Try in the morning.

### One thing partnered sex won't give you
Permission to take 90 minutes for yourself, in silence, with no one's needs to manage. Your solo sessions can be the most luxurious sex you have. Treat them that way.
$art$,
 'pleasure', '18plus', 'en', true, now() - interval '5 minutes'),

('solo-pleasure-penis-advanced',
 'Solo pleasure for penis owners — beyond the basics',
 $art$
For most penis-having people, masturbation is a 90-second tension release on autopilot. That's fine. But it's a fraction of what's possible. If you've ever wondered why partnered sex sometimes underwhelms — your solo habits are probably training your body for a single kind of orgasm.

![Penis anatomy showing frenulum and coronal ridge](/sexed/anatomy-penis.svg)

### The problem: "death grip"
If you masturbate with a tight, dry, fast grip, your body learns to come from that specific sensation. A vagina, mouth, or hand will be *less stimulating* than that grip. The fix is variety.

### The basic upgrade
- **Lube.** Always. Coconut oil or a water-based lube turns dry friction into a fundamentally different sensation. (Coconut oil destroys latex condoms — fine for solo, NOT with a partner using condoms.)
- **Slower.** Many penis-havers default to "as fast as you can while still feeling something". Halve the speed. Double the duration. The orgasm at the end is layered, not punchy.
- **Vary grip pressure.** Sometimes light. Sometimes firm. Sometimes a loose ring of finger-and-thumb around the head only. Sometimes full hand.
- **Use the other hand.** Most people use only one. Add the other to the head, the base, the perineum, the testicles.

### Edging — the foundational practice
1. Touch yourself until you're at ~80% (close, but not at the point of no return).
2. Stop completely. Breathe. Hands off, or hands on stomach.
3. Wait 30-60 seconds until you've stepped down to ~50%.
4. Restart. Build to 80%. Stop again.
5. Do this 3-5 times.
6. On the final cycle, let it happen.

Effects: more intense orgasm; longer staying power in partner sex; the discovery that what you thought was "needing to come" was actually a low-level reflex you can ride out.

### Technique inventory
- **The pulse technique** — instead of stroking, *squeeze and release* at the base in a rhythm. Different sensation entirely.
- **One hand on the head only.** Glans-only stimulation. Slower build, very intense orgasm.
- **Frenulum focus.** Lube + thumb on the frenulum (the V-shaped bit on the underside of the head), the rest of your hand resting on the shaft. Most penis-havers have never been touched there in isolation.
- **Two-handed twist.** Two hands stacked, twisting in opposite directions on each up-stroke. Adds a rotational sensation that no partner is likely to mimic.
- **Perineum press.** Press firmly on the perineum (the spot between scrotum and anus) with two fingers as you approach orgasm. Strongly intensifies it for many people.
- **Cock ring (silicone, adjustable).** Stays on the base of the shaft, slows blood return, longer erection, often stronger orgasm.
- **Stroker / sleeve.** Different texture profile — Tenga eggs, Fleshlight. Use with lube. The variety alone breaks the death-grip pattern.

### Prostate solo — advanced
The prostate orgasm is qualitatively different from the penile one — deeper, wave-like, sometimes without ejaculation, sometimes with a much shorter refractory period. Many penis-havers don't know they can have one.

![Prostate location side-section](/sexed/prostate-location.svg)

- **Lube. Generous amount. Reapply.**
- **Trim nail of the finger you're using; file the corner. File it.**
- **Position: lying on back with knees up, or on side with one knee to chest, or doggy.**
- **One finger first.** Insert slowly. The first inch (the sphincters) is the tight part — pace it.
- **Once past the first inch, curl the finger "come here", toward the front of the body.** ~5-7 cm in. You're looking for a walnut-sized firm bump on the front wall.
- **Press, hold, then small massage motion.** Not stroking. Steady pressure with small movement.
- **Simultaneously stroke the penis with the other hand** — slow, almost-light. The combined sensation is what produces the prostate-driven orgasm for most people.
- **Or use a prostate massager.** Curved silicone toy designed for the angle — easier on the wrist, more sustainable, often vibrating.

The first prostate orgasm often takes several attempts. Don't perform; don't time yourself; just learn what your body responds to.

### "I can only come one way" — fix
The fix is two weeks of intentionally *different* solo sessions. New hand, new lube, new grip, new pace, no porn. Your nervous system rewires faster than you'd think. Some people report being able to come from completely new techniques within 10-14 days.

### "I can't come during partner sex but easily by myself" — read this
Almost always a death-grip / specific-sensation issue. Your nervous system trained for one input; partner contact is a different input. Three weeks of varied solo technique — looser grip, slower pace, lube, different hand each day — usually restores the ability.

### "I come too fast" — solo practice fixes partner outcomes
Edging in solo practice (above) directly transfers to longer-lasting partner sex. Most "premature ejaculation" without a medical cause is solved by 4-6 weeks of edging training.

### Aftercare for yourself
Yes. Hydrate. Stretch (especially hips/lower back). 5 minutes of just lying there. People who immediately get up and scroll their phone are skipping the part of the orgasm cycle that delivers the *relaxation* benefit — that's the oxytocin/prolactin window. Use it.
$art$,
 'pleasure', '18plus', 'en', true, now() - interval '6 minutes'),

('lesbian-sex-deep-dive',
 'Lesbian / WLW sex — the deep dive',
 $art$
The starter WLW article covered the basics. This one goes further — strap-ons, scissoring done well (rare), mouth craft, two-vulva penetration, and how to design a WLW sex life that doesn't get stuck in one pattern.

### "Bed death" and how to not have it
The "lesbian bed death" stereotype isn't WLW-specific (every long-term couple coasts eventually), but WLW couples report it more often because:
- Both bodies are arousal-state-dependent on stress, sleep, and cycle (no penis-default "always ready" partner).
- Without a script (penetration as default), couples sometimes drift into no-default — and then default to nothing.
- Many WLW couples are deeply emotionally intimate, which can flatten the erotic charge unless deliberately maintained.

Fix: **schedule sex like adults.** Tuesday + Saturday nights are no less hot for being on the calendar. Couples who schedule report more sex *and* more spontaneous sex in between.

### Mouth craft — beyond the basics
The starter article said: tongue flat, varied speed and pressure, two fingers inside, breathe. Here's more.

- **The alphabet.** Trace the letters of the alphabet on her clit with your tongue. Sounds gimmicky, *works* — because it forces variation in speed, direction, and pressure that nobody does naturally.
- **The lock.** Once you find the rhythm she's responding to, lock it. Same speed, same pressure, same pattern. **Do not improve it.** She'll come from the repetition.
- **Suction.** Gentle lip-suction on the clitoral hood, paired with a soft tongue flick inside that suction. Many vulva-havers describe this as the technique that finally got them oral orgasms.
- **Numbed tongue trick.** Hold an ice cube in your mouth for 30 seconds before going down; cold tongue + hot vulva = electric sensation. (Optional, novelty.)
- **Talk during.** Pull back, "you taste so good", go back in. Hearing it changes her experience.

### Fingering technique, layered
![Two-finger curl + thumb-on-clit](/sexed/fingering-technique.svg)

- **One finger, then two, building.** Always.
- **Curl up "come-here" on the front wall.** Find the G-spot bump (~5-7 cm in).
- **Thumb on the clit** while curled fingers work. **This is, for many vulva-havers, the technique that produces orgasm consistently.**
- **Three fingers + thumb in some cases.** Build slowly. Lube. Lots.
- **Switch hands during.** Tired hand = mediocre sex. The other hand has different angles too.

### Scissoring / tribadism — done right
The classic image: two vulvas grinding against each other. Often portrayed; rarely worked-out in practice. The truth:

- **Find the angle.** One partner on back, the other above and to the side, hooking a leg over. Vulvas pressed together; you grind, not thrust.
- **Lube. A lot.** Vulva-on-vulva is high friction without it.
- **Mutual eye contact.** This is one of the most face-to-face possible WLW positions.
- **Slow at first.** Find the angle that lights up both clits. *Then* you can pick up speed.
- **Don't make it the main event.** Most couples who love scissoring use it as build-up; the orgasm itself usually comes from a different technique a moment later.

### Strap-ons
- **Bigger isn't better.** Start with a small or medium dildo. A 6-inch dildo with a comfortable harness is more pleasurable than an intimidating 8-inch one.
- **Body-safe silicone.** Avoid cheap "jelly" rubber.
- **Harness fit matters.** Try a few — the dildo should sit at a comfortable height; some harnesses have a base that vibrates back against the wearer's clit.
- **Wearer's clit needs attention too.** A vibrating ring at the base of the dildo, or a "Feeldoe" / double-ended strapless that has an inserted end for the wearer, or a hand under the harness.
- **Communicate during.** Strap-ons separate sensation from action — the wearer can't feel the angle from her end. Tell her what's happening.
- **Lube. Always lube.**
- **Position notes:**
  - *Receiver on back, wearer on top* — eye contact, control for wearer, classic feel.
  - *Doggy* — deeper angle, more intense; not the first-time choice.
  - *Receiver on top, wearer on back* — gives the receiver full control, often the most-orgasmic position.
  - *Spooning* — slowest, gentlest, great for first-time strap-on.

### Double-ended dildos
- Both partners receive simultaneously. Hard to coordinate at first.
- Easier in *side-by-side* or one-on-back-one-on-top. Almost impossible in scissoring (despite the porn).
- Look for one with a *firm* core — floppy ones flop.

### Sex toys built for two vulvas
- **We-Vibe Sync / Chorus** — sits inside the receiver, presses on the clit, partners can use it on each other.
- **Vibrators with two motors** designed for couples.
- **Wand + a long handle** — one partner uses the wand on the other.

### Penetration without a strap-on
- **Fingers.** Already covered. Adding a third or fourth finger gradually, with lube, can produce a very full sensation.
- **Fisting** — advanced. Hours of build-up, gallons of lube, pelvic floor relaxation. Not a starter activity. Worth its own dedicated reading.
- **Dildo by hand.** Without a harness, just held — gives more control of angle, often better than strap-on for one partner.

### The under-rated WLW skill: rest
WLW couples often have very long sessions — 2+ hours. Bodies need breaks. Water, a snack, lying entangled for 10 minutes, then resuming. Tantric, in a way; also just sensible.

### Conflict + sex
Many WLW couples report a slowdown in sex when the relationship has unresolved conflict — because emotional and erotic intimacy are tightly fused. Repair the conflict, the sex usually follows. (Therapy helps. Couples therapy with a queer-affirming therapist especially.)

### Resources (India)
- **Sappho for Equality** (Kolkata) — queer women's organisation, helpline, community.
- **Nazariya** (Delhi) — queer feminist resource group.
- **Gaysi** — Indian queer media outlet with relationships writing.
- **The Humsafar Trust** — broader queer health/community work, female-affirming.
$art$,
 'queer', '18plus', 'en', true, now() - interval '7 minutes'),

('gay-sex-deep-dive',
 'Gay / MLM sex — the deep dive',
 $art$
The starter MLM article covered orientation basics, condoms, PrEP, and overview technique. This one goes further: topping, bottoming, versatile rhythm, prep, recovery, and how to actually enjoy it.

### Anal anatomy refresher
Two sphincters: outer (voluntary, you control), inner (involuntary, relaxes when you do). The first ~3 cm is the tight part; the rectum is more open. The prostate sits on the front wall ~5-7 cm in.

![Prostate side-section](/sexed/prostate-location.svg)

### Prep for bottoming — actually realistic
- **Diet day-of.** Fiber-friendly day — fruit, oats, whole grains, water. Avoid greasy/heavy meals 4-6 hours before.
- **Shower with attention to the outside.** That alone handles 90% of the worry.
- **Light douching, optional.** A small bulb (60-100 ml) of lukewarm water, 30-60 minutes before. Squat-and-release in the shower. Repeat once or twice until water runs clear. Do not over-douche — it irritates the rectal lining and increases risk of tearing and STI transmission.
- **Do not eat right before.** A near-empty rectum makes everything easier.
- **Trim nails. Lube.** Always lube. Silicone-based for longest staying power, or thick water-based.

### Topping — actual technique
Topping is *not* just thrusting harder. Good tops are made, not born.

- **Patience at entry.** Tip at the entrance. Pressure, not push. Let the bottom *push back onto you* when they're ready. The single biggest mistake tops make is hurrying entry.
- **Pause once in.** 30-60 seconds. Let his body adjust. Kiss, talk, breathe together.
- **Inch by inch.** Out slightly, then back in a little deeper. *Listen to his body, not the porn in your head.*
- **Slow before fast.** First 5 minutes: slow, almost still-half-the-time. Speed is earned.
- **Hit the prostate.** Angle matters more than depth. Bottom on back, knees up, slightly arched — that angle hits the prostate on the front wall on most thrusts.
- **Lube, often.** Reapply during. The friction-pain that ends sessions early is almost always a lube problem.
- **Talk.** "Okay?" "How's this?" "Want me to slow down?" Tops who talk to their bottoms have better bottoms returning for more.

### Bottoming — actual technique
- **Breath.** When in doubt, exhale. Bottoms who hold their breath clench. Bottoms who breathe stay open.
- **Push back into the entry.** Don't just receive — actively engage. You're 50% of this.
- **Position changes everything.**
  - *On back, knees up* — most prostate-friendly angle, eye contact, easy to start.
  - *On side / spooning* — slowest, gentlest, best first-time position.
  - *On top / cowboy* — full control of depth and pace, often the best-orgasm position once you have practice.
  - *Doggy* — deep, intense; *not* the right first-time position.
- **Touch yourself.** Stroke your own penis during. The combined penile + prostate stimulation is what produces the wave-style orgasm bottoms describe as "different".
- **Say what you need.** "Stop" "slow down" "more lube" "stay there" "harder" are full sentences. Use them.

### Versatile — the rhythm of switching
- **Versatile = comfortable both topping and bottoming.** Some sessions one, some the other, some both.
- **Switching mid-session** — full break (water, towel, lube re-apply, 5 min) before changing. Same condom doesn't go from receiver back to top — that's a recipe for UTIs / bacteria transfer.
- **Vers couples report the highest sexual satisfaction in MLM survey data.** Variety + empathy from having been in both roles.

### Positions (MLM-specific)
![Common positions reference](/sexed/positions-grid.svg)

- *Bottom on back, top kneeling between his legs* — eye contact, prostate-hitting angle.
- *Spooning* — gentle, ideal for slow sex, hands free.
- *Doggy* — deep, intense, for when you're warmed up.
- *Standing — bottom bent over* — quickie energy, novelty.
- *Cowboy / bottom on top* — bottom controls everything.
- *Reverse cowboy* — different angle, no eye contact, sometimes hits the prostate differently.

### Mutual masturbation and oral as full meals
A whole session can be hands and mouths — no penetration. Many MLM partners report some of their best sex this way. **Penetration is not the goal**; pleasure is.

- **Frot / frottage** — two penises rubbed together, usually with lube. Underrated. Intimate, low-risk, very hot.
- **Docking** — one foreskin over the other's glans (requires at least one uncut partner). Specific, but real.
- **Sword-fighting** — mutual hand-stroking with eye contact. Sounds funny; produces strong, simultaneous orgasms.

### STI risk and management
- **PrEP** — daily or on-demand HIV prevention pill. Routine for sexually active MLM in many cities. Cheap or free in India through programs.
- **Condoms** — still useful, especially with new partners. Reduces HIV but also syphilis, gonorrhea, chlamydia.
- **Testing schedule** — every 3-6 months for sexually active MLM. Full panel: HIV, syphilis, hep B, hep C, gonorrhea + chlamydia (throat, urethral, and rectal swabs).
- **Talk before sex.** "Last tested?" "On PrEP?" "Anything I should know?" — adult, sexy in its own way, saves complications.

### Substances — the honest section
Chems / party-and-play / chemsex is a real subculture in MLM spaces. Substances dramatically increase HIV/STI risk (lowered inhibition, longer sessions, more partners). Many MLM survey respondents report higher rates of regret + lower long-term satisfaction. If you do play this way: harm reduction first — testing, PrEP, hydration, sleep, ride home arranged. If you're using to *enjoy* sex you can't otherwise enjoy, that's a question for a therapist, not a dealer.

### Long-term MLM relationships
- **Open vs monogamous** — both work, both fail; the predictor is honest communication, not the structure.
- **Dead bed solutions** — schedule sex; introduce new toys; take a weekend trip; talk to a sex therapist (queer-affirming). Most ruts are fixable.
- **Bottoming-only / topping-only partners** — fine if both agree; sometimes a source of incompatibility. Vers partners have more flexibility.

### Aftercare — non-optional
After bottoming: water, a snack, soft blanket, low light. Drop is real — body and mind dip after intense sessions. A cuddle and check-in 1-2 hours later prevents most of the post-sex shame spiral some MLM bottoms describe.

After topping: similar. Top-drop is real too. "How are you?" matters in both directions.

### Resources (India)
- **The Humsafar Trust** (Mumbai) — HIV testing, PrEP, community.
- **Sangama** (Bangalore), **Sahodaran** (Chennai), **The YP Foundation** (Delhi).
- **Grindr** is the dominant app; **Blued** popular in Asia; **Romeo** older crowd.
- **PrEP availability** — YR Gaitonde Centre, NACO programs, private GPs in metros.
$art$,
 'queer', '18plus', 'en', true, now() - interval '8 minutes')

on conflict (slug) do update set
  title = excluded.title,
  body_markdown = excluded.body_markdown,
  topic = excluded.topic,
  age_band = excluded.age_band,
  language = excluded.language,
  published = excluded.published,
  updated_at = now();
