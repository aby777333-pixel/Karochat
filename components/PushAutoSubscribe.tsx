"use client";

import { useEffect } from "react";
import { usePushSubscribe } from "@/lib/usePushSubscribe";

/**
 * Mount-once helper: if the user has already granted notification permission,
 * silently (re)register their Web Push subscription so server pings (radar
 * waves/calls) can reach them in the background. Renders nothing and never
 * prompts — the explicit opt-in lives in the radar UI.
 */
export function PushAutoSubscribe() {
  const { subscribe } = usePushSubscribe();
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      void subscribe();
    }
  }, [subscribe]);
  return null;
}
