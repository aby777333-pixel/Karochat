"use client";

// Karochat — PWA install prompt (Wave 22).
//
// Offers an "Install" option on web (desktop + Android via the native
// beforeinstallprompt flow) and a Share → Add to Home Screen hint on iOS
// Safari. Hidden when already installed or running inside the native shell.
// Registers a minimal service worker so the app is installable.
// Purely additive — renders null in most states, never throws.

import { useEffect, useState } from "react";
import { Logo } from "@/components/Brand";
import { isNative } from "@/lib/native/capacitor";

const DISMISS_KEY = "karochat:install-dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isNative()) return; // already a real installed app

    // Already running as an installed PWA?
    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (navigator as any).standalone === true;
    if (standalone) return;

    let dismissed = false;
    try {
      dismissed = !!window.localStorage.getItem(DISMISS_KEY);
    } catch {
      /* ignore */
    }
    if (dismissed) return;

    // Register the minimal service worker (enables installability).
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onBIP = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
      try {
        window.localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari never fires beforeinstallprompt → show a manual hint.
    const ua = navigator.userAgent || "";
    const isIOS = /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|android/i.test(ua);
    let t: any;
    if (isIOS && isSafari) {
      t = setTimeout(() => {
        setIosHint(true);
        setVisible(true);
      }, 2000);
    }

    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    try {
      deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[70] flex justify-center px-3 md:bottom-4">
      <div className="surface-glass tint-purple pointer-events-auto flex w-full max-w-md items-center gap-3 p-3 shadow-xl">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5">
          <Logo className="h-8 w-8" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Install Karochat</p>
          <p className="text-[11px] leading-snug text-white/60">
            {iosHint
              ? "Tap the Share button, then “Add to Home Screen”."
              : "Add it to your phone or desktop for one-tap access."}
          </p>
        </div>
        {!iosHint && (
          <button
            type="button"
            onClick={() => void install()}
            className="shrink-0 rounded-lg bg-gradient-to-br from-neon-purple to-neon-blue px-3 py-2 text-xs font-semibold text-white shadow-glow-blue transition active:scale-95"
          >
            Install
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/60 hover:bg-white/10"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
