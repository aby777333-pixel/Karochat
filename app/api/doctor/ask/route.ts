// Karochat — POST /api/doctor/ask (v9 Phase 4).
//
// Creates a doctor beacon on the v8 help-beacon rail. The emergency
// triage classifier runs server-side BEFORE routing — client-side
// detection is a convenience; this is the enforcement point. Detected
// red flags return emergency numbers alongside the created beacon and
// travel with the beacon as `was_emergency_routed`.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  detectEmergency,
  emergencyHelplineKindsFor
} from "@/lib/doctor/triage";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    symptom?: string;
    severity?: number;
    duration?: string | null;
    specialty?: string | null;
    country?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const symptom = (body.symptom ?? "").trim();
  const severity = Number(body.severity);
  if (!symptom || symptom.length < 10) {
    return NextResponse.json(
      { error: "Describe what's going on (at least a sentence)." },
      { status: 400 }
    );
  }
  if (!Number.isInteger(severity) || severity < 1 || severity > 10) {
    return NextResponse.json(
      { error: "Severity must be 1-10." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Server-side triage — the model/routing can't suppress this.
  const hits = detectEmergency(
    `${symptom} ${(body.duration ?? "").trim()}`
  );
  let helplines: unknown[] = [];
  if (hits.length > 0) {
    const { data } = await supabase.rpc("list_helplines_for", {
      p_country: body.country || "IN",
      p_kinds: emergencyHelplineKindsFor(hits)
    });
    helplines = data ?? [];
  }

  const { data: beaconId, error } = await supabase.rpc(
    "create_doctor_beacon",
    {
      p_symptom_summary: symptom.slice(0, 2000),
      p_severity: severity,
      p_duration_text: (body.duration ?? "").trim().slice(0, 200) || null,
      p_specialty: (body.specialty ?? "").trim().slice(0, 80) || null,
      p_emergency_flagged: hits.length > 0
    }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    beacon_id: beaconId,
    emergency: hits.length > 0 ? hits : null,
    helplines
  });
}
