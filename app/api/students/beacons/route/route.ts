// /api/students/beacons/route — server-side beacon routing.
//
// Called after the client creates a help_beacons row (via the create_beacon
// RPC). We:
//   1. Load the beacon + asker's verification context.
//   2. Classify via Karo (Anthropic if ANTHROPIC_API_KEY set, else stub).
//   3. Run the 4-phase router from lib/students/beacons.
//
// The router resolves either when:
//   • a helper accepts (their POST /api/students/beacons/accept signal)
//   • all 4 phases elapse with no taker (offer Karo fallback)
//
// Single-process semantics. For multi-worker, swap InProcessAcceptanceWaiter
// for a Redis/Postgres-pubsub version.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BeaconRouter, RealClock } from "@/lib/students/beacons/router";
import { AnthropicClassifier, StubClassifier } from "@/lib/students/beacons/classifier";
import {
  SupabaseHelperStore,
  SupabaseNotifier,
  SupabaseEventBus
} from "@/lib/students/beacons/supabase-impls";
import { DbPollingAcceptanceWaiter } from "@/lib/students/beacons/polling-waiter";
import type { Beacon } from "@/lib/students/beacons/types";

export const runtime = "nodejs";
export const maxDuration = 60; // Netlify lambda cap

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const beaconId = body?.beacon_id as string | undefined;
  if (!beaconId) {
    return NextResponse.json({ error: "beacon_id required" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  // Load beacon row
  const { data: rawBeacon, error: bErr } = await supabase
    .from("help_beacons")
    .select("*")
    .eq("id", beaconId)
    .maybeSingle();
  if (bErr || !rawBeacon) {
    return NextResponse.json(
      { error: bErr?.message ?? "beacon not found" },
      { status: 404 }
    );
  }
  if (rawBeacon.asker_profile_id !== user.id) {
    return NextResponse.json(
      { error: "only the asker can route their beacon" },
      { status: 403 }
    );
  }

  // Asker context (country/level/syllabus) for the classifier
  const { data: verif } = await supabase
    .from("student_verifications")
    .select("country, education_level, syllabus")
    .eq("profile_id", user.id)
    .eq("status", "verified")
    .maybeSingle();

  const beacon: Beacon = {
    id: rawBeacon.id,
    asker_profile_id: rawBeacon.asker_profile_id,
    raw_question_text: rawBeacon.question_text ?? "",
    raw_question_voice_url: rawBeacon.question_voice_url,
    raw_question_image_url: rawBeacon.question_image_url,
    context_note: rawBeacon.context_note,
    urgency: rawBeacon.urgency,
    // Placeholder until classifier fills it in
    classification: {
      subject: rawBeacon.subject ?? "unknown",
      topic: null,
      level: (verif?.education_level as any) ?? "unknown",
      syllabus: verif?.syllabus ?? null,
      country: verif?.country ?? null,
      rewritten_question: rawBeacon.question_text ?? "",
      confidence: 0,
      off_topic: false
    },
    status: rawBeacon.status,
    routing_phase: 1,
    answered_by_profile_id: rawBeacon.answered_by_profile_id,
    session_id: rawBeacon.session_id,
    created_at: new Date(rawBeacon.created_at),
    answered_at: rawBeacon.answered_at ? new Date(rawBeacon.answered_at) : null,
    expired_at: rawBeacon.expired_at ? new Date(rawBeacon.expired_at) : null
  };

  const classifier = process.env.ANTHROPIC_API_KEY
    ? new AnthropicClassifier(process.env.ANTHROPIC_API_KEY)
    : new StubClassifier();

  const router = new BeaconRouter({
    classifier,
    helperStore: new SupabaseHelperStore(supabase),
    notifier: new SupabaseNotifier(supabase),
    acceptanceWaiter: new DbPollingAcceptanceWaiter(supabase),
    clock: new RealClock(),
    eventBus: new SupabaseEventBus(supabase)
  });

  // Fire-and-forget — the router runs up to ~2 minutes in the foreground
  // (phases 1+2+3) then 59-minute phase 4 in the background. Netlify lambda
  // timeout will end this invocation early; the routes already written into
  // beacon_routes survive, and the asker can re-route via a retry later.
  // For production-grade long-tail routing, move this to a background queue
  // (Inngest, QStash, etc.).
  void (async () => {
    try {
      await router.runBeacon(beacon, {
        text: beacon.raw_question_text,
        context_note: beacon.context_note ?? undefined,
        asker_country: verif?.country ?? "IN",
        asker_level: (verif?.education_level as any) ?? "unknown",
        asker_syllabus: verif?.syllabus ?? null
      });
    } catch (e) {
      console.warn("[beacon-router] failed", e);
    }
  })();

  // Persist the classification on the beacon row asynchronously
  void (async () => {
    try {
      const cls = await classifier.classify({
        text: beacon.raw_question_text,
        context_note: beacon.context_note ?? undefined,
        asker_country: verif?.country ?? "IN",
        asker_level: (verif?.education_level as any) ?? "unknown",
        asker_syllabus: verif?.syllabus ?? null
      });
      await supabase
        .from("help_beacons")
        .update({
          subject: cls.subject,
          topic: cls.topic,
          level: cls.level,
          syllabus: cls.syllabus,
          country: cls.country,
          karo_rewritten_question: cls.rewritten_question,
          classification: cls as any
        })
        .eq("id", beacon.id);
    } catch {
      // best-effort metadata update
    }
  })();

  return NextResponse.json({ ok: true, beacon_id: beacon.id });
}
