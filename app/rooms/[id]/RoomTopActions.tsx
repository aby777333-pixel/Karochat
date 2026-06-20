"use client";

// Karochat — clusters the room header's action buttons into a single "⋮"
// button (top-right) on phones that pops the toolbar DOWN. The panel is
// rendered `fixed` with a very high z-index + measured position so it always
// sits IN FRONT of the chat card below (an absolute panel was painting behind
// it). On sm+ the buttons stay inline as before.

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

export function RoomTopActions({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function place() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
  }

  function toggle() {
    if (!open) place();
    setOpen((o) => !o);
  }

  // Keep the panel anchored if the viewport changes; close on scroll so it
  // never drifts away from the button.
  useEffect(() => {
    if (!open) return;
    const onResize = () => place();
    const onScroll = () => setOpen(false);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <div className="flex items-center">
      {/* Mobile: the single cluster button (top-right). */}
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label="Room actions"
        title="Room actions"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-base text-white/80 transition hover:bg-white/10 hover:text-white sm:hidden"
      >
        {open ? "▴" : "⋮"}
      </button>

      {/* Tap-away backdrop (mobile only, under the panel). */}
      {open && (
        <div
          className="fixed inset-0 z-[120] sm:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* The actions. Mobile: a fixed pop-down IN FRONT of everything,
          positioned just under the button. Desktop: inline row.
          Tapping any action also closes the panel. */}
      <div
        onClick={() => setOpen(false)}
        style={open ? { top: pos?.top, right: pos?.right } : undefined}
        className={clsx(
          "items-center gap-1.5",
          open
            ? "fixed z-[130] flex max-w-[92vw] flex-wrap justify-end rounded-xl border border-white/10 bg-ink-800 p-2 shadow-2xl"
            : "hidden",
          "sm:static sm:z-auto sm:flex sm:max-w-none sm:flex-wrap sm:justify-end sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none md:gap-2"
        )}
      >
        {children}
      </div>
    </div>
  );
}
