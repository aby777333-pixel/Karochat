"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const LOBBY_ID = "00000000-0000-0000-0000-00000000aaaa";

/**
 * Header action for the current room. Two shapes:
 *  • Non-owner: 🚪 Leave room — removes their membership.
 *  • Owner:     🗑 Delete room — removes the room entirely (room_members
 *               and messages cascade via FK).
 * The Lobby is opted out of both (auto-join would just re-add a leaver,
 * and the delete RPC blocks the lobby UUID anyway).
 */
export function LeaveRoomButton({
  roomId,
  roomName,
  currentUserId,
  isOwner = false
}: {
  roomId: string;
  roomName: string;
  currentUserId: string;
  isOwner?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (roomId === LOBBY_ID) return null;

  function leave() {
    if (
      !confirm(
        `Leave “${roomName}”? You'll need an invite again if it's private.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error: delErr } = await supabase
        .from("room_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", currentUserId);
      if (delErr) {
        setError(delErr.message);
        alert(`Could not leave: ${delErr.message}`);
        return;
      }
      router.replace("/rooms");
      router.refresh();
    });
  }

  function deleteRoom() {
    const ok = confirm(
      `Delete “${roomName}” for everyone? This wipes every message in the room and removes all members. This cannot be undone.`
    );
    if (!ok) return;
    // Two-step confirm because this is destructive and irreversible.
    const typed = prompt(
      `Type DELETE to confirm you want to permanently delete “${roomName}”.`
    );
    if (typed !== "DELETE") return;
    setError(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error: rpcErr } = await supabase.rpc("delete_room", {
        p_room_id: roomId
      });
      if (rpcErr) {
        setError(rpcErr.message);
        alert(`Could not delete: ${rpcErr.message}`);
        return;
      }
      router.replace("/rooms");
      router.refresh();
    });
  }

  if (isOwner) {
    return (
      <button
        onClick={deleteRoom}
        disabled={pending}
        aria-label="Delete room"
        title={`Delete ${roomName} for everyone (permanent)`}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-neon-red/40 bg-neon-red/10 px-2.5 py-1 text-[11px] text-neon-red transition hover:bg-neon-red/20 disabled:opacity-50"
      >
        <span aria-hidden>🗑</span>
        <span className="hidden md:inline">
          {pending ? "Deleting…" : "Delete room"}
        </span>
        {error && <span className="sr-only">{error}</span>}
      </button>
    );
  }

  return (
    <button
      onClick={leave}
      disabled={pending}
      aria-label="Leave room"
      title="Leave room"
      className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60 transition hover:border-neon-red/40 hover:bg-neon-red/10 hover:text-white"
    >
      <span aria-hidden>🚪</span>
      <span className="hidden md:inline">
        {pending ? "Leaving…" : "Leave room"}
      </span>
    </button>
  );
}
