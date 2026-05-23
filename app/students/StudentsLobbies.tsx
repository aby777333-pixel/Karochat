"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Lobby = {
  id: string;
  name: string;
  topic: string;
  visibility: string;
  capacity: number;
  member_count: number;
  band: string;
  sort_order: number;
};

type BandMeta = { glyph: string; tint: string; hint: string };

const FALLBACK_META: BandMeta = {
  glyph: "·",
  tint: "from-white/10 to-white/0",
  hint: ""
};

const BAND_META: Record<string, BandMeta> = {
  common:  { glyph: "🛋️", tint: "from-neon-mint/20 to-neon-mint/0",   hint: "Open to every learner, every age." },
  "13-15": { glyph: "🧒",  tint: "from-neon-blue/20 to-neon-blue/0",   hint: "Middle school and early high school." },
  "16-17": { glyph: "🎒",  tint: "from-neon-blue/15 to-neon-purple/0", hint: "Late high school — exams, college apps." },
  "18-22": { glyph: "🎓",  tint: "from-neon-purple/20 to-neon-purple/0", hint: "Undergrad — courses, internships." },
  "23-29": { glyph: "📚",  tint: "from-neon-amber/20 to-neon-amber/0", hint: "Grad school, early career, transitions." },
  "30+":   { glyph: "🧑‍🏫", tint: "from-neon-red/15 to-neon-red/0",     hint: "Lifelong learners, returning students." },
  other:   FALLBACK_META
};

function metaFor(band: string): BandMeta {
  return BAND_META[band] ?? FALLBACK_META;
}

/**
 * Renders the seeded common + per-age-group lobbies as a featured grid at
 * the top of the Students area. Clicking a lobby joins it (via
 * join_public_room — they're seeded as public) and routes to /rooms/[id]
 * so it uses the exact same chat / call / member-list infrastructure as
 * any other Karochat room.
 */
export function StudentsLobbies() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [lobbies, setLobbies] = useState<Lobby[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: rpcErr } = await supabase.rpc("list_student_lobbies");
      if (cancelled) return;
      if (rpcErr) {
        setError(rpcErr.message);
        setLobbies([]);
        return;
      }
      setLobbies((data ?? []) as Lobby[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function enter(lobby: Lobby) {
    if (joining) return;
    setJoining(lobby.id);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("join_public_room", {
      p_room_id: lobby.id
    });
    if (rpcErr && !rpcErr.message.toLowerCase().includes("already")) {
      setError(rpcErr.message);
      setJoining(null);
      return;
    }
    router.push(`/rooms/${lobby.id}`);
    router.refresh();
  }

  if (lobbies === null) {
    return (
      <section className="surface-glass tint-mint p-5">
        <p className="text-sm text-white/45">Loading lobbies…</p>
      </section>
    );
  }

  if (lobbies.length === 0) {
    return (
      <section className="surface-glass tint-mint p-5">
        <h3 className="font-display text-lg font-semibold">Common lobbies</h3>
        <p className="mt-2 text-sm text-white/65">
          Lobby rooms haven&apos;t been seeded yet. Ask the operator to run
          migration{" "}
          <code className="rounded bg-white/10 px-1 text-xs">
            0035_wave20_students_lobbies.sql
          </code>
          .
        </p>
        {error && (
          <p className="mt-2 text-xs text-neon-red">{error}</p>
        )}
      </section>
    );
  }

  const common = lobbies.find((l) => l.band === "common");
  const ageBands = lobbies.filter((l) => l.band !== "common");

  return (
    <section className="space-y-4">
      {common && (
        <button
          type="button"
          onClick={() => void enter(common)}
          disabled={joining === common.id}
          className={clsx(
            "group block w-full rounded-3xl border border-neon-mint/40 bg-gradient-to-br p-6 text-left transition hover:border-neon-mint/70",
            metaFor("common").tint
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
                🛋️ Students Common Lobby
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-white">
                {common.name}
              </h2>
              <p className="mt-1 text-sm text-white/70">
                {metaFor("common").hint} {common.member_count} member
                {common.member_count === 1 ? "" : "s"} in there now.
              </p>
            </div>
            <span className="rounded-xl bg-neon-mint px-4 py-2 text-sm font-semibold text-ink-900 transition group-hover:bg-neon-mint/80">
              {joining === common.id ? "Joining…" : "Enter →"}
            </span>
          </div>
        </button>
      )}

      <div>
        <h3 className="font-display text-base font-semibold text-white">
          By age group
        </h3>
        <p className="mt-0.5 text-xs text-white/55">
          Choose your band. Karochat&apos;s minimum is 13 — every band is
          opt-in.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {ageBands.map((lobby) => {
            const meta = metaFor(lobby.band);
            return (
              <button
                key={lobby.id}
                type="button"
                onClick={() => void enter(lobby)}
                disabled={joining === lobby.id}
                className={clsx(
                  "group rounded-2xl border border-white/10 bg-gradient-to-br p-4 text-left transition hover:border-white/30 hover:bg-white/[0.03]",
                  meta.tint
                )}
              >
                <p className="text-2xl">{meta.glyph}</p>
                <p className="mt-1 font-semibold text-white">{lobby.name}</p>
                <p className="mt-0.5 text-[11px] text-white/55">{meta.hint}</p>
                <p className="mt-2 font-mono text-[11px] text-white/45">
                  {lobby.member_count} 👤 ·{" "}
                  <span className="text-neon-mint/80">
                    {joining === lobby.id ? "Joining…" : "Enter →"}
                  </span>
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">
          {error}
        </p>
      )}
    </section>
  );
}
