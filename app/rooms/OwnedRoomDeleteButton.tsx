"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Per-row delete trigger for the lobby's "Your rooms" list. Visible only
 * when the caller is the room owner. Uses the same two-step confirm
 * pattern as the room-header delete (confirm → type DELETE).
 */
export function OwnedRoomDeleteButton({
  roomId,
  roomName
}: {
  roomId: string;
  roomName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ok = confirm(
      `Delete "${roomName}" for everyone? This wipes every message and removes all members. This cannot be undone.`
    );
    if (!ok) return;
    const typed = prompt(
      `Type DELETE to confirm you want to permanently delete "${roomName}".`
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
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={`Delete ${roomName}`}
      title="Delete this room (you own it)"
      className="shrink-0 rounded-lg border border-neon-red/30 bg-neon-red/10 px-2.5 py-1.5 text-xs text-neon-red transition hover:bg-neon-red/20 disabled:opacity-50"
    >
      {pending ? "…" : (
        <>
          <span aria-hidden>🗑</span>
          <span className="ml-1 hidden md:inline">Delete</span>
          {error && <span className="sr-only"> — {error}</span>}
        </>
      )}
    </button>
  );
}
