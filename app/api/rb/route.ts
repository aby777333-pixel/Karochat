import { type NextRequest } from "next/server";
import { decodeRbPath, tryMirrors } from "@/lib/rbProxy";

// Karochat — same-origin proxy for the radio-browser directory (LEGACY query
// form). New clients call /api/rb/<base64url> (path-based, see [q]/route.ts) so
// the edge cache can vary per query. This handler stays for older cached clients
// that still send ?q= / ?path= / ?ep=. It is NOT CDN-cached: Netlify's edge keys
// this route by pathname only, so a public cache here would serve one query's
// result for every country/tag.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  let path = "";
  const q = params.get("q");
  if (q) {
    path = decodeRbPath(q);
  } else {
    // Older clients: `path` (or `ep`) possibly plus separate filter params.
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
  // Only allow radio-browser's read-only /json/ endpoints (no SSRF).
  if (!path.startsWith("/json/")) {
    return Response.json([], { status: 400 });
  }
  const data = await tryMirrors(path);
  if (data) {
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store, must-revalidate",
        "netlify-cdn-cache-control": "no-store"
      }
    });
  }
  return Response.json([], { status: 502 });
}
