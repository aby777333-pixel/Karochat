import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aiText, getOpenAI } from "@/lib/ai/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INSTRUCTIONS = `You suggest exactly three short, casual replies the user could send next in a group chat.
Return STRICT JSON: {"replies":["…","…","…"]}.
Rules:
- 1–14 words each.
- Match the tone (friendly, casual, sometimes nostalgic — this is Karochat, a Yahoo-Messenger-style room).
- Do NOT repeat what others just said.
- Vary the three so the user has real choice: e.g. a quick yes/agree, a question that moves things forward, and a playful aside.
- No emojis unless they fit the vibe.
- Plain text only; no markdown.`;

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

  if (!conversation) return NextResponse.json({ replies: [] });

  try {
    const text = await aiText(
      INSTRUCTIONS,
      `Conversation so far:\n${conversation}\n\nSuggest three replies for "You":`,
      { jsonOnly: true }
    );
    let replies: string[] = [];
    try {
      const m = text.match(/\{[\s\S]*\}/);
      const parsed = m ? JSON.parse(m[0]) : { replies: [] };
      replies = Array.isArray(parsed.replies)
        ? parsed.replies.map((s: unknown) => String(s ?? "").trim()).filter(Boolean).slice(0, 3)
        : [];
    } catch {
      replies = text
        .split("\n")
        .map((s) => s.replace(/^[-•\d\.\)\s"]+/, "").replace(/[",]+$/, "").trim())
        .filter(Boolean)
        .slice(0, 3);
    }
    return NextResponse.json({ replies });
  } catch (err: any) {
    console.error("[ai/smart-replies] failed", err);
    return NextResponse.json(
      { error: err?.message ?? "openai-failed" },
      { status: 502 }
    );
  }
}
