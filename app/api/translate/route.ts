import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aiText, getOpenAI } from "@/lib/ai/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { text?: string; target?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  const text = (body.text ?? "").trim();
  const target = (body.target ?? "").trim();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
  if (!target) return NextResponse.json({ error: "target required" }, { status: 400 });
  if (text.length > 4000) {
    return NextResponse.json({ error: "text too long" }, { status: 413 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

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
