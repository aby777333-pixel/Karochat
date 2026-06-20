"use client";

// Karochat — clusters the room header's action buttons into a single "⋮"
// button on phones that pops the toolbar DOWN (mirrors the bottom composer's
// 🧰 Tools sheet, which pops up). On sm+ the buttons stay inline as before.

import { useState } from "react";
import clsx from "clsx";

export function RoomTopActions({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex items-center">
      {/* Mobile: the single cluster button. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Room actions"
        title="Room actions"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-base text-white/80 transition hover:bg-white/10 hover:text-white sm:hidden"
      >
        {open ? "▴" : "⋮"}
      </button>

      {/* Tap-away backdrop (mobile only). */}
      {open && (
        <div
          className="fixed inset-0 z-40 sm:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* The actions. Pop-down panel on mobile; inline row on desktop.
          Tapping any action also closes the panel. */}
      <div
        onClick={() => setOpen(false)}
        className={clsx(
          "items-center gap-1.5",
          open
            ? "absolute right-0 top-full z-50 mt-1 flex max-w-[88vw] flex-wrap justify-end rounded-xl border border-white/10 bg-ink-800 p-2 shadow-xl"
            : "hidden",
          "sm:static sm:mt-0 sm:flex sm:max-w-none sm:flex-wrap sm:justify-end sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none md:gap-2"
        )}
      >
        {children}
      </div>
    </div>
  );
}
