import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Some restrictive networks/browsers silently drop the cross-origin CORS
// preflight (OPTIONS) to *.supabase.co — or return an HTML block page — so the
// app's REST/auth/functions calls hang or fail. To stay robust there WITHOUT
// changing behaviour on normal networks, we wrap fetch: try the direct call
// first (fast, unchanged on good networks); if it times out, errors, or comes
// back as an HTML interstitial, retry the SAME request against the same-origin
// proxy (`/sb-proxy/...` → supabase.co, served by nginx on the app server, with
// a Next route handler as fallback). Once a direct call has failed we remember
// it — in localStorage too — and skip straight to the proxy.
//
// Realtime uses a websocket (not fetch). When we KNOW the direct path is blocked
// we also point that websocket at the same-origin proxy (see
// createSupabaseBrowserClient). Good networks keep a direct websocket.

const BLOCKED_KEY = "karochat:sb-direct-blocked";

function readBlocked(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.localStorage.getItem(BLOCKED_KEY) === "1"
    );
  } catch {
    return false;
  }
}

// Start already-blocked if a previous visit proved the direct path is blocked,
// so we skip the per-call direct attempt (and direct websocket) entirely.
let directBlocked = readBlocked();
const DIRECT_TIMEOUT_MS = 2500;

function markBlocked() {
  directBlocked = true;
  try {
    window.localStorage.setItem(BLOCKED_KEY, "1");
  } catch {
    /* ignore */
  }
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

function toProxy(url: string): string {
  // https://<ref>.supabase.co/rest/v1/... → <origin>/sb-proxy/rest/v1/...
  return window.location.origin + "/sb-proxy" + url.slice(SUPABASE_URL.length);
}

// Supabase APIs only ever return JSON/binary — never an HTML document. So a
// `text/html` response means the network intercepted the call and served a
// block page / captive portal instead of forwarding it. Treat that as blocked.
function looksIntercepted(res: Response): boolean {
  return (res.headers.get("content-type") || "").toLowerCase().includes("text/html");
}

async function resilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // Only special-case browser calls to our Supabase project.
  if (typeof window === "undefined") return fetch(input as any, init);
  const url = urlOf(input);
  if (!url || !url.startsWith(SUPABASE_URL)) return fetch(input as any, init);

  const proxyUrl = toProxy(url);

  // Already know direct is blocked → go straight to the same-origin proxy.
  if (directBlocked) {
    return fetch(proxyUrl, init);
  }

  // Try direct with a timeout. Respect a caller-provided abort signal so we
  // don't fall back when the caller deliberately cancelled.
  const ctrl = new AbortController();
  let timedOut = false;
  const onCallerAbort = () => ctrl.abort();
  const caller = init?.signal;
  if (caller) {
    if (caller.aborted) ctrl.abort();
    else caller.addEventListener("abort", onCallerAbort, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, DIRECT_TIMEOUT_MS);

  try {
    const res = await fetch(input as any, { ...init, signal: ctrl.signal });
    // The call "succeeded" but a captive portal / ISP returned an HTML block
    // page instead of the real Supabase response → retry via the proxy.
    if (looksIntercepted(res)) {
      markBlocked();
      return fetch(proxyUrl, init);
    }
    return res;
  } catch (err) {
    // Caller cancelled (not our timeout) → propagate, don't fall back.
    if (caller?.aborted && !timedOut) throw err;
    // Timed out or network/preflight failure → switch to the same-origin proxy.
    markBlocked();
    return fetch(proxyUrl, init);
  } finally {
    clearTimeout(timer);
    if (caller) caller.removeEventListener("abort", onCallerAbort);
  }
}

// A WebSocket subclass that rewrites the realtime URL to the same-origin proxy.
// Only used when the direct path is known-blocked — good networks pass
// `undefined` and get the default (direct) websocket, unchanged.
function proxyTransport(): typeof WebSocket | undefined {
  if (typeof window === "undefined" || typeof WebSocket === "undefined") return undefined;
  const wsOrigin = window.location.origin.replace(/^http/, "ws");
  return class ProxyWebSocket extends WebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      const raw = typeof url === "string" ? url : url.toString();
      // wss://<ref>.supabase.co/realtime/v1/... → wss://<origin>/sb-proxy/realtime/v1/...
      const rewritten = raw.replace(/wss?:\/\/[^/]+\.supabase\.co/i, wsOrigin + "/sb-proxy");
      super(rewritten, protocols);
    }
  } as unknown as typeof WebSocket;
}

export function createSupabaseBrowserClient() {
  const transport = directBlocked ? proxyTransport() : undefined;
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { fetch: resilientFetch },
    ...(transport ? { realtime: { transport: transport as any } } : {})
  });
}
