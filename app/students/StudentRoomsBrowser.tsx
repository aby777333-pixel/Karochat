"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type StudentRoom = {
  id: string;
  name: string;
  description: string | null;
  visibility: "public" | "listed" | "unlisted" | "secret";
  member_count: number;
  created_at: string;
  is_member: boolean;
  subcategory_slug: string | null;
};

const VIS_GLYPH: Record<StudentRoom["visibility"], string> = {
  public: "🌍",
  listed: "🔒",
  unlisted: "🔗",
  secret: "🕶️"
};

/**
 * Lists user-created rooms tagged with category='students'. Powered by
 * the browse_student_user_rooms RPC seeded in migration
 * 0035_wave20_students_lobbies.sql.
 */
export function StudentRoomsBrowser() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [rooms, setRooms] = useState<StudentRoom[] | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: rpcErr } = await supabase.rpc(
        "browse_student_user_rooms",
        { p_limit: 200 }
      );
      if (cancelled) return;
      if (rpcErr) {
        setError(rpcErr.message);
        setRooms([]);
        return;
      }
      setRooms((data ?? []) as StudentRoom[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function enter(room: StudentRoom) {
    if (joining) return;
    setJoining(room.id);
    setError(null);
    if (!room.is_member && room.visibility === "public") {
      const { error: rpcErr } = await supabase.rpc("join_public_room", {
        p_room_id: room.id
      });
      if (rpcErr && !rpcErr.message.toLowerCase().includes("already")) {
        setError(rpcErr.message);
        setJoining(null);
        return;
      }
    }
    router.push(`/rooms/${room.id}`);
    router.refresh();
  }

  const filterLower = filter.trim().toLowerCase();
  const filtered = (rooms ?? []).filter((r) => {
    if (!filterLower) return true;
    return (
      r.name.toLowerCase().includes(filterLower) ||
      (r.description ?? "").toLowerCase().includes(filterLower)
    );
  });

  return (
    <section className="surface-glass tint-blue p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">
            Student rooms (user-created)
          </h2>
          <p className="text-[11px] text-white/45">
            Rooms created by students for students — anyone can join. Same
            chat, voice, video, screen-share, whiteboard.
          </p>
        </div>
        <span className="text-xs text-white/40">
          {rooms === null ? "" : `${rooms.length} rooms`}
        </span>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 focus-within:border-neon-blue/60">
        <span aria-hidden className="text-white/40">🔎</span>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter student rooms by name or description…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/30"
        />
        {filter && (
          <button
            type="button"
            onClick={() => setFilter("")}
            aria-label="Clear"
            className="text-xs text-white/40 hover:text-white/70"
          >
            ✕
          </button>
        )}
      </div>

      {error && (
        <p className="mb-2 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">
          {error}
        </p>
      )}

      {rooms === null ? (
        <p className="text-xs text-white/40">Loading student rooms…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-white/55">
          {filterLower
            ? `Nothing matches "${filter}".`
            : "No student rooms yet — be the first. Use Create a room above."}
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {filtered.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm">
                  <span aria-hidden>{VIS_GLYPH[r.visibility]}</span>
                  <span className="truncate text-white">{r.name}</span>
                  <span className="font-mono text-[11px] text-white/45">
                    · {r.member_count}
                  </span>
                  {r.is_member && (
                    <span className="rounded-sm bg-neon-blue/15 px-1 text-[9px] uppercase tracking-widest text-neon-blue">
                      joined
                    </span>
                  )}
                </p>
                {r.description && (
                  <p className="truncate text-[11px] text-white/50">
                    {r.description}
                  </p>
                )}
              </div>
              {r.is_member ? (
                <Link
                  href={`/rooms/${r.id}`}
                  className={clsx(
                    "shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                  )}
                >
                  Enter →
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => void enter(r)}
                  disabled={joining === r.id}
                  className={clsx(
                    "shrink-0 rounded-lg border border-neon-blue/30 bg-neon-blue/10 px-3 py-1.5 text-xs text-neon-blue hover:bg-neon-blue/20",
                    joining === r.id && "opacity-60"
                  )}
                >
                  {joining === r.id
                    ? "Joining…"
                    : r.visibility === "public"
                    ? "Join →"
                    : "Request →"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
