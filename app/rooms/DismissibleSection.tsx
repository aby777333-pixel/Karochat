"use client";

import { useEffect, useState } from "react";

const HIDDEN_PREFIX = "karochat:hide:";

/**
 * Wraps a section card on /rooms with a small ✕ button. Clicking it hides
 * the section locally (per-browser) and the user can restore everything
 * via the `RestoreHiddenSections` widget at the bottom of the page.
 */
export function DismissibleSection({
  id,
  className,
  children
}: {
  id: string;
  /**
   * Optional extra classes merged onto the relative wrapper. Use this for
   * outer spacing (e.g. `mt-3`) — keeping the spacing on the wrapper rather
   * than inside the child keeps the ✕ button's `top-3` anchor aligned with
   * the visible card edge instead of floating in the margin gap above it.
   */
  className?: string;
  children: React.ReactNode;
}) {
  const storageKey = `${HIDDEN_PREFIX}${id}`;
  // Start hidden=false on the server render to avoid hydration mismatch; the
  // effect below re-reads localStorage on mount and may flip it.
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey) === "1") setHidden(true);
    } catch {
      // ignore
    }
  }, [storageKey]);

  if (hidden) return null;

  return (
    <div className={"relative" + (className ? ` ${className}` : "")}>
      {children}
      <button
        type="button"
        onClick={() => {
          try {
            window.localStorage.setItem(storageKey, "1");
            window.dispatchEvent(new Event("karochat:hidden-changed"));
          } catch {
            // ignore
          }
          setHidden(true);
        }}
        aria-label="Hide this section"
        title="Hide this section"
        className="absolute right-3 top-3 z-10 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/55 hover:bg-white/10 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}

export function RestoreHiddenSections() {
  const [hiddenCount, setHiddenCount] = useState(0);

  useEffect(() => {
    function recount() {
      try {
        let n = 0;
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(HIDDEN_PREFIX) && window.localStorage.getItem(k) === "1") {
            n++;
          }
        }
        setHiddenCount(n);
      } catch {
        setHiddenCount(0);
      }
    }
    recount();
    window.addEventListener("karochat:hidden-changed", recount);
    window.addEventListener("storage", recount);
    return () => {
      window.removeEventListener("karochat:hidden-changed", recount);
      window.removeEventListener("storage", recount);
    };
  }, []);

  if (hiddenCount === 0) return null;

  function restoreAll() {
    try {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(HIDDEN_PREFIX)) keys.push(k);
      }
      for (const k of keys) window.localStorage.removeItem(k);
    } catch {
      // ignore
    }
    setHiddenCount(0);
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={restoreAll}
      className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60 hover:bg-white/10 hover:text-white"
      title="Show all sections again"
    >
      <span aria-hidden>↻</span>
      <span>
        Restore {hiddenCount} hidden section{hiddenCount === 1 ? "" : "s"}
      </span>
    </button>
  );
}
