// Karochat — same-origin Supabase proxy (route handler).
//
// WHY THIS EXISTS
// Production (karochat.co) is served from a self-hosted nginx droplet, NOT
// Netlify, so the `/sb-proxy/*` rewrite in netlify.toml never runs there. This
// route handler does the same job from inside the Next.js server: it forwards
// `/sb-proxy/<rest|auth|functions|storage>/...` to the Supabase project
// server-to-server. The browser Supabase client (lib/supabase/client.ts) falls
// back to this path whenever a direct call to *.supabase.co fails or is
// intercepted by a restrictive network (some ISPs silently drop the CORS
// preflight or return an HTML block page). Same-origin requests never need a
// CORS preflight and aren't subject to hostname-based blocks of supabase.co.
//
// Realtime uses a WebSocket and is NOT proxied here (route handlers can't proxy
// WS upgrades); it talks to supabase.co directly, exactly as before.

import { type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");

// Request headers that must not be copied through a proxy.
const STRIP_REQ = new Set(["host", "connection", "content-length", "accept-encoding"]);

// Response headers that must not be copied back. content-encoding/length and
// transfer-encoding are critical: Node's fetch already decompresses the upstream
// body, so echoing the original encoding/length would make the browser fail to
// decode it.
const STRIP_RES = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  // Drop Supabase/Cloudflare cookies scoped to supabase.co — useless on our
  // origin and could confuse the browser.
  "set-cookie"
]);

async function proxy(request: NextRequest, ctx: { params: { path?: string[] } }) {
  if (!SUPABASE_URL) {
    return Response.json({ error: "sb-proxy misconfigured: missing SUPABASE URL" }, { status: 500 });
  }

  const path = (ctx.params.path ?? []).join("/");
  const target = `${SUPABASE_URL}/${path}${request.nextUrl.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIP_REQ.has(key.toLowerCase())) headers.set(key, value);
  });

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store"
    });
  } catch (e) {
    return Response.json(
      { error: "sb-proxy upstream fetch failed", detail: String((e as any)?.message ?? e) },
      { status: 502 }
    );
  }

  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIP_RES.has(key.toLowerCase())) resHeaders.set(key, value);
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
