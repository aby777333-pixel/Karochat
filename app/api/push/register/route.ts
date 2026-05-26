// Karochat — /api/push/register
//
// Receives a device push token from the Capacitor shell after the user
// grants notification permission. Persists into public.push_tokens so
// the server can fan out FCM / APNs notifications later (DM received,
// room mention, friend request, Karo Q&A answer).
//
// Idempotent: re-registers existing tokens (e.g. on app re-launch) bump
// updated_at + active=true so the server keeps using the freshest token
// per device.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_PLATFORMS = new Set(["ios", "android", "web"]);

export async function POST(req: Request) {
  let body: { token?: string; platform?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  const token = (body.token ?? "").trim();
  const platform = (body.platform ?? "").trim().toLowerCase();

  if (!token || token.length > 4096) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }
  if (!ALLOWED_PLATFORMS.has(platform)) {
    return NextResponse.json({ error: "invalid platform" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const { error } = await supabase.rpc("upsert_push_token", {
      p_token: token,
      p_platform: platform
    });
    if (error) {
      // If the RPC doesn't exist yet (migration not applied) we degrade
      // gracefully — the token is logged and the app keeps working.
      console.warn("[push/register] upsert_push_token RPC missing:", error.message);
      return NextResponse.json(
        { ok: false, deferred: true, reason: "rpc-missing" },
        { status: 200 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[push/register] failed", err);
    return NextResponse.json(
      { error: err?.message ?? "register-failed" },
      { status: 500 }
    );
  }
}
