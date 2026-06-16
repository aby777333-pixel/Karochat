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
  const path = req.nextUrl.searchParams.get("path") ?? "";
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
                // Cache at the CDN a few minutes — the directory changes slowly.
                "cache-control": "public, s-maxage=300, stale-while-revalidate=600"
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
