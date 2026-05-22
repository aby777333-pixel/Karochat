"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * GuestBanner — Wave 19.11.
 *
 * Sticky red warning strip at the top of every authenticated page when
 * the caller is signed in as a guest. Makes the consequence of guest
 * mode unmissable BEFORE they invest in creating rooms / sending
 * messages: signing out deletes everything tied to this identity.
 *
 * Dismissible per session (sessionStorage) so it doesn't nag inside
 * the same tab; it returns after a refresh / new tab so people can't
 * forget.
 */
const DISMISS_KEY = "karochat:guest-banner-dismissed";

export function GuestBanner() {
  const [isGuest, setIsGuest] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(DISMISS_KEY) === "1") {
        setDismissed(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        if (alive) setIsGuest(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("is_guest")
        .eq("id", user.id)
        .maybeSingle();
      if (alive) setIsGuest(!!data?.is_guest);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (isGuest !== true || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  }

  return (
    <div
      role="alert"
      aria-label="Guest mode warning"
      className="sticky top-0 z-[70] border-b border-neon-red/40 bg-neon-red/15 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2 text-[12px] text-neon-red/95 md:text-sm">
        <span aria-hidden className="shrink-0 text-base">⚠️</span>
        <p className="min-w-0 flex-1">
          <strong className="text-neon-red">You&apos;re signed in as a guest.</strong>{" "}
          <span className="text-neon-red/85">
            Your messages, rooms, friendships, mood, status — everything tied
            to this identity gets deleted the moment you sign out. Sign in
            with an email to keep it forever.
          </span>
        </p>
        <a
          href="/?switch=email"
          className="shrink-0 rounded-md border border-neon-red/50 bg-neon-red/20 px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-white hover:bg-neon-red/30"
        >
          Use email
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss for this session"
          title="Dismiss for this session"
          className="shrink-0 rounded-md border border-neon-red/40 bg-neon-red/10 px-2 py-1 text-[11px] text-neon-red/80 hover:bg-neon-red/20"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
