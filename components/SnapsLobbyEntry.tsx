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
      className="relative flex shrink-0 flex-col items-center gap-0.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white"
      title="Disappearing photo & video snaps"
    >
      <span aria-hidden className="text-base leading-none">📸</span>
      <span className="whitespace-nowrap">Snaps</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 rounded-full bg-neon-mint px-1.5 text-[10px] font-semibold text-ink-900">
          {count}
        </span>
      )}
    </Link>
  );
}
