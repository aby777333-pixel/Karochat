"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const PANIC_URL = "https://www.google.com";

async function panic() {
  try {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
  } catch {
    // ignore — we're leaving regardless
  }
  try {
    sessionStorage.clear();
    localStorage.clear();
  } catch {
    // ignore
  }
  // Use replace so back-button doesn't return to Karochat.
  window.location.replace(PANIC_URL);
}

/**
 * Global safety affordance: Ctrl+Shift+Backspace (or ⌘+Shift+Backspace on Mac)
 * signs the user out, clears local storage, and redirects to a neutral page.
 * A small visible button is also rendered in the bottom-right corner so users
 * who can't use the keyboard shortcut still have an escape hatch.
 */
export function PanicExit() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const modOk = e.ctrlKey || e.metaKey;
      if (modOk && e.shiftKey && (e.key === "Backspace" || e.code === "Backspace")) {
        e.preventDefault();
        void panic();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <button
      type="button"
      onClick={() => void panic()}
      title="Panic exit — signs out and redirects (Ctrl/⌘+Shift+Backspace)"
      aria-label="Panic exit"
      className="fixed bottom-3 right-3 z-50 hidden h-8 w-8 place-items-center rounded-full border border-white/10 bg-ink-800/70 text-xs text-white/40 shadow-lg backdrop-blur transition hover:border-neon-red/40 hover:bg-neon-red/10 hover:text-neon-red md:grid"
    >
      <span aria-hidden>✕</span>
    </button>
  );
}
