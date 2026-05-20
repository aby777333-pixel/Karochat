/**
 * Beacon Router
 * -------------
 * The 4-phase orchestrator. Given a beacon + an injected store/notifier/clock,
 * runs the fan-out across phases, races against helper acceptances, and
 * resolves with a BeaconOutcome.
 *
 * Designed as a state machine with injectable dependencies — everything
 * involving I/O (database, notifications, time) goes through interfaces so
 * tests can drive it deterministically.
 *
 * Drop path: src/students-network/beacons/router.ts
 */

import {
  Beacon, BeaconEvent, BeaconOutcome, BeaconRouterConfig,
  DEFAULT_CONFIG, Helper, ScoredHelper,
} from './types';
import { Classifier, ClassifierInput } from './classifier';
import { rankHelpersForPhase } from './scorer';

// ============================================================================
// DEPENDENCIES (injected — store, notifier, clock)
// ============================================================================

export interface HelperStore {
  /** Get all currently-online verified helpers (filtered server-side for perf). */
  listOnlineCandidates(subject: string): Promise<Helper[]>;
}

export interface Notifier {
  /** Push a beacon to a helper's sidebar (via Supabase Realtime / WS / push). */
  notifyHelper(helperId: string, beacon: Beacon, phase: 1 | 2 | 3 | 4): Promise<void>;
  /** Tell a notified helper that someone else accepted the beacon. */
  notifyHelperAccepted(helperId: string, beaconId: string): Promise<void>;
  /** Push a session start to the accepting helper + asker. */
  startSession(beaconId: string, askerId: string, helperId: string): Promise<{ session_id: string }>;
  /** Karo fallback: offer an AI answer after 1h. */
  offerKaroFallback(beacon: Beacon): Promise<void>;
}

export interface EventBus {
  emit(event: BeaconEvent): void;
}

/** Race signal — helper acceptances arrive through this. */
export interface AcceptanceWaiter {
  /**
   * Wait for the first helper acceptance, OR until `ms` elapses.
   * Resolves with the accepting helper_profile_id, or null on timeout.
   * Should also resolve null on `cancel()` from caller.
   */
  waitForAcceptance(beaconId: string, ms: number): Promise<string | null>;
  /** Stop waiting (e.g. beacon cancelled). */
  cancel(beaconId: string): void;
  /** Internal: called when a helper hits "accept". */
  signalAcceptance(beaconId: string, helperId: string): void;
}

export interface Clock {
  now(): Date;
  /** Resolves after `ms`. AbortSignal-friendly. */
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

// Default in-process AcceptanceWaiter — works for a single Node process.
// In production with multiple workers, replace with a Redis/Postgres-pubsub backed version.
export class InProcessAcceptanceWaiter implements AcceptanceWaiter {
  private waiters = new Map<string, {
    resolve: (helperId: string | null) => void;
    timer: ReturnType<typeof setTimeout> | null;
  }>();

  waitForAcceptance(beaconId: string, ms: number): Promise<string | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.waiters.get(beaconId)?.resolve === resolve) {
          this.waiters.delete(beaconId);
          resolve(null);
        }
      }, ms);
      this.waiters.set(beaconId, { resolve, timer });
    });
  }

  signalAcceptance(beaconId: string, helperId: string): void {
    const w = this.waiters.get(beaconId);
    if (w) {
      if (w.timer) clearTimeout(w.timer);
      this.waiters.delete(beaconId);
      w.resolve(helperId);
    }
  }

  cancel(beaconId: string): void {
    const w = this.waiters.get(beaconId);
    if (w) {
      if (w.timer) clearTimeout(w.timer);
      this.waiters.delete(beaconId);
      w.resolve(null);
    }
  }
}

export class RealClock implements Clock {
  now(): Date { return new Date(); }
  sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      });
    });
  }
}

// ============================================================================
// THE ROUTER
// ============================================================================

export interface RouterDeps {
  classifier: Classifier;
  helperStore: HelperStore;
  notifier: Notifier;
  acceptanceWaiter: AcceptanceWaiter;
  clock: Clock;
  eventBus: EventBus;
  config?: BeaconRouterConfig;
}

export class BeaconRouter {
  private cfg: BeaconRouterConfig;

  constructor(private deps: RouterDeps) {
    this.cfg = deps.config ?? DEFAULT_CONFIG;
  }

  /**
   * Main entrypoint. Takes a fresh beacon and runs the full lifecycle:
   *   classify → phase 1 → phase 2 → phase 3 → phase 4 → karo fallback → expire.
   *
   * Resolves with a BeaconOutcome describing how it ended.
   */
  async runBeacon(beacon: Beacon, classifierInput: ClassifierInput): Promise<BeaconOutcome> {
    const startedAt = this.deps.clock.now();
    const startMs = startedAt.getTime();

    // ===== 1. Classify =====
    this.deps.eventBus.emit({ type: 'classification_started', beacon_id: beacon.id, at: startedAt });

    const classification = await this.deps.classifier.classify(classifierInput);
    beacon.classification = classification;

    if (classification.off_topic) {
      this.deps.eventBus.emit({
        type: 'classification_rejected', beacon_id: beacon.id,
        reason: classification.off_topic_reason ?? 'off-topic',
        at: this.deps.clock.now(),
      });
      return { kind: 'cancelled', total_duration_ms: this.deps.clock.now().getTime() - startMs };
    }

    this.deps.eventBus.emit({
      type: 'classification_completed', beacon_id: beacon.id,
      classification, at: this.deps.clock.now(),
    });

    // ===== 2. Fetch candidate pool =====
    const candidates = await this.deps.helperStore.listOnlineCandidates(classification.subject);

    // ===== 3. Run phases 1 → 4 =====
    const alreadyNotified = new Set<string>();
    const phases: Array<{ phase: 1 | 2 | 3 | 4; duration_ms: number }> = [
      { phase: 1, duration_ms: this.cfg.phase_1_duration_ms },
      { phase: 2, duration_ms: this.cfg.phase_2_duration_ms },
      { phase: 3, duration_ms: this.cfg.phase_3_duration_ms },
      { phase: 4, duration_ms: this.cfg.phase_4_duration_ms },
    ];

    for (const { phase, duration_ms } of phases) {
      const ranked = rankHelpersForPhase(candidates, classification, phase, alreadyNotified, this.cfg);

      this.deps.eventBus.emit({
        type: 'phase_started', beacon_id: beacon.id, phase,
        helpers_count: ranked.length, at: this.deps.clock.now(),
      });

      // Notify all ranked helpers (parallel, fire-and-forget tracking)
      await Promise.all(ranked.map(async (s) => {
        alreadyNotified.add(s.helper.profile_id);
        try {
          await this.deps.notifier.notifyHelper(s.helper.profile_id, beacon, phase);
          this.deps.eventBus.emit({
            type: 'helper_notified', beacon_id: beacon.id,
            helper_profile_id: s.helper.profile_id, phase, at: this.deps.clock.now(),
          });
        } catch (err) {
          // Notification failure is non-fatal; helper just won't see it.
          // In production: structured log + metric.
        }
      }));

      // Wait this phase's duration OR until someone accepts
      const winnerId = await this.deps.acceptanceWaiter.waitForAcceptance(beacon.id, duration_ms);
      if (winnerId) {
        return await this.handleAcceptance(beacon, winnerId, phase, startMs, alreadyNotified);
      }
      // Otherwise loop into next phase
    }

    // ===== 4. Karo fallback (1h mark) =====
    // We've spent ~2 minutes on phases 1-3 + 59 minutes on phase 4 = ~61 minutes total.
    // If still no winner, offer Karo fallback. Beacon stays live for humans for another 23h.
    this.deps.eventBus.emit({ type: 'karo_fallback_offered', beacon_id: beacon.id, at: this.deps.clock.now() });
    await this.deps.notifier.offerKaroFallback(beacon);

    // Keep the door open in case a human eventually accepts (next 23h).
    // The router exits here — long-tail acceptance is handled by a separate
    // background job that periodically re-runs phase 4 routing.
    return {
      kind: 'expired',
      total_duration_ms: this.deps.clock.now().getTime() - startMs,
      phases_completed: 4,
    };
  }

  /**
   * Called when a helper hits "accept". Public so the API layer can call it
   * directly when an HTTP POST /beacons/:id/accept comes in.
   */
  acceptBeacon(beaconId: string, helperId: string): void {
    this.deps.acceptanceWaiter.signalAcceptance(beaconId, helperId);
  }

  cancelBeacon(beaconId: string): void {
    this.deps.acceptanceWaiter.cancel(beaconId);
  }

  // ============================================================
  // INTERNAL
  // ============================================================

  private async handleAcceptance(
    beacon: Beacon,
    winnerId: string,
    phase: 1 | 2 | 3 | 4,
    startMs: number,
    notified: Set<string>,
  ): Promise<BeaconOutcome> {
    this.deps.eventBus.emit({
      type: 'helper_accepted', beacon_id: beacon.id,
      helper_profile_id: winnerId, phase, at: this.deps.clock.now(),
    });

    // Start the session (creates LiveKit room, whiteboard, etc.)
    const { session_id } = await this.deps.notifier.startSession(
      beacon.id, beacon.asker_profile_id, winnerId,
    );

    // Tell all other notified helpers the beacon's gone
    const otherHelpers = [...notified].filter(id => id !== winnerId);
    await Promise.all(
      otherHelpers.map(id => this.deps.notifier.notifyHelperAccepted(id, beacon.id).catch(() => {/*non-fatal*/}))
    );

    this.deps.eventBus.emit({
      type: 'beacon_answered', beacon_id: beacon.id,
      helper_profile_id: winnerId, session_id, at: this.deps.clock.now(),
    });

    return {
      kind: 'answered',
      helper_profile_id: winnerId,
      phase,
      total_duration_ms: this.deps.clock.now().getTime() - startMs,
    };
  }
}
