"use client";

// Karochat — Karaoke / Singing Studio.
//
// A self-contained, mobile-first modal singers can open in ANY room (karaoke,
// sing-along, or anywhere). Pure client-side, no backend, no external data —
// so it can't break anything:
//   • Lyrics teleprompter — paste lyrics, auto-scroll with speed + font control
//   • Vocal tuner — live mic pitch detection (note + in-tune meter)
//   • Metronome — adjustable BPM click
//   • Backing tracks — quick search for karaoke instrumentals
//
// Renders full-screen on phones and a centred card on desktop; the body
// scrolls so every control stays within the screen and never overlaps the room.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

type Tab = "lyrics" | "tuner" | "metronome" | "tracks";

export function KaraokeStudio({
  open,
  onClose,
  roomName
}: {
  open: boolean;
  onClose: () => void;
  roomName: string;
}) {
  const [tab, setTab] = useState<Tab>("lyrics");

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-stretch justify-center bg-black/85 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Karaoke studio"
        className="flex h-full w-full flex-col overflow-hidden bg-ink-900/95 sm:h-auto sm:max-h-[88vh] sm:max-w-lg sm:rounded-2xl sm:border sm:border-white/10"
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-white">
              🎤 Karaoke studio
            </p>
            <p className="truncate text-[11px] text-white/45">{roomName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
          >
            ✕
          </button>
        </header>

        {/* Tabs */}
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-2 py-2">
          {([
            ["lyrics", "📜 Lyrics"],
            ["tuner", "🎯 Tuner"],
            ["metronome", "🥁 Metronome"],
            ["tracks", "🎶 Tracks"]
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition " +
                (tab === key
                  ? "bg-neon-purple/25 text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white")
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "lyrics" && <LyricsTeleprompter />}
          {tab === "tuner" && <VocalTuner active={tab === "tuner"} />}
          {tab === "metronome" && <Metronome />}
          {tab === "tracks" && <BackingTracks />}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Lyrics teleprompter ─────────────────────────────────────────────────────
function LyricsTeleprompter() {
  const [text, setText] = useState("");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(40); // px / second
  const [font, setFont] = useState(22);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    setPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastRef.current = null;
  }, []);

  useEffect(() => {
    if (!playing) return;
    const step = (ts: number) => {
      const el = scrollRef.current;
      if (!el) return;
      if (lastRef.current == null) lastRef.current = ts;
      const dt = (ts - lastRef.current) / 1000;
      lastRef.current = ts;
      el.scrollTop += speed * dt;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        stop();
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
    };
  }, [playing, speed, stop]);

  return (
    <div className="space-y-3">
      {!playing ? (
        <>
          <p className="text-xs text-white/60">
            Paste the lyrics, then play the teleprompter and sing along.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={"Paste lyrics here…\nLine by line."}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
          />
        </>
      ) : (
        <div
          ref={scrollRef}
          className="h-[44vh] overflow-hidden rounded-xl border border-white/10 bg-black/40 px-4 py-6 text-center leading-relaxed text-white"
          style={{ fontSize: font }}
        >
          <div className="whitespace-pre-wrap pb-[40vh] pt-[8vh]">
            {text || "Add lyrics first."}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (playing) stop();
            else {
              if (scrollRef.current) scrollRef.current.scrollTop = 0;
              setPlaying(true);
            }
          }}
          disabled={!text.trim()}
          className="rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-neon-purple/30 disabled:opacity-50"
        >
          {playing ? "⏸ Stop" : "▶ Play"}
        </button>
        <label className="flex items-center gap-1.5 text-[11px] text-white/55">
          Speed
          <input
            type="range"
            min={10}
            max={120}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="accent-neon-purple"
          />
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-white/55">
          Size
          <input
            type="range"
            min={16}
            max={40}
            value={font}
            onChange={(e) => setFont(Number(e.target.value))}
            className="accent-neon-purple"
          />
        </label>
      </div>
    </div>
  );
}

// ── Vocal tuner (live pitch detection) ──────────────────────────────────────
function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    const v = buf[i] ?? 0;
    rms += v * v;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1; // too quiet
  let r1 = 0;
  let r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++)
    if (Math.abs(buf[i] ?? 0) < thres) {
      r1 = i;
      break;
    }
  for (let i = 1; i < SIZE / 2; i++)
    if (Math.abs(buf[SIZE - i] ?? 0) < thres) {
      r2 = SIZE - i;
      break;
    }
  const b = buf.slice(r1, r2);
  const n = b.length;
  const c = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n - i; j++)
      c[i] = (c[i] ?? 0) + (b[j] ?? 0) * (b[j + i] ?? 0);
  let d = 0;
  while (d < n - 1 && (c[d] ?? 0) > (c[d + 1] ?? 0)) d++;
  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < n; i++) {
    const ci = c[i] ?? 0;
    if (ci > maxval) {
      maxval = ci;
      maxpos = i;
    }
  }
  let T0 = maxpos;
  if (T0 <= 0) return -1;
  const x1 = c[T0 - 1] ?? 0;
  const x2 = c[T0] ?? 0;
  const x3 = c[T0 + 1] ?? 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const bb = (x3 - x1) / 2;
  if (a) T0 = T0 - bb / (2 * a);
  return sampleRate / T0;
}

function VocalTuner({ active }: { active: boolean }) {
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState<string>("—");
  const [cents, setCents] = useState<number>(0);
  const [freq, setFreq] = useState<number>(0);
  const [err, setErr] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    setListening(false);
    if (ivRef.current) clearInterval(ivRef.current);
    ivRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (ctxRef.current) {
      void ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    setNote("—");
    setCents(0);
    setFreq(0);
  }, []);

  // Stop the mic whenever the tab is left or the modal unmounts.
  useEffect(() => {
    if (!active) stop();
    return () => stop();
  }, [active, stop]);

  async function start() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AC: typeof AudioContext =
        window.AudioContext ?? (window as any).webkitAudioContext;
      const ctx = new AC();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      setListening(true);
      ivRef.current = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        const f = autoCorrelate(buf, ctx.sampleRate);
        if (f < 0 || f < 50 || f > 2000) {
          setNote("—");
          setFreq(0);
          setCents(0);
          return;
        }
        const midi = Math.round(12 * (Math.log(f / 440) / Math.log(2))) + 69;
        const ref = 440 * Math.pow(2, (midi - 69) / 12);
        const c = Math.floor((1200 * Math.log(f / ref)) / Math.log(2));
        setNote(
          (NOTE_NAMES[((midi % 12) + 12) % 12] ?? "") +
            (Math.floor(midi / 12) - 1)
        );
        setCents(c);
        setFreq(Math.round(f));
      }, 90);
    } catch (e: any) {
      setErr(
        e?.name === "NotAllowedError"
          ? "Mic permission denied. Allow microphone access to use the tuner."
          : "Couldn't start the microphone."
      );
    }
  }

  const inTune = Math.abs(cents) <= 5 && note !== "—";

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/60">
        Sing a note — the tuner shows the pitch and whether you&apos;re sharp or
        flat. Nothing is recorded or sent.
      </p>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center">
        <div
          className={
            "font-display text-5xl font-bold " +
            (inTune ? "text-neon-mint" : note === "—" ? "text-white/40" : "text-white")
          }
        >
          {note}
        </div>
        <div className="mt-1 text-xs text-white/45">{freq ? `${freq} Hz` : "listening…"}</div>

        {/* Cents meter */}
        <div className="relative mx-auto mt-4 h-2 w-full max-w-xs rounded-full bg-white/10">
          <div className="absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-white/40" />
          <div
            className={
              "absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition-all " +
              (inTune ? "bg-neon-mint" : "bg-neon-amber")
            }
            style={{
              left: `calc(50% + ${Math.max(-50, Math.min(50, cents)) * 0.9}% )`,
              transform: "translate(-50%, -50%)"
            }}
          />
        </div>
        <div className="mt-1 text-[11px] text-white/40">
          {note === "—" ? "" : inTune ? "in tune ✓" : `${cents > 0 ? "+" : ""}${cents} cents`}
        </div>
      </div>

      {err && (
        <p className="rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{err}</p>
      )}

      <button
        type="button"
        onClick={() => (listening ? stop() : void start())}
        className={
          "w-full rounded-xl px-4 py-2.5 text-sm font-medium transition " +
          (listening
            ? "border border-neon-red/40 bg-neon-red/15 text-neon-red hover:bg-neon-red/25"
            : "border border-neon-mint/40 bg-neon-mint/15 text-neon-mint hover:bg-neon-mint/25")
        }
      >
        {listening ? "■ Stop tuner" : "🎤 Start tuner"}
      </button>
    </div>
  );
}

// ── Metronome ───────────────────────────────────────────────────────────────
function Metronome() {
  const [bpm, setBpm] = useState(100);
  const [running, setRunning] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beatRef = useRef(0);

  const stop = useCallback(() => {
    setRunning(false);
    if (ivRef.current) clearInterval(ivRef.current);
    ivRef.current = null;
    if (ctxRef.current) {
      void ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    beatRef.current = 0;
  }, []);

  useEffect(() => () => stop(), [stop]);

  function click(ctx: AudioContext, accent: boolean) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1500 : 1000;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }

  function toggle() {
    if (running) {
      stop();
      return;
    }
    const AC: typeof AudioContext =
      window.AudioContext ?? (window as any).webkitAudioContext;
    const ctx = new AC();
    ctxRef.current = ctx;
    setRunning(true);
    beatRef.current = 0;
    click(ctx, true);
    ivRef.current = setInterval(() => {
      beatRef.current = (beatRef.current + 1) % 4;
      click(ctx, beatRef.current === 0);
    }, (60 / bpm) * 1000);
  }

  // Re-time on BPM change while running.
  useEffect(() => {
    if (!running || !ctxRef.current) return;
    if (ivRef.current) clearInterval(ivRef.current);
    const ctx = ctxRef.current;
    ivRef.current = setInterval(() => {
      beatRef.current = (beatRef.current + 1) % 4;
      click(ctx, beatRef.current === 0);
    }, (60 / bpm) * 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, running]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/60">Keep time while you sing or practise.</p>
      <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center">
        <div className="font-display text-5xl font-bold text-white">{bpm}</div>
        <div className="text-xs text-white/45">BPM</div>
        <input
          type="range"
          min={40}
          max={220}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          className="mt-4 w-full accent-neon-amber"
        />
      </div>
      <button
        type="button"
        onClick={toggle}
        className={
          "w-full rounded-xl px-4 py-2.5 text-sm font-medium transition " +
          (running
            ? "border border-neon-red/40 bg-neon-red/15 text-neon-red hover:bg-neon-red/25"
            : "border border-neon-amber/40 bg-neon-amber/15 text-neon-amber hover:bg-neon-amber/25")
        }
      >
        {running ? "■ Stop" : "▶ Start metronome"}
      </button>
    </div>
  );
}

// ── Backing tracks ──────────────────────────────────────────────────────────
function BackingTracks() {
  const [q, setQ] = useState("");
  const term = encodeURIComponent((q.trim() || "karaoke instrumental") + " karaoke");
  return (
    <div className="space-y-3">
      <p className="text-xs text-white/60">
        Find a backing/instrumental track, then sing over it in the room&apos;s
        voice call. Opens in a new tab.
      </p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Song or artist…"
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <a
          href={`https://www.youtube.com/results?search_query=${term}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white/85 transition hover:border-white/25 hover:bg-white/5"
        >
          ▶ YouTube karaoke ↗
        </a>
        <a
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent((q.trim() || "song") + " instrumental")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white/85 transition hover:border-white/25 hover:bg-white/5"
        >
          🎼 Instrumental ↗
        </a>
      </div>
      <p className="text-[11px] text-white/40">
        Tip: open the room&apos;s voice/video call (📞) so everyone hears you
        sing together.
      </p>
    </div>
  );
}
