"use client";

import { useCallback } from "react";

// VAPID applicationServerKey must be a Uint8Array.
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Result = { ok: boolean; reason?: string };

/**
 * Subscribe this browser to Web Push and persist the subscription server-side.
 * Safe to call repeatedly — it reuses an existing subscription and upserts by
 * endpoint. Requires Notification permission to already be 'granted'. No-ops
 * (returning a reason) when unsupported or unconfigured, so callers can fire it
 * optimistically without guarding.
 */
export function usePushSubscribe() {
  const subscribe = useCallback(async (): Promise<Result> => {
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) return { ok: false, reason: "no-key" };
      if (typeof window === "undefined") return { ok: false, reason: "ssr" };
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return { ok: false, reason: "unsupported" };
      }
      if (typeof Notification === "undefined" || Notification.permission !== "granted") {
        return { ok: false, reason: "no-permission" };
      }

      // Make sure a service worker is registered + active (the PWA install
      // prompt registers one too, but not in standalone mode — so self-register).
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      reg = (await navigator.serviceWorker.getRegistration()) ?? reg;
      if (!reg) return { ok: false, reason: "no-sw" };

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key)
        });
      }

      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: { endpoint: json.endpoint, keys: json.keys }
        })
      });
      return { ok: res.ok };
    } catch (e) {
      return { ok: false, reason: String(e) };
    }
  }, []);

  return { subscribe };
}
