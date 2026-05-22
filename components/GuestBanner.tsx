"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * GuestBanner — Wave 19.11.
 *
 * Sticky red warning strip at the top of every authenticated page when
 * the caller is signed in as a guest. Makes the consequence of guest
 * mode unmissable BEFORE they invest in creating rooms / sending
 * messages: signing out deletes everything tied to this identity.
 *
 * The "Use email" CTA opens a confirmation modal -- because the user is
 * already in an anonymous session, a plain link to "/" just bounces
 * them back to /rooms via the home-page redirect. The CTA therefore
 * triggers the same purge_guest_account + signOut flow as Sign Out
 * does, then lands on the landing page where the email login form
 * lives.
 *
 * Dismissible per session (sessionStorage) so it doesn't nag inside
 * the same tab; it returns after a refresh / new tab so people can't
 * forget.
 */
const DISMISS_KEY = "karochat:guest-banner-dismissed";

export function GuestBanner() {
  const router = useRouter();
  const [isGuest, setIsGuest] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function switchToEmail() {
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    // Purge the guest first so their footprint is gone before they pick
    // an email. If the user later signs in with email and changes their
    // mind, that's a separate (clean) account.
    const { error: rpcErr } = await supabase.rpc("purge_guest_account");
    if (rpcErr) {
      setError(rpcErr.message);
      setBusy(false);
      return;
    }
    await supabase.auth.signOut();
    setBusy(false);
    setConfirming(false);
    // Hard navigate so the home-page server render sees a fresh
    // (signed-out) cookie state and shows the email form.
    if (typeof window !== "undefined") {
      window.location.href = "/";
    } else {
      router.replace("/");
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
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={busy}
          className="shrink-0 rounded-md border border-neon-red/50 bg-neon-red/20 px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-white hover:bg-neon-red/30 disabled:opacity-50"
        >
          Use email
        </button>
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

      {confirming && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="switch-to-email-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setConfirming(false);
          }}
        >
          <div className="surface-glass tint-amber my-auto w-[min(460px,94vw)] p-5">
            <p
              id="switch-to-email-title"
              className="font-display text-base font-semibold text-white"
            >
              Switch to email sign-in?
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/85">
              You&apos;re currently a guest. To use email you need to leave
              this guest identity behind — meaning{" "}
              <span className="text-neon-amber">
                your messages, rooms, friendships, mood, status, and every
                other preference will be deleted now
              </span>
              . There&apos;s no recovery.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              You&apos;ll land on the sign-in page next. Enter your email
              there to start a permanent account.
            </p>

            {error && (
              <p className="mt-3 rounded-md bg-neon-red/15 px-2 py-1 text-[12px] text-neon-red">
                {error}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => !busy && setConfirming(false)}
                disabled={busy}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                Stay as guest
              </button>
              <button
                type="button"
                onClick={() => void switchToEmail()}
                disabled={busy}
                className="flex-1 rounded-lg bg-neon-amber px-3 py-2 text-sm font-medium text-ink-900 hover:bg-neon-amber/90 disabled:opacity-50"
              >
                {busy ? "Switching…" : "Delete & switch to email"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
