"use client";

// Karochat — guided breathing. A calm, animated breathing coach: pick a pattern,
// follow the growing/shrinking circle, breathe. Pure client, no backend.

import { useEffect, useRef, useState } from "react";

type Phase = { label: string; secs: number; scale: number };
type Pattern = { key: string; name: string; note: string; phases: Phase[] };

const PATTERNS: Pattern[] = [
  {
    key: "478",
    name: "4-7-8 · Calm & sleep",
    note: "Breathe in 4, hold 7, out 8. Great for winding down.",
    phases: [
      { label: "Breathe in", secs: 4, scale: 1.7 },
      { label: "Hold", secs: 7, scale: 1.7 },
      { label: "Breathe out", secs: 8, scale: 1 }
    ]
  },
  {
    key: "box",
    name: "Box · Focus",
    note: "In 4, hold 4, out 4, hold 4. Steadies the mind.",
    phases: [
      { label: "Breathe in", secs: 4, scale: 1.7 },
      { label: "Hold", secs: 4, scale: 1.7 },
      { label: "Breathe out", secs: 4, scale: 1 },
      { label: "Hold", secs: 4, scale: 1 }
    ]
  },
  {
    key: "relax",
    name: "4-6 · Relax",
    note: "In 4, out 6. Longer exhale calms the nervous system.",
    phases: [
      { label: "Breathe in", secs: 4, scale: 1.7 },
      { label: "Breathe out", secs: 6, scale: 1 }
    ]
  },
  {
    key: "coherent",
    name: "5-5 · Coherent",
    note: "In 5, out 5. Balanced, heart-friendly breathing.",
    phases: [
      { label: "Breathe in", secs: 5, scale: 1.7 },
      { label: "Breathe out", secs: 5, scale: 1 }
    ]
  }
];

export function BreatheClient() {
  const [patternKey, setPatternKey] = useState("478");
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [count, setCount] = useState(0);
  const [cycles, setCycles] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pattern = PATTERNS.find((p) => p.key === patternKey) ?? PATTERNS[0]!;
  const phase = pattern.phases[phaseIdx] ?? pattern.phases[0]!;

  function clearTimers() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    timerRef.current = null;
    tickRef.current = null;
  }

  useEffect(() => clearTimers, []);

  // Drive the phase machine while running.
  useEffect(() => {
    if (!running) {
      clearTimers();
      return;
    }
    const ph = pattern.phases[phaseIdx] ?? pattern.phases[0]!;
    setCount(ph.secs);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => setCount((c) => (c > 1 ? c - 1 : c)), 1000);
    timerRef.current = setTimeout(() => {
      const nextIdx = phaseIdx + 1;
      if (nextIdx >= pattern.phases.length) {
        setCycles((n) => n + 1);
        setPhaseIdx(0);
      } else {
        setPhaseIdx(nextIdx);
      }
    }, ph.secs * 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phaseIdx, patternKey]);

  function start() {
    setPhaseIdx(0);
    setCycles(0);
    setRunning(true);
  }
  function stop() {
    setRunning(false);
    clearTimers();
  }

  return (
    <div className="space-y-5">
      <section className="surface-glass tint-purple p-5">
        <h1 className="font-display text-xl font-semibold">🌬️ Breathe</h1>
        <p className="mt-1 text-sm text-white/60">
          A moment of calm. Pick a pattern, follow the circle and breathe. Helps with
          stress, focus and sleep — anytime, anywhere.
        </p>
      </section>

      <section className="surface-glass flex flex-col items-center p-6">
        {/* Animated circle */}
        <div className="relative grid h-64 w-64 place-items-center">
          <div
            className="absolute h-40 w-40 rounded-full"
            style={{
              transform: `scale(${running ? phase.scale : 1})`,
              transition: `transform ${running ? phase.secs : 0.4}s ease-in-out`,
              background:
                "radial-gradient(circle at 50% 40%, rgba(167,139,250,0.55), rgba(34,211,238,0.25) 60%, transparent 75%)",
              boxShadow: "0 0 60px rgba(167,139,250,0.35)"
            }}
          />
          <div className="relative z-10 text-center">
            <p className="font-display text-2xl font-semibold text-white">
              {running ? phase.label : "Ready?"}
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-white/90">
              {running ? count : ""}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <select
            value={patternKey}
            onChange={(e) => {
              stop();
              setPatternKey(e.target.value);
            }}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 outline-none focus:border-neon-purple/60"
          >
            {PATTERNS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </select>
          {!running ? (
            <button
              type="button"
              onClick={start}
              className="rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-5 py-2 text-sm font-medium text-white hover:bg-neon-purple/30"
            >
              ▶ Start
            </button>
          ) : (
            <button
              type="button"
              onClick={stop}
              className="rounded-xl border border-neon-red/40 bg-neon-red/15 px-5 py-2 text-sm font-medium text-neon-red hover:bg-neon-red/25"
            >
              ■ Stop
            </button>
          )}
        </div>
        <p className="mt-3 text-center text-[12px] text-white/50">{pattern.note}</p>
        {cycles > 0 && (
          <p className="mt-1 text-center text-[11px] text-neon-mint">{cycles} cycles complete 🌿</p>
        )}
      </section>

      <p className="px-1 text-[10px] leading-relaxed text-white/35">
        A relaxation aid, not medical treatment. If you feel dizzy, stop and breathe
        normally. Don’t practise breath-holding in water or while driving.
      </p>
    </div>
  );
}
