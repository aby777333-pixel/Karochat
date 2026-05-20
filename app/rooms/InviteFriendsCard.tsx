"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * v5 AA1 — personal invite link. Lazily mints a slug for the current user
 * via get_or_create_invite_slug, builds the full URL, and offers copy/share.
 */
export function InviteFriendsCard() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [slug, setSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      const { data, error: rpcErr } = await supabase.rpc(
        "get_or_create_invite_slug"
      );
      if (cancelled) return;
      setBusy(false);
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      setSlug((data as string) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const link =
    slug && typeof window !== "undefined"
      ? `${window.location.origin}/i/${slug}`
      : "";

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — user can long-press to copy
    }
  }

  async function share() {
    if (!link) return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "Karochat",
          text: "Come find me on Karochat — chat, make friends, share, care.",
          url: link
        });
      } catch {
        // user cancelled
      }
    } else {
      void copy();
    }
  }

  return (
    <section className="surface-glass tint-amber p-5">
      <h3 className="font-display text-base font-semibold">Invite friends</h3>
      <p className="mt-1 text-xs text-white/60">
        Your personal invite link. Anyone who joins through it becomes your
        first buddy on Karochat.
      </p>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
        <span aria-hidden className="text-white/40">🔗</span>
        <span className="flex-1 select-all truncate text-xs text-white/85" title={link || ""}>
          {busy ? "Creating link…" : link || "—"}
        </span>
      </div>

      {error && (
        <p className="mt-2 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!link}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/85 hover:bg-white/10 disabled:opacity-50"
        >
          {copied ? "copied" : "copy link"}
        </button>
        <button
          type="button"
          onClick={() => void share()}
          disabled={!link}
          className="flex-1 rounded-lg bg-neon-amber/80 px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-neon-amber disabled:opacity-50"
        >
          share
        </button>
      </div>
      <p className="mt-2 text-[10px] text-white/40">
        No follower counts, no growth-hacky walls. Just a link that says: you brought them here.
      </p>
    </section>
  );
}
