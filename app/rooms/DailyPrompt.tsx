"use client";

import { useEffect, useState } from "react";

/**
 * Karo's daily prompt — one warm conversation starter per UTC day, surfaced
 * on the lobby. Loads via /api/karo/daily-prompt; fails silently if the
 * upstream isn't available so the rest of the lobby keeps working.
 */
export function DailyPrompt() {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/karo/daily-prompt", { cache: "no-store" });
        if (!res.ok) {
          setError("");
          return;
        }
        const data = await res.json();
        if (!cancelled && typeof data?.prompt === "string") {
          setPrompt(data.prompt);
        }
      } catch {
        if (!cancelled) setError("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!prompt && error === null) {
    return (
      <section className="surface-glass tint-mint flex items-center gap-3 px-4 py-3">
        <span aria-hidden className="text-base text-neon-mint">✨</span>
        <span className="text-xs text-white/40">Loading today&apos;s prompt…</span>
      </section>
    );
  }

  if (!prompt) return null;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // no-op
    }
  }

  return (
    <section className="surface-glass tint-mint flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="text-lg text-neon-mint">✨</span>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-neon-mint">
            Karo · today&apos;s prompt
          </p>
          <p className="text-sm text-white/90">{prompt}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void copyPrompt()}
        className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/10 hover:text-white sm:ml-auto"
      >
        {copied ? "copied" : "copy prompt"}
      </button>
    </section>
  );
}
