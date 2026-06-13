"use client";

// Karochat — "Live now" banner.
//
// Surfaces every active live broadcast in the lobby (and anywhere it's
// mounted) so anyone can jump in as audience. Live-updates via the
// live_broadcasts realtime publication; hides itself when nothing is live.
// Reuses join_public_room + the room ?call= deep-link to drop the viewer
// straight into the broadcast.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Broadcast = {
  id: string;
  host_id: string;
  room_id: string;
  title: string;
  mode: "video" | "audio";
  host_name: string;
  started_at: string;
  member_count: number;
};

export function LiveBroadcasts() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [live, setLive] = useState<Broadcast[]>([]);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data } = await supabase.rpc("active_broadcasts");
      if (alive) setLive((data ?? []) as Broadcast[]);
    }
    void load();
    const channel = supabase
      .channel("live-broadcasts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_broadcasts" },
        () => void load()
      )
      .subscribe();
    // Light refresh so member counts + stale sessions stay roughly current.
    const iv = setInterval(() => void load(), 60000);
    return () => {
      alive = false;
      clearInterval(iv);
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  async function join(b: Broadcast) {
    if (joining) return;
    setJoining(b.id);
    const { error } = await supabase.rpc("join_public_room", {
      p_room_id: b.room_id
    });
    if (error && !error.message.toLowerCase().includes("already")) {
      setJoining(null);
      return;
    }
    router.push(`/rooms/${b.room_id}?call=${b.mode}`);
    router.refresh();
  }

  if (live.length === 0) return null;

  return (
    <section className="surface-glass border-neon-red/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-red opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-neon-red" />
        </span>
        <h2 className="font-display text-lg font-semibold text-white">Live now</h2>
        <span className="text-xs text-white/40">{live.length}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {live.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => void join(b)}
              disabled={joining === b.id}
              className="flex w-full items-center gap-3 rounded-xl border border-neon-red/30 bg-gradient-to-r from-red-500/15 to-black/30 px-3 py-2.5 text-left transition hover:border-neon-red/60 hover:from-red-500/25 disabled:opacity-60"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-neon-red/20 text-lg">
                {b.mode === "video" ? "📹" : "🎙️"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="rounded-sm bg-neon-red px-1 text-[9px] font-bold uppercase tracking-widest text-white">
                    Live
                  </span>
                  <span className="break-words text-sm font-semibold text-white">
                    {b.title}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-white/60">
                  {b.host_name} · {b.member_count} watching
                </span>
              </span>
              <span className="shrink-0 rounded-lg border border-neon-red/40 bg-neon-red/15 px-3 py-1.5 text-[11px] font-medium text-neon-red">
                {joining === b.id ? "…" : "Join →"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
