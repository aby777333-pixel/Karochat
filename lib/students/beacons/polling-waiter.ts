/**
 * DB-polling AcceptanceWaiter.
 *
 * Works across Netlify lambda invocations because state lives in Postgres
 * (the help_beacons row's status flips to 'answered' when a helper accepts
 * via the accept_beacon RPC).
 *
 * Polling interval: 2 seconds. Total wait capped per phase.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AcceptanceWaiter } from "./router";

export class DbPollingAcceptanceWaiter implements AcceptanceWaiter {
  private cancelled = new Set<string>();

  constructor(
    private supabase: SupabaseClient,
    private pollMs: number = 2000
  ) {}

  async waitForAcceptance(
    beaconId: string,
    ms: number
  ): Promise<string | null> {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (this.cancelled.has(beaconId)) {
        this.cancelled.delete(beaconId);
        return null;
      }
      const { data } = await this.supabase
        .from("help_beacons")
        .select("status, answered_by_profile_id")
        .eq("id", beaconId)
        .maybeSingle();
      if (data?.status === "answered" && data.answered_by_profile_id) {
        return data.answered_by_profile_id as string;
      }
      if (data?.status === "cancelled" || data?.status === "expired") {
        return null;
      }
      await new Promise((r) => setTimeout(r, this.pollMs));
    }
    return null;
  }

  // No-op in DB-polling mode: helpers signal acceptance via accept_beacon
  // RPC (which flips the row), and this waiter detects it on the next poll.
  signalAcceptance(_beaconId: string, _helperId: string): void {
    // intentionally no-op
  }

  cancel(beaconId: string): void {
    this.cancelled.add(beaconId);
  }
}
