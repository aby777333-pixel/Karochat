"use client";

// Karochat — explicit "Install app" button for the landing page.
//
// The auto-banner in <InstallPrompt /> only appears when the browser fires
// beforeinstallprompt (desktop Chrome/Edge, Android) or on iOS Safari. Desktop
// Firefox/Safari — and any browser that hasn't yet fired the event — would
// otherwise never see an install ask. This button is the always-present
// affordance: it dispatches the same "karo:install" event the ☰ menu uses, so
// <InstallPrompt /> either fires the native one-tap install or, where the
// browser can't, surfaces the guidance/iOS hint banner.
//
// It hides itself when the app is already installed / running standalone / in
// the native shell, so installed users never see a redundant ask. Purely
// additive — renders null in those states and never throws.

import { useEffect, useState } from "react";
import { isNative } from "@/lib/native/capacitor";

export function InstallButton({ className }: { className?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isNative()) return;

    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (navigator as any).standalone === true;
    if (standalone) return;

    let installed = false;
    try {
      installed = !!window.localStorage.getItem("karochat:installed");
    } catch {
      /* ignore */
    }
    if (installed) return;

    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => {
        try {
          window.dispatchEvent(new Event("karo:install"));
        } catch {
          /* ignore */
        }
      }}
      className={
        className ??
        "shrink-0 rounded-lg border border-neon-blue/40 bg-neon-blue/10 px-3 py-1.5 text-sm font-medium text-neon-blue transition hover:bg-neon-blue/20"
      }
    >
      <span aria-hidden>📲</span> Install app
    </button>
  );
}
