"use client";

// Karochat — Sleep & Relaxation studio.
//
// A self-contained, mobile-first soundscape + frequency engine for winding down
// and sleeping. EVERYTHING is synthesised live with the Web Audio API — there
// are no hosted audio files, no network calls, no third-party streams. That
// means it loops seamlessly forever, works fully offline, and can never break
// from a dead link or CORS error.
//
//   • Soundscapes — rain, thunderstorm, ocean, stream, wind, night crickets,
//     campfire, wind chimes, fan, white/pink/brown noise, singing bowl, slow
//     heartbeat. Layer as many as you like, each with its own volume.
//   • Healing frequencies — the nine Solfeggio tones + 432 Hz, as pure sine
//     tones (traditional associations, for relaxation — not medical advice).
//   • Binaural beats — Delta (deep sleep), Theta (meditation), Alpha (calm),
//     and the 7.83 Hz Schumann resonance. Use headphones.
//   • Sleep timer — fades everything out and stops after 15–90 minutes.
//   • Bring your own — loop any audio link or file, plus curated free sources.
//
// Nothing here touches existing app state; it's a leaf component reachable only
// from /sleep.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ── Web-Audio sound generators ───────────────────────────────────────────────
// Every generator takes the AudioContext + the node it should feed (a per-layer
// gain) and returns a stop() that tears its nodes/timers down cleanly.
type Maker = (ctx: AudioContext, out: AudioNode) => () => void;

function noiseSource(ctx: AudioContext, type: "white" | "pink" | "brown"): AudioBufferSourceNode {
  const seconds = 4;
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  if (type === "white") {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } else if (type === "pink") {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.start();
  return src;
}

const stopNodes = (...nodes: Array<{ stop?: () => void } | null>) =>
  nodes.forEach((n) => {
    try {
      n?.stop?.();
    } catch {
      // already stopped
    }
  });

const makeRain: Maker = (ctx, out) => {
  const src = noiseSource(ctx, "pink");
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 500;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 6500;
  const g = ctx.createGain();
  g.gain.value = 0.6;
  src.connect(hp);
  hp.connect(lp);
  lp.connect(g);
  g.connect(out);
  return () => stopNodes(src);
};

const makeThunder: Maker = (ctx, out) => {
  const stopRain = makeRain(ctx, out);
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const rumble = () => {
    if (stopped) return;
    const src = noiseSource(ctx, "brown");
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 180;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.5 + Math.random() * 0.5, now + 0.4 + Math.random() * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.6 + Math.random() * 2);
    src.connect(lp);
    lp.connect(g);
    g.connect(out);
    setTimeout(() => stopNodes(src), 5200);
    timer = setTimeout(rumble, 9000 + Math.random() * 17000);
  };
  timer = setTimeout(rumble, 4000 + Math.random() * 6000);
  return () => {
    stopped = true;
    clearTimeout(timer);
    stopRain();
  };
};

const makeOcean: Maker = (ctx, out) => {
  const src = noiseSource(ctx, "brown");
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 550;
  const g = ctx.createGain();
  g.gain.value = 0.18;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.09;
  const lg = ctx.createGain();
  lg.gain.value = 0.5;
  lfo.connect(lg);
  lg.connect(g.gain);
  lfo.start();
  src.connect(lp);
  lp.connect(g);
  g.connect(out);
  return () => stopNodes(src, lfo);
};

const makeStream: Maker = (ctx, out) => {
  const src = noiseSource(ctx, "white");
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2200;
  bp.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.value = 0.18;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 6;
  const lg = ctx.createGain();
  lg.gain.value = 0.05;
  lfo.connect(lg);
  lg.connect(g.gain);
  lfo.start();
  src.connect(bp);
  bp.connect(g);
  g.connect(out);
  return () => stopNodes(src, lfo);
};

const makeWind: Maker = (ctx, out) => {
  const src = noiseSource(ctx, "pink");
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 500;
  lp.Q.value = 4;
  const g = ctx.createGain();
  g.gain.value = 0.45;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.12;
  const lg = ctx.createGain();
  lg.gain.value = 320;
  lfo.connect(lg);
  lg.connect(lp.frequency);
  lfo.start();
  src.connect(lp);
  lp.connect(g);
  g.connect(out);
  return () => stopNodes(src, lfo);
};

const makeCrickets: Maker = (ctx, out) => {
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = 4500;
  const osc2 = ctx.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.value = 4530;
  const g = ctx.createGain();
  g.gain.value = 0;
  const lfo = ctx.createOscillator();
  lfo.type = "square";
  lfo.frequency.value = 13;
  const lg = ctx.createGain();
  lg.gain.value = 0.06;
  lfo.connect(lg);
  lg.connect(g.gain);
  osc.connect(g);
  osc2.connect(g);
  g.connect(out);
  osc.start();
  osc2.start();
  lfo.start();
  return () => stopNodes(osc, osc2, lfo);
};

const makeFire: Maker = (ctx, out) => {
  const src = noiseSource(ctx, "brown");
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.value = 0.5;
  src.connect(lp);
  lp.connect(g);
  g.connect(out);
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const pop = () => {
    if (stopped) return;
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = 600 + Math.random() * 1400;
    const pg = ctx.createGain();
    const now = ctx.currentTime;
    pg.gain.setValueAtTime(0.0001, now);
    pg.gain.exponentialRampToValueAtTime(0.05 + Math.random() * 0.08, now + 0.005);
    pg.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    o.connect(pg);
    pg.connect(out);
    o.start(now);
    o.stop(now + 0.06);
    timer = setTimeout(pop, 50 + Math.random() * 420);
  };
  timer = setTimeout(pop, 200);
  return () => {
    stopped = true;
    clearTimeout(timer);
    stopNodes(src);
  };
};

const CHIME_SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
const makeChimes: Maker = (ctx, out) => {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const ring = () => {
    if (stopped) return;
    const f = CHIME_SCALE[Math.floor(Math.random() * CHIME_SCALE.length)] ?? 660;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = f * 2.01;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.25, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 3.4);
    const o2g = ctx.createGain();
    o2g.gain.value = 0.3;
    o2.connect(o2g);
    o2g.connect(g);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    o2.start(now);
    osc.stop(now + 3.5);
    o2.stop(now + 3.5);
    timer = setTimeout(ring, 700 + Math.random() * 2800);
  };
  timer = setTimeout(ring, 300);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
};

const makeFan: Maker = (ctx, out) => {
  const src = noiseSource(ctx, "white");
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 800;
  const g = ctx.createGain();
  g.gain.value = 0.4;
  const hum = ctx.createOscillator();
  hum.type = "sawtooth";
  hum.frequency.value = 60;
  const hg = ctx.createGain();
  hg.gain.value = 0.02;
  hum.connect(hg);
  hg.connect(out);
  hum.start();
  src.connect(lp);
  lp.connect(g);
  g.connect(out);
  return () => stopNodes(src, hum);
};

const colorNoise =
  (type: "white" | "pink" | "brown"): Maker =>
  (ctx, out) => {
    const src = noiseSource(ctx, type);
    const g = ctx.createGain();
    g.gain.value = type === "white" ? 0.22 : 0.4;
    src.connect(g);
    g.connect(out);
    return () => stopNodes(src);
  };

const BOWL_PARTIALS = [1, 2.0, 2.7, 3.7, 5.4];
const makeBowl: Maker = (ctx, out) => {
  const base = 136.1; // "Om" / earth-year tone
  const oscs = BOWL_PARTIALS.map((p, i) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = base * p;
    const g = ctx.createGain();
    g.gain.value = 0.12 / (i + 1);
    o.connect(g);
    g.connect(out);
    o.start();
    return o;
  });
  return () => stopNodes(...oscs);
};

const makeHeartbeat: Maker = (ctx, out) => {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const bpm = 50;
  const beat = () => {
    if (stopped) return;
    const now = ctx.currentTime;
    const thump = (t: number, amp: number) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(80, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + 0.22);
    };
    thump(now, 0.6);
    thump(now + 0.28, 0.4);
    timer = setTimeout(beat, 60000 / bpm);
  };
  timer = setTimeout(beat, 200);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
};

// Bright choral "aah" pad — a soft major chord with gentle vibrato.
const makeAngelicPad: Maker = (ctx, out) => {
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1700;
  lp.connect(out);
  const vib = ctx.createOscillator();
  vib.frequency.value = 5;
  const vibG = ctx.createGain();
  vibG.gain.value = 6;
  vib.connect(vibG);
  vib.start();
  const freqs = [261.63, 329.63, 392.0, 523.25];
  const oscs = freqs.map((f) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 0.09;
    vibG.connect(o.detune);
    o.connect(g);
    g.connect(lp);
    o.start();
    return o;
  });
  return () => stopNodes(...oscs, vib);
};

// Dark "mmm" humming choir with a slow breathing swell.
const makeHummingChoir: Maker = (ctx, out) => {
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 700;
  const amp = ctx.createGain();
  amp.gain.value = 0.5;
  lp.connect(amp);
  amp.connect(out);
  const breath = ctx.createOscillator();
  breath.frequency.value = 0.18;
  const breathG = ctx.createGain();
  breathG.gain.value = 0.25;
  breath.connect(breathG);
  breathG.connect(amp.gain);
  breath.start();
  const vib = ctx.createOscillator();
  vib.frequency.value = 4.5;
  const vibG = ctx.createGain();
  vibG.gain.value = 5;
  vib.connect(vibG);
  vib.start();
  const freqs = [146.83, 220.0, 293.66];
  const oscs = freqs.map((f) => {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 0.12;
    vibG.connect(o.detune);
    o.connect(g);
    g.connect(lp);
    o.start();
    return o;
  });
  return () => stopNodes(...oscs, vib, breath);
};

// Deep space — sub drone + airy filtered sweep + sparse shimmer bells.
const SPACE_BELLS = [1046.5, 1318.5, 1568, 2093];
const makeDeepSpace: Maker = (ctx, out) => {
  const drone = ctx.createOscillator();
  drone.type = "sine";
  drone.frequency.value = 55;
  const dg = ctx.createGain();
  dg.gain.value = 0.18;
  drone.connect(dg);
  dg.connect(out);
  drone.start();
  const drone2 = ctx.createOscillator();
  drone2.type = "sine";
  drone2.frequency.value = 82.41;
  const dg2 = ctx.createGain();
  dg2.gain.value = 0.08;
  drone2.connect(dg2);
  dg2.connect(out);
  drone2.start();
  const src = noiseSource(ctx, "pink");
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 900;
  bp.Q.value = 2;
  const ng = ctx.createGain();
  ng.gain.value = 0.05;
  const sweep = ctx.createOscillator();
  sweep.frequency.value = 0.05;
  const sg = ctx.createGain();
  sg.gain.value = 700;
  sweep.connect(sg);
  sg.connect(bp.frequency);
  sweep.start();
  src.connect(bp);
  bp.connect(ng);
  ng.connect(out);
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const shimmer = () => {
    if (stopped) return;
    const f = SPACE_BELLS[Math.floor(Math.random() * SPACE_BELLS.length)] ?? 1568;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.06, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 4);
    o.connect(g);
    g.connect(out);
    o.start(now);
    o.stop(now + 4.2);
    timer = setTimeout(shimmer, 3000 + Math.random() * 6000);
  };
  timer = setTimeout(shimmer, 1500);
  return () => {
    stopped = true;
    clearTimeout(timer);
    stopNodes(drone, drone2, src, sweep);
  };
};

// Whale song over a deep ocean bed.
const makeWhales: Maker = (ctx, out) => {
  const src = noiseSource(ctx, "brown");
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 300;
  const g = ctx.createGain();
  g.gain.value = 0.18;
  src.connect(lp);
  lp.connect(g);
  g.connect(out);
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const moan = () => {
    if (stopped) return;
    const o = ctx.createOscillator();
    o.type = "sine";
    const now = ctx.currentTime;
    const base = 120 + Math.random() * 120;
    o.frequency.setValueAtTime(base, now);
    o.frequency.exponentialRampToValueAtTime(base * 0.5, now + 2.5);
    o.frequency.exponentialRampToValueAtTime(base * 0.8, now + 4);
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(0.0001, now);
    mg.gain.exponentialRampToValueAtTime(0.12, now + 0.8);
    mg.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);
    o.connect(mg);
    mg.connect(out);
    o.start(now);
    o.stop(now + 4.6);
    timer = setTimeout(moan, 5000 + Math.random() * 9000);
  };
  timer = setTimeout(moan, 2000);
  return () => {
    stopped = true;
    clearTimeout(timer);
    stopNodes(src);
  };
};

const makeTone =
  (hz: number): Maker =>
  (ctx, out) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    o.connect(g);
    g.connect(out);
    o.start();
    return () => stopNodes(o);
  };

const makeBinaural =
  (base: number, beat: number): Maker =>
  (ctx, out) => {
    const lO = ctx.createOscillator();
    lO.type = "sine";
    lO.frequency.value = base - beat / 2;
    const rO = ctx.createOscillator();
    rO.type = "sine";
    rO.frequency.value = base + beat / 2;
    const lP = ctx.createStereoPanner();
    lP.pan.value = -1;
    const rP = ctx.createStereoPanner();
    rP.pan.value = 1;
    lO.connect(lP);
    lP.connect(out);
    rO.connect(rP);
    rP.connect(out);
    lO.start();
    rO.start();
    return () => stopNodes(lO, rO);
  };

// ── Catalogs ─────────────────────────────────────────────────────────────────
type Item = { id: string; label: string; emoji?: string; sub?: string; make: Maker; def: number };

const SOUNDS: Item[] = [
  { id: "rain", label: "Rain", emoji: "🌧️", make: makeRain, def: 0.6 },
  { id: "thunder", label: "Thunderstorm", emoji: "⛈️", make: makeThunder, def: 0.6 },
  { id: "ocean", label: "Ocean waves", emoji: "🌊", make: makeOcean, def: 0.7 },
  { id: "stream", label: "Stream / creek", emoji: "🏞️", make: makeStream, def: 0.6 },
  { id: "wind", label: "Wind", emoji: "💨", make: makeWind, def: 0.5 },
  { id: "crickets", label: "Night crickets", emoji: "🦗", make: makeCrickets, def: 0.5 },
  { id: "fire", label: "Campfire", emoji: "🔥", make: makeFire, def: 0.5 },
  { id: "chimes", label: "Wind chimes", emoji: "🎐", make: makeChimes, def: 0.6 },
  { id: "fan", label: "Fan", emoji: "🌀", make: makeFan, def: 0.5 },
  { id: "white", label: "White noise", emoji: "⬜", make: colorNoise("white"), def: 0.4 },
  { id: "pink", label: "Pink noise", emoji: "🌸", make: colorNoise("pink"), def: 0.4 },
  { id: "brown", label: "Brown noise", emoji: "🟫", make: colorNoise("brown"), def: 0.4 },
  { id: "bowl", label: "Singing bowl", emoji: "🥣", make: makeBowl, def: 0.5 },
  { id: "heart", label: "Slow heartbeat", emoji: "🫀", make: makeHeartbeat, def: 0.5 },
  { id: "humming", label: "Humming choir", emoji: "🎙️", make: makeHummingChoir, def: 0.5 },
  { id: "angelic", label: "Angelic choir", emoji: "👼", make: makeAngelicPad, def: 0.4 },
  { id: "space", label: "Deep space", emoji: "🌌", make: makeDeepSpace, def: 0.6 },
  { id: "whales", label: "Whale song", emoji: "🐋", make: makeWhales, def: 0.6 }
];

const SOLFEGGIO: Item[] = [
  { id: "t174", label: "174 Hz", sub: "foundation · ease", make: makeTone(174), def: 0.18 },
  { id: "t285", label: "285 Hz", sub: "renew · restore", make: makeTone(285), def: 0.18 },
  { id: "t396", label: "396 Hz", sub: "release fear", make: makeTone(396), def: 0.18 },
  { id: "t417", label: "417 Hz", sub: "change · clearing", make: makeTone(417), def: 0.18 },
  { id: "t432", label: "432 Hz", sub: "calm tuning", make: makeTone(432), def: 0.18 },
  { id: "t528", label: "528 Hz", sub: "the “love” tone", make: makeTone(528), def: 0.18 },
  { id: "t639", label: "639 Hz", sub: "connection", make: makeTone(639), def: 0.18 },
  { id: "t741", label: "741 Hz", sub: "cleanse · express", make: makeTone(741), def: 0.18 },
  { id: "t852", label: "852 Hz", sub: "intuition", make: makeTone(852), def: 0.18 },
  { id: "t963", label: "963 Hz", sub: "awakening", make: makeTone(963), def: 0.18 },
  { id: "t40", label: "40 Hz", sub: "gamma · clarity", make: makeTone(40), def: 0.16 },
  { id: "t111", label: "111 Hz", sub: "deep calm", make: makeTone(111), def: 0.18 },
  { id: "t136", label: "136.1 Hz", sub: "Om · earth tone", make: makeTone(136.1), def: 0.18 },
  { id: "t936", label: "936 Hz", sub: "pineal", make: makeTone(936), def: 0.16 }
];

const BINAURAL: Item[] = [
  { id: "b-delta", label: "Delta · 2.5 Hz", sub: "deep dreamless sleep", make: makeBinaural(110, 2.5), def: 0.22 },
  { id: "b-theta", label: "Theta · 6 Hz", sub: "meditation · REM", make: makeBinaural(120, 6), def: 0.22 },
  { id: "b-alpha", label: "Alpha · 10 Hz", sub: "calm & relaxed", make: makeBinaural(160, 10), def: 0.22 },
  { id: "b-schumann", label: "Schumann · 7.83 Hz", sub: "earth resonance", make: makeBinaural(136.1, 7.83), def: 0.22 },
  { id: "b-deepdelta", label: "Delta · 1 Hz", sub: "deepest sleep", make: makeBinaural(100, 1), def: 0.22 },
  { id: "b-gamma", label: "Gamma · 40 Hz", sub: "focus & healing", make: makeBinaural(220, 40), def: 0.2 }
];

const ALL: Item[] = [...SOUNDS, ...SOLFEGGIO, ...BINAURAL];
const ITEM_BY_ID = new Map(ALL.map((i) => [i.id, i]));

const TIMER_OPTS = [0, 15, 30, 45, 60, 90];

function ytSearch(q: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}
const FREE_SOURCES: { label: string; q: string }[] = [
  { label: "Rain on a tin roof", q: "rain on tin roof 10 hours sleep" },
  { label: "Thunderstorm", q: "thunderstorm sleep sounds black screen" },
  { label: "Crickets at night", q: "crickets at night nature sounds" },
  { label: "Forest night", q: "forest night ambience sleep" },
  { label: "Ocean waves", q: "ocean waves sleep 10 hours" },
  { label: "Wind chimes", q: "relaxing wind chimes" },
  { label: "Campfire", q: "campfire crackling sounds" },
  { label: "Birdsong", q: "morning birdsong nature" },
  { label: "Lo-fi sleep music", q: "lofi sleep music" },
  { label: "Tibetan bowls", q: "tibetan singing bowls meditation" },
  { label: "528 Hz music", q: "528 hz healing music sleep" },
  { label: "Delta waves", q: "delta waves deep sleep music" },
  { label: "Opera for sleep", q: "relaxing opera arias for sleep" },
  { label: "Humming meditation", q: "humming meditation for sleep" },
  { label: "Space ambience", q: "deep space ambience for sleep 10 hours" },
  { label: "963 Hz", q: "963 hz pineal activation meditation" },
  { label: "Gamma waves", q: "gamma waves focus healing meditation" },
  { label: "Gregorian chant", q: "gregorian chant for sleep" }
];

type Section = "sounds" | "frequencies" | "binaural" | "music" | "more";

// ── Music channels (radio-browser streams) ──────────────────────────────────
type Station = { name: string; url: string; favicon: string; bitrate: number; tags: string };
type MusicCat = { key: string; label: string; emoji: string; tags: string[] };
const MUSIC_CATS: MusicCat[] = [
  { key: "western", label: "Western classical", emoji: "🎻", tags: ["classical"] },
  { key: "indian", label: "Indian classical", emoji: "🪕", tags: ["indian classical", "carnatic", "hindustani", "raga"] },
  { key: "solfeggio", label: "Solfeggio & meditation", emoji: "🧘", tags: ["meditation", "healing", "solfeggio"] },
  { key: "ambient", label: "Ambient & sleep", emoji: "🌌", tags: ["ambient", "sleep", "relaxation"] }
];

async function fetchByTags(tags: string[]): Promise<Station[]> {
  const base = "https://de1.api.radio-browser.info/json/stations/search";
  const lists = await Promise.all(
    tags.map(async (t) => {
      try {
        const r = await fetch(
          `${base}?tag=${encodeURIComponent(t)}&hidebroken=true&order=clickcount&reverse=true&limit=80`,
          { cache: "no-store" }
        );
        if (!r.ok) return [];
        return (await r.json()) as any[];
      } catch {
        return [];
      }
    })
  );
  const seen = new Set<string>();
  const out: Station[] = [];
  for (const arr of lists) {
    for (const s of arr ?? []) {
      const url = (s.url_resolved || s.url || "") as string;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push({
        name: (s.name ?? "Station").trim() || "Station",
        url,
        favicon: (s.favicon || "") as string,
        bitrate: (s.bitrate || 0) as number,
        tags: (s.tags || "") as string
      });
    }
  }
  return out.slice(0, 80);
}

// ── Component ────────────────────────────────────────────────────────────────
export function SleepStudio() {
  const [section, setSection] = useState<Section>("sounds");
  const [active, setActive] = useState<Set<string>>(new Set());
  const [vols, setVols] = useState<Record<string, number>>({});
  const [master, setMaster] = useState(0.8);
  const [timerMin, setTimerMin] = useState(0);
  const [timerEnd, setTimerEnd] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number>(0);

  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const layersRef = useRef<Map<string, { stop: () => void; gain: GainNode }>>(new Map());

  const ensureCtx = useCallback((): AudioContext | null => {
    if (!ctxRef.current) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      const m = ctx.createGain();
      m.gain.value = master;
      m.connect(ctx.destination);
      ctxRef.current = ctx;
      masterRef.current = m;
    }
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, [master]);

  const stopLayer = useCallback((id: string) => {
    const ctx = ctxRef.current;
    const entry = layersRef.current.get(id);
    if (!entry) return;
    try {
      if (ctx) entry.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
    } catch {
      // ignore
    }
    window.setTimeout(() => {
      try {
        entry.stop();
      } catch {
        // ignore
      }
      try {
        entry.gain.disconnect();
      } catch {
        // ignore
      }
    }, 320);
    layersRef.current.delete(id);
  }, []);

  const stopAll = useCallback(() => {
    for (const id of Array.from(layersRef.current.keys())) stopLayer(id);
    setActive(new Set());
  }, [stopLayer]);

  const toggle = useCallback(
    (id: string) => {
      const item = ITEM_BY_ID.get(id);
      if (!item) return;
      if (layersRef.current.has(id)) {
        stopLayer(id);
        setActive(new Set(layersRef.current.keys()));
        return;
      }
      const ctx = ensureCtx();
      const m = masterRef.current;
      if (!ctx || !m) return;
      try {
        const g = ctx.createGain();
        const v = vols[id] ?? item.def;
        g.gain.value = 0;
        g.connect(m);
        const stop = item.make(ctx, g);
        g.gain.setTargetAtTime(v, ctx.currentTime, 0.25);
        layersRef.current.set(id, { stop, gain: g });
        setActive(new Set(layersRef.current.keys()));
      } catch {
        // a single generator failing must never crash the page
      }
    },
    [ensureCtx, stopLayer, vols]
  );

  const setVolume = useCallback((id: string, v: number) => {
    setVols((prev) => ({ ...prev, [id]: v }));
    const ctx = ctxRef.current;
    const entry = layersRef.current.get(id);
    if (ctx && entry) {
      try {
        entry.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
      } catch {
        // ignore
      }
    }
  }, []);

  // Master volume.
  useEffect(() => {
    const ctx = ctxRef.current;
    const m = masterRef.current;
    if (ctx && m) {
      try {
        m.gain.setTargetAtTime(master, ctx.currentTime, 0.05);
      } catch {
        // ignore
      }
    }
  }, [master]);

  // Sleep timer: tick + fade-and-stop when it elapses.
  useEffect(() => {
    if (!timerEnd) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const left = timerEnd - Date.now();
      if (left <= 0) {
        // gentle final fade then full stop
        const ctx = ctxRef.current;
        const m = masterRef.current;
        if (ctx && m) {
          try {
            m.gain.setTargetAtTime(0, ctx.currentTime, 1.4);
          } catch {
            // ignore
          }
        }
        window.setTimeout(() => {
          stopAll();
          if (masterRef.current && ctxRef.current) {
            try {
              masterRef.current.gain.setTargetAtTime(master, ctxRef.current.currentTime, 0.1);
            } catch {
              // ignore
            }
          }
        }, 4500);
        setTimerEnd(null);
        setTimerMin(0);
        setRemaining(0);
        return;
      }
      setRemaining(left);
    };
    tick();
    const iv = window.setInterval(tick, 1000);
    return () => window.clearInterval(iv);
  }, [timerEnd, stopAll, master]);

  // Teardown on unmount.
  useEffect(() => {
    return () => {
      for (const { stop } of layersRef.current.values()) {
        try {
          stop();
        } catch {
          // ignore
        }
      }
      layersRef.current.clear();
      if (ctxRef.current) {
        void ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, []);

  function chooseTimer(min: number) {
    setTimerMin(min);
    setTimerEnd(min > 0 ? Date.now() + min * 60_000 : null);
  }

  const playingCount = active.size;
  const remMin = Math.floor(remaining / 60000);
  const remSec = Math.floor((remaining % 60000) / 1000);

  return (
    <div className="space-y-5">
      {/* Hero + master controls */}
      <section className="surface-glass tint-purple p-5">
        <h1 className="font-display text-xl font-semibold">😴 Sleep &amp; Relaxation</h1>
        <p className="mt-1 text-sm text-white/60">
          Mix calming soundscapes, healing frequencies and binaural beats for deep
          rest. Everything plays live in your browser — layer as many as you like,
          set a sleep timer, and drift off.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <label className="flex items-center gap-2 text-[11px] text-white/55">
            🔊 Master
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={master}
              onChange={(e) => setMaster(Number(e.target.value))}
              className="accent-neon-purple"
              aria-label="Master volume"
            />
          </label>

          <label className="flex items-center gap-2 text-[11px] text-white/55">
            ⏲️ Sleep timer
            <select
              value={timerMin}
              onChange={(e) => chooseTimer(Number(e.target.value))}
              className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white/85 outline-none focus:border-neon-purple/60"
            >
              {TIMER_OPTS.map((t) => (
                <option key={t} value={t}>
                  {t === 0 ? "Off" : `${t} min`}
                </option>
              ))}
            </select>
          </label>

          {timerEnd && (
            <span className="text-[11px] text-neon-mint">
              fades out in {remMin}:{remSec < 10 ? "0" : ""}
              {remSec}
            </span>
          )}

          <button
            type="button"
            onClick={stopAll}
            disabled={playingCount === 0}
            className="ml-auto rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10 disabled:opacity-40"
          >
            ■ Stop all {playingCount > 0 ? `(${playingCount})` : ""}
          </button>
        </div>
      </section>

      {/* Section tabs */}
      <div className="surface-glass p-2">
        <div className="flex gap-1 overflow-x-auto">
          {([
            ["sounds", "🌧️ Soundscapes"],
            ["frequencies", "🔮 Frequencies"],
            ["binaural", "🎧 Binaural"],
            ["music", "🎵 Music"],
            ["more", "➕ More & sources"]
          ] as [Section, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition " +
                (section === key
                  ? "bg-neon-purple/25 text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {section === "sounds" && (
        <section className="surface-glass p-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {SOUNDS.map((s) => (
              <SoundCard
                key={s.id}
                item={s}
                on={active.has(s.id)}
                vol={vols[s.id] ?? s.def}
                onToggle={() => toggle(s.id)}
                onVol={(v) => setVolume(s.id, v)}
              />
            ))}
          </div>
        </section>
      )}

      {section === "frequencies" && (
        <section className="surface-glass p-4">
          <p className="mb-3 text-xs text-white/55">
            Pure Solfeggio &amp; tuning tones. Descriptions are traditional
            associations for relaxation — not medical advice. Keep the volume gentle.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SOLFEGGIO.map((s) => (
              <FreqRow
                key={s.id}
                item={s}
                on={active.has(s.id)}
                vol={vols[s.id] ?? s.def}
                onToggle={() => toggle(s.id)}
                onVol={(v) => setVolume(s.id, v)}
              />
            ))}
          </div>
        </section>
      )}

      {section === "binaural" && (
        <section className="surface-glass p-4">
          <p className="mb-3 rounded-xl border border-neon-blue/30 bg-neon-blue/5 px-3 py-2 text-[11px] leading-relaxed text-white/70">
            🎧 <span className="text-white/90">Use headphones</span> — binaural beats
            need a different tone in each ear. The brain perceives the difference as a
            slow pulse. Relaxation aid only; not medical advice.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {BINAURAL.map((s) => (
              <FreqRow
                key={s.id}
                item={s}
                on={active.has(s.id)}
                vol={vols[s.id] ?? s.def}
                onToggle={() => toggle(s.id)}
                onVol={(v) => setVolume(s.id, v)}
              />
            ))}
          </div>
        </section>
      )}

      {section === "music" && <MusicChannels />}

      {section === "more" && (
        <section className="space-y-4">
          <LoopPlayer />
          <div className="surface-glass p-4">
            <p className="text-xs text-white/55">
              More free sleep &amp; nature sounds and music — opens a search of free
              long-play tracks you can leave running.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {FREE_SOURCES.map((s) => (
                <a
                  key={s.label}
                  href={ytSearch(s.q)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-white/75 transition hover:border-white/25 hover:bg-white/5"
                >
                  {s.label} ↗
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <p className="px-1 text-[10px] leading-relaxed text-white/35">
        Sounds &amp; frequencies are generated live for relaxation only and are not a
        medical device or treatment. If you have a health condition (including
        epilepsy), check with a professional before using tones or binaural beats.
      </p>
    </div>
  );
}

function SoundCard({
  item,
  on,
  vol,
  onToggle,
  onVol
}: {
  item: Item;
  on: boolean;
  vol: number;
  onToggle: () => void;
  onVol: (v: number) => void;
}) {
  return (
    <div
      className={
        "rounded-2xl border p-3 transition " +
        (on
          ? "border-neon-purple/50 bg-neon-purple/10"
          : "border-white/10 bg-black/20 hover:border-white/25")
      }
    >
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 text-left">
        <span className="text-2xl">{item.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">{item.label}</span>
          <span className={"text-[11px] " + (on ? "text-neon-mint" : "text-white/40")}>
            {on ? "● playing" : "tap to play"}
          </span>
        </span>
      </button>
      {on && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={vol}
          onChange={(e) => onVol(Number(e.target.value))}
          className="mt-2 w-full accent-neon-purple"
          aria-label={`${item.label} volume`}
        />
      )}
    </div>
  );
}

function FreqRow({
  item,
  on,
  vol,
  onToggle,
  onVol
}: {
  item: Item;
  on: boolean;
  vol: number;
  onToggle: () => void;
  onVol: (v: number) => void;
}) {
  return (
    <div
      className={
        "rounded-xl border px-3 py-2.5 transition " +
        (on ? "border-neon-purple/50 bg-neon-purple/10" : "border-white/10 bg-black/20")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{item.label}</p>
          {item.sub && <p className="truncate text-[11px] text-white/45">{item.sub}</p>}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={
            "shrink-0 rounded-lg border px-3 py-1 text-[11px] font-medium transition " +
            (on
              ? "border-neon-red/40 bg-neon-red/15 text-neon-red hover:bg-neon-red/25"
              : "border-neon-mint/40 bg-neon-mint/15 text-neon-mint hover:bg-neon-mint/25")
          }
        >
          {on ? "■ Stop" : "▶ Play"}
        </button>
      </div>
      {on && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={vol}
          onChange={(e) => onVol(Number(e.target.value))}
          className="mt-2 w-full accent-neon-purple"
          aria-label={`${item.label} volume`}
        />
      )}
    </div>
  );
}

// A tiny standalone looping player for any audio link or local file. Independent
// of the Web-Audio graph — just an <audio loop> element.
function LoopPlayer() {
  const [url, setUrl] = useState("");
  const [src, setSrc] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function loadUrl() {
    const u = url.trim();
    if (!u) return;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setTitle("Your link");
    setSrc(u);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const obj = URL.createObjectURL(f);
    objectUrlRef.current = obj;
    setTitle(f.name);
    setSrc(obj);
    e.target.value = "";
  }

  return (
    <div className="surface-glass p-4">
      <p className="text-sm font-medium text-white">🔁 Loop your own sound</p>
      <p className="mt-0.5 text-[11px] text-white/50">
        Paste a direct audio link (.mp3 / .m4a / .ogg) or load a file — it loops all
        night.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") loadUrl();
          }}
          placeholder="Paste an audio link…"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
        />
        <button
          type="button"
          onClick={loadUrl}
          disabled={!url.trim()}
          className="shrink-0 rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2 text-sm font-medium text-white transition hover:bg-neon-purple/30 disabled:opacity-50"
        >
          Loop
        </button>
        <label className="shrink-0 cursor-pointer rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/85 transition hover:bg-white/5">
          Load file
          <input type="file" accept="audio/*" className="hidden" onChange={onFile} />
        </label>
      </div>
      {src && (
        <div className="mt-3">
          <p className="mb-1 truncate text-[11px] text-white/55">{title}</p>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio key={src} src={src} controls loop autoPlay className="w-full" />
        </div>
      )}
    </div>
  );
}

// ── Music channels — Western & Indian classical, solfeggio/meditation, ambient.
// Live streams from radio-browser, played under a psychedelic equalizer. These
// are separate streaming channels (independent of the synth soundscapes above).
function MusicChannels() {
  const [catKey, setCatKey] = useState(MUSIC_CATS[0]!.key);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState<{ name: string; url: string } | null>(null);
  const cat = MUSIC_CATS.find((c) => c.key === catKey) ?? MUSIC_CATS[0]!;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const list = await fetchByTags(cat.tags);
        if (!cancelled) setStations(list);
      } catch {
        if (!cancelled) setErr("Couldn't load channels — check your connection.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cat]);

  return (
    <section className="surface-glass p-4">
      <h2 className="font-display text-lg font-semibold">🎵 Music channels</h2>
      <p className="mt-0.5 text-[11px] text-white/50">
        Relaxing live stations — Western &amp; Indian classical, solfeggio &amp;
        meditation, and ambient. Plays on its own (separate from the soundscapes).
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {MUSIC_CATS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCatKey(c.key)}
            className={
              "rounded-lg border px-2.5 py-1.5 text-xs transition " +
              (c.key === catKey
                ? "border-neon-purple/50 bg-neon-purple/20 text-white"
                : "border-white/10 bg-black/20 text-white/75 hover:bg-white/5")
            }
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {now && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm text-white">🎶 {now.name}</p>
            <button type="button" onClick={() => setNow(null)} className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/55 hover:bg-white/10">
              ✕ Stop
            </button>
          </div>
          <MusicPlayer url={now.url} />
        </div>
      )}

      {err && <p className="mt-2 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{err}</p>}
      {loading ? (
        <p className="px-1 py-6 text-center text-sm text-white/50">
          <span className="mr-2 animate-pulseDot">●</span>Loading {cat.label.toLowerCase()}…
        </p>
      ) : stations.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-white/50">No channels found right now. Try another category.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {stations.map((s, i) => {
            const sub = [s.tags?.split(",")[0], s.bitrate ? `${s.bitrate}kbps` : ""].filter(Boolean).join(" · ");
            const activeRow = now?.url === s.url;
            return (
              <li key={`${s.url}-${i}`}>
                <button
                  type="button"
                  onClick={() => setNow({ name: s.name, url: s.url })}
                  className={
                    "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition " +
                    (activeRow ? "border-neon-purple/50 bg-neon-purple/10" : "border-white/10 bg-black/20 hover:border-white/25 hover:bg-white/5")
                  }
                >
                  {s.favicon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.favicon} alt="" className="h-8 w-8 shrink-0 rounded bg-white/10 object-contain" onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />
                  ) : (
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-white/10 text-sm">🎵</span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-white/90">{s.name}</span>
                    {sub && <span className="block truncate text-[11px] text-white/40">{sub}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[10px] leading-relaxed text-white/35">
        Stations are provided by the radio-browser community directory. Karochat
        doesn&apos;t host these streams; availability can vary.
      </p>
    </section>
  );
}

// Streaming music player with a decorative psychedelic equalizer (bars dance
// while playing). Cross-origin streams aren't routed through Web Audio so audio
// is never affected.
function MusicPlayer({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <div className={"slm-aud relative h-28 w-full" + (playing ? " is-playing" : "")}>
        <div className="slm-bg" aria-hidden />
        <div className="slm-eq" aria-hidden>
          {Array.from({ length: 28 }).map((_, i) => (
            <span key={i} style={{ animationDelay: `${(i % 14) * 0.06}s` }} />
          ))}
        </div>
        <style>{`
          .slm-bg{position:absolute;inset:0;background:
            radial-gradient(120% 120% at 15% 20%, #7c3aed 0%, transparent 45%),
            radial-gradient(120% 120% at 85% 25%, #db2777 0%, transparent 45%),
            radial-gradient(140% 140% at 50% 95%, #0ea5e9 0%, transparent 50%),
            #0a0a12;filter:saturate(1.15);animation:slmHue 16s linear infinite}
          @keyframes slmHue{to{filter:hue-rotate(360deg) saturate(1.15)}}
          .slm-eq{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;gap:3px;padding:0 8px 8px}
          .slm-eq span{flex:1;max-width:9px;height:14%;border-radius:3px 3px 0 0;
            background:linear-gradient(to top,#22d3ee,#a78bfa,#f472b6);opacity:.85;
            animation:slmBar 1s ease-in-out infinite;animation-play-state:paused;
            box-shadow:0 0 8px rgba(167,139,250,.45)}
          .slm-aud.is-playing .slm-eq span{animation-play-state:running}
          @keyframes slmBar{0%,100%{height:14%}25%{height:72%}50%{height:34%}75%{height:90%}}
          @media (prefers-reduced-motion: reduce){.slm-bg,.slm-eq span{animation:none}}
        `}</style>
      </div>
      <div className="bg-black/60 p-2">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio key={url} src={url} controls autoPlay className="w-full" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
      </div>
    </div>
  );
}
