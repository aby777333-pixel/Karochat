"use client";

// Karochat — in-room "extras" card that fills the space below the chat:
//   • Who's online (group rooms) — tap an avatar to open a private DM.
//   • Icebreaker — a shuffleable prompt you can drop straight into the room.
//   • Daily question — one deterministic-by-date prompt for the whole app.
// Posting uses the same messages insert the composer does, so it shows up live.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Member = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  presence_state: string | null;
};

const ICEBREAKERS = [
  "This or that: mountains 🏔️ or ocean 🌊?",
  "What's a song you can't skip right now?",
  "Tea, coffee, or neither — and how do you take it?",
  "Most underrated movie you'd recommend to anyone?",
  "If you could teleport anywhere for an hour, where to?",
  "What's a small win you had today?",
  "Cats, dogs, or something more exotic?",
  "What's the last thing that made you laugh out loud?",
  "Night owl or early bird?",
  "One food you could eat every day forever?",
  "What hobby would you pick up if money/time were free?",
  "Beach sunrise or city skyline at night?",
  "What's your comfort show — the one you rewatch?",
  "Texting or calling — what's your default?",
  "If your week had a theme song, what would it be?"
];

const DAILY_QUESTIONS = [
  "What's one thing you're looking forward to this week?",
  "What's a tiny thing that always cheers you up?",
  "Who's someone you're grateful for today?",
  "What's a skill you wish you'd started learning earlier?",
  "What's the best advice you've ever gotten?",
  "If today had a colour, which one would it be?",
  "What's something kind you saw or did recently?",
  "What's a place that feels like home to you?",
  "What would your younger self be proud of?",
  "What's a small goal for tomorrow?"
];

function initials(name: string | null, handle: string | null): string {
  return (name || handle || "?").trim().slice(0, 1).toUpperCase();
}

export function RoomExtras({
  roomId,
  currentUserId,
  isDm,
  members
}: {
  roomId: string;
  currentUserId: string;
  isDm: boolean;
  members: Member[];
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();

  const online = useMemo(
    () =>
      (members ?? []).filter(
        (m) => m.user_id !== currentUserId && m.presence_state === "online"
      ),
    [members, currentUserId]
  );

  // Deterministic daily question (same for everyone on a given day).
  const dailyQ = useMemo(() => {
    const d = new Date();
    const day = Math.floor(
      Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000
    );
    return DAILY_QUESTIONS[day % DAILY_QUESTIONS.length]!;
  }, []);

  const [iceIdx, setIceIdx] = useState(0);
  const [posting, setPosting] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  async function drop(text: string, tag: string) {
    if (posting) return;
    setPosting(tag);
    await supabase.from("messages").insert({
      sender_id: currentUserId,
      room_id: roomId,
      content: text,
      type: "text"
    });
    setPosting(null);
  }

  async function openDM(userId: string) {
    if (opening) return;
    setOpening(userId);
    const { data } = await supabase.rpc("get_or_create_dm", {
      p_target_user_id: userId
    });
    setOpening(null);
    if (data) {
      router.push(`/rooms/${data}`);
      router.refresh();
    }
  }

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {/* Who's online — group rooms only */}
      {!isDm && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:col-span-2">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-white/40">
            🟢 Online now · {online.length}
          </p>
          {online.length === 0 ? (
            <p className="text-[12px] text-white/40">No one else is online right now.</p>
          ) : (
            <div className="scroll-thin flex gap-2 overflow-x-auto pb-1">
              {online.map((m) => {
                const name = m.display_name || m.username || "Someone";
                return (
                  <button
                    key={m.user_id}
                    type="button"
                    onClick={() => void openDM(m.user_id)}
                    disabled={opening === m.user_id}
                    title={`Message ${name} privately`}
                    className="flex w-[64px] shrink-0 flex-col items-center gap-1 disabled:opacity-50"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-emerald-500/50 to-cyan-500/50 text-sm font-semibold text-white">
                      {initials(m.display_name, m.username)}
                    </span>
                    <span className="max-w-[64px] truncate text-[10px] text-white/55">
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Icebreaker */}
      <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-white/40">
          💬 Icebreaker
        </p>
        <p className="flex-1 text-[14px] leading-snug text-white/90">
          {ICEBREAKERS[iceIdx]}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIceIdx((i) => (i + 1) % ICEBREAKERS.length)}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[12px] text-white/70 hover:bg-white/10 hover:text-white"
          >
            🔀 Shuffle
          </button>
          <button
            type="button"
            onClick={() => void drop(ICEBREAKERS[iceIdx]!, "ice")}
            disabled={posting === "ice"}
            className="rounded-lg bg-neon-blue/20 px-3 py-1 text-[12px] font-medium text-white hover:bg-neon-blue/30 disabled:opacity-50"
          >
            {posting === "ice" ? "Dropping…" : "Drop in chat"}
          </button>
        </div>
      </div>

      {/* Daily question */}
      <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-white/40">
          ☀️ Daily question
        </p>
        <p className="flex-1 text-[14px] leading-snug text-white/90">{dailyQ}</p>
        <div className="mt-2">
          <button
            type="button"
            onClick={() => void drop(dailyQ, "daily")}
            disabled={posting === "daily"}
            className="rounded-lg bg-neon-purple/20 px-3 py-1 text-[12px] font-medium text-white hover:bg-neon-purple/30 disabled:opacity-50"
          >
            {posting === "daily" ? "Dropping…" : "Drop in chat"}
          </button>
        </div>
      </div>
    </div>
  );
}
