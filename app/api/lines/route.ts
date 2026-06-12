// Karochat — POST /api/lines (v9 "Lines & sparks").
//
// Karo writes one original flirting/conversation line in the requested
// vibe. The "spicy" vibe is server-gated to the 18plus age band (same
// Phase-3 gate as the sex-ed library) — the client toggle is cosmetic;
// THIS is the enforcement point. Hard rails in the persona keep even
// spicy output suggestive-but-classy and consent-forward. Falls back
// to a canned line when OpenAI isn't configured.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aiText, getOpenAI } from "@/lib/ai/openai";
import { AI_FALLBACK } from "@/lib/lines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERSONA = `You are Karo on Karochat, ghost-writing ONE short
flirting / conversation line the user can send to someone they like.

Hard rules (never break):
- Output ONLY the line itself. No quotes, no preamble, no explanation.
- One to two sentences, under 220 characters.
- Consent-forward: playful invitation, never pressure, never an
  assumption of access to the other person. A graceful "no" must always
  be easy.
- Never explicit or graphic. "Spicy" means suggestive, confident,
  classy — innuendo at most. No body-part descriptions, no sexual acts.
- Never negging, never crude, never possessive or jealous.
- No pet names like "baby girl"; keep it adult-to-adult and respectful.
- The line must work as a text message in a chat app.`;

const VIBE_PROMPTS: Record<string, string> = {
  sweet: "Vibe: sweet and warm. Genuine, a little disarming, melts slightly.",
  funny: "Vibe: funny. Witty, self-aware, makes them exhale through their nose.",
  bold: "Vibe: bold. Direct, confident, says the quiet part out loud — respectfully.",
  poetic: "Vibe: poetic. A touch literary, evocative, but still text-message natural.",
  spicy:
    "Vibe: spicy (the user is a verified 18+ adult). Suggestive, magnetic, slow-burn confidence — but still classy, non-explicit innuendo only, and consent-forward."
};

export async function POST(req: Request) {
  let body: { vibe?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  let vibe = (body.vibe ?? "sweet").toLowerCase();
  if (!(vibe in VIBE_PROMPTS)) vibe = "sweet";

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Server-side 18+ gate for spicy — downgrade rather than error.
  if (vibe === "spicy") {
    const { data: band } = await supabase.rpc("current_user_age_band");
    if (band !== "18plus") vibe = "bold";
  }

  if (!getOpenAI()) {
    return NextResponse.json({ line: AI_FALLBACK[vibe] ?? AI_FALLBACK.sweet });
  }

  try {
    const line = (
      await aiText(
        PERSONA,
        `${VIBE_PROMPTS[vibe]}\n\nWrite the line now. Vary it — avoid the most clichéd openers.`
      )
    )
      .trim()
      .replace(/^["'“”]+|["'“”]+$/g, "");
    if (!line) {
      return NextResponse.json({ line: AI_FALLBACK[vibe] ?? AI_FALLBACK.sweet });
    }
    return NextResponse.json({ line: line.slice(0, 300) });
  } catch {
    return NextResponse.json({ line: AI_FALLBACK[vibe] ?? AI_FALLBACK.sweet });
  }
}
