"use client";

import { useRef } from "react";
import clsx from "clsx";
import type { SizePreset } from "@/lib/useResizableHeight";

/**
 * ChatResizer — Wave 18.
 *
 * A thin handle that sits between the scrollable message area and the
 * composer. Drag up to diminish the chat height; drag down to grow.
 * Includes quick toggles: Compact / Normal / Full.
 */
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

  function pickStartHeight(): number {
    const el = scrollerRef.current;
    if (!el) return px ?? 320;
    // If we already have an explicit px lock, start from that — otherwise
    // measure the live rendered height so dragging feels continuous.
    return px ?? el.getBoundingClientRect().height;
  }

  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    onBeginDrag(e.clientY, pickStartHeight(), handleRef.current);
  }

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const t = e.touches[0];
    if (!t) return;
    onBeginDrag(t.clientY, pickStartHeight(), handleRef.current);
  }

  return (
    <div className="relative flex items-center justify-center border-y border-white/5 bg-black/10">
      <div
        ref={handleRef}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize chat window — drag up to diminish, down to grow"
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onDoubleClick={onReset}
        title="Drag to resize · double-click to reset"
        className="group/handle flex h-3 w-full cursor-row-resize items-center justify-center transition hover:bg-white/5 active:bg-white/10"
      >
        <span className="h-0.5 w-10 rounded-full bg-white/15 transition group-hover/handle:bg-white/40" />
      </div>
      <div className="absolute right-2 flex items-center gap-0.5">
        <button
          type="button"
          onClick={onCompact}
          aria-pressed={preset === "compact"}
          title="Compact chat height"
          className={clsx(
            "rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-widest transition",
            preset === "compact"
              ? "border-neon-blue/60 bg-neon-blue/15 text-neon-blue"
              : "border-white/10 bg-white/5 text-white/45 hover:bg-white/10 hover:text-white/80"
          )}
        >
          ▽
        </button>
        <button
          type="button"
          onClick={onReset}
          aria-pressed={preset === "normal" && px === null}
          title="Reset chat height"
          className={clsx(
            "rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-widest transition",
            preset === "normal" && px === null
              ? "border-neon-blue/60 bg-neon-blue/15 text-neon-blue"
              : "border-white/10 bg-white/5 text-white/45 hover:bg-white/10 hover:text-white/80"
          )}
        >
          ◇
        </button>
        <button
          type="button"
          onClick={onFull}
          aria-pressed={preset === "full"}
          title="Full chat height"
          className={clsx(
            "rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-widest transition",
            preset === "full"
              ? "border-neon-blue/60 bg-neon-blue/15 text-neon-blue"
              : "border-white/10 bg-white/5 text-white/45 hover:bg-white/10 hover:text-white/80"
          )}
        >
          △
        </button>
      </div>
    </div>
  );
}
