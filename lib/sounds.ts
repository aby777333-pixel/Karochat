// Karochat — notification sounds, generated with WebAudio (no asset files).
//
// Three voices:
//   playChime() — soft two-note ding for messages / mentions
//   playBuzz()  — short low rasp for nudges
//   playRing()  — gentle two-tone ring for incoming calls
//
// All are no-ops server-side, when the user turned sound off
// (karochat:sound = "off"), or when the browser blocks audio before the
// first user gesture (AudioContext stays suspended — we just stay silent).

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as any).webkitAudioContext;
  if (!AC) return null;
  try {
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

export function soundEnabled(): boolean {
  try {
    return window.localStorage.getItem("karochat:sound") !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    window.localStorage.setItem("karochat:sound", on ? "on" : "off");
  } catch {
    // ignore
  }
}

function tone(
  ac: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
  type: OscillatorType = "sine",
  peak = 0.08
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ac.currentTime + startAt;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export function playChime(): void {
  if (!soundEnabled()) return;
  const ac = getCtx();
  if (!ac || ac.state !== "running") return;
  try {
    tone(ac, 659.25, 0, 0.18); // E5
    tone(ac, 880.0, 0.12, 0.28); // A5
  } catch {
    // ignore
  }
}

export function playBuzz(): void {
  if (!soundEnabled()) return;
  const ac = getCtx();
  if (!ac || ac.state !== "running") return;
  try {
    tone(ac, 160, 0, 0.1, "sawtooth", 0.06);
    tone(ac, 140, 0.12, 0.1, "sawtooth", 0.06);
    tone(ac, 160, 0.24, 0.12, "sawtooth", 0.06);
  } catch {
    // ignore
  }
}

export function playRing(): void {
  if (!soundEnabled()) return;
  const ac = getCtx();
  if (!ac || ac.state !== "running") return;
  try {
    for (let i = 0; i < 2; i++) {
      const base = i * 0.5;
      tone(ac, 740, base, 0.18, "sine", 0.09); // F#5
      tone(ac, 988, base + 0.16, 0.22, "sine", 0.09); // B5
    }
  } catch {
    // ignore
  }
}
