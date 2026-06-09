import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TERMS_VERSION = 1;

/**
 * Same-origin terms acceptance.
 *
 * The browser posts here (no CORS preflight) and the server reads the session
 * from the auth cookie and updates the profile — so it works on networks that
 * drop the browser's cross-origin preflight to supabase.co (same reason as
 * /api/auth/instant). RLS still applies: the SSR client acts as the user, who
 * may only update their own row.
 */
export async function POST() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: "no_session" }, { status: 401 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      terms_accepted_at: new Date().toISOString(),
      terms_version: TERMS_VERSION
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ ok: false, code: "update_failed", detail: error.message });
  }

  return NextResponse.json({ ok: true, redirect: "/rooms" });
}
