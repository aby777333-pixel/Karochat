import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aiText, getOpenAI } from "@/lib/ai/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sarvam's mayura:v1 covers these. Anything else falls through to OpenAI.
const SARVAM_CODE: Record<string, string> = {
  english:   "en-IN",
  hindi:     "hi-IN",
  tamil:     "ta-IN",
  telugu:    "te-IN",
  malayalam: "ml-IN",
  kannada:   "kn-IN",
  marathi:   "mr-IN",
  bengali:   "bn-IN",
  gujarati:  "gu-IN",
  punjabi:   "pa-IN",
  odia:      "od-IN"
};

export async function POST(req: Request) {
  let body: { text?: string; target?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  const text = (body.text ?? "").trim();
  const target = (body.target ?? "").trim().toLowerCase();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
  if (!target) return NextResponse.json({ error: "target required" }, { status: 400 });
  if (text.length > 4000) {
    return NextResponse.json({ error: "text too long" }, { status: 413 });
  }

  // Authenticate so we don't open a free translator to the world.
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // Try Sarvam first for supported Indian languages.
  const sarvamCode = SARVAM_CODE[target];
  if (sarvamCode && process.env.SARVAM_API_KEY) {
    try {
      const r = await fetch("https://api.sarvam.ai/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": process.env.SARVAM_API_KEY
        },
        body: JSON.stringify({
          input: text,
          source_language_code: "auto",
          target_language_code: sarvamCode,
          mode: "formal",
          model: "mayura:v1",
          enable_preprocessing: true
        })
      });
      if (r.ok) {
        const data = (await r.json()) as { translated_text?: string };
        const out = (data.translated_text ?? "").trim();
        if (out) {
          return NextResponse.json({ translated: out, provider: "sarvam" });
        }
      } else {
        const errText = await r.text().catch(() => "");
        console.warn("[translate] sarvam non-200", r.status, errText.slice(0, 200));
      }
    } catch (err) {
      console.warn("[translate] sarvam threw", err);
    }
  }

  // OpenAI fallback for everything else (and on Sarvam failure).
  if (!getOpenAI()) {
    return NextResponse.json(
      { error: "no-translation-provider-configured" },
      { status: 503 }
    );
  }
  try {
    const out = await aiText(
      `You translate user text into ${target}. Output ONLY the translation — no quotes, no preamble, no notes. Preserve names, @handles, and URLs verbatim. Match the tone of the original (casual stays casual, formal stays formal).`,
      text
    );
    const cleaned = out.trim().replace(/^["“'](.*)["”']$/s, "$1").trim();
    return NextResponse.json({ translated: cleaned, provider: "openai" });
  } catch (err: any) {
    console.error("[translate] openai failed", err);
    return NextResponse.json(
      { error: err?.message ?? "openai-failed" },
      { status: 502 }
    );
  }
}
