import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aiText, getOpenAI } from "@/lib/ai/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hand-tuned seed list — used when OpenAI is unavailable so the lobby always
// has a prompt to land on. Deterministic per UTC day.
const SEED_PROMPTS = [
  "what's a small thing that made you feel okay today",
  "describe your last 24 hours in three emojis",
  "a song you can't stop replaying right now and why",
  "the most queer thing you did this week (broad definition encouraged)",
  "one thing you'd tell your 19-year-old self in one sentence",
  "a hill you'd die on — chat-friendly hill only",
  "what's the room you wish existed on Karochat",
  "describe your current mood as a weather forecast",
  "the most kind thing a stranger has done for you online",
  "if your day were a Wikipedia entry, what's the opening line",
  "one thing you used to be wrong about",
  "what's playing in the background of your life right now",
  "the most underrated movie/song/show in your library",
  "describe your dream Saturday — no money, no rules",
  "what's something you're proud of but don't talk about",
  "the snack/drink that hits different at 3am"
];

const INSTRUCTIONS = `You write one daily conversation prompt for Karochat, a
queer-friendly, anonymity-first chat app. Style:
- 1 sentence, lowercase, no period at the end.
- Casual, warm, inviting — never preachy or therapy-coded.
- Encourages low-stakes sharing across strangers.
- No politics, no current events, no anything that ages badly.
- 60-100 characters.
- Don't ask multiple questions in one prompt.
- Don't repeat: today's prompt should be different from any you'd typically write.

Output ONLY the prompt text, no quotes, no preamble.`;

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

function seedForToday(): string {
  // Cheap deterministic pick across the seed list.
  const d = todayUtcDate();
  let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
  return SEED_PROMPTS[h % SEED_PROMPTS.length]!;
}

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Cached row?
  const today = todayUtcDate();
  const { data: existing } = await supabase
    .from("daily_prompts")
    .select("prompt, posted_for")
    .eq("posted_for", today)
    .maybeSingle();
  if (existing?.prompt) {
    return NextResponse.json({ prompt: existing.prompt, posted_for: today });
  }

  // Generate via OpenAI, fall back to the seed list.
  let prompt = seedForToday();
  if (getOpenAI()) {
    try {
      const generated = await aiText(INSTRUCTIONS, "give me today's prompt");
      const clean = generated.trim().replace(/^["']|["']$/g, "").trim();
      if (clean && clean.length <= 200) prompt = clean;
    } catch (err) {
      console.warn("[daily-prompt] openai failed; using seed", err);
    }
  }

  // Atomically pin today's prompt (race-safe via on-conflict).
  const { data: pinned, error: rpcErr } = await supabase.rpc(
    "ensure_daily_prompt",
    { p_prompt: prompt }
  );
  if (rpcErr) {
    console.warn("[daily-prompt] ensure failed", rpcErr);
    return NextResponse.json({ prompt, posted_for: today });
  }
  return NextResponse.json({ prompt: (pinned as string) ?? prompt, posted_for: today });
}
