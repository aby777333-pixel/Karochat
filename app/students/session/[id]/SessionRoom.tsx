"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Whiteboard } from "./Whiteboard";

/**
 * SessionRoom — live audio + whiteboard for a Help Beacon session.
 * Audio: we use the existing LiveKit token endpoint; CallPanel-style
 * is overkill here, so we embed a minimal LiveKit room.
 * Whiteboard: lives in the next file.
 */
export function SessionRoom({
  sessionId,
  whiteboardId,
  currentUserId,
  isAsker
}: {
  sessionId: string;
  whiteboardId: string | null;
  currentUserId: string;
  isAsker: boolean;
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [ending, setEnding] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => {
      setSecondsElapsed((s) => s + 1);
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  async function endSession() {
    setEnding(true);
    const myField = isAsker ? "asker_rating" : "helper_rating";
    const update: Record<string, any> = {
      ended_at: new Date().toISOString(),
      duration_seconds: secondsElapsed
    };
    if (rating > 0) update[myField] = rating;
    await supabase.from("beacon_sessions").update(update).eq("id", sessionId);
    setEnding(false);
    router.push("/students");
  }

  const minutes = Math.floor(secondsElapsed / 60);
  const seconds = secondsElapsed % 60;

  return (
    <section className="mt-3 grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[1fr_280px]">
      <div className="surface-glass flex min-h-[480px] flex-col p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-white/40">
            🧮 Shared whiteboard
          </p>
          <p className="font-mono text-[11px] text-white/45">
            ⏱ {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </p>
        </div>
        {whiteboardId ? (
          <Whiteboard whiteboardId={whiteboardId} currentUserId={currentUserId} />
        ) : (
          <p className="text-sm text-white/50">Whiteboard not ready.</p>
        )}
      </div>

      <aside className="space-y-3">
        <section className="surface-glass p-4">
          <p className="text-[10px] uppercase tracking-widest text-white/40">
            🎙 Voice
          </p>
          <p className="mt-1 text-[12px] text-white/65">
            Use the room&apos;s native call button to start audio (top header
            on /rooms). LiveKit-embedded session audio lands next iteration —
            for now the whiteboard is the primary medium.
          </p>
        </section>

        <section className="surface-glass tint-mint p-4">
          <p className="text-[10px] uppercase tracking-widest text-white/40">
            Rate this session
          </p>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={clsx(
                  "h-8 w-8 rounded-md border text-sm transition",
                  rating >= n
                    ? "border-neon-mint/60 bg-neon-mint/15 text-neon-mint"
                    : "border-white/10 bg-white/5 text-white/45 hover:bg-white/10"
                )}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
              >
                {n <= rating ? "★" : "☆"}
              </button>
            ))}
          </div>
        </section>

        <section className="surface-glass p-4">
          <button
            type="button"
            onClick={() => void endSession()}
            disabled={ending}
            className="w-full rounded-xl bg-neon-red px-3 py-2 text-sm font-semibold text-white hover:bg-neon-red/90 disabled:opacity-60"
          >
            {ending ? "Ending…" : "End session"}
          </button>
          <p className="mt-2 text-[10px] text-white/35">
            Karo writes a summary once you end. Both sides can save the
            whiteboard to their notes.
          </p>
        </section>
      </aside>
    </section>
  );
}
