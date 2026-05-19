import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aiText, getOpenAI } from "@/lib/ai/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INSTRUCTIONS = `You summarise a recent group chat for someone who just opened the room.
Style: warm, concise, 4–8 short bullet points, each ≤120 chars.
Lead with what happened, then who said what notable thing, then any unresolved questions or plans.
Use display names. No greetings, no preamble, no "the chat discusses…" filler.
Plain text bullets prefixed with "• ". No markdown headers.`;

export async function POST(req: Request) {
  if (!getOpenAI()) {
    return NextResponse.json({ error: "ai-not-configured" }, { status: 503 });
  }
  let body: { roomId?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const roomId = body.roomId;
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

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
  if (!membership) return NextResponse.json({ error: "not a member" }, { status: 403 });

  const { data: msgs } = await supabase
    .from("messages_with_sender")
    .select("content, sender_display_name, sender_username, type, deleted_at, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(80);

  const transcript = (msgs ?? [])
    .reverse()
    .filter((m: any) => !m.deleted_at && m.type !== "nudge" && m.content)
    .map((m: any) => {
      const who = m.sender_display_name ?? m.sender_username ?? "Someone";
      return `${who}: ${m.content}`;
    })
    .join("\n");

  if (transcript.split("\n").length < 3) {
    return NextResponse.json({
      summary: "Not much to summarise yet — the room is just getting started."
    });
  }

  try {
    const summary = await aiText(INSTRUCTIONS, transcript);
    return NextResponse.json({ summary: summary.trim() });
  } catch (err: any) {
    console.error("[ai/summarize] failed", err);
    return NextResponse.json(
      { error: err?.message ?? "openai-failed" },
      { status: 502 }
    );
  }
}
