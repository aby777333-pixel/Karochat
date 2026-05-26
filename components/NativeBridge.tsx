"use client";

// Karochat — native-shell bootstrap.
//
// Mounted once in the root layout. On the web it does nothing. Inside
// the Capacitor Android / iOS shell it:
//   1. Hides the native splash screen as soon as React paints.
//   2. Asks for push-notification permission once per install, on a
//      short delay so the user has a chance to see the lobby first.
//   3. Wires deep-links + back-button handlers (Android).
//
// All of this is purely additive — never throws if Capacitor is absent.

import { useEffect } from "react";
import {
  hideSplashScreen,
  isNative,
  registerPushNotifications
} from "@/lib/native/capacitor";

export function NativeBridge() {
  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;

    // 1) Hide the splash immediately after mount.
    void hideSplashScreen();

    // 2) Defer push permission ask by ~6s so the user isn't slapped
    //    with a permission prompt on cold start. The OS will only show
    //    the prompt once per install — we want it to land AFTER they've
    //    seen what the app is.
    const t = setTimeout(() => {
      if (cancelled) return;
      void registerPushNotifications();
    }, 6000);

    // 3) Wire the hardware back button on Android to navigate WebView
    //    history; if there's no history, the system handles app-exit.
    const App = (window as any).Capacitor?.Plugins?.App;
    let removeBack: any;
    try {
      removeBack = App?.addListener?.("backButton", (e: any) => {
        if (window.history.length > 1 && e.canGoBack !== false) {
          window.history.back();
        } else {
          App?.exitApp?.();
        }
      });
    } catch {}

    return () => {
      cancelled = true;
      clearTimeout(t);
      try {
        removeBack?.remove?.();
      } catch {}
    };
  }, []);

  return null;
}
