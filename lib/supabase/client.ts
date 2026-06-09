import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Some restrictive networks/browsers silently drop the cross-origin CORS
// preflight (OPTIONS) to *.supabase.co, so the app's REST/auth/functions calls
// hang forever. To stay robust there WITHOUT changing behaviour on normal
// networks, we wrap fetch: try the direct call first (fast, unchanged on good
// networks); if it times out or errors, retry the SAME request against a
// same-origin Netlify proxy (`/sb-proxy/...` → supabase.co), which never needs
// a CORS preflight. Once a direct call has failed we remember it and skip
// straight to the proxy for the rest of the session.
//
// Realtime uses a websocket (not fetch) and isn't subject to CORS preflight, so
// it's left untouched.

let directBlocked = false;
const DIRECT_TIMEOUT_MS = 7000;

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

function toProxy(url: string): string {
  // https://<ref>.supabase.co/rest/v1/... → <origin>/sb-proxy/rest/v1/...
  return window.location.origin + "/sb-proxy" + url.slice(SUPABASE_URL.length);
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
    return await fetch(input as any, { ...init, signal: ctrl.signal });
  } catch (err) {
    // Caller cancelled (not our timeout) → propagate, don't fall back.
    if (caller?.aborted && !timedOut) throw err;
    // Timed out or network/preflight failure → switch to the same-origin proxy.
    directBlocked = true;
    return fetch(proxyUrl, init);
  } finally {
    clearTimeout(timer);
    if (caller) caller.removeEventListener("abort", onCallerAbort);
  }
}

export function createSupabaseBrowserClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { fetch: resilientFetch }
  });
}
