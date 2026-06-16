// Karochat — resilient radio-browser fetch.
//
// radio-browser is a free community service that periodically reports
// "no available server" when its backend pool is momentarily overloaded — which
// otherwise breaks TV & Radio, Sports radio and the Sleep music channels.
//
// rbFetch tries a couple of entry points (the de1 host + the all.api round-robin)
// with a short backoff and one retry, so a transient blip resolves itself instead
// of surfacing an error. It NEVER throws — it returns [] only if every attempt
// fails, so callers can simply render an empty list.

const RB_BASES = [
  "https://de1.api.radio-browser.info",
  "https://de2.api.radio-browser.info",
  "https://all.api.radio-browser.info",
  "https://de1.api.radio-browser.info"
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function rbFetch(path: string): Promise<any[]> {
  // In the browser, go through our same-origin server proxy (/api/rb). It
  // fetches radio-browser server-to-server across several mirrors with retry,
  // which sidesteps browser CORS / regional blocks that otherwise leave the
  // station lists empty. Only fall back to calling the mirrors directly if the
  // proxy itself is unreachable (and for any non-browser caller).
  if (typeof window !== "undefined") {
    try {
      const res = await fetch(`/api/rb?path=${encodeURIComponent(path)}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch {
      // proxy unreachable — fall through to direct mirrors
    }
  }

  for (let i = 0; i < RB_BASES.length; i++) {
    const base = RB_BASES[i];
    if (!base) continue;
    try {
      const res = await fetch(base + path, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        // A healthy response is a JSON array. "no available server" comes back as
        // plain text / a non-array, which falls through to the next attempt.
        if (Array.isArray(data)) return data;
      }
    } catch {
      // network error — try the next entry point
    }
    if (i < RB_BASES.length - 1) await sleep(500);
  }
  return [];
}
