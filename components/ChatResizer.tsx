"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { SizePreset } from "@/lib/useResizableHeight";

/**
 * ChatResizer — Wave 18 (v2 high-visibility).
 *
 * A chunky, obvious handle that sits between the scrollable message area
 * and the composer. Drag up to diminish, down to grow. A first-time hint
 * pill draws attention so it's not mistaken for a divider.
 */
const HINT_KEY = "karochat:resize-hint-seen";

export function ChatResizer({
  scrollerRef,
  px,
  preset,
  onBeginDrag,
  onCompact,
  onReset,
  onFull
}: {
  scrollerRef: React.RefObject<HTMLDivElement>;
  px: number | null;
  preset: SizePreset;
  onBeginDrag: (clientY: number, currentHeight: number, target: HTMLElement | null) => void;
  onCompact: () => void;
  onReset: () => void;
  onFull: () => void;
}) {
  const handleRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(false);

  // Show a one-time "drag to resize" hint so first-time users notice the
  // handle. After they've dragged or dismissed once, it stays quiet.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(HINT_KEY) === "1";
      if (seen) return;
    } catch {
      // ignore
    }
    setShowHint(true);
    const t = setTimeout(dismissHint, 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismissHint() {
    setShowHint(false);
    try {
      window.localStorage.setItem(HINT_KEY, "1");
    } catch {
      // ignore
    }
  }

  function pickStartHeight(): number {
    const el = scrollerRef.current;
    if (!el) return px ?? 320;
    return px ?? el.getBoundingClientRect().height;
  }

  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    dismissHint();
    onBeginDrag(e.clientY, pickStartHeight(), handleRef.current);
  }

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const t = e.touches[0];
    if (!t) return;
    dismissHint();
    onBeginDrag(t.clientY, pickStartHeight(), handleRef.current);
  }

  return (
    <div className="relative flex shrink-0 items-center justify-between gap-2 border-y border-neon-blue/20 bg-gradient-to-b from-black/30 via-neon-blue/[0.04] to-black/30 px-2 py-1">
      {/* Left label so the bar reads as a control, not a divider. */}
      <span
        aria-hidden
        className="hidden select-none text-[9px] font-semibold uppercase tracking-widest text-neon-blue/70 sm:inline"
        title="Drag the grip to resize · double-click to reset"
      >
        ⇕ resize chat
      </span>

      {/* The actual drag handle — chunky, with a clear grip texture. */}
      <div
        ref={handleRef}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize chat window — drag up to diminish, down to grow"
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onDoubleClick={onReset}
        title="Drag to resize · double-click to reset"
        className={clsx(
          "group/handle relative mx-auto flex h-5 flex-1 cursor-row-resize touch-none items-center justify-center rounded-md border border-white/15 bg-white/5 transition hover:border-neon-blue/60 hover:bg-neon-blue/10 active:bg-neon-blue/20",
          showHint && "animate-pulse"
        )}
      >
        <span aria-hidden className="flex items-center gap-0.5">
          <span className="h-1 w-1 rounded-full bg-white/45 group-hover/handle:bg-neon-blue" />
          <span className="h-1 w-1 rounded-full bg-white/45 group-hover/handle:bg-neon-blue" />
          <span className="h-1 w-1 rounded-full bg-white/45 group-hover/handle:bg-neon-blue" />
          <span className="mx-0.5 h-[2px] w-6 rounded-full bg-white/45 group-hover/handle:bg-neon-blue" />
          <span className="h-1 w-1 rounded-full bg-white/45 group-hover/handle:bg-neon-blue" />
          <span className="h-1 w-1 rounded-full bg-white/45 group-hover/handle:bg-neon-blue" />
          <span className="h-1 w-1 rounded-full bg-white/45 group-hover/handle:bg-neon-blue" />
        </span>

        {showHint && (
          <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-neon-amber/50 bg-neon-amber/20 px-2 py-0.5 text-[10px] font-medium text-neon-amber shadow-lg">
            ⇕ drag me to resize chat
          </span>
        )}
      </div>

      {/* Quick preset toggles. */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => {
            dismissHint();
            onCompact();
          }}
          aria-pressed={preset === "compact"}
          title="Compact (shorter chat)"
          className={clsx(
            "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest transition",
            preset === "compact"
              ? "border-neon-blue/60 bg-neon-blue/20 text-neon-blue"
              : "border-white/15 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
          )}
        >
          ▽ compact
        </button>
        <button
          type="button"
          onClick={() => {
            dismissHint();
            onReset();
          }}
          aria-pressed={preset === "normal" && px === null}
          title="Reset chat height"
          className={clsx(
            "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest transition",
            preset === "normal" && px === null
              ? "border-neon-blue/60 bg-neon-blue/20 text-neon-blue"
              : "border-white/15 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
          )}
        >
          ◇ reset
        </button>
        <button
          type="button"
          onClick={() => {
            dismissHint();
            onFull();
          }}
          aria-pressed={preset === "full"}
          title="Full chat height"
          className={clsx(
            "hidden rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest transition sm:inline",
            preset === "full"
              ? "border-neon-blue/60 bg-neon-blue/20 text-neon-blue"
              : "border-white/15 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
          )}
        >
          △ full
        </button>
        {px !== null && (
          <span
            className="ml-1 hidden rounded-sm bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/55 sm:inline"
            title="Current locked height"
          >
            {Math.round(px)}px
          </span>
        )}
      </div>
    </div>
  );
}
