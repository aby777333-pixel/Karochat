"use client";

// Karochat — Ask-a-Doctor composer + routing status (v9 Phase 4).
//
// Live triage: the emergency classifier runs on every keystroke and
// surfaces the EmergencyCard above the form the moment a red flag
// appears (server re-checks on submit — this is just the fast path).
// After submit, polls my_doctor_consults until a doctor accepts, then
// offers the consult room link.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { detectEmergency, type EmergencyHit } from "@/lib/doctor/triage";
import { EmergencyCard } from "../_components/EmergencyCard";

type Helpline = {
  id: string;
  country: string;
  kind: string;
  name: string;
  phone: string | null;
  sms: string | null;
  url: string | null;
  hours: string | null;
  notes: string | null;
};

type Consult = {
  beacon_id: string;
  created_at: string;
  status: string;
  symptom: string;
  severity: number | null;
  doctor_id: string | null;
  doctor_username: string | null;
  doctor_display_name: string | null;
  room_id: string | null;
};

const SPECIALTIES = [
  ["", "Any doctor"],
  ["general", "General physician"],
  ["dermatology", "Skin"],
  ["gynecology", "Gynecology / women's health"],
  ["sexual_health", "Sexual health"],
  ["mental_health", "Mental health"],
  ["pediatrics", "Children"],
  ["orthopedics", "Bones & joints"],
  ["ent", "Ear, nose & throat"],
  ["gastro", "Stomach & digestion"],
  ["cardiology", "Heart"],
  ["other", "Something else"]
] as const;

// Static fallback so emergency numbers render even before the server
// responds (or if the helpline fetch fails).
const FALLBACK_EMERGENCY: Helpline[] = [
  { id: "fallback-in", country: "IN", kind: "medical_emergency", name: "Emergency services", phone: "112", sms: null, url: null, hours: "24/7", notes: null },
  { id: "fallback-in-amb", country: "IN", kind: "medical_emergency", name: "Ambulance", phone: "108", sms: null, url: null, hours: "24/7", notes: null }
];

export function AskDoctorFlow({ isGuest }: { isGuest: boolean }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();

  const [symptom, setSymptom] = useState("");
  const [severity, setSeverity] = useState(4);
  const [duration, setDuration] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [beaconId, setBeaconId] = useState<string | null>(null);
  const [serverHits, setServerHits] = useState<EmergencyHit[] | null>(null);
  const [helplines, setHelplines] = useState<Helpline[]>([]);
  const [consult, setConsult] = useState<Consult | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live (client-side) triage while typing.
  const liveHits = useMemo(
    () => detectEmergency(`${symptom} ${duration}`),
    [symptom, duration]
  );
  const hits = serverHits ?? liveHits;

  // Poll for acceptance once a beacon is in flight.
  useEffect(() => {
    if (!beaconId) return;
    let cancelled = false;
    async function check() {
      const { data } = await supabase.rpc("my_doctor_consults");
      if (cancelled) return;
      const mine = (data as Consult[] | null)?.find(
        (c) => c.beacon_id === beaconId
      );
      if (mine) setConsult(mine);
    }
    check();
    pollRef.current = setInterval(check, 5000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [beaconId, supabase]);

  useEffect(() => {
    if (consult?.status === "answered" && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [consult?.status]);

  async function submit() {
    if (symptom.trim().length < 10) {
      setErr("Describe what's going on — at least a sentence.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/doctor/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptom: symptom.trim(),
          severity,
          duration: duration.trim() || null,
          specialty: specialty || null,
          country: "IN"
        })
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j?.error ?? "Couldn't send that — try again.");
        return;
      }
      setBeaconId(j.beacon_id);
      setServerHits(j.emergency ?? null);
      if (Array.isArray(j.helplines) && j.helplines.length > 0) {
        setHelplines(j.helplines as Helpline[]);
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!beaconId) return;
    await supabase.rpc("cancel_doctor_beacon", { p_beacon_id: beaconId });
    setBeaconId(null);
    setConsult(null);
    setServerHits(null);
  }

  if (isGuest) {
    return (
      <section className="surface-glass p-5 text-sm text-white/75">
        👋 Guests can&apos;t ask a doctor — it needs a real account so the
        doctor can follow up with you.{" "}
        <a href="/" className="text-neon-blue hover:underline">
          Sign in free
        </a>{" "}
        (takes ~10 seconds).
      </section>
    );
  }

  // ---- Routing / accepted states ----
  if (beaconId) {
    const answered = consult?.status === "answered";
    const cancelledOrExpired =
      consult?.status === "cancelled" || consult?.status === "expired";
    return (
      <div className="space-y-4">
        {hits.length > 0 && (
          <EmergencyCard
            hits={hits}
            helplines={helplines.length > 0 ? helplines : FALLBACK_EMERGENCY}
          />
        )}
        <section className="surface-glass p-5">
          {answered ? (
            <>
              <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
                ✅ A doctor took your request
              </p>
              <p className="mt-2 text-sm text-white/80">
                <strong className="text-white">
                  Dr. {consult?.doctor_display_name ?? consult?.doctor_username}
                </strong>{" "}
                opened a private consult chat with you.
              </p>
              <button
                type="button"
                onClick={() =>
                  consult?.room_id && router.push(`/rooms/${consult.room_id}`)
                }
                className="mt-4 rounded-xl bg-neon-mint px-4 py-2 text-sm font-medium text-ink-900 hover:bg-neon-mint/90"
              >
                Open consult chat →
              </button>
            </>
          ) : cancelledOrExpired ? (
            <>
              <p className="text-[10px] uppercase tracking-widest text-white/45">
                Request {consult?.status}
              </p>
              <button
                type="button"
                onClick={() => {
                  setBeaconId(null);
                  setConsult(null);
                  setServerHits(null);
                }}
                className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75 hover:bg-white/10"
              >
                Ask again
              </button>
            </>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-widest text-neon-blue/80">
                📡 Finding you a doctor…
              </p>
              <p className="mt-2 text-sm text-white/70">
                Verified doctors who are online can see your request now.
                You can leave this page — the consult chat will appear in
                your{" "}
                <a href="/rooms" className="text-neon-blue hover:underline">
                  Direct messages
                </a>{" "}
                when someone accepts.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-neon-blue" />
                <span className="text-[12px] text-white/50">
                  Checking every few seconds…
                </span>
              </div>
              <button
                type="button"
                onClick={cancel}
                className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75 hover:bg-white/10"
              >
                Cancel request
              </button>
            </>
          )}
        </section>
      </div>
    );
  }

  // ---- Composer ----
  return (
    <div className="space-y-4">
      {hits.length > 0 && (
        <EmergencyCard hits={hits} helplines={FALLBACK_EMERGENCY} />
      )}

      <section className="surface-glass min-w-0 p-5">
        <p className="text-[10px] uppercase tracking-widest text-white/45">
          Describe it like you&apos;d tell a friend
        </p>
        <textarea
          value={symptom}
          onChange={(e) => setSymptom(e.target.value.slice(0, 2000))}
          rows={5}
          disabled={busy}
          placeholder="e.g. itchy rash on both forearms for 3 days, slightly raised, no fever…"
          className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/40 disabled:opacity-60"
        />
        <div className="mt-1 text-right text-[11px] text-white/40">
          {symptom.length} / 2000
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="block text-[10px] uppercase tracking-widest text-white/45">
              How long has this been going on?
            </label>
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value.slice(0, 200))}
              disabled={busy}
              placeholder="e.g. 3 days / since last night"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/40 disabled:opacity-60"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-[10px] uppercase tracking-widest text-white/45">
              Kind of doctor (optional)
            </label>
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              disabled={busy}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-blue/40 disabled:opacity-60"
            >
              {SPECIALTIES.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-[10px] uppercase tracking-widest text-white/45">
            How bad does it feel right now? —{" "}
            <span className="text-white/70">{severity}/10</span>
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            disabled={busy}
            className="mt-2 w-full accent-neon-blue"
          />
          <div className="flex justify-between text-[10px] text-white/40">
            <span>annoying</span>
            <span>worrying</span>
            <span>severe</span>
          </div>
        </div>

        {err && (
          <p className="mt-3 rounded-lg border border-neon-red/30 bg-neon-red/10 px-3 py-2 text-[12px] text-neon-red">
            {err}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={busy || symptom.trim().length < 10}
          className="mt-4 rounded-xl bg-neon-blue px-4 py-2 text-sm font-medium text-ink-900 hover:bg-neon-blue/90 disabled:opacity-60"
        >
          {busy ? "Sending…" : "Find me a doctor →"}
        </button>
      </section>
    </div>
  );
}
