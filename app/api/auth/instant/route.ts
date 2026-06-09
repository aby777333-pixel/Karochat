import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Same-origin instant sign-in.
 *
 * The browser posts here (same origin → NO CORS preflight), and the server
 * does the two cross-origin hops to Supabase itself:
 *   1) call the `instant-auth` edge function to create/repair + confirm the
 *      account (service-role, no email), and
 *   2) sign in with the deterministic password, writing the auth cookies onto
 *      THIS response so the browser is authenticated.
 *
 * This is what lets people sign in on networks that drop the browser's CORS
 * preflight (OPTIONS) to supabase.co — simple same-origin requests still pass.
 * The deterministic password is derived from the email (same formula the
 * client used historically), so existing accounts keep working unchanged.
 */

// Mirror of the old client-side derivePassword(): SHA-256 of "karochat:v1:"+
// email → standard base64, strip non-alphanumerics, prefix. Deterministic, so
// the server reproduces the exact password an account was created with.
function derivePassword(email: string): string {
  const b64 = createHash("sha256")
    .update("karochat:v1:" + email)
    .digest("base64")
    .replace(/[^a-zA-Z0-9]/g, "");
  return "Kc1!" + b64.slice(0, 36);
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "bad_request" });
  }

  const email = String(body?.email ?? "").trim().toLowerCase();
  const phone = String(body?.phone ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, code: "bad_email" });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anon) {
    return NextResponse.json({ ok: false, code: "server", detail: "missing_env" });
  }

  const password = derivePassword(email);

  // Preserve the function's IP-blacklist check by forwarding the real caller IP
  // (otherwise it would only see Netlify's egress IP).
  const clientIp =
    request.headers.get("x-nf-client-connection-ip") ||
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "";

  // 1) Create / repair + confirm the account (server-to-server).
  let prep: any = null;
  try {
    const r = await fetch(`${supabaseUrl}/functions/v1/instant-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "x-forwarded-for": clientIp
      },
      body: JSON.stringify({ email, phone, password })
    });
    prep = await r.json().catch(() => null);
  } catch {
    return NextResponse.json({ ok: false, code: "prep_unreachable" });
  }

  if (prep?.code === "admin_otp") {
    return NextResponse.json({ ok: false, code: "admin_otp" });
  }
  if (!prep || !prep.ok) {
    return NextResponse.json({
      ok: false,
      code: prep?.code ?? "server",
      masked: prep?.masked ?? null
    });
  }

  // 2) Sign in server-side — the SSR client writes the auth cookies onto this
  //    response, so the browser ends up authenticated with no cross-origin call.
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error || !data?.session) {
    return NextResponse.json({
      ok: false,
      code: "signin_failed",
      detail: error?.message ?? null
    });
  }

  // 3) Decide the landing page from profile completeness (same rules as the
  //    magic-link callback).
  let redirect = "/rooms";
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, terms_accepted_at")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.username) redirect = "/onboarding";
    else if (!profile.terms_accepted_at) redirect = "/terms";
  }

  return NextResponse.json({ ok: true, redirect });
}
