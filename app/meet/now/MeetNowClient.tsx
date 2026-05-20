"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Meet-now matchmaking — calls enter_meet_queue every 3s while waiting.
 * Server side pairs two waiting users, creates a self-destructing 5-min
 * DM, and returns the room id on the next poll. We redirect on match.
 */
export function MeetNowClient() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [state, setState] = useState<"idle" | "queued" | "matched" | "error">(
    "idle"
  );
  const [err, setErr] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function callQueue() {
    const { data, error } = await supabase.rpc("enter_meet_queue");
    if (error) {
      setErr(error.message);
      setState("error");
      return null;
    }
    if (data) {
      setState("matched");
      router.push(`/rooms/${data}`);
      return data;
    }
    return null;
  }

  async function joinQueue() {
    setErr(null);
    setSeconds(0);
    setState("queued");
    await callQueue();
    pollRef.current = setInterval(() => {
      void callQueue();
    }, 3000);
    tickRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
  }

  async function leaveQueue() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    pollRef.current = null;
    tickRef.current = null;
    await supabase.rpc("leave_meet_queue");
    setState("idle");
  }

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      // best-effort leave so we don't pollute the queue
      void (async () => {
        try {
          await supabase.rpc("leave_meet_queue");
        } catch {
          // ignore
        }
      })();
    };
  }, [supabase]);

  return (
    <section className="surface-glass tint-blue mt-5 p-7 sm:p-9 text-center">
      {state === "idle" && (
        <button
          type="button"
          onClick={() => void joinQueue()}
          className="rounded-2xl bg-neon-blue px-6 py-3 text-base font-semibold text-ink-900 shadow-glow-blue hover:bg-neon-blue/90"
        >
          ⚡ Find someone now
        </button>
      )}

      {state === "queued" && (
        <>
          <p className="font-mono text-3xl font-bold text-white">
            {String(Math.floor(seconds / 60)).padStart(2, "0")}:
            {String(seconds % 60).padStart(2, "0")}
          </p>
          <p className="mt-1 text-sm text-white/55">
            <span className="mr-2 inline-block animate-pulseDot">●</span>
            Waiting for a match…
          </p>
          <button
            type="button"
            onClick={() => void leaveQueue()}
            className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
          >
            Cancel
          </button>
          <p className="mt-3 text-[11px] text-white/40">
            Open this page on another device to test — both halves match within
            a few seconds.
          </p>
        </>
      )}

      {state === "matched" && (
        <p className="text-sm text-neon-mint">🎉 Matched — taking you there…</p>
      )}

      {state === "error" && (
        <>
          <p className="text-sm text-neon-red">{err ?? "Something broke."}</p>
          <button
            type="button"
            onClick={() => void joinQueue()}
            className="mt-3 rounded-lg bg-neon-blue px-3 py-1.5 text-xs text-ink-900 hover:bg-neon-blue/90"
          >
            Retry
          </button>
        </>
      )}
    </section>
  );
}
