"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const LOBBY_ID = "00000000-0000-0000-0000-00000000aaaa";

export function LeaveRoomButton({
  roomId,
  roomName,
  currentUserId
}: {
  roomId: string;
  roomName: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // The Lobby is sticky — auto-join trigger would just re-add the user.
  if (roomId === LOBBY_ID) return null;

  function onClick() {
    if (!confirm(`Leave “${roomName}”? You'll need an invite again if it's private.`))
      return;
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("room_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", currentUserId);
      if (error) {
        alert(`Could not leave: ${error.message}`);
        return;
      }
      router.replace("/rooms");
      router.refresh();
    });
  }

  return (
    <button
      onClick={onClick}
      disabled={pending}
      aria-label="Leave room"
      title="Leave room"
      className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60 transition hover:border-neon-red/40 hover:bg-neon-red/10 hover:text-white"
    >
      <span aria-hidden>🚪</span>
      <span className="hidden md:inline">{pending ? "Leaving…" : "Leave room"}</span>
    </button>
  );
}
