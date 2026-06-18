"use client";

// Karochat — gentle one-tap "turn on notifications" prompt.
//
// Most people never find the Notifications card in the lobby, so they never
// enable push and miss messages. This shows a single dismissible banner to a
// SIGNED-IN user whose notification permission is still "default" (never asked),
// and wires the one tap straight to permission + push subscription. It hides
// itself forever once enabled or dismissed, and never appears for guests on the
// landing page, on unsupported browsers, or once permission is already decided.

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { usePushSubscribe } from "@/lib/usePushSubscribe";

const DISMISS_KEY = "karochat:notif-prompt-dismissed";

export function EnableNotificationsPrompt() {
  const { subscribe } = usePushSubscribe();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    // Only consider showing where it makes sense.
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return; // already granted/denied
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    // Only for signed-in users (skip landing/login). Small delay so it doesn't
    // pop the instant the app loads.
    void (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user }
        } = await supabase.auth.getUser();
        if (!alive || !user) return;
        setTimeout(() => {
          if (alive && Notification.permission === "default") setShow(true);
        }, 3500);
      } catch {
        /* ignore */
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  function dismiss() {
    setShow(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function enable() {
    setBusy(true);
    try {
      const res = await Notification.requestPermission();
      if (res === "granted") {
        await subscribe();
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
      // Either way the permission is no longer "default" → never ask again.
      dismiss();
    }
  }

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[4.5rem] z-[80] mx-auto flex w-auto max-w-[420px] justify-center sm:bottom-4">
      <div className="surface-glass pointer-events-auto flex items-center gap-3 p-3 shadow-2xl">
        <span className="text-xl" aria-hidden>
          🔔
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Turn on notifications</p>
          <p className="text-[12px] text-white/60">
            Get pinged for messages &amp; calls — even when Karochat is closed.
          </p>
        </div>
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="shrink-0 rounded-lg border border-neon-mint/40 bg-neon-mint/10 px-3 py-1.5 text-sm font-medium text-neon-mint transition hover:bg-neon-mint/20 disabled:opacity-50"
        >
          {busy ? "…" : "Enable"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md px-1.5 py-1 text-white/40 transition hover:text-white/80"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
