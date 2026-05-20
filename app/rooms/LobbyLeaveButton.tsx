"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Per-row leave control for the lobby's "Your rooms" list. Shown when the
 * caller is a member but NOT the owner. Removes the membership row and
 * refreshes the lobby so the room drops out of the list.
 *
 * The Lobby itself is excluded because users get auto-joined back — there's
 * no value in churning the membership row only to have it recreated.
 */
const LOBBY_ID = "00000000-0000-0000-0000-00000000aaaa";

export function LobbyLeaveButton({
  roomId,
  roomName
}: {
  roomId: string;
  roomName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (roomId === LOBBY_ID) return null;

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ok = confirm(
      `Leave "${roomName}"? It'll come back to your list if you re-join.`
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error: delErr } = await supabase
        .from("room_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", user.id);
      if (delErr) {
        setError(delErr.message);
        alert(`Could not leave: ${delErr.message}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={`Leave ${roomName}`}
      title="Leave this room"
      className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/65 transition hover:border-neon-amber/40 hover:bg-neon-amber/10 hover:text-neon-amber disabled:opacity-50"
    >
      {pending ? "…" : (
        <>
          <span aria-hidden>🚪</span>
          <span className="ml-1 hidden md:inline">Leave</span>
          {error && <span className="sr-only"> — {error}</span>}
        </>
      )}
    </button>
  );
}
