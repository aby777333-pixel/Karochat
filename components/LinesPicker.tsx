"use client";

// Karochat — "Lines & sparks" picker (v9).
//
// Pre-written ice breakers, compliments, pick-up lines, date asks,
// smooth replies, kind let-downs — plus an 18+ flirty tier that only
// appears for users whose age band is 18plus (same Phase-3 gate the
// sex-ed library uses), and a "Karo, write me one" AI spark generator.
// Picking inserts into the composer; nothing auto-sends.

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { LINE_PACKS } from "@/lib/lines";

const VIBES = [
  ["sweet", "🌷 Sweet"],
  ["funny", "😄 Funny"],
  ["bold", "🔥 Bold"],
  ["poetic", "🌙 Poetic"]
] as const;

export function LinesPicker({
  onPick,
  onClose
}: {
  onPick: (line: string) => void;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const rootRef = useRef<HTMLDivElement>(null);
  const [isAdult, setIsAdult] = useState(false);
  const packs = useMemo(
    () => LINE_PACKS.filter((p) => !p.adult || isAdult),
    [isAdult]
  );
  const [tab, setTab] = useState<string>(LINE_PACKS[0]!.key);

  // AI spark state
  const [vibe, setVibe] = useState<string>("sweet");
  const [spicy, setSpicy] = useState(false);
  const [aiLine, setAiLine] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    void supabase.rpc("current_user_age_band").then(({ data }) => {
      if (alive && data === "18plus") setIsAdult(true);
    });
    return () => {
      alive = false;
    };
  }, [supabase]);

  async function generate() {
    setAiBusy(true);
    setAiErr(null);
    setAiLine(null);
    try {
      const r = await fetch("/api/lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vibe: spicy && isAdult ? "spicy" : vibe })
      });
      const j = await r.json();
      if (!r.ok) {
        setAiErr(j?.error ?? "Karo is out of ideas — try again.");
        return;
      }
      setAiLine(j.line as string);
    } catch (e: any) {
      setAiErr(e?.message ?? String(e));
    } finally {
      setAiBusy(false);
    }
  }

  const active = packs.find((p) => p.key === tab) ?? packs[0]!;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Lines and sparks"
      className="fixed inset-x-3 bottom-28 z-[60] mx-auto flex max-h-[60vh] w-auto max-w-[360px] flex-col rounded-xl border border-white/10 bg-ink-800/95 p-2 shadow-xl backdrop-blur sm:absolute sm:inset-x-auto sm:bottom-12 sm:left-0 sm:mx-0 sm:w-[340px] sm:max-w-none"
    >
      <div className="flex items-center justify-between px-1 pb-1.5">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          💘 Lines &amp; sparks
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close lines picker"
          className="rounded-md border border-white/10 bg-white/5 px-1.5 text-[10px] text-white/60 hover:bg-white/10"
        >
          ✕
        </button>
      </div>

      <div className="mb-1 flex gap-0.5 overflow-x-auto">
        {packs.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setTab(p.key)}
            className={clsx(
              "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] uppercase tracking-widest transition",
              tab === p.key
                ? p.adult
                  ? "bg-neon-red/15 text-neon-red"
                  : "bg-neon-purple/15 text-neon-purple"
                : "text-white/45 hover:bg-white/5 hover:text-white/80"
            )}
          >
            {p.emoji} {p.label}
          </button>
        ))}
        <button
          key="ai"
          type="button"
          onClick={() => setTab("ai")}
          className={clsx(
            "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] uppercase tracking-widest transition",
            tab === "ai"
              ? "bg-neon-mint/15 text-neon-mint"
              : "text-white/45 hover:bg-white/5 hover:text-white/80"
          )}
        >
          ✨ Ask Karo
        </button>
      </div>

      {tab === "ai" ? (
        <div className="min-h-0 overflow-y-auto px-1 py-1">
          <p className="text-[11px] text-white/55">
            Karo writes you one original line. Pick the vibe:
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {VIBES.map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setVibe(v);
                  setSpicy(false);
                }}
                className={clsx(
                  "rounded-md border px-2 py-1 text-[11px] transition",
                  vibe === v && !spicy
                    ? "border-neon-mint/40 bg-neon-mint/10 text-neon-mint"
                    : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                )}
              >
                {label}
              </button>
            ))}
            {isAdult && (
              <button
                type="button"
                onClick={() => setSpicy((s) => !s)}
                className={clsx(
                  "rounded-md border px-2 py-1 text-[11px] transition",
                  spicy
                    ? "border-neon-red/40 bg-neon-red/10 text-neon-red"
                    : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                )}
              >
                🌶 Spicy (18+)
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={aiBusy}
            className="mt-2 w-full rounded-lg bg-neon-mint px-3 py-1.5 text-sm font-medium text-ink-900 hover:bg-neon-mint/90 disabled:opacity-60"
          >
            {aiBusy ? "Karo is thinking…" : "✨ Write me a line"}
          </button>
          {aiErr && (
            <p className="mt-2 rounded-md border border-neon-red/30 bg-neon-red/10 px-2 py-1.5 text-[11px] text-neon-red">
              {aiErr}
            </p>
          )}
          {aiLine && (
            <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-2.5">
              <p className="text-sm leading-relaxed text-white/85">{aiLine}</p>
              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onPick(aiLine)}
                  className="rounded-md bg-neon-mint px-2.5 py-1 text-[12px] font-medium text-ink-900 hover:bg-neon-mint/90"
                >
                  Use it →
                </button>
                <button
                  type="button"
                  onClick={() => void generate()}
                  disabled={aiBusy}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[12px] text-white/70 hover:bg-white/10 disabled:opacity-50"
                >
                  Another
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="px-1 pb-1 text-[10px] text-white/40">{active.hint}</p>
          <ul className="min-h-0 space-y-1 overflow-y-auto pr-0.5">
            {active.lines.map((line, i) => (
              <li key={`${active.key}-${i}`}>
                <button
                  type="button"
                  onClick={() => onPick(line)}
                  className="w-full rounded-lg border border-white/5 bg-black/30 px-2.5 py-2 text-left text-[13px] leading-snug text-white/80 hover:border-neon-purple/40 hover:bg-white/5 hover:text-white"
                >
                  {line}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="px-1 pt-1.5 text-[9px] text-white/30">
        Inserted into your message box — make it yours before sending.
        {!isAdult && " Flirty packs unlock at 18+ (set your birth year in Sex ed)."}
      </p>
    </div>
  );
}
