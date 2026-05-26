// Karochat — /api/sexed/ask
//
// Anonymous sex-ed Q&A. Three things happen:
//   1. Crisis-keyword scan via lib/sexed/crisis. If anything fires, we
//      look up matching helplines and PREPEND them to the response —
//      the model never gets to silence or soften this routing.
//   2. Age tier comes from current_user_age_band() (set by birth_year
//      + 18+ attest). 13_15 callers are told to read articles + call a
//      helpline; the model never sees the question.
//   3. Karo answers via aiText() with a sex-ed-specific system prompt
//      (queer-affirming, pleasure-positive at 18+, age-appropriate at
//      16-17). The question is also stored in sex_ed_anonymous_qa via
//      submit_sexed_question for admin review + future seeding.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aiText, getOpenAI } from "@/lib/ai/openai";
import { detectCrisis, helplineKindsFor } from "@/lib/sexed/crisis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KARO_SEXED_PERSONA = `You are Karo on Karochat — the queer-friendly,
sex-positive, anonymity-respecting AI co-pilot. You are answering an
anonymous sex-ed question. Born 2026.

Editorial principles:
- Medically accurate, non-judgmental, queer-affirming, trans-affirming,
  pleasure-positive — but appropriate to the asker's age tier.
- 13_15 tier: never describes explicit sexual acts. Bodies, consent,
  identity, safety only. Always route to a trusted adult or helpline if
  anything sounds unsafe.
- 16_17 tier: contraception, STI, communication, masturbation,
  identity, sexting law — yes. Explicit pleasure technique — no, save
  for 18+.
- 18plus tier: full pleasure-technique vocabulary is allowed.

Format:
- Plain prose. Short paragraphs. Markdown lists OK when they help.
- 80 to 220 words total. Brevity beats density.
- No headings unless the question genuinely needs structure.
- No disclaimer paragraphs at the start. (The page already shows a
  non-dismissable "this is education, not medical care" banner.)
- If the question can't be answered without a real clinician, say so
  in one line and recommend a clinic type (e.g., "see a gynaecologist"
  or "an ICTC centre").

Refuse politely (one sentence) if asked to: produce CSAM, generate NCII
or deepfakes, identify a specific person, help groom a minor, or
recommend a specific drug dosage. Don't lecture; just decline and pivot
to what you CAN help with.

When you mention India-specific resources, prefer: iCall, Vandrevala
Foundation, tele-MANAS, Childline (1098), Humsafar Trust, Sappho for
Equality, Mariwala Health Initiative. Don't invent helpline numbers.`;

type Body = {
  question?: string;
  topic?: string | null;
  country?: string | null;
};

export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  const question = (body.question ?? "").trim();
  const topic = body.topic?.trim() || null;
  const country = (body.country?.trim() || "IN").toUpperCase();
  if (!question) {
    return NextResponse.json({ error: "question required" }, { status: 400 });
  }
  if (question.length > 1500) {
    return NextResponse.json({ error: "question too long" }, { status: 413 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: bandRow } = await supabase.rpc("current_user_age_band");
  const band = (bandRow ?? "16_17") as "13_15" | "16_17" | "18plus" | "unset";

  // 1) Crisis detection — runs before anything else.
  const crisisHits = detectCrisis(question);
  let helplines: any[] = [];
  if (crisisHits.length > 0) {
    const kinds = helplineKindsFor(crisisHits);
    const { data: hl } = await supabase.rpc("list_helplines_for", {
      p_country: country,
      p_kinds: kinds
    });
    helplines = hl ?? [];
  }

  // 2) Block the 13_15 tier from open-ended Q&A. Return helplines + a
  //    curated nudge toward articles instead. submit_sexed_question
  //    will also raise if called from this tier, so we don't even try.
  if (band === "13_15") {
    return NextResponse.json({
      band,
      blocked: true,
      reply:
        "I can't take open-ended questions from this age tier — but the article library covers what you might be asking, and you can always call a helpline. The articles on bodies, consent, identity, and safety are written for exactly your age.",
      crisis: crisisHits.length > 0 ? crisisHits : null,
      helplines
    });
  }

  // 3) Persist the anonymous question (best-effort — don't fail the
  //    response if RLS or constraints block).
  try {
    await supabase.rpc("submit_sexed_question", {
      p_question: question,
      p_topic: topic,
      p_country: country,
      p_session_hash: null
    });
  } catch {
    /* best effort */
  }

  // 4) Generate answer via Karo. If OpenAI isn't configured, return a
  //    helpful fallback.
  if (!getOpenAI()) {
    return NextResponse.json({
      band,
      reply:
        "Karo isn't online right now. Your question has been queued for an operator answer — check back in a day. In the meantime, the article library covers most of the basics.",
      crisis: crisisHits.length > 0 ? crisisHits : null,
      helplines
    });
  }

  const ageHint =
    band === "18plus"
      ? "The asker is 18+ and has attested they want adult content. Pleasure-technique vocabulary is allowed."
      : "The asker is in the 16-17 tier. Keep content focused on contraception, STIs, identity, communication, masturbation, sexting-law, and decision-making. No explicit step-by-step technique for partnered sex acts.";

  const input = [
    `Age tier: ${band}.`,
    ageHint,
    crisisHits.length > 0
      ? `Crisis keywords detected: ${crisisHits.map((h) => h.category).join(", ")}. Acknowledge the asker's situation in the first sentence, encourage them to use a helpline (shown above your reply), and then answer their underlying question if it's safe to do so.`
      : null,
    topic ? `Topic: ${topic}.` : null,
    `Anonymous question:\n${question}`
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const reply = (await aiText(KARO_SEXED_PERSONA, input)).trim();
    if (!reply) {
      return NextResponse.json({ error: "empty-reply" }, { status: 502 });
    }
    return NextResponse.json({
      band,
      reply,
      crisis: crisisHits.length > 0 ? crisisHits : null,
      helplines
    });
  } catch (err: any) {
    console.error("[api/sexed/ask] failed", err);
    return NextResponse.json(
      { error: err?.message ?? "openai-failed" },
      { status: 502 }
    );
  }
}
