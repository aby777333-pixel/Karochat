"use client";

import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

// 30s heartbeat. Pause on hidden tab — counts as away after 5 min via server cleanup later.
export function usePresenceHeartbeat(
  supabase: SupabaseClient,
  currentState: "online" | "away" | "busy" | "invisible" | "offline"
) {
  useEffect(() => {
    let cancelled = false;

    async function ping(state: typeof currentState) {
      if (cancelled) return;
      await supabase.rpc("touch_presence", { p_state: state });
    }

    void ping(currentState);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void ping(currentState);
    }, 30_000);

    function onVisibility() {
      if (document.visibilityState === "visible") void ping(currentState);
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [supabase, currentState]);
}
