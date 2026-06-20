"use client";

// Karochat — clusters the room header's action buttons into a single "⋮"
// button (top-right) on phones that pops the toolbar DOWN.
//
// The header has `backdrop-filter` (.surface-glass), which makes it the
// containing block for `position: fixed` descendants — so a fixed panel was
// trapped INSIDE the header's stacking context and the chat card painted over
// it. Fix: render the pop-down through a PORTAL to <body>, escaping the header
// entirely, so it's truly in the foreground. Desktop renders inline as before.
// Mobile-vs-desktop is an either/or (matchMedia) so children mount in exactly
// one place — no duplicated stateful buttons.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function RoomTopActions({ children }: { children: React.ReactNode }) {
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
      <div className="flex flex-wrap items-center justify-end gap-1.5 md:gap-2">
        {children}
      </div>
    );
  }

  // Mobile: a single cluster button + a portaled pop-down in the foreground.
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label="Room actions"
        title="Room actions"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-base text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        {open ? "▴" : "⋮"}
      </button>

      {open &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[120]"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              onClick={() => setOpen(false)}
              style={{ top: pos.top, right: pos.right }}
              className="fixed z-[130] flex max-w-[92vw] flex-wrap justify-end gap-1.5 rounded-xl border border-white/10 bg-ink-800 p-2 shadow-2xl"
            >
              {children}
            </div>
          </>,
          document.body
        )}
    </>
  );
}
