"use client";

// Karochat — PWA install prompt (Wave 22, refreshed).
//
// Offers an "Install" option on web (desktop + Android via the native
// beforeinstallprompt flow) and a Share → Add to Home Screen hint on iOS
// Safari. Hidden when already installed or running inside the native shell.
//
// The install event (beforeinstallprompt) can fire BEFORE this component mounts,
// so a tiny beforeInteractive script in the root layout captures it into
// window.__karoBIP and re-broadcasts "karo:bip". We read that on mount so the
// deferred prompt is never missed — letting both the landing banner and the ☰
// menu "Install app" trigger a real one-tap install.
//
// Dismissing the banner now only SNOOZES it (24h) instead of hiding it forever,
// so the install offer keeps appearing on landing until the app is installed.
// Purely additive — renders null in most states, never throws.

import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Brand";
import { isNative } from "@/lib/native/capacitor";

const SNOOZE_KEY = "karochat:install-snooze"; // timestamp (ms) of last dismiss
const INSTALLED_KEY = "karochat:installed"; // set once the app is installed
const LEGACY_DISMISS_KEY = "karochat:install-dismissed"; // old permanent flag
const SNOOZE_MS = 24 * 60 * 60 * 1000;

export function InstallPrompt() {
  const deferredRef = useRef<any>(null);
  const [hasPrompt, setHasPrompt] = useState(false);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isNative()) return; // already a real installed app

    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (navigator as any).standalone === true;
    if (standalone) return;

    // Already installed earlier → don't pester.
    let installed = false;
    try {
      installed = !!window.localStorage.getItem(INSTALLED_KEY);
    } catch {
      /* ignore */
    }
    if (installed) return;

    // Migrate the old permanent dismiss to a one-time snooze so previously
    // dismissed users see the offer again (the requested behaviour), once.
    try {
      if (window.localStorage.getItem(LEGACY_DISMISS_KEY)) {
        window.localStorage.removeItem(LEGACY_DISMISS_KEY);
      }
    } catch {
      /* ignore */
    }

    const snoozed = () => {
      try {
        const ts = Number(window.localStorage.getItem(SNOOZE_KEY) || 0);
        return ts > 0 && Date.now() - ts < SNOOZE_MS;
      } catch {
        return false;
      }
    };
    const showIfAllowed = () => {
      if (!snoozed()) setVisible(true);
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const ua = navigator.userAgent || "";
    const isIOS =
      /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|android/i.test(ua);

    // Pick up an install event captured before this component mounted.
    const adopt = () => {
      const e = (window as any).__karoBIP;
      if (e) {
        deferredRef.current = e;
        setHasPrompt(true);
        showIfAllowed();
      }
    };
    adopt();

    const onBIP = (e: any) => {
      e.preventDefault?.();
      deferredRef.current = e;
      (window as any).__karoBIP = e;
      setHasPrompt(true);
      showIfAllowed();
    };
    const onInstalled = () => {
      setVisible(false);
      deferredRef.current = null;
      (window as any).__karoBIP = null;
      setHasPrompt(false);
      try {
        window.localStorage.setItem(INSTALLED_KEY, "1");
      } catch {
        /* ignore */
      }
    };
    // ☰ menu "Install app" → fire the native dialog now (real install), or, where
    // the browser can't (iOS / unsupported), surface the guidance banner. Always
    // shows regardless of snooze, since the user explicitly asked to install.
    const onMenuInstall = () => {
      adopt();
      if (deferredRef.current) {
        void doInstall();
        return;
      }
      if (isIOS && isSafari) setIosHint(true);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("karo:bip", adopt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("karo:appinstalled", onInstalled);
    window.addEventListener("karo:install", onMenuInstall);

    // iOS Safari can't fire beforeinstallprompt — offer the Add-to-Home hint on
    // landing (unless snoozed).
    let t: any;
    if (isIOS && isSafari && !snoozed()) {
      t = setTimeout(() => {
        setIosHint(true);
        setVisible(true);
      }, 2000);
    }

    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("karo:bip", adopt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("karo:appinstalled", onInstalled);
      window.removeEventListener("karo:install", onMenuInstall);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  async function doInstall() {
    const d = deferredRef.current;
    if (!d) return;
    try {
      d.prompt();
      const choice = await d.userChoice;
      if (choice?.outcome === "accepted") {
        try {
          window.localStorage.setItem(INSTALLED_KEY, "1");
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
    deferredRef.current = null;
    (window as any).__karoBIP = null;
    setHasPrompt(false);
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
              : hasPrompt
              ? "Add it to your phone or desktop for one-tap access."
              : "Use your browser menu → “Install app” / “Add to Home Screen”."}
          </p>
        </div>
        {hasPrompt && !iosHint && (
          <button
            type="button"
            onClick={() => void doInstall()}
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
