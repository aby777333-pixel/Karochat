import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Logs an abuse/flagged-content event with the offender's IP + user-agent.
 * Called when a user trips the flagged-terms filter (hard-line categories:
 * minors, terror, doxxing). The IP is captured server-side from edge headers
 * and stored in public.abuse_events for review / hand-off to authorities.
 *
 * Insert runs as the signed-in user (RLS: user_id = auth.uid()).
 */
function clientIp(h: Headers): string | null {
  return (
    h.get("x-nf-client-connection-ip") ||
    h.get("x-real-ip") ||
    (h.get("x-forwarded-for") || "").split(",")[0]?.trim() ||
    null
  );
}

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const body = await req.json().catch(() => ({} as any));
    const h = headers();
    const ip = clientIp(h);
    const ua = h.get("user-agent");

    const category = String(body?.category ?? "flagged_terms").slice(0, 40);
    const snippet = String(body?.snippet ?? "").slice(0, 500);
    const roomId =
      typeof body?.room_id === "string" && body.room_id.length <= 40
        ? body.room_id
        : null;

    const { error } = await supabase.from("abuse_events").insert({
      user_id: user.id,
      ip,
      user_agent: ua,
      category,
      snippet,
      room_id: roomId
    });

    return NextResponse.json({ ok: !error });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
