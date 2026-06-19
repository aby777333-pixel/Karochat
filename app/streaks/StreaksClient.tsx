"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type StreakRow = {
  other_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  current_streak: number;
  longest_streak: number;
  is_alive: boolean;
  hours_left: number;
  can_mercy: boolean;
};

export function StreaksClient({ initialStreaks }: { initialStreaks: StreakRow[] }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [streaks, setStreaks] = useState<StreakRow[]>(initialStreaks);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function restore(s: StreakRow) {
    if (busyId) return;
    setBusyId(s.other_id);
    setNote(null);
    const { data, error } = await supabase.rpc("use_streak_mercy", { p_other: s.other_id });
    setBusyId(null);
    if (error) {
      setNote(error.message);
      return;
    }
    if (data === true) {
      setStreaks((prev) =>
        prev.map((x) =>
          x.other_id === s.other_id ? { ...x, is_alive: true, can_mercy: false, hours_left: 48 } : x
        )
      );
      setNote("Streak restored 🔥 — now snap them to keep it going.");
    } else {
      setNote("That streak can no longer be restored.");
    }
  }

  if (streaks.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-8 text-center text-sm text-white/50">
        No streaks yet. Send a friend a snap — when you both snap each other,
        a 🔥 streak begins.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {note && (
        <p className="rounded-md bg-neon-mint/10 px-2 py-1 text-xs text-neon-mint">{note}</p>
      )}
      <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
        {streaks.map((s) => {
          const name = s.display_name ?? s.username ?? "anon";
          const warning = s.is_alive && s.hours_left <= 6;
          return (
            <li key={s.other_id} className="flex items-center gap-3 bg-white/[0.02] px-3 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10">
                {s.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm">{name.slice(0, 1).toUpperCase()}</span>
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white">{name}</p>
                {s.is_alive ? (
                  <p className={`text-[11px] ${warning ? "text-amber-400" : "text-white/45"}`}>
                    {warning ? `⏳ ${s.hours_left}h left — snap to keep it!` : `${s.hours_left}h left today`}
                    {s.longest_streak > s.current_streak && (
                      <span className="text-white/30"> · best {s.longest_streak}</span>
                    )}
                  </p>
                ) : (
                  <p className="text-[11px] text-neon-red">💔 Streak broke</p>
                )}
              </div>

              <span
                className={`shrink-0 text-sm font-semibold ${
                  s.is_alive ? "text-amber-400" : "text-white/30 line-through"
                }`}
                title={`${s.current_streak}-day streak`}
              >
                🔥 {s.current_streak}
              </span>

              {!s.is_alive && s.can_mercy ? (
                <button
                  onClick={() => void restore(s)}
                  disabled={busyId === s.other_id}
                  className="shrink-0 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-1.5 text-xs text-amber-300 hover:bg-amber-400/20 disabled:opacity-50"
                  title="Use your one-time Streak Mercy"
                >
                  🔁 Restore
                </button>
              ) : (
                <Link
                  href={`/snaps?to=${s.other_id}`}
                  onClick={() => router.refresh()}
                  className="shrink-0 rounded-lg border border-neon-blue/40 bg-neon-blue/10 px-2.5 py-1.5 text-xs text-neon-blue hover:bg-neon-blue/20"
                >
                  📸 Snap
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
