import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function liveKitConfig() {
  const url = process.env.LIVEKIT_URL ?? process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret };
}

export async function GET() {
  return NextResponse.json({ configured: liveKitConfig() !== null });
}

export async function POST(req: Request) {
  const cfg = liveKitConfig();
  if (!cfg) {
    return NextResponse.json({ error: "livekit-not-configured" }, { status: 503 });
  }

  let body: { roomId?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const roomId = body.roomId;
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "not a member" }, { status: 403 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .maybeSingle();

  const lkRoom = `karochat-${roomId}`;
  const token = new AccessToken(cfg.apiKey, cfg.apiSecret, {
    identity: user.id,
    name: profile?.display_name ?? profile?.username ?? "Guest",
    ttl: 60 * 60 * 4
  });
  token.addGrant({
    roomJoin: true,
    room: lkRoom,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true
  });

  return NextResponse.json({
    token: await token.toJwt(),
    url: cfg.url,
    room: lkRoom
  });
}
