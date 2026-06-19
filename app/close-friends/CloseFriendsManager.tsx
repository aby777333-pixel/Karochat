"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type FriendRow = {
  friend_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_close: boolean;
};

export function CloseFriendsManager({ initialFriends }: { initialFriends: FriendRow[] }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [friends, setFriends] = useState<FriendRow[]>(initialFriends);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return friends;
    return friends.filter((f) =>
      `${f.display_name ?? ""} ${f.username ?? ""}`.toLowerCase().includes(needle)
    );
  }, [friends, q]);

  const closeCount = friends.filter((f) => f.is_close).length;

  async function toggle(f: FriendRow) {
    if (busyId) return;
    setError(null);
    setBusyId(f.friend_id);
    const adding = !f.is_close;
    // Optimistic flip.
    setFriends((prev) =>
      prev.map((x) => (x.friend_id === f.friend_id ? { ...x, is_close: adding } : x))
    );
    const { error: rpcErr } = adding
      ? await supabase.rpc("add_close_friend", { p_friend: f.friend_id })
      : await supabase.rpc("remove_close_friend", { p_friend: f.friend_id });
    if (rpcErr) {
      // Roll back.
      setFriends((prev) =>
        prev.map((x) => (x.friend_id === f.friend_id ? { ...x, is_close: !adding } : x))
      );
      setError(rpcErr.message);
    }
    setBusyId(null);
  }

  if (friends.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-6 text-center text-sm text-white/50">
        You have no friends yet. Add some from their profile, then come back to
        build your close-friends circle.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search friends…"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-mint/60"
        />
        <span className="shrink-0 rounded-lg bg-neon-mint/10 px-2.5 py-2 text-xs text-neon-mint">
          {closeCount} close
        </span>
      </div>

      {error && (
        <p className="rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{error}</p>
      )}

      <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
        {filtered.map((f) => {
          const name = f.display_name ?? f.username ?? "anon";
          return (
            <li key={f.friend_id} className="flex items-center gap-3 bg-white/[0.02] px-3 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10">
                {f.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs">{name.slice(0, 1).toUpperCase()}</span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white">{name}</p>
                <p className="truncate text-[11px] text-white/40">@{f.username ?? "anon"}</p>
              </div>
              <button
                type="button"
                onClick={() => void toggle(f)}
                disabled={busyId === f.friend_id}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs transition disabled:opacity-50 ${
                  f.is_close
                    ? "border-neon-mint/50 bg-neon-mint/15 text-neon-mint"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {f.is_close ? "💚 Close" : "+ Add"}
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-white/40">No matches.</li>
        )}
      </ul>
    </div>
  );
}
