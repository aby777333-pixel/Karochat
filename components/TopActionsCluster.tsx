"use client";

// Karochat — collapses a row of header action buttons into a single button on
// phones that pops the buttons DOWN as a list. Desktop renders the children
// inline, unchanged.
//
// Mirrors app/rooms/[id]/RoomTopActions.tsx: many of our headers sit on a
// `.surface-glass` (backdrop-filter) ancestor, which becomes the containing
// block for `position: fixed` descendants — trapping a pop-down inside the
// header's stacking context so the page paints over it. Fix: render the
// pop-down through a PORTAL to <body>, so it's truly in the foreground.
// Mobile-vs-desktop is an either/or (matchMedia) so children mount in exactly
// one place — no duplicated stateful buttons.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function TopActionsCluster({
  children,
  label = "More",
  className
}: {
  children: React.ReactNode;
  label?: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 8 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  function place() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  }

  function toggle() {
    if (!open) place();
    setOpen((o) => !o);
  }

  // Re-anchor on resize; close on scroll so it never drifts from the button.
  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    const onResize = () => place();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  // Desktop (and the SSR/first-paint default): inline row, unchanged.
  if (!mounted || !isMobile) {
    return (
      <div className={className ?? "flex flex-wrap items-center justify-end gap-1.5 md:gap-2"}>
        {children}
      </div>
    );
  }

  // Mobile: a single cluster button + a portaled pop-down list in the foreground.
  // The panel is ALWAYS mounted (just hidden via `display` when closed) so a
  // child that opens its OWN modal isn't unmounted by the same click that
  // closes the menu — which would discard the modal before it can render.
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={label}
        title={label}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-base text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        {open ? "▴" : "⋮"}
      </button>

      {createPortal(
        <>
          {open && (
            <div
              className="fixed inset-0 z-[120]"
              onClick={() => setOpen(false)}
              aria-hidden
            />
          )}
          <div
            onClick={() => setOpen(false)}
            style={{ top: pos.top, right: pos.right, display: open ? undefined : "none" }}
            className="fixed z-[130] flex max-w-[92vw] flex-col items-stretch gap-1.5 rounded-xl border border-white/10 bg-ink-800 p-2 shadow-2xl [&_a]:w-full [&_button]:w-full"
          >
            {children}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
