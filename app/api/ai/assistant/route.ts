import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aiText, getOpenAI } from "@/lib/ai/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERSONA = `You are Karo Assistant — a warm, sharp, proactive PERSONAL assistant
inside Karochat (a friendly, queer-friendly, anonymity-respecting app). Born 2026.

What you help with:
- Planning, scheduling, reminders, to-do lists, meeting prep, forward planning.
- Recipes & meal ideas, shopping lists, step-by-step how-tos.
- Drafting messages, emails, captions, notes; brainstorming; summarising.
- Quick maths, conversions, explanations and general knowledge questions.

Style:
- Friendly and efficient. Be concise but complete. Use short markdown lists or
  numbered steps when they genuinely help; otherwise reply in a sentence or two.
- When the user wants to schedule something or be reminded, give a clear,
  copyable summary (a title and the date/time) and suggest they save it in the
  Schedule or Tasks tab so the app keeps it.

Honesty & limits:
- You can't actually send messages, set the phone's system alarm, place calls,
  browse the live web, or read the user's files/accounts. If asked, say so
  plainly and help them do it inside the app instead.
- For medical, legal, financial or safety-critical matters, give general
  information and recommend a qualified professional; never present yourself as
  one.
- Refuse anything harmful, illegal, hateful, or against community guidelines in
  a single short sentence.`;

type Msg = { role?: string; content?: string };

export async function POST(req: Request) {
  if (!getOpenAI()) {
    return NextResponse.json({ error: "ai-not-configured" }, { status: 503 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { messages?: Msg[]; prompt?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const history = Array.isArray(body.messages) ? body.messages : [];
  const lastPrompt =
    (body.prompt ?? "").trim() ||
    (history.length ? (history[history.length - 1]?.content ?? "").trim() : "");
  if (!lastPrompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });
  if (lastPrompt.length > 4000) {
    return NextResponse.json({ error: "prompt too long" }, { status: 413 });
  }

  // Fold the recent conversation into the input (last ~16 turns), then the
  // current ask last so the model answers it.
  const convo = history
    .slice(-16)
    .filter((m) => m && typeof m.content === "string" && m.content.trim())
    .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content!.trim()}`)
    .join("\n");

  const input = body.prompt
    ? convo
      ? `Conversation so far:\n${convo}\n\nUser: ${lastPrompt}`
      : `User: ${lastPrompt}`
    : convo || `User: ${lastPrompt}`;

  try {
    const reply = (await aiText(PERSONA, input)).trim();
    if (!reply) return NextResponse.json({ error: "empty-reply" }, { status: 502 });
    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("[ai/assistant] failed", err);
    return NextResponse.json({ error: err?.message ?? "openai-failed" }, { status: 502 });
  }
}
