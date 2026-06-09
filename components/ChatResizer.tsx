"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { ResizeEdge, SizePreset } from "@/lib/useResizableHeight";

/**
 * ChatResizer — Wave 18 / 19.
 *
 * Visible bottom toolbar with chunky drag grip + Compact / Reset / Full
 * preset chips. The actual drag works on any of the four edges of the
 * chat <section> through `EdgeHandles` (see below) — this bar is the
 * primary, labelled affordance and ships with the first-time hint pill.
 */
const HINT_KEY = "karochat:resize-hint-seen";

export function ChatResizer({
  targetRef,
  px,
  wPx,
  preset,
  onBeginDrag,
  onCompact,
  onReset,
  onFull
}: {
  /** The element whose dimensions the user is resizing (the chat <section>). */
  targetRef: React.RefObject<HTMLElement>;
  px: number | null;
  wPx: number | null;
  preset: SizePreset;
  onBeginDrag: (
    edge: ResizeEdge,
    clientX: number,
    clientY: number,
    currentHeight: number,
    currentWidth: number
  ) => void;
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

  function pickRect(): { h: number; w: number } {
    const el = targetRef.current;
    if (!el) return { h: px ?? 480, w: wPx ?? 640 };
    const r = el.getBoundingClientRect();
    return { h: px ?? r.height, w: wPx ?? r.width };
  }

  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    dismissHint();
    const { h, w } = pickRect();
    onBeginDrag("bottom", e.clientX, e.clientY, h, w);
  }

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const t = e.touches[0];
    if (!t) return;
    dismissHint();
    const { h, w } = pickRect();
    onBeginDrag("bottom", t.clientX, t.clientY, h, w);
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
        {(px !== null || wPx !== null) && (
          <span
            className="ml-1 hidden rounded-sm bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/55 sm:inline"
            title="Current locked size"
          >
            {wPx !== null ? `${Math.round(wPx)}w` : "auto"} ·{" "}
            {px !== null ? `${Math.round(px)}h` : "auto"}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * TopResizeHandle — a visible grip at the TOP of the chat window, mirroring
 * the bottom bar so users can grab the top and drag to resize too (drag down
 * to shrink, up to grow). Double-click resets. No preset chips here — those
 * live on the bottom bar.
 */
export function TopResizeHandle({
  targetRef,
  px,
  wPx,
  onBeginDrag,
  onReset
}: {
  targetRef: React.RefObject<HTMLElement>;
  px: number | null;
  wPx: number | null;
  onBeginDrag: (
    edge: ResizeEdge,
    clientX: number,
    clientY: number,
    currentHeight: number,
    currentWidth: number
  ) => void;
  onReset: () => void;
}) {
  function pickRect(): { h: number; w: number } {
    const el = targetRef.current;
    if (!el) return { h: px ?? 480, w: wPx ?? 640 };
    const r = el.getBoundingClientRect();
    return { h: px ?? r.height, w: wPx ?? r.width };
  }
  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    const { h, w } = pickRect();
    onBeginDrag("top", e.clientX, e.clientY, h, w);
  }
  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const t = e.touches[0];
    if (!t) return;
    const { h, w } = pickRect();
    onBeginDrag("top", t.clientX, t.clientY, h, w);
  }
  return (
    <div className="relative flex shrink-0 items-center gap-2 border-b border-neon-blue/20 bg-gradient-to-b from-black/30 via-neon-blue/[0.04] to-black/30 px-2 py-1">
      <span
        aria-hidden
        className="hidden select-none text-[9px] font-semibold uppercase tracking-widest text-neon-blue/70 sm:inline"
        title="Drag the grip to resize · double-click to reset"
      >
        ⇕ resize chat
      </span>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize chat window from the top — drag down to shrink, up to grow"
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onDoubleClick={onReset}
        title="Drag to resize · double-click to reset"
        className="group/handle relative mx-auto flex h-5 flex-1 cursor-row-resize touch-none items-center justify-center rounded-md border border-white/15 bg-white/5 transition hover:border-neon-blue/60 hover:bg-neon-blue/10 active:bg-neon-blue/20"
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
      </div>
    </div>
  );
}

/**
 * EdgeHandles — Wave 19.
 *
 * Four very thin, hover-revealed strips on each edge of the chat section
 * so users can resize from any side (Yahoo-Messenger-style). The visible
 * bottom bar above is still the discoverable affordance.
 */
export function EdgeHandles({
  targetRef,
  px,
  wPx,
  onBeginDrag
}: {
  targetRef: React.RefObject<HTMLElement>;
  px: number | null;
  wPx: number | null;
  onBeginDrag: (
    edge: ResizeEdge,
    clientX: number,
    clientY: number,
    currentHeight: number,
    currentWidth: number
  ) => void;
}) {
  function rect() {
    const el = targetRef.current;
    if (!el) return { h: px ?? 480, w: wPx ?? 640 };
    const r = el.getBoundingClientRect();
    return { h: px ?? r.height, w: wPx ?? r.width };
  }
  function start(edge: ResizeEdge, e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const point =
      "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    if (!point) return;
    const { h, w } = rect();
    onBeginDrag(edge, point.clientX, point.clientY, h, w);
  }
  return (
    <>
      {/* Top edge — full width, thin strip at the very top */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize from top edge"
        title="Drag to resize from the top"
        onMouseDown={(e) => start("top", e)}
        onTouchStart={(e) => start("top", e)}
        className="group/edge absolute inset-x-0 top-0 z-20 h-1.5 cursor-row-resize touch-none transition hover:bg-neon-blue/40"
      >
        <span className="pointer-events-none absolute left-1/2 top-0 h-1 w-10 -translate-x-1/2 rounded-b-full bg-white/0 transition group-hover/edge:bg-white/60" />
      </div>
      {/* Left edge */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize from left edge"
        title="Drag to resize from the left"
        onMouseDown={(e) => start("left", e)}
        onTouchStart={(e) => start("left", e)}
        className="group/edge absolute inset-y-0 left-0 z-20 w-1.5 cursor-col-resize touch-none transition hover:bg-neon-blue/40"
      >
        <span className="pointer-events-none absolute top-1/2 left-0 h-10 w-1 -translate-y-1/2 rounded-r-full bg-white/0 transition group-hover/edge:bg-white/60" />
      </div>
      {/* Right edge */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize from right edge"
        title="Drag to resize from the right"
        onMouseDown={(e) => start("right", e)}
        onTouchStart={(e) => start("right", e)}
        className="group/edge absolute inset-y-0 right-0 z-20 w-1.5 cursor-col-resize touch-none transition hover:bg-neon-blue/40"
      >
        <span className="pointer-events-none absolute top-1/2 right-0 h-10 w-1 -translate-y-1/2 rounded-l-full bg-white/0 transition group-hover/edge:bg-white/60" />
      </div>
      {/* Bottom edge — duplicates the bottom bar's drag intent so dragging
         the absolute bottom pixel also works (the bar lives above the
         section's bottom border by a hair). */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize from bottom edge"
        title="Drag to resize from the bottom"
        onMouseDown={(e) => start("bottom", e)}
        onTouchStart={(e) => start("bottom", e)}
        className="group/edge absolute inset-x-0 bottom-0 z-20 h-1.5 cursor-row-resize touch-none transition hover:bg-neon-blue/40"
      >
        <span className="pointer-events-none absolute left-1/2 bottom-0 h-1 w-10 -translate-x-1/2 rounded-t-full bg-white/0 transition group-hover/edge:bg-white/60" />
      </div>
    </>
  );
}
