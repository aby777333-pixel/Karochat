import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aiText, getOpenAI } from "@/lib/ai/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KARO_PERSONA = `You are Karo, the in-room AI co-pilot of Karochat — a friendly,
queer-friendly, anonymity-respecting chat. Born in 2026.

Rules:
- Reply ONLY when summoned with @karo. The user's message will already
  start with @karo — strip that mention when reasoning about intent.
- Keep responses tight: 1–4 sentences. No headings. No markdown lists
  unless asked.
- Match the room's tone (casual, playful, grounded — never preachy).
- When asked to settle a fact, give a confident concise answer and
  cite uncertainty if relevant.
- When asked to summarise, do it in a single short paragraph.
- When asked to translate, just give the translation, nothing else.
- When asked for a poll/event idea, propose ONE concrete option and
  ask if they want more.
- Do not invent identities or attribute opinions to specific named
  participants unless their message directly stated that opinion.
- Never reveal private chat contents to anyone who isn't in this room.
- Never read or summarise vault DMs (you don't have access).
- If asked to do harm, doxx, target minors, generate NCII, generate
  sexual deepfakes of real people, or anything against Karochat's
  community guidelines, politely refuse in one sentence.`;

export async function POST(req: Request) {
  if (!getOpenAI()) {
    return NextResponse.json({ error: "ai-not-configured" }, { status: 503 });
  }
  let body: { roomId?: string; prompt?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  const roomId = body.roomId;
  const prompt = (body.prompt ?? "").trim();
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });
  if (prompt.length > 2000) {
    return NextResponse.json({ error: "prompt too long" }, { status: 413 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "not a member" }, { status: 403 });
  }

  // Last 12 messages for context (oldest → newest).
  const { data: msgs } = await supabase
    .from("messages_with_sender")
    .select("content, sender_id, sender_display_name, sender_username, type, deleted_at, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(12);

  const conversation = (msgs ?? [])
    .reverse()
    .filter((m: any) => !m.deleted_at && m.type !== "nudge" && m.content)
    .map((m: any) => {
      const who =
        m.sender_id === user.id
          ? "You"
          : m.sender_display_name ?? m.sender_username ?? "Someone";
      return `${who}: ${m.content}`;
    })
    .join("\n");

  // Strip the leading @karo (case-insensitive) so the AI doesn't echo it back.
  const cleanedPrompt = prompt.replace(/^@karo\s*/i, "").trim() || prompt;

  const input = [
    conversation ? `Recent conversation in this room:\n${conversation}` : null,
    `The user just asked you (preceded by @karo):\n${cleanedPrompt}`
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const reply = await aiText(KARO_PERSONA, input);
    const clean = reply.trim();
    if (!clean) {
      return NextResponse.json({ error: "empty-reply" }, { status: 502 });
    }
    return NextResponse.json({ reply: clean });
  } catch (err: any) {
    console.error("[ai/karo] failed", err);
    return NextResponse.json(
      { error: err?.message ?? "openai-failed" },
      { status: 502 }
    );
  }
}
