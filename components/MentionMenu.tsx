"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * MentionMenu — Wave 18.
 *
 * Floating autocomplete popover that appears when the composer detects a
 * pending @-mention. Lists room members whose username matches the query.
 */
type Member = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  presence_state?: string | null;
};

export function MentionMenu({
  roomId,
  query,
  currentUserId,
  onPick,
  onClose
}: {
  roomId: string;
  query: string;
  currentUserId: string;
  onPick: (username: string) => void;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("room_members_view")
        .select("user_id, username, display_name, presence_state")
        .eq("room_id", roomId)
        .limit(120);
      if (!cancelled && data) setMembers(data as Member[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, roomId]);

  const q = query.trim().toLowerCase();
  const list = members
    .filter((m) => m.user_id !== currentUserId && m.username)
    .filter((m) => {
      if (!q) return true;
      const u = (m.username ?? "").toLowerCase();
      const d = (m.display_name ?? "").toLowerCase();
      return u.startsWith(q) || u.includes(q) || d.includes(q);
    })
    .slice(0, 6);

  if (list.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Mention member"
      className="absolute bottom-14 left-0 z-[60] w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-ink-800/95 p-1 shadow-xl backdrop-blur"
    >
      <div className="flex items-center justify-between px-2 pb-1">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          @ mention
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-white/10 bg-white/5 px-1.5 text-[10px] text-white/60 hover:bg-white/10"
          aria-label="Close mention menu"
        >
          ✕
        </button>
      </div>
      <ul>
        {list.map((m) => (
          <li key={m.user_id}>
            <button
              type="button"
              onClick={() => m.username && onPick(m.username)}
              className="block w-full rounded-md px-2 py-1 text-left text-xs hover:bg-white/10"
            >
              <span className="text-white">
                {m.display_name ?? m.username ?? "someone"}
              </span>
              <span className="ml-1 text-white/50">@{m.username}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
