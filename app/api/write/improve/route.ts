// /api/write/improve — AI grammar + clarity pass on submitted text.
//
// Requires an email-registered (non-anonymous) caller — matches the same
// rule the publications RLS enforces for create/update. Anonymous guests
// + signed-out callers get a 401. Rate-limited softly to the input length
// (12k char cap).

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aiText, getOpenAI } from "@/lib/ai/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMPROVE_INSTRUCTIONS = `You are an editor helping a writer polish their prose.

Goals:
- Fix grammar, spelling, and obvious typos.
- Improve clarity, flow, and word choice. Keep the writer's voice, register,
  and intent. If the original is informal, stay informal.
- Preserve markdown structure (headings, lists, **bold**, *italic*, etc.)
  exactly. Do not reformat the document.
- Preserve line breaks between paragraphs.
- Do not add commentary, explanations, or quotes. Return only the improved
  text — nothing else.
- If the input is already well-written, you may return it nearly unchanged.
- Never rewrite the meaning. Never censor adult content; the platform
  permits 18+ writing and the writer has chosen this tone.

Return only the rewritten text. No preamble, no closing remarks.`;

export async function POST(req: Request) {
  if (!getOpenAI()) {
    return NextResponse.json(
      { error: "ai-not-configured" },
      { status: 503 }
    );
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }
  if ((user as any).is_anonymous) {
    return NextResponse.json(
      { error: "email-registration-required" },
      { status: 403 }
    );
  }

  let body: { text?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  const text = String(body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "empty-text" }, { status: 400 });
  }
  if (text.length > 12000) {
    return NextResponse.json(
      { error: "text-too-long", limit: 12000 },
      { status: 413 }
    );
  }

  try {
    const improved = await aiText(IMPROVE_INSTRUCTIONS, text);
    return NextResponse.json({ improved });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
