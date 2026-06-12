"use client";

// Karochat — doctor queue board (v9 Phase 4).
//
// Polls list_open_doctor_beacons every 7s; accept races through
// accept_doctor_beacon (the RPC locks the row — losers get a friendly
// "someone else took it"). Below the queue: active sessions with a
// wrap-up form (complete_doctor_session).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type OpenBeacon = {
  beacon_id: string;
  created_at: string;
  symptom: string;
  severity: number | null;
  duration_text: string | null;
  specialty: string | null;
  urgency: string;
  emergency: boolean;
  asker_username: string;
  asker_display_name: string;
};

type Session = {
  session_id: string;
  started_at: string;
  ended_at: string | null;
  room_id: string | null;
  symptom_summary: string | null;
  severity_rating: number | null;
  was_emergency_routed: boolean;
  follow_up_required: boolean;
  doctor_recommendation: string | null;
  asker_username: string;
  asker_display_name: string;
};

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
}

function WrapUpForm({
  session,
  onDone
}: {
  session: Session;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rec, setRec] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function complete() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("complete_doctor_session", {
      p_session_id: session.session_id,
      p_recommendation: rec.trim() || null,
      p_follow_up_required: followUp
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onDone();
  }

  return (
    <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
      <textarea
        value={rec}
        onChange={(e) => setRec(e.target.value.slice(0, 1000))}
        rows={2}
        placeholder="One-line recommendation (e.g. 'likely contact dermatitis — see a dermatologist if it spreads or persists past a week')"
        className="w-full resize-y rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[13px] outline-none placeholder:text-white/30 focus:border-neon-mint/40"
      />
      <label className="flex items-center gap-2 text-[12px] text-white/70">
        <input
          type="checkbox"
          checked={followUp}
          onChange={(e) => setFollowUp(e.target.checked)}
          className="accent-neon-mint"
        />
        Needs in-person follow-up
      </label>
      {err && <p className="text-[11px] text-neon-red">{err}</p>}
      <button
        type="button"
        onClick={complete}
        disabled={busy}
        className="rounded-lg bg-neon-mint px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-neon-mint/90 disabled:opacity-60"
      >
        {busy ? "Saving…" : "End consult"}
      </button>
    </div>
  );
}

export function QueueBoard() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [open, setOpen] = useState<OpenBeacon[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [openResp, sessResp] = await Promise.all([
      supabase.rpc("list_open_doctor_beacons"),
      supabase.rpc("my_doctor_sessions")
    ]);
    if (openResp.data) setOpen(openResp.data as OpenBeacon[]);
    if (sessResp.data) setSessions(sessResp.data as Session[]);
  }, [supabase]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 7000);
    return () => clearInterval(t);
  }, [refresh]);

  async function accept(beaconId: string) {
    setAcceptingId(beaconId);
    setErr(null);
    const { data, error } = await supabase.rpc("accept_doctor_beacon", {
      p_beacon_id: beaconId
    });
    setAcceptingId(null);
    if (error) {
      setErr(
        error.message.includes("already took")
          ? "Another doctor just took that one."
          : error.message
      );
      refresh();
      return;
    }
    const roomId = (data as { room_id?: string } | null)?.room_id;
    if (roomId) router.push(`/rooms/${roomId}`);
  }

  const active = sessions.filter((s) => !s.ended_at);
  const recent = sessions.filter((s) => s.ended_at).slice(0, 5);

  return (
    <div className="space-y-6">
      {err && (
        <p className="rounded-lg border border-neon-amber/30 bg-neon-amber/10 px-3 py-2 text-[12px] text-neon-amber">
          {err}
        </p>
      )}

      <section>
        <h2 className="text-sm font-semibold text-white/80">
          Waiting now {open.length > 0 && `(${open.length})`}
        </h2>
        {open.length === 0 ? (
          <p className="surface-glass mt-2 p-4 text-sm text-white/55">
            Nobody waiting right now — this list refreshes itself.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {open.map((b) => (
              <li key={b.beacon_id} className="surface-glass min-w-0 p-3.5">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  {b.emergency && (
                    <span className="rounded-sm border border-neon-red/50 bg-neon-red/15 px-1.5 py-0.5 font-semibold uppercase tracking-widest text-neon-red">
                      🚨 emergency flags
                    </span>
                  )}
                  <span
                    className={
                      "rounded-sm px-1.5 py-0.5 uppercase tracking-widest " +
                      (b.urgency === "live"
                        ? "border border-neon-red/40 bg-neon-red/10 text-neon-red"
                        : b.urgency === "urgent"
                          ? "border border-neon-amber/40 bg-neon-amber/10 text-neon-amber"
                          : "border border-white/15 bg-white/5 text-white/55")
                    }
                  >
                    {b.urgency}
                  </span>
                  {b.severity != null && (
                    <span className="text-white/50">severity {b.severity}/10</span>
                  )}
                  {b.specialty && (
                    <span className="text-white/50">· {b.specialty}</span>
                  )}
                  <span className="ml-auto text-white/40">{ago(b.created_at)}</span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-white/85">
                  {b.symptom}
                </p>
                {b.duration_text && (
                  <p className="mt-0.5 text-[12px] text-white/50">
                    Duration: {b.duration_text}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12px] text-white/55">
                    @{b.asker_username}
                  </span>
                  <button
                    type="button"
                    onClick={() => accept(b.beacon_id)}
                    disabled={acceptingId !== null}
                    className="rounded-xl bg-neon-blue px-3.5 py-1.5 text-sm font-medium text-ink-900 hover:bg-neon-blue/90 disabled:opacity-60"
                  >
                    {acceptingId === b.beacon_id
                      ? "Opening chat…"
                      : "Accept & open chat →"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {active.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white/80">
            Your open consults ({active.length})
          </h2>
          <ul className="mt-2 space-y-2">
            {active.map((s) => (
              <li key={s.session_id} className="surface-glass min-w-0 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm text-white/85">
                    <strong className="text-white">
                      {s.asker_display_name}
                    </strong>{" "}
                    — {s.symptom_summary}
                  </p>
                  {s.room_id && (
                    <button
                      type="button"
                      onClick={() => router.push(`/rooms/${s.room_id}`)}
                      className="shrink-0 rounded-lg border border-neon-blue/40 bg-neon-blue/10 px-3 py-1.5 text-xs text-neon-blue hover:bg-neon-blue/20"
                    >
                      Open chat →
                    </button>
                  )}
                </div>
                <WrapUpForm session={s} onDone={refresh} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white/80">Recently ended</h2>
          <ul className="mt-2 space-y-1.5">
            {recent.map((s) => (
              <li
                key={s.session_id}
                className="surface-glass flex flex-wrap items-center justify-between gap-2 p-2.5 text-[13px]"
              >
                <span className="min-w-0 flex-1 truncate text-white/70">
                  {s.asker_display_name} — {s.symptom_summary}
                </span>
                <span className="shrink-0 text-[11px] text-white/40">
                  {s.ended_at && ago(s.ended_at)}
                  {s.follow_up_required && " · follow-up advised"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
