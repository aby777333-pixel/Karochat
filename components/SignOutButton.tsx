"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Sign-out trigger.
 *
 * Wave 19.9 behaviour split:
 *   • Email accounts (profiles.is_guest = false) — plain Supabase
 *     signOut. Profile + rooms + messages + preferences all persist
 *     for the next sign-in.
 *   • Guest accounts (profiles.is_guest = true) — show a clear
 *     confirmation that signing out will wipe their footprint, then
 *     call purge_guest_account() RPC (deletes their owned rooms
 *     and the auth.users row, cascading the rest), THEN signOut.
 */
export function SignOutButton() {
  const router = useRouter();
  const [isGuest, setIsGuest] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check guest status once on mount so we can branch sign-out behaviour
  // without an extra round-trip when the button is clicked.
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

  async function plainSignOut() {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setBusy(false);
    router.replace("/");
    router.refresh();
  }

  async function guestPurgeAndSignOut() {
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: rpcErr } = await supabase.rpc("purge_guest_account");
    if (rpcErr) {
      setError(rpcErr.message);
      setBusy(false);
      return;
    }
    // The auth.users row is now gone; sign out the dead session and
    // bounce to the landing page.
    await supabase.auth.signOut();
    setConfirming(false);
    setBusy(false);
    router.replace("/");
    router.refresh();
  }

  function onClick() {
    if (isGuest) {
      setConfirming(true);
      return;
    }
    void plainSignOut();
  }

  return (
    <>
      <button
        onClick={onClick}
        disabled={busy}
        aria-label="Sign out"
        title={
          isGuest
            ? "Sign out — your guest data will be deleted"
            : "Sign out"
        }
        className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
      >
        <span aria-hidden>⏏</span>
        <span className="hidden md:inline">{busy ? "…" : "Sign out"}</span>
      </button>

      {confirming && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-signout-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setConfirming(false);
          }}
        >
          <div className="surface-glass tint-amber my-auto w-[min(460px,94vw)] p-5">
            <p
              id="guest-signout-title"
              className="font-display text-base font-semibold text-white"
            >
              Sign out as guest?
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/80">
              Guest accounts don&apos;t persist. Signing out will
              <span className="text-neon-amber"> delete your messages, rooms you own, friendships, status, mood,
              and every other preference</span> tied to this guest
              identity. There&apos;s no recovery.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/80">
              If you want any of this to stick around, hit Cancel and
              sign in with an email instead.
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
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void guestPurgeAndSignOut()}
                disabled={busy}
                className="flex-1 rounded-lg bg-neon-amber px-3 py-2 text-sm font-medium text-ink-900 hover:bg-neon-amber/90 disabled:opacity-50"
              >
                {busy ? "Wiping…" : "Delete & sign out"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
