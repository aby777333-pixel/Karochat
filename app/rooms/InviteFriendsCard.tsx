"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * v5 AA1 — personal invite link. Lazily mints a slug for the current user
 * via get_or_create_invite_slug, builds the full URL, and offers copy/share.
 * Also shows the v7 personal Meet URL (karochat.co/meet/<handle>) so users
 * can share a one-tap "open a DM with me" link too.
 */
export function InviteFriendsCard() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [slug, setSlug] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"invite" | "meet" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);

      // Mint / fetch the invite slug.
      const slugResp = await supabase.rpc("get_or_create_invite_slug");
      if (cancelled) return;
      if (slugResp.error) {
        setError(slugResp.error.message);
      } else {
        setSlug((slugResp.data as string) ?? null);
      }

      // Look up caller's username for the personal Meet URL.
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (user) {
        const profileResp = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();
        if (!cancelled) {
          setHandle((profileResp.data as any)?.username ?? null);
        }
      }

      if (!cancelled) setBusy(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const link =
    slug && typeof window !== "undefined"
      ? `${window.location.origin}/i/${slug}`
      : "";
  const meetLink =
    handle && typeof window !== "undefined"
      ? `${window.location.origin}/meet/${handle}`
      : "";

  async function copy(value: string, which: "invite" | "meet") {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
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
      void copy(link, "invite");
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
          onClick={() => void copy(link, "invite")}
          disabled={!link}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/85 hover:bg-white/10 disabled:opacity-50"
        >
          {copied === "invite" ? "copied" : "copy link"}
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

      {/* v7 6.1 — personal Meet URL */}
      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          Or your personal meet link
        </p>
        <p className="mt-1 text-[11px] text-white/55">
          Opens a private chat with you — perfect for bios + dating profiles.
        </p>
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
          <span aria-hidden className="text-white/40">📞</span>
          <span
            className="flex-1 select-all truncate font-mono text-xs text-white/85"
            title={meetLink || ""}
          >
            {handle === null ? "Loading…" : meetLink || "—"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void copy(meetLink, "meet")}
          disabled={!meetLink}
          className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/85 hover:bg-white/10 disabled:opacity-50"
        >
          {copied === "meet" ? "copied" : "copy meet link"}
        </button>
      </div>

      <p className="mt-3 text-[10px] text-white/40">
        No follower counts, no growth-hacky walls. Just two links that say:
        come find me.
      </p>
    </section>
  );
}
