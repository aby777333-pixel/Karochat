"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PresenceDot } from "@/components/PresenceDot";

type UserHit = {
  id: string;
  username: string | null;
  display_name: string | null;
  is_guest: boolean | null;
  presence_state: string | null;
};

type RoomHit = {
  id: string;
  name: string;
  description: string | null;
  visibility: "public" | "listed" | "unlisted" | "secret";
  member_count: number;
  is_member: boolean;
};

const VIS_GLYPH: Record<RoomHit["visibility"], string> = {
  public: "🌍",
  listed: "🔒",
  unlisted: "🔗",
  secret: "🕶️"
};

export function UserSearch() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<UserHit[]>([]);
  const [rooms, setRooms] = useState<RoomHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 1) {
      setPeople([]);
      setRooms([]);
      setError(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      setError(null);
      const [usersResp, roomsResp] = await Promise.all([
        supabase.rpc("search_users", { p_query: q }),
        supabase.rpc("search_rooms", { p_query: q })
      ]);
      setBusy(false);
      if (usersResp.error) {
        setError(usersResp.error.message);
      } else if (roomsResp.error) {
        setError(roomsResp.error.message);
      }
      setPeople((usersResp.data ?? []) as UserHit[]);
      setRooms((roomsResp.data ?? []) as RoomHit[]);
    }, 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, supabase]);

  async function openDM(target: UserHit) {
    setOpening(target.id);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("get_or_create_dm", {
      p_target_user_id: target.id
    });
    setOpening(null);
    if (rpcErr || !data) {
      setError(rpcErr?.message ?? "Could not start a DM.");
      return;
    }
    router.push(`/rooms/${data}`);
    router.refresh();
  }

  async function openOrJoinRoom(room: RoomHit) {
    setOpening(room.id);
    setError(null);
    if (room.is_member) {
      router.push(`/rooms/${room.id}`);
      router.refresh();
      setOpening(null);
      return;
    }
    if (room.visibility === "public") {
      const { error: rpcErr } = await supabase.rpc("join_public_room", {
        p_room_id: room.id
      });
      setOpening(null);
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      router.push(`/rooms/${room.id}`);
      router.refresh();
      return;
    }
    // Listed/unlisted/secret — let them know they need an invite/request.
    setOpening(null);
    setError(
      room.visibility === "listed"
        ? "That room requires a request to join — coming next."
        : "That room is invite-only. Ask the owner for a code."
    );
  }

  const hasQuery = query.trim().length > 0;
  const hasResults = people.length > 0 || rooms.length > 0;

  return (
    <section className="surface-glass tint-pink p-5">
      <h3 className="font-display text-base font-semibold">Find a person or room</h3>
      <p className="mt-1 text-xs text-white/60">
        Search by @handle, display name, or room name. Tap a result to start
        a private chat or enter the room.
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 focus-within:border-neon-blue/60">
        <span aria-hidden className="text-white/40">🔎</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="@username or #room…"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/30"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear"
            className="text-xs text-white/40 hover:text-white/70"
          >
            ✕
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-neon-red">{error}</p>}
      {hasQuery && (
        <div className="mt-3 space-y-3">
          {busy ? (
            <p className="text-xs text-white/40">Searching…</p>
          ) : !hasResults ? (
            <p className="text-xs text-white/40">No one and no rooms match that yet.</p>
          ) : (
            <>
              {people.length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-widest text-white/40">
                    People
                  </p>
                  <ul className="divide-y divide-white/5">
                    {people.map((h) => {
                      const name = h.display_name ?? h.username ?? "Unknown";
                      const handle = h.username ?? "anon";
                      const isOpening = opening === h.id;
                      return (
                        <li
                          key={h.id}
                          className="flex items-center justify-between gap-2 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <PresenceDot state={h.presence_state ?? "offline"} pulse />
                            <div className="min-w-0">
                              <p className="truncate text-sm">
                                <span className="text-white">{name}</span>
                                {h.is_guest && (
                                  <span className="ml-1 rounded-sm bg-white/10 px-1 text-[9px] uppercase tracking-widest text-white/50">
                                    guest
                                  </span>
                                )}
                              </p>
                              <p className="truncate text-[11px] text-white/40">
                                @{handle}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void openDM(h)}
                            disabled={isOpening}
                            className={clsx(
                              "rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white",
                              isOpening && "opacity-50"
                            )}
                          >
                            {isOpening ? "Opening…" : "Message →"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {rooms.length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-widest text-white/40">
                    Rooms
                  </p>
                  <ul className="divide-y divide-white/5">
                    {rooms.map((r) => {
                      const isOpening = opening === r.id;
                      return (
                        <li
                          key={r.id}
                          className="flex items-center justify-between gap-2 py-2"
                        >
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-sm">
                              <span aria-hidden>{VIS_GLYPH[r.visibility]}</span>
                              <span className="truncate text-white">{r.name}</span>
                              <span className="text-[11px] text-white/40">
                                · {r.member_count} member{r.member_count === 1 ? "" : "s"}
                              </span>
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
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
                            >
                              Enter →
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void openOrJoinRoom(r)}
                              disabled={isOpening}
                              className={clsx(
                                "rounded-lg border border-neon-blue/30 bg-neon-blue/10 px-3 py-1.5 text-xs text-neon-blue transition hover:bg-neon-blue/20",
                                isOpening && "opacity-50"
                              )}
                            >
                              {isOpening
                                ? "Joining…"
                                : r.visibility === "public"
                                ? "Join →"
                                : r.visibility === "listed"
                                ? "Request →"
                                : "Invite-only"}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
