"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * RoomThemePicker — Wave 19.5.
 *
 * Owner-only widget. Picks a theme for the room (applied for everyone via
 * the section's data-theme attribute, see THEMES below + global CSS in
 * tailwind/globals).
 */
export const ROOM_THEMES: Array<{
  value: string;
  label: string;
  emoji: string;
  gradient: string;
  hint: string;
}> = [
  { value: "default", label: "Default", emoji: "💠", gradient: "from-neon-blue/15 via-transparent to-transparent", hint: "Karochat blue" },
  { value: "sunset",  label: "Sunset",  emoji: "🌅", gradient: "from-orange-500/20 via-pink-500/10 to-purple-600/20", hint: "Warm dusk vibes" },
  { value: "ocean",   label: "Ocean",   emoji: "🌊", gradient: "from-cyan-500/20 via-sky-500/10 to-indigo-700/30", hint: "Deep blue calm" },
  { value: "forest",  label: "Forest",  emoji: "🌲", gradient: "from-emerald-600/20 via-teal-500/10 to-green-900/30", hint: "Mossy + grounded" },
  { value: "neon",    label: "Neon",    emoji: "💜", gradient: "from-fuchsia-500/25 via-purple-600/15 to-cyan-400/20", hint: "Synthwave city" },
  { value: "rose",    label: "Rose",    emoji: "🌸", gradient: "from-pink-500/20 via-rose-400/10 to-fuchsia-500/20", hint: "Soft + romantic" },
  { value: "candy",   label: "Candy",   emoji: "🍭", gradient: "from-pink-400/25 via-yellow-300/15 to-cyan-400/20", hint: "Pop colours" },
  { value: "retro",   label: "Retro",   emoji: "📼", gradient: "from-amber-400/20 via-orange-500/10 to-red-500/15", hint: "VHS warmth" },
  { value: "royal",   label: "Royal",   emoji: "👑", gradient: "from-violet-700/30 via-indigo-600/15 to-amber-300/15", hint: "Velvet + gold" },
  { value: "mono",    label: "Mono",    emoji: "⬛", gradient: "from-white/10 via-transparent to-white/5", hint: "Black & white" }
];

export function RoomThemePicker({
  roomId,
  initialTheme,
  isOwner
}: {
  roomId: string;
  initialTheme: string | null;
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<string>(initialTheme ?? "default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const portalTargetRef = useRef<Element | null>(null);

  useEffect(() => {
    if (typeof document !== "undefined") portalTargetRef.current = document.body;
  }, []);

  if (!isOwner) return null;

  async function apply(newTheme: string) {
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: rpcErr } = await supabase.rpc("set_room_theme", {
      p_room_id: roomId,
      p_theme: newTheme === "default" ? null : newTheme
    });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setTheme(newTheme);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Change room theme"
        title="Change room theme (you own this room)"
        className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/65 transition hover:bg-white/10 hover:text-white"
      >
        <span aria-hidden>🎨</span>
        <span className="hidden md:inline">Theme</span>
      </button>

      {open && portalTargetRef.current && createPortal(
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setOpen(false);
          }}
        >
          <div className="surface-glass tint-purple my-auto w-[min(560px,94vw)] p-5">
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-semibold text-white">
                🎨 Pick a theme
              </p>
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                aria-label="Close"
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-xs text-white/55">
              Theme applies to this room for everyone who&apos;s in it.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {ROOM_THEMES.map((t) => {
                const active = (theme ?? "default") === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => void apply(t.value)}
                    disabled={busy}
                    aria-pressed={active}
                    title={t.hint}
                    className={clsx(
                      "flex flex-col items-center rounded-xl border px-2 py-2 text-xs transition disabled:opacity-50",
                      active
                        ? "border-neon-blue/60 bg-neon-blue/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    )}
                  >
                    <span
                      className={clsx(
                        "mb-1 grid h-10 w-full place-items-center rounded-md bg-gradient-to-br text-lg",
                        t.gradient
                      )}
                      aria-hidden
                    >
                      {t.emoji}
                    </span>
                    <span className="text-white">{t.label}</span>
                    <span className="mt-0.5 text-[10px] text-white/45">
                      {t.hint}
                    </span>
                  </button>
                );
              })}
            </div>

            {error && (
              <p className="mt-2 rounded-md bg-neon-red/15 px-2 py-1 text-[12px] text-neon-red">
                {error}
              </p>
            )}
          </div>
        </div>,
        portalTargetRef.current
      )}
    </>
  );
}
