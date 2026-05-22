import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
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

/**
 * POST /api/livekit/end
 * Body: { roomId: string, targetUserId?: string }
 *
 * Without targetUserId — owner/admin/moderator deletes the entire LiveKit
 * room (ends the meeting for everyone). With targetUserId — kick a single
 * participant via removeParticipant. Identities mirror Supabase user ids.
 */
export async function POST(req: Request) {
  const cfg = liveKitConfig();
  if (!cfg)
    return NextResponse.json({ error: "livekit-not-configured" }, { status: 503 });

  let body: { roomId?: string; targetUserId?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const roomId = body.roomId;
  if (!roomId)
    return NextResponse.json({ error: "roomId required" }, { status: 400 });

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // Caller must be the room owner OR an owner/admin/moderator member.
  const [{ data: room }, { data: membership }] = await Promise.all([
    supabase.from("rooms").select("owner_id").eq("id", roomId).maybeSingle(),
    supabase
      .from("room_members")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle()
  ]);

  const isOwner = !!room && room.owner_id === user.id;
  const isStaff =
    !!membership &&
    ["owner", "admin", "moderator"].includes((membership as any).role);
  if (!isOwner && !isStaff)
    return NextResponse.json({ error: "not authorized" }, { status: 403 });

  const lkRoom = `karochat-${roomId}`;
  const svc = new RoomServiceClient(cfg.url, cfg.apiKey, cfg.apiSecret);

  try {
    if (body.targetUserId) {
      await svc.removeParticipant(lkRoom, body.targetUserId);
      return NextResponse.json({ ok: true, removed: body.targetUserId });
    }
    await svc.deleteRoom(lkRoom);
    return NextResponse.json({ ok: true, ended: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "livekit-error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
