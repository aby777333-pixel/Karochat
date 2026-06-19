"use client";

// Karochat — "New community rooms" highlight.
//
// Surfaces the freshest user-created rooms prominently in the lobby so rooms
// people make actually get discovered (not buried in the catalog tree). Rooms
// created in the last 3 days get a glowing NEW badge. Reuses the existing
// browse_user_rooms RPC — no new data layer. Additive + self-contained.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type UserRoom = {
  id: string;
  name: string;
  description: string | null;
  visibility: "public" | "listed" | "unlisted" | "secret";
  member_count: number;
  created_at: string;
  is_member: boolean;
  is_owner: boolean;
};

const VIS_GLYPH: Record<UserRoom["visibility"], string> = {
  public: "🌍",
  listed: "🔒",
  unlisted: "🔗",
  secret: "🕶️"
};

const NEW_WINDOW_MS = 1000 * 60 * 60 * 72; // 72h

export function NewUserRooms() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [rooms, setRooms] = useState<UserRoom[] | null>(null);
  const [joining, setJoining] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [now, setNow] = useState<number>(0);

  async function deleteRoom(room: UserRoom) {
    if (deleting) return;
    if (!confirm(`Delete "${room.name}"? This permanently removes the room and its chat for everyone.`)) return;
    setDeleting(room.id);
    const { error } = await supabase.rpc("delete_room", { p_room_id: room.id });
    setDeleting(null);
    if (error) {
      alert(error.message);
      return;
    }
    setRooms((prev) => (prev ? prev.filter((r) => r.id !== room.id) : prev));
  }

  useEffect(() => {
    setNow(Date.now());
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("browse_user_rooms", {
        p_limit: 60
      });
      if (cancelled) return;
      if (error) {
        setRooms([]);
        return;
      }
      const all = (data ?? []) as UserRoom[];
      // Freshest first; keep the top handful for a compact highlight rail.
      all.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRooms(all.slice(0, 8));
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function enter(room: UserRoom) {
    if (joining) return;
    setJoining(room.id);
    if (!room.is_member && room.visibility === "public") {
      const { error } = await supabase.rpc("join_public_room", {
        p_room_id: room.id
      });
      if (error && !error.message.toLowerCase().includes("already")) {
        setJoining(null);
        return;
      }
    }
    router.push(`/rooms/${room.id}`);
    router.refresh();
  }

  // Hide entirely until we know there's something to show — keeps the lobby
  // clean on fresh installs and never renders an empty card.
  if (rooms === null || rooms.length === 0) return null;

  return (
    <section className="surface-glass tint-amber p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">
            ✨ New community rooms
          </h2>
          <p className="text-[11px] text-white/45">
            Freshly created by people on Karochat — jump in and say hi.
          </p>
        </div>
        <span className="text-xs text-white/40">{rooms.length}</span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {rooms.map((r) => {
          const isNew = now > 0 && now - new Date(r.created_at).getTime() < NEW_WINDOW_MS;
          return (
            <li key={r.id} className="flex items-stretch gap-1.5">
              <button
                type="button"
                onClick={() => void enter(r)}
                disabled={joining === r.id}
                className={clsx(
                  "flex w-full flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
                  isNew
                    ? "border-neon-amber/40 bg-neon-amber/10 hover:bg-neon-amber/20"
                    : "border-white/10 bg-black/20 hover:bg-white/5",
                  joining === r.id && "opacity-60"
                )}
              >
                <span aria-hidden className="shrink-0 text-sm">
                  {VIS_GLYPH[r.visibility]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="break-words text-sm font-medium text-white">
                      {r.name}
                    </span>
                    {isNew && (
                      <span className="rounded-sm bg-neon-amber/25 px-1 text-[9px] font-semibold uppercase tracking-widest text-neon-amber">
                        new
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-white/45">
                      · {r.member_count}
                    </span>
                    {r.is_member && (
                      <span className="rounded-sm bg-neon-mint/15 px-1 text-[9px] uppercase tracking-widest text-neon-mint">
                        joined
                      </span>
                    )}
                  </span>
                  {r.description && (
                    <span className="mt-0.5 block break-words text-[11px] text-white/50">
                      {r.description}
                    </span>
                  )}
                </span>
                <span
                  className={clsx(
                    "shrink-0 self-start rounded-lg border px-2.5 py-1 text-[11px]",
                    r.is_member
                      ? "border-white/10 bg-white/5 text-white/80"
                      : "border-neon-blue/30 bg-neon-blue/10 text-neon-blue"
                  )}
                >
                  {joining === r.id
                    ? "…"
                    : r.is_member
                    ? "Enter →"
                    : r.visibility === "public"
                    ? "Join →"
                    : "Request →"}
                </span>
              </button>
              {r.is_owner && (
                <button
                  type="button"
                  onClick={() => void deleteRoom(r)}
                  disabled={deleting === r.id}
                  className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-2.5 text-white/45 transition hover:bg-neon-red/10 hover:text-neon-red disabled:opacity-50"
                  aria-label={`Delete ${r.name}`}
                  title="Delete this room"
                >
                  🗑
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
