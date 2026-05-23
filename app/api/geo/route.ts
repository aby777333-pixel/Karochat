import { NextResponse } from "next/server";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Best-effort country detection for the requesting client. Used by the
 * VerificationGate to default the dial-code picker to the visitor's
 * own country.
 *
 * Resolution order (first hit wins):
 *   1. Netlify edge header   `x-nf-geo`          (base64 JSON with country.code)
 *   2. Netlify CDN header    `x-country`         (already 2-letter)
 *   3. Cloudflare header     `cf-ipcountry`      (if proxied via CF)
 *   4. Vercel headers        `x-vercel-ip-country` / `x-vercel-country`
 *   5. Browser-language fallback is done client-side — the response
 *      includes `country: null` if we have nothing useful, and the
 *      client can fall back on `navigator.language`.
 *
 * Never leaks IP back to the client. Never depends on a third-party
 * geolocation service. Edge-cached in the CDN for 5 minutes via the
 * `cache-control` header (per-visitor cache key is fine — different
 * IPs hit different CDN nodes).
 */
export async function GET() {
  const h = headers();

  // 1) Netlify edge geo header (preferred — set by Netlify Edge).
  const nfGeo = h.get("x-nf-geo");
  let country: string | null = null;
  if (nfGeo) {
    try {
      const decoded = Buffer.from(nfGeo, "base64").toString("utf-8");
      const obj = JSON.parse(decoded) as { country?: { code?: string } };
      if (obj?.country?.code) country = obj.country.code.toUpperCase();
    } catch {
      // ignore — fall through
    }
  }

  // 2) Plain Netlify country header (also injected on CDN responses).
  if (!country) {
    const v = h.get("x-country");
    if (v) country = v.toUpperCase();
  }

  // 3) Cloudflare.
  if (!country) {
    const v = h.get("cf-ipcountry");
    if (v && v !== "XX") country = v.toUpperCase();
  }

  // 4) Vercel.
  if (!country) {
    const v = h.get("x-vercel-ip-country") ?? h.get("x-vercel-country");
    if (v) country = v.toUpperCase();
  }

  return NextResponse.json(
    { country },
    {
      // Short cache — geo can shift if a user moves, but for a 5-min
      // page-session it's stable enough and saves a request per render.
      headers: { "cache-control": "private, max-age=300" }
    }
  );
}
