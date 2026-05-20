/**
 * Supabase-backed implementations of the beacon-router's injected interfaces.
 * Wires HelperStore / Notifier / EventBus to our Postgres tables. The router
 * itself stays pure.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Beacon,
  BeaconEvent,
  Helper
} from "./types";
import type {
  HelperStore,
  Notifier,
  EventBus
} from "./router";

// ----------------------------------------------------------------------------
// HelperStore — reads online verified helpers from the candidates view.
// ----------------------------------------------------------------------------
export class SupabaseHelperStore implements HelperStore {
  constructor(private supabase: SupabaseClient) {}

  async listOnlineCandidates(subject: string): Promise<Helper[]> {
    const { data, error } = await this.supabase
      .from("beacon_helper_candidates_view")
      .select("*")
      .eq("is_online", true);
    if (error) {
      console.warn("[helper-store] candidate fetch failed", error.message);
      return [];
    }
    return (data ?? []).map((row: any) => ({
      profile_id: row.profile_id,
      badge_tier: row.badge_tier,
      country: row.country,
      current_education_level: row.current_education_level ?? "unknown",
      syllabus: row.syllabus,
      subject_affinities: row.subject_affinities ?? [],
      is_online: !!row.is_online,
      active_beacon_count: row.active_beacon_count ?? 0,
      dnd_until: row.dnd_until ? new Date(row.dnd_until) : null,
      beacons_paused: !!row.beacons_paused,
      avg_rating: row.avg_rating != null ? Number(row.avg_rating) : null,
      sessions_completed: row.sessions_completed ?? 0,
      ghosts_last_7d: row.ghosts_last_7d ?? 0,
      // We don't store per-subject win counts in the view yet — pass an empty
      // map (scorer treats missing keys as 0). A future migration can add a
      // materialized counter.
      past_helpful_sessions_by_subject: {}
    }));
  }
}

// ----------------------------------------------------------------------------
// Notifier — writes beacon_routes rows so helpers see beacons in their
// sidebar (the client subscribes via Supabase Realtime to beacon_routes).
// "Start session" creates the beacon_sessions row + LiveKit name.
// ----------------------------------------------------------------------------
export class SupabaseNotifier implements Notifier {
  constructor(private supabase: SupabaseClient) {}

  async notifyHelper(
    helperId: string,
    beacon: Beacon,
    phase: 1 | 2 | 3 | 4
  ): Promise<void> {
    await this.supabase
      .from("beacon_routes")
      .upsert(
        {
          beacon_id: beacon.id,
          helper_profile_id: helperId,
          phase,
          acknowledged: "seen"
        },
        { onConflict: "beacon_id,helper_profile_id" }
      );
  }

  async notifyHelperAccepted(
    helperId: string,
    beaconId: string
  ): Promise<void> {
    await this.supabase
      .from("beacon_routes")
      .update({ acknowledged: "passed", responded_at: new Date().toISOString() })
      .eq("beacon_id", beaconId)
      .eq("helper_profile_id", helperId);
  }

  async startSession(
    beaconId: string,
    askerId: string,
    helperId: string
  ): Promise<{ session_id: string }> {
    // accept_beacon() RPC already creates a session row when a helper accepts.
    // We look it up here and just return the id.
    const { data } = await this.supabase
      .from("beacon_sessions")
      .select("id, livekit_room_name")
      .eq("beacon_id", beaconId)
      .maybeSingle();
    if (data?.id) {
      // ensure a livekit room name is stamped
      if (!data.livekit_room_name) {
        await this.supabase
          .from("beacon_sessions")
          .update({ livekit_room_name: `beacon-${beaconId.slice(0, 12)}` })
          .eq("id", data.id);
      }
      return { session_id: data.id };
    }
    // Fallback path — create one ourselves (shouldn't normally hit).
    const { data: created, error } = await this.supabase
      .from("beacon_sessions")
      .insert({
        beacon_id: beaconId,
        asker_profile_id: askerId,
        helper_profile_id: helperId,
        livekit_room_name: `beacon-${beaconId.slice(0, 12)}`
      })
      .select("id")
      .single();
    if (error) throw error;
    return { session_id: created.id };
  }

  async offerKaroFallback(beacon: Beacon): Promise<void> {
    // We store a flag on the beacon and a karo_summary placeholder. The
    // client picks this up and renders "Karo's answer ready" tile.
    await this.supabase
      .from("help_beacons")
      .update({
        status: "answered",
        karo_rewritten_question:
          beacon.classification.rewritten_question ?? beacon.raw_question_text,
        answered_at: new Date().toISOString()
      })
      .eq("id", beacon.id);
  }
}

// ----------------------------------------------------------------------------
// EventBus — write-only, structured log of beacon lifecycle events.
// We persist into a small `beacon_events` table for forensics / analytics.
// If the table doesn't exist yet (very-first-run state), we silently no-op.
// ----------------------------------------------------------------------------
export class SupabaseEventBus implements EventBus {
  constructor(private supabase: SupabaseClient) {}

  emit(event: BeaconEvent): void {
    // Fire-and-forget — never blocks router progress.
    void this.supabase
      .from("beacon_events")
      .insert({
        type: event.type,
        beacon_id: (event as any).beacon_id ?? null,
        payload: event as any,
        emitted_at: (event as any).at?.toISOString?.() ?? new Date().toISOString()
      })
      .then(() => {})
      // Swallow errors — analytics shouldn't crash production routing.
      .then(undefined, () => {});
  }
}
