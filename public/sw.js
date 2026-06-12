// Karochat — minimal service worker (Wave 22).
//
// Its ONLY job is to make the app installable as a PWA (browsers require a
// registered service worker with a fetch handler). It deliberately does NOT
// cache anything: every request passes straight through to the network, so
// there is zero risk of serving stale pages/assets. Safe and inert.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Passthrough fetch handler — present (so install criteria are met) but never
// intercepts: we don't call respondWith, so the browser handles it normally.
self.addEventListener("fetch", () => {
  /* no-op: let the network handle it */
});

// ---------------------------------------------------------------------------
// Web Push — show a notification when the server pushes one (e.g. a radar
// wave / call / scan ping), even when the tab is closed or backgrounded.
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Karochat", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Karochat";
  const options = {
    body: data.body || "",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag || "karochat",
    renotify: true,
    // Device vibration on Android Chrome (ignored where unsupported).
    vibrate: [120, 60, 120],
    // Action buttons (Chrome/Android/Edge; harmlessly ignored elsewhere).
    actions: [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" }
    ],
    data: { url: data.url || "/" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Focus an existing tab (navigating it to the target) or open a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });
      for (const client of all) {
        if ("focus" in client) {
          try {
            if ("navigate" in client) await client.navigate(target);
          } catch (e) {
            /* cross-origin or detached — ignore */
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })()
  );
});
