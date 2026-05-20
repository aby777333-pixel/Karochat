"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PresenceDot } from "@/components/PresenceDot";

type Person = {
  id: string;
  username: string | null;
  display_name: string | null;
  is_guest: boolean | null;
  presence_state: string | null;
};

/**
 * v6 invite-people-directly. Owner picks from:
 *   1. Their accepted friends (default selection list)
 *   2. Any handle/display-name search across all profiles
 * Selected people are bulk-added via invite_user_to_room (owner-only RPC).
 */
export function InvitePeoplePicker({
  roomId,
  isOwner
}: {
  roomId: string;
  isOwner: boolean;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [friends, setFriends] = useState<Person[] | null>(null);
  const [members, setMembers] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [searchHits, setSearchHits] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load friends + room members (so we can hide already-in-room rows).
  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    (async () => {
      const [friendsResp, membersResp] = await Promise.all([
        supabase
          .from("my_friends_view")
          .select("friend_id, username, display_name, is_guest, presence_state"),
        supabase.from("room_members").select("user_id").eq("room_id", roomId)
      ]);
      if (cancelled) return;
      const mappedFriends = ((friendsResp.data ?? []) as any[]).map((f) => ({
        id: f.friend_id,
        username: f.username,
        display_name: f.display_name,
        is_guest: f.is_guest,
        presence_state: f.presence_state
      }));
      setFriends(mappedFriends);
      setMembers(
        new Set(((membersResp.data ?? []) as any[]).map((m) => m.user_id))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, roomId, isOwner]);

  // Debounced search across all users (search_users RPC excludes the caller).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 1) {
      setSearchHits([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const { data, error: rpcErr } = await supabase.rpc("search_users", {
        p_query: q
      });
      setSearching(false);
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      const rows = ((data ?? []) as any[]).map((u) => ({
        id: u.id,
        username: u.username,
        display_name: u.display_name,
        is_guest: u.is_guest,
        presence_state: u.presence_state
      }));
      setSearchHits(rows);
    }, 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, supabase]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function sendInvites() {
    if (busy || selected.size === 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    let added = 0;
    const failures: string[] = [];
    for (const userId of Array.from(selected)) {
      const { error: rpcErr } = await supabase.rpc("invite_user_to_room", {
        p_room_id: roomId,
        p_target_user_id: userId
      });
      if (rpcErr) failures.push(rpcErr.message);
      else added++;
    }
    setBusy(false);
    if (added > 0) {
      setMembers((prev) => {
        const next = new Set(prev);
        for (const id of selected) next.add(id);
        return next;
      });
      setSelected(new Set());
    }
    if (failures.length > 0) {
      setError(`Added ${added}/${added + failures.length}. ${failures[0]}`);
    } else {
      setNotice(`Added ${added} ${added === 1 ? "person" : "people"} to the room.`);
    }
  }

  if (!isOwner) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 bg-black/20 px-3 py-3 text-xs text-white/55">
        Only the room owner can add people directly. Share the invite link
        above and let them join themselves.
      </p>
    );
  }

  const friendRows = (friends ?? []).filter((f) => !members.has(f.id));
  const searchRows = searchHits.filter(
    (h) => !members.has(h.id) && !friendRows.some((f) => f.id === h.id)
  );

  return (
    <div className="space-y-3">
      {/* Friends list */}
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-widest text-white/40">
          Your friends
        </p>
        {friends === null ? (
          <p className="text-xs text-white/40">Loading…</p>
        ) : friendRows.length === 0 ? (
          <p className="text-xs text-white/45">
            {friends.length === 0
              ? "No friends yet — add some via the chat header."
              : "Everyone you're friends with is already in this room."}
          </p>
        ) : (
          <ul className="max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-1">
            {friendRows.map((f) => (
              <PickerRow
                key={f.id}
                person={f}
                checked={selected.has(f.id)}
                onToggle={() => toggle(f.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Search anyone */}
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-widest text-white/40">
          Search anyone
        </p>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 focus-within:border-neon-blue/60">
          <span aria-hidden className="text-white/40">🔎</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="@handle or display name…"
            spellCheck={false}
            autoComplete="off"
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
        {query.trim() && (
          <ul className="mt-1 max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-1">
            {searching ? (
              <li className="px-2 py-1.5 text-xs text-white/40">Searching…</li>
            ) : searchRows.length === 0 ? (
              <li className="px-2 py-1.5 text-xs text-white/40">
                {searchHits.length === 0
                  ? "No matches yet."
                  : "Everyone matching is already in this room or in your friends list above."}
              </li>
            ) : (
              searchRows.map((p) => (
                <PickerRow
                  key={p.id}
                  person={p}
                  checked={selected.has(p.id)}
                  onToggle={() => toggle(p.id)}
                />
              ))
            )}
          </ul>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="rounded-md bg-neon-mint/10 px-2 py-1 text-xs text-neon-mint">
          {notice}
        </p>
      )}

      <button
        type="button"
        onClick={() => void sendInvites()}
        disabled={busy || selected.size === 0}
        className={clsx(
          "w-full rounded-xl px-3 py-2 text-sm font-medium transition disabled:opacity-50",
          selected.size > 0
            ? "bg-neon-blue text-ink-900 shadow-glow-blue hover:bg-neon-blue/90"
            : "border border-white/10 bg-white/5 text-white/60"
        )}
      >
        {busy
          ? "Adding…"
          : selected.size === 0
          ? "Pick people above"
          : `Invite ${selected.size} ${selected.size === 1 ? "person" : "people"} →`}
      </button>
      <p className="text-[10px] text-white/35">
        Owner-only. Picked people are added immediately — they get a
        notification next time they open Karochat.
      </p>
    </div>
  );
}

function PickerRow({
  person,
  checked,
  onToggle
}: {
  person: Person;
  checked: boolean;
  onToggle: () => void;
}) {
  const name = person.display_name ?? person.username ?? "Unknown";
  const handle = person.username ?? "anon";
  return (
    <li>
      <label
        className={clsx(
          "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/10",
          checked && "bg-neon-blue/10"
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="accent-neon-blue"
        />
        <PresenceDot state={person.presence_state ?? "offline"} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            <span className="text-white">{name}</span>
            {person.is_guest && (
              <span className="ml-1 rounded-sm bg-white/10 px-1 text-[9px] uppercase tracking-widest text-white/50">
                guest
              </span>
            )}
          </p>
          <p className="truncate text-[11px] text-white/40">@{handle}</p>
        </div>
      </label>
    </li>
  );
}
