import { type NextRequest } from "next/server";
import { decodeRbPath, tryMirrors } from "@/lib/rbProxy";

// Karochat — same-origin radio-browser proxy (path-based).
//
// The base64url-encoded radio-browser path rides as a URL PATH segment
// (/api/rb/<q>), not a query param. Netlify's edge cache keys this route by its
// full pathname, so each distinct query caches separately — fixing the bug where
// a single ?query= response was served for every country/tag. A few-minute CDN
// cache shields the radio-browser mirrors (which rate-limit / "no available
// server" under load); the directory itself changes slowly.

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { q: string } }) {
  const path = decodeRbPath(params.q ?? "");
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
        // Safe to cache now: the query lives in the path, so the edge cache key
        // varies per query. Short TTL keeps the mirrors lightly loaded.
        "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600"
      }
    });
  }
  // Every mirror failed — return an empty array (callers render curated
  // fallbacks). No-store so a transient blip isn't cached.
  return new Response("[]", {
    status: 502,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}
