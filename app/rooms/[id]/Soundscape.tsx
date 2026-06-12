"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

type SoundscapeKind = "off" | "rain" | "drone" | "chime" | "hum";

const STORAGE_KEY_KIND = "karochat:soundscape:kind";
const STORAGE_KEY_VOLUME = "karochat:soundscape:volume";

const OPTIONS: { value: SoundscapeKind; label: string; emoji: string }[] = [
  { value: "off",   label: "off",   emoji: "🔇" },
  { value: "rain",  label: "rain",  emoji: "🌧️" },
  { value: "drone", label: "drone", emoji: "🌌" },
  { value: "chime", label: "chime", emoji: "🎐" },
  { value: "hum",   label: "hum",   emoji: "🎚️" }
];

/**
 * v7 6.12 — per-user ambient soundscape. Pure Web Audio API: no audio files,
 * no external deps. Four procedural ambiences:
 *   • rain  : filtered white noise
 *   • drone : two detuned sine pads slowly LFOed
 *   • chime : drone + occasional bell tones
 *   • hum   : warm low-frequency hum
 * Each user picks their own; selection persists in localStorage.
 */
export function Soundscape() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<SoundscapeKind>("off");
  const [volume, setVolume] = useState(0.18);
  const audioRef = useRef<{
    ctx: AudioContext;
    master: GainNode;
    stop: () => void;
  } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Load persisted choice on mount.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_KIND);
      if (stored && ["off", "rain", "drone", "chime", "hum"].includes(stored)) {
        setKind(stored as SoundscapeKind);
      }
      const v = Number(window.localStorage.getItem(STORAGE_KEY_VOLUME));
      if (Number.isFinite(v) && v > 0 && v <= 1) setVolume(v);
    } catch {
      // ignore
    }
  }, []);

  // Outside-click closes the popover.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // (Re)start the audio graph when kind changes.
  useEffect(() => {
    audioRef.current?.stop();
    audioRef.current = null;
    if (kind === "off") return;
    try {
      const ctx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
      const stop = buildScape(ctx, master, kind);
      audioRef.current = { ctx, master, stop };
    } catch (err) {
      // AudioContext can't be constructed (rare) — soundscape silently disables.
      console.warn("[soundscape] audio init failed", err);
    }
    return () => {
      audioRef.current?.stop();
      audioRef.current = null;
    };
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live volume changes.
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.master.gain.setTargetAtTime(
      volume,
      audioRef.current.ctx.currentTime,
      0.05
    );
  }, [volume]);

  function pick(next: SoundscapeKind) {
    setKind(next);
    try {
      window.localStorage.setItem(STORAGE_KEY_KIND, next);
    } catch {
      // ignore
    }
  }

  function changeVolume(v: number) {
    setVolume(v);
    try {
      window.localStorage.setItem(STORAGE_KEY_VOLUME, String(v));
    } catch {
      // ignore
    }
  }

  const active = OPTIONS.find((o) => o.value === kind) ?? OPTIONS[0]!;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        title="Soundscape — ambient audio for this room"
        aria-label="Soundscape"
        aria-expanded={open}
        className={clsx(
          "flex h-8 items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] transition",
          kind === "off"
            ? "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
            : "border-neon-mint/40 bg-neon-mint/10 text-neon-mint hover:bg-neon-mint/20"
        )}
      >
        <span aria-hidden>{active.emoji}</span>
        <span className="hidden md:inline">{active.label}</span>
      </button>

      {open && (
        <div className="surface-glass fixed inset-x-3 top-28 z-30 mx-auto w-auto max-w-[320px] p-2 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mx-0 sm:mt-2 sm:w-56 sm:max-w-none">
          <div className="flex items-center justify-between px-1.5 pb-1">
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              Soundscape
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              title="Close"
              className="rounded-md border border-white/10 bg-white/5 px-1.5 text-[10px] text-white/60 hover:bg-white/10"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 gap-0.5">
            {OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => pick(opt.value)}
                className={clsx(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/10",
                  kind === opt.value && "bg-neon-mint/10 text-neon-mint"
                )}
              >
                <span aria-hidden>{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
          {kind !== "off" && (
            <div className="mt-2 flex items-center gap-2 px-1.5">
              <span aria-hidden className="text-white/40">🎚️</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={volume}
                onChange={(e) => changeVolume(Number(e.target.value))}
                className="flex-1 accent-neon-mint"
                aria-label="Volume"
              />
            </div>
          )}
          <p className="mt-2 px-1.5 text-[10px] text-white/35">
            Generated locally — no external audio. Saves to your browser.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Procedural soundscapes — all generated on the fly via Web Audio API
// ---------------------------------------------------------------------------
function buildScape(
  ctx: AudioContext,
  master: GainNode,
  kind: Exclude<SoundscapeKind, "off">
): () => void {
  const sources: AudioNode[] = [];
  const intervals: ReturnType<typeof setInterval>[] = [];

  if (kind === "rain" || kind === "chime") {
    // White-noise rain via ScriptProcessor → fed through a low-pass filter.
    const bufferSize = 4096;
    const noise = ctx.createScriptProcessor(bufferSize, 1, 1);
    noise.onaudioprocess = (e) => {
      const out = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) out[i] = Math.random() * 2 - 1;
    };
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1200;
    lp.Q.value = 0.6;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.5;
    noise.connect(lp);
    lp.connect(rainGain);
    rainGain.connect(master);
    sources.push(noise, lp, rainGain);
  }

  if (kind === "drone" || kind === "chime") {
    // Two detuned sine pads.
    for (const freq of [82.4, 110]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.18;
      // LFO for a slow shimmer.
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.1 + Math.random() * 0.1;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.08;
      lfo.connect(lfoG);
      lfoG.connect(g.gain);
      osc.connect(g);
      g.connect(master);
      osc.start();
      lfo.start();
      sources.push(osc, g, lfo, lfoG);
    }
  }

  if (kind === "hum") {
    // Warm low hum — sine + saturated low filter.
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 110;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 220;
    const g = ctx.createGain();
    g.gain.value = 0.35;
    osc.connect(lp);
    lp.connect(g);
    g.connect(master);
    osc.start();
    sources.push(osc, lp, g);
  }

  if (kind === "chime") {
    // Occasional bell pings — tinkling on top of rain.
    const ring = () => {
      const now = ctx.currentTime;
      const freq = 880 + Math.random() * 660;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 2.6);
    };
    const id = setInterval(() => {
      if (Math.random() < 0.5) ring();
    }, 6000);
    intervals.push(id);
    // Kick off with one chime so the user knows it's on.
    setTimeout(ring, 800);
  }

  return () => {
    for (const id of intervals) clearInterval(id);
    for (const node of sources) {
      try {
        if ("stop" in node && typeof (node as OscillatorNode).stop === "function") {
          (node as OscillatorNode).stop();
        }
      } catch {
        // already stopped
      }
      try {
        node.disconnect();
      } catch {
        // already disconnected
      }
    }
    try {
      ctx.close();
    } catch {
      // already closed
    }
  };
}
