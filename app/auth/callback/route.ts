import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Handles three sign-in completion flows:
 *
 *   1. PKCE     — same-browser magic link: `?code=...`
 *                 The browser SDK stored a `code_verifier` cookie when
 *                 `signInWithOtp` was called on this device; we exchange
 *                 the auth code for a session.
 *
 *   2. token_hash — Supabase's classic verify endpoint redirects here with
 *                 `?token_hash=...&type=email|magiclink|signup|recovery`.
 *                 Works cross-device because there is no client-stored
 *                 verifier; the token itself is the proof.
 *
 *   3. token     — legacy `?token=...&type=...` parameter still emitted by
 *                 some Supabase email templates. Same idea as token_hash.
 *
 * Whichever succeeds, we land the user on their next step (onboarding /
 * terms / rooms). Errors carry a `?auth=` reason so the home page can
 * surface a hint instead of looking like a no-op (which is what the user
 * was hitting on their second device).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tokenParam = url.searchParams.get("token");
  const typeParam = url.searchParams.get("type");
  const next = url.searchParams.get("next") ?? "/rooms";

  const supabase = createSupabaseServerClient();

  let signedIn = false;
  let lastErr: string | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      signedIn = true;
    } else {
      lastErr = error.message;
    }
  }

  if (!signedIn && tokenHash) {
    const verifyType = (typeParam ?? "email") as
      | "email"
      | "magiclink"
      | "signup"
      | "recovery"
      | "invite";
    const { error } = await supabase.auth.verifyOtp({
      type: verifyType,
      token_hash: tokenHash
    });
    if (!error) {
      signedIn = true;
    } else {
      lastErr = error.message;
    }
  }

  if (!signedIn && tokenParam && typeParam) {
    // Legacy `?token=...&type=...` — older email templates and OAuth
    // providers may still send this shape.
    const verifyType = typeParam as
      | "email"
      | "magiclink"
      | "signup"
      | "recovery"
      | "invite";
    const { error } = await supabase.auth.verifyOtp({
      type: verifyType,
      token_hash: tokenParam
    });
    if (!error) {
      signedIn = true;
    } else {
      lastErr = error.message;
    }
  }

  if (signedIn) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, terms_accepted_at")
        .eq("id", user.id)
        .maybeSingle();
      let dest = next;
      if (!profile?.username) dest = "/onboarding";
      else if (!profile.terms_accepted_at) dest = "/terms";
      return NextResponse.redirect(new URL(dest, url.origin));
    }
  }

  const reason = lastErr
    ? `error&detail=${encodeURIComponent(lastErr).slice(0, 200)}`
    : "error";
  return NextResponse.redirect(new URL(`/?auth=${reason}`, url.origin));
}
