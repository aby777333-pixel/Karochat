import { type NextRequest } from "next/server";

// Karochat — same-origin proxy for the radio-browser directory.
//
// radio-browser is CORS-enabled in theory, but from some browsers / networks /
// regions a direct call fails, or its de1 mirror replies "no available server",
// which left the Sleep music + TV/Radio lists empty (only curated fallbacks
// showed). Fetching server-to-server from Netlify across several mirrors with a
// short retry is far more reliable. Always returns a JSON array (or [] / an
// error status on total failure) so callers can render an empty list safely.

export const dynamic = "force-dynamic";

const MIRRORS = [
  "https://de2.api.radio-browser.info",
  "https://all.api.radio-browser.info",
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info"
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  // Primary scheme: the whole radio-browser path+query is base64url-encoded into a
  // single `q` param ([A-Za-z0-9_-] only), so the nested "?"/"&" can't be mangled
  // by any URL-parsing layer (the cause of the proxy ignoring country/tag filters
  // and always returning the global top stations).
  let path = "";
  const q = params.get("q");
  if (q) {
    try {
      const b64 = q.replace(/-/g, "+").replace(/_/g, "/");
      path = Buffer.from(b64, "base64").toString("utf8");
    } catch {
      path = "";
    }
  } else {
    // Legacy fallback for older cached clients: `path` (or `ep`) + extra params.
    const raw = params.get("ep") ?? params.get("path") ?? "";
    const endpoint = raw.split("?")[0] ?? "";
    const forward = new URLSearchParams();
    const embeddedIdx = raw.indexOf("?");
    if (embeddedIdx >= 0) {
      for (const [k, v] of new URLSearchParams(raw.slice(embeddedIdx + 1))) forward.append(k, v);
    }
    for (const [k, v] of params) {
      if (k === "ep" || k === "path") continue;
      forward.append(k, v);
    }
    const qs = forward.toString();
    path = endpoint + (qs ? `?${qs}` : "");
  }
  // Only allow radio-browser's read-only /json/ endpoints (no SSRF to arbitrary
  // hosts/paths). Everything we call is /json/stations/... or /json/servers.
  if (!path.startsWith("/json/")) {
    return Response.json([], { status: 400 });
  }
  for (let i = 0; i < MIRRORS.length; i++) {
    try {
      const res = await fetch(MIRRORS[i] + path, {
        cache: "no-store",
        headers: { "user-agent": "Karochat/1.0 (+https://magical-heliotrope-e4d7df.netlify.app)" }
      });
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            return new Response(JSON.stringify(data), {
              status: 200,
              headers: {
                "content-type": "application/json",
                // MUST NOT be CDN-cached: Netlify's edge cache keys this route by
                // pathname only (ignoring the query), so any public/s-maxage cache
                // serves the first query's result for EVERY country/tag. Keep it
                // per-request fresh — the mirror fetch already has retry/fallback.
                "cache-control": "no-store, must-revalidate",
                "netlify-cdn-cache-control": "no-store"
              }
            });
          }
        } catch {
          // non-JSON ("no available server") → try the next mirror
        }
      }
    } catch {
      // network error → try the next mirror
    }
    if (i < MIRRORS.length - 1) await sleep(350);
  }
  return Response.json([], { status: 502 });
}
