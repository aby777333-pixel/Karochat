"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Lobby entry for Snaps with a live count of unopened (received, not-yet-viewed)
 * snaps. Refreshes on mount and whenever a new snap addressed to me arrives.
 */
export function SnapsLobbyEntry({ currentUserId }: { currentUserId: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc("list_inbox_snaps");
    const n = (data ?? []).filter((s: { viewed_at: string | null }) => !s.viewed_at).length;
    setCount(n);
  }, [supabase]);

  useEffect(() => {
    void refresh();
    const ch = supabase
      .channel("snaps-lobby-badge")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "snaps",
          filter: `recipient_profile_id=eq.${currentUserId}`
        },
        () => void refresh()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase, currentUserId, refresh]);

  return (
    <Link
      href="/snaps"
      className="inline-flex items-center gap-1 hover:text-white/80"
      title="Disappearing photo & video snaps"
    >
      📸 Snaps
      {count > 0 && (
        <span className="rounded-full bg-neon-mint/20 px-1.5 text-[10px] font-medium text-neon-mint">
          {count}
        </span>
      )}
    </Link>
  );
}
