"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Ring the other member(s) of a room/DM when starting a call.
 *
 * Best-effort + fire-and-forget: inserts a `call` radar ping per other member
 * via the ring_room RPC (0074), which the server turns into background Web
 * Push (closed app) and which the in-app GlobalNotifier listener turns into a
 * ring + vibrate + toast (open app). Never throws — a signalling hiccup must
 * never block the caller from joining their own LiveKit call.
 */
export async function ringRoom(
  roomId: string,
  mode: "audio" | "video"
): Promise<void> {
  try {
    const supabase = createSupabaseBrowserClient();
    await supabase.rpc("ring_room", { p_room_id: roomId, p_mode: mode });
  } catch {
    // ignore — signalling is non-critical to the caller's own call.
  }
}
