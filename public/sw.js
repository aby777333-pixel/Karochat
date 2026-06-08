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
