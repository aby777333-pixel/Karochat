"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * ConferenceTools — sits in the chat header for non-DM rooms.
 *
 *  • Breakout rooms: owner/admin can spawn child rooms; anyone can jump to them.
 *  • Live captions: per-user Web Speech API transcription overlay (no infra).
 *  • Recording consent: every member toggles, owner clicks Start when all green.
 */
export function ConferenceTools({
  roomId,
  isOwner,
  isDm,
  isSaved,
  recordingStartedAt
}: {
  roomId: string;
  isOwner: boolean;
  isDm: boolean;
  isSaved: boolean;
  recordingStartedAt: string | null;
}) {
  if (isDm || isSaved) return null;
  return <Inner roomId={roomId} isOwner={isOwner} recordingStartedAt={recordingStartedAt} />;
}

function Inner({
  roomId,
  isOwner,
  recordingStartedAt
}: {
  roomId: string;
  isOwner: boolean;
  recordingStartedAt: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // ─ Breakouts ───────────────────────────────────────────────────────────
  const [breakouts, setBreakouts] = useState<{ id: string; name: string }[]>([]);
  const [showBreakouts, setShowBreakouts] = useState(false);
  const [newBreakoutName, setNewBreakoutName] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadBreakouts() {
    const { data } = await supabase
      .from("rooms")
      .select("id, name")
      .eq("parent_room_id", roomId)
      .limit(20);
    setBreakouts((data ?? []) as { id: string; name: string }[]);
  }

  useEffect(() => {
    if (showBreakouts) void loadBreakouts();
  }, [showBreakouts]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createBreakout() {
    const name = newBreakoutName.trim();
    if (!name) return;
    setCreating(true);
    const { data, error } = await supabase.rpc("create_breakout", {
      p_parent_room_id: roomId,
      p_name: name
    });
    setCreating(false);
    if (error) return;
    setNewBreakoutName("");
    if (data) router.push(`/rooms/${data}`);
  }

  // ─ Live captions (Web Speech API, local-only) ──────────────────────────
  const [captionsOn, setCaptionsOn] = useState(false);
  const [captionsText, setCaptionsText] = useState("");
  const [captionsErr, setCaptionsErr] = useState<string | null>(null);

  useEffect(() => {
    if (!captionsOn) return;
    const W = window as any;
    const Rec = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Rec) {
      setCaptionsErr("This browser doesn't support Web Speech.");
      setCaptionsOn(false);
      return;
    }
    const rec = new Rec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setCaptionsText((prev) => {
        // Keep last ~200 chars to avoid stretching the overlay forever.
        const next = (prev + " " + final + " " + interim).trim();
        return next.length > 220 ? next.slice(next.length - 220) : next;
      });
    };
    rec.onerror = (e: any) => setCaptionsErr(e?.error ?? "speech error");
    try {
      rec.start();
    } catch {
      // already running — ignore
    }
    return () => {
      try {
        rec.stop();
      } catch {
        // ignore
      }
    };
  }, [captionsOn]);

  // ─ Recording consent ───────────────────────────────────────────────────
  const [showConsent, setShowConsent] = useState(false);
  const [myConsent, setMyConsent] = useState<boolean | null>(null);
  const [consentStats, setConsentStats] = useState<{ yes: number; total: number } | null>(null);
  const [recBusy, setRecBusy] = useState(false);
  const [recErr, setRecErr] = useState<string | null>(null);

  async function loadConsent() {
    const { data: rows } = await supabase
      .from("recording_consents")
      .select("user_id, consented")
      .eq("room_id", roomId);
    const { data: members } = await supabase
      .from("room_members")
      .select("user_id")
      .eq("room_id", roomId);
    const yes = (rows ?? []).filter((r) => r.consented).length;
    setConsentStats({ yes, total: (members ?? []).length });
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const mine = (rows ?? []).find((r) => r.user_id === user.id);
      setMyConsent(mine?.consented ?? null);
    }
  }

  useEffect(() => {
    if (showConsent) void loadConsent();
  }, [showConsent]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setConsent(v: boolean) {
    await supabase.rpc("set_recording_consent", {
      p_room_id: roomId,
      p_consented: v
    });
    setMyConsent(v);
    void loadConsent();
  }

  async function startRecording() {
    setRecBusy(true);
    setRecErr(null);
    const { error } = await supabase.rpc("start_recording", { p_room_id: roomId });
    setRecBusy(false);
    if (error) setRecErr(error.message);
    else router.refresh();
  }

  async function stopRecording() {
    setRecBusy(true);
    setRecErr(null);
    await supabase.rpc("stop_recording", { p_room_id: roomId });
    setRecBusy(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center gap-1.5 border-b border-white/5 bg-black/15 px-3 py-1.5 text-[11px]">
        {/* Breakouts */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowBreakouts((s) => !s)}
            className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-white/70 hover:bg-white/10"
            title="Breakout rooms"
          >
            🪟 Breakouts
          </button>
          {showBreakouts && (
            <div className="surface-glass absolute left-0 top-full z-30 mt-1 w-64 max-w-[calc(100vw-1.5rem)] p-2">
              <div className="flex items-center justify-between px-1 pb-1">
                <p className="text-[9px] uppercase tracking-widest text-white/40">
                  Breakouts
                </p>
                <button
                  type="button"
                  onClick={() => setShowBreakouts(false)}
                  className="rounded-md border border-white/10 bg-white/5 px-1.5 text-[10px] text-white/60 hover:bg-white/10"
                >
                  ✕
                </button>
              </div>
              {breakouts.length === 0 ? (
                <p className="px-1 py-1 text-[11px] text-white/50">
                  No breakouts yet.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {breakouts.map((b) => (
                    <li key={b.id}>
                      <Link
                        href={`/rooms/${b.id}`}
                        className="block rounded-md px-2 py-1 text-xs text-white/85 hover:bg-white/10"
                      >
                        → {b.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {isOwner && (
                <div className="mt-2 border-t border-white/10 pt-2">
                  <input
                    value={newBreakoutName}
                    onChange={(e) => setNewBreakoutName(e.target.value.slice(0, 60))}
                    placeholder="Breakout name…"
                    className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none focus:border-neon-blue/40"
                  />
                  <button
                    type="button"
                    onClick={() => void createBreakout()}
                    disabled={!newBreakoutName.trim() || creating}
                    className="mt-1 w-full rounded-md bg-neon-blue px-2 py-1 text-xs font-medium text-ink-900 hover:bg-neon-blue/90 disabled:opacity-60"
                  >
                    {creating ? "…" : "+ Create breakout"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Captions */}
        <button
          type="button"
          onClick={() => setCaptionsOn((s) => !s)}
          className={clsx(
            "flex items-center gap-1 rounded-md border px-2 py-0.5 transition",
            captionsOn
              ? "border-neon-mint/40 bg-neon-mint/10 text-neon-mint"
              : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          )}
          title="Live captions (local-only, your browser)"
        >
          💬 Captions
        </button>
        {captionsErr && (
          <span className="text-neon-red">{captionsErr}</span>
        )}

        {/* Recording consent */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowConsent((s) => !s)}
            className={clsx(
              "flex items-center gap-1 rounded-md border px-2 py-0.5",
              recordingStartedAt
                ? "border-neon-red/40 bg-neon-red/10 text-neon-red"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            )}
            title="Recording consent"
          >
            ● Recording
          </button>
          {showConsent && (
            <div className="surface-glass fixed inset-x-3 top-28 z-30 mx-auto w-auto max-w-[340px] p-3 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mx-0 sm:mt-1 sm:w-72 sm:max-w-none">
              <div className="flex items-center justify-between pb-1">
                <p className="text-[9px] uppercase tracking-widest text-white/40">
                  Recording-consent
                </p>
                <button
                  type="button"
                  onClick={() => setShowConsent(false)}
                  className="rounded-md border border-white/10 bg-white/5 px-1.5 text-[10px] text-white/60 hover:bg-white/10"
                >
                  ✕
                </button>
              </div>
              <p className="text-[11px] text-white/55">
                Recording can only start once every member opts in.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => void setConsent(true)}
                  className={clsx(
                    "flex-1 rounded-md border px-2 py-1 text-xs",
                    myConsent === true
                      ? "border-neon-mint/60 bg-neon-mint/15 text-neon-mint"
                      : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                  )}
                >
                  ✓ I consent
                </button>
                <button
                  type="button"
                  onClick={() => void setConsent(false)}
                  className={clsx(
                    "flex-1 rounded-md border px-2 py-1 text-xs",
                    myConsent === false
                      ? "border-neon-red/60 bg-neon-red/15 text-neon-red"
                      : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                  )}
                >
                  ✕ I decline
                </button>
              </div>
              {consentStats && (
                <p className="mt-2 text-[11px] text-white/45">
                  {consentStats.yes} of {consentStats.total} have consented.
                </p>
              )}
              {isOwner && (
                <div className="mt-3 border-t border-white/10 pt-2">
                  {recordingStartedAt ? (
                    <button
                      type="button"
                      onClick={() => void stopRecording()}
                      disabled={recBusy}
                      className="w-full rounded-md bg-neon-red px-2 py-1 text-xs font-medium text-white hover:bg-neon-red/90 disabled:opacity-60"
                    >
                      ■ Stop recording
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void startRecording()}
                      disabled={
                        recBusy ||
                        !consentStats ||
                        consentStats.yes < consentStats.total
                      }
                      className="w-full rounded-md bg-neon-red px-2 py-1 text-xs font-medium text-white hover:bg-neon-red/90 disabled:opacity-60"
                      title={
                        consentStats && consentStats.yes < consentStats.total
                          ? "Waiting for every member to consent"
                          : "Start recording"
                      }
                    >
                      ● Start recording
                    </button>
                  )}
                  {recErr && (
                    <p className="mt-1 text-[11px] text-neon-red">{recErr}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Live caption overlay */}
      {captionsOn && captionsText && (
        <div className="pointer-events-none fixed inset-x-4 bottom-24 z-40 mx-auto max-w-2xl rounded-2xl border border-neon-mint/30 bg-ink-900/85 px-4 py-2 text-center text-sm text-white shadow-glow-mint backdrop-blur md:bottom-32">
          {captionsText}
        </div>
      )}
    </>
  );
}
