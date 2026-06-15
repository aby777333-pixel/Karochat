"use client";

// Karochat — Smart Tools: a handy utility belt. World clock, weather, translate,
// dictionary, converter, QR codes and a calculator. Client-side + free, key-less,
// CORS-enabled public APIs (Open-Meteo, dictionaryapi.dev, er-api, qrserver) and
// the existing /api/translate. Each tool is independent and fails gracefully.

import { useEffect, useRef, useState } from "react";

export function ToolsHub() {
  return (
    <div className="space-y-5">
      <section className="surface-glass tint-purple p-5">
        <h1 className="font-display text-xl font-semibold">🧰 Smart Tools</h1>
        <p className="mt-1 text-sm text-white/60">
          A handy utility belt — check the time anywhere, the weather, translate,
          look up words, convert units &amp; currency, make QR codes, and crunch numbers.
        </p>
      </section>
      <div id="worldclock" className="scroll-mt-20"><WorldClock /></div>
      <div id="weather" className="scroll-mt-20"><Weather /></div>
      <div id="translate" className="scroll-mt-20"><Translate /></div>
      <div id="dictionary" className="scroll-mt-20"><Dictionary /></div>
      <div id="convert" className="scroll-mt-20"><Converter /></div>
      <div id="qr" className="scroll-mt-20"><QrTool /></div>
      <div id="calc" className="scroll-mt-20"><Calculator /></div>
    </div>
  );
}

// ── World Clock ──────────────────────────────────────────────────────────────
const CITIES: [string, string][] = [
  ["🇺🇸 Los Angeles", "America/Los_Angeles"],
  ["🇺🇸 New York", "America/New_York"],
  ["🇧🇷 São Paulo", "America/Sao_Paulo"],
  ["🇬🇧 London", "Europe/London"],
  ["🇪🇺 Paris", "Europe/Paris"],
  ["🇿🇦 Johannesburg", "Africa/Johannesburg"],
  ["🇦🇪 Dubai", "Asia/Dubai"],
  ["🇮🇳 Mumbai", "Asia/Kolkata"],
  ["🇸🇬 Singapore", "Asia/Singapore"],
  ["🇨🇳 Beijing", "Asia/Shanghai"],
  ["🇯🇵 Tokyo", "Asia/Tokyo"],
  ["🇦🇺 Sydney", "Australia/Sydney"]
];
function WorldClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  function fmt(tz: string | undefined) {
    if (!now) return { t: "—", d: "" };
    try {
      const t = new Intl.DateTimeFormat(undefined, {
        timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
      }).format(now);
      const d = new Intl.DateTimeFormat(undefined, {
        timeZone: tz, weekday: "short", day: "numeric", month: "short"
      }).format(now);
      return { t, d };
    } catch {
      return { t: "—", d: "" };
    }
  }
  const local = fmt(undefined);
  return (
    <section className="surface-glass p-4">
      <h2 className="font-display text-lg font-semibold">🕐 World Clock</h2>
      <div className="mt-3 rounded-xl border border-neon-purple/30 bg-neon-purple/10 px-4 py-3">
        <p className="text-[11px] uppercase tracking-widest text-white/50">Your local time</p>
        <p className="font-display text-3xl font-bold tabular-nums text-white">{local.t}</p>
        <p className="text-[11px] text-white/50">{local.d}</p>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CITIES.map(([label, tz]) => {
          const f = fmt(tz);
          return (
            <li key={tz} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <span className="min-w-0 truncate text-sm text-white/85">{label}</span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-sm tabular-nums text-white">{f.t}</span>
                <span className="block text-[10px] text-white/40">{f.d}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Weather (Open-Meteo) ─────────────────────────────────────────────────────
const WMO: Record<number, string> = {
  0: "Clear ☀️", 1: "Mainly clear 🌤️", 2: "Partly cloudy ⛅", 3: "Overcast ☁️",
  45: "Fog 🌫️", 48: "Rime fog 🌫️", 51: "Light drizzle 🌦️", 53: "Drizzle 🌦️", 55: "Heavy drizzle 🌧️",
  61: "Light rain 🌦️", 63: "Rain 🌧️", 65: "Heavy rain 🌧️", 71: "Light snow 🌨️", 73: "Snow 🌨️",
  75: "Heavy snow ❄️", 80: "Showers 🌦️", 81: "Showers 🌧️", 82: "Violent showers ⛈️",
  95: "Thunderstorm ⛈️", 96: "Storm + hail ⛈️", 99: "Storm + hail ⛈️"
};
function Weather() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [place, setPlace] = useState("");

  async function forecast(lat: number, lon: number, name: string) {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`
      );
      if (!r.ok) throw new Error("weather");
      setData(await r.json());
      setPlace(name);
    } catch {
      setErr("Couldn't load the weather. Try again.");
    } finally {
      setLoading(false);
    }
  }
  async function search() {
    const term = q.trim();
    if (!term) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=1`);
      const j = (await r.json()) as any;
      const hit = j?.results?.[0];
      if (!hit) {
        setErr("Place not found.");
        setLoading(false);
        return;
      }
      await forecast(hit.latitude, hit.longitude, [hit.name, hit.country].filter(Boolean).join(", "));
    } catch {
      setErr("Search failed. Try again.");
      setLoading(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setErr("Location isn't available.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => void forecast(pos.coords.latitude, pos.coords.longitude, "Your location"),
      () => setErr("Couldn't get your location.")
    );
  }
  const cur = data?.current;
  const daily = data?.daily;
  return (
    <section className="surface-glass p-4">
      <h2 className="font-display text-lg font-semibold">⛅ Weather</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void search()}
          placeholder="City…"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
        />
        <button type="button" onClick={() => void search()} className="rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2 text-sm font-medium text-white hover:bg-neon-purple/30">
          Search
        </button>
        <button type="button" onClick={locate} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10">
          📍 My location
        </button>
      </div>
      {err && <p className="mt-2 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{err}</p>}
      {loading && <p className="mt-2 text-sm text-white/45">Loading…</p>}
      {cur && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-sm text-white/85">{place}</p>
          <p className="font-display text-3xl font-bold text-white">{Math.round(cur.temperature_2m)}°C</p>
          <p className="text-sm text-white/60">{WMO[cur.weather_code] ?? "—"}</p>
          <p className="text-[11px] text-white/45">💧 {cur.relative_humidity_2m}% · 💨 {Math.round(cur.wind_speed_10m)} km/h</p>
          {daily?.time && (
            <ul className="mt-2 grid grid-cols-4 gap-1.5 text-center">
              {daily.time.map((d: string, i: number) => (
                <li key={d} className="rounded-lg border border-white/10 bg-black/20 px-1 py-1.5">
                  <p className="text-[10px] text-white/45">
                    {new Date(d).toLocaleDateString(undefined, { weekday: "short" })}
                  </p>
                  <p className="text-base">{(WMO[daily.weather_code?.[i]] ?? "").split(" ").pop()}</p>
                  <p className="text-[11px] text-white/80">{Math.round(daily.temperature_2m_max?.[i])}°</p>
                  <p className="text-[10px] text-white/40">{Math.round(daily.temperature_2m_min?.[i])}°</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="mt-2 text-[10px] text-white/35">Weather by Open-Meteo (free, open data).</p>
    </section>
  );
}

// ── Translate (reuses /api/translate) ────────────────────────────────────────
const LANGS = ["English", "Hindi", "Spanish", "French", "German", "Italian", "Portuguese", "Arabic", "Chinese", "Japanese", "Korean", "Russian", "Bengali", "Tamil", "Telugu", "Urdu"];
function Translate() {
  const [text, setText] = useState("");
  const [target, setTarget] = useState("Hindi");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    if (!text.trim()) return;
    setBusy(true);
    setErr(null);
    setOut("");
    try {
      const r = await fetch("/api/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: text.trim(), target })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error === "no-translation-provider-configured" ? "Translation isn't available right now." : j?.error ?? "Failed.");
      setOut(j.translated ?? "");
    } catch (e: any) {
      setErr(e?.message ?? "Translation failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="surface-glass p-4">
      <h2 className="font-display text-lg font-semibold">🌐 Translate</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Type text to translate…"
        className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-white/55">to</span>
        <select value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 outline-none focus:border-neon-purple/60">
          {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button type="button" onClick={() => void go()} disabled={busy || !text.trim()} className="rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2 text-sm font-medium text-white hover:bg-neon-purple/30 disabled:opacity-50">
          {busy ? "Translating…" : "Translate"}
        </button>
      </div>
      {err && <p className="mt-2 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{err}</p>}
      {out && <div className="mt-2 whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/90">{out}</div>}
    </section>
  );
}

// ── Dictionary (dictionaryapi.dev) ───────────────────────────────────────────
function Dictionary() {
  const [w, setW] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [entry, setEntry] = useState<any>(null);
  async function look() {
    const word = w.trim();
    if (!word) return;
    setBusy(true);
    setErr(null);
    setEntry(null);
    try {
      const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (!r.ok) {
        setErr("No definition found.");
        setBusy(false);
        return;
      }
      const j = (await r.json()) as any[];
      setEntry(j?.[0] ?? null);
    } catch {
      setErr("Lookup failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="surface-glass p-4">
      <h2 className="font-display text-lg font-semibold">📖 Dictionary</h2>
      <div className="mt-2 flex gap-2">
        <input value={w} onChange={(e) => setW(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void look()} placeholder="Look up an English word…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60" />
        <button type="button" onClick={() => void look()} className="rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2 text-sm font-medium text-white hover:bg-neon-purple/30">Define</button>
      </div>
      {err && <p className="mt-2 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{err}</p>}
      {busy && <p className="mt-2 text-sm text-white/45">Looking up…</p>}
      {entry && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-base font-semibold text-white">
            {entry.word} {entry.phonetic && <span className="text-sm font-normal text-white/45">{entry.phonetic}</span>}
          </p>
          {(entry.meanings ?? []).slice(0, 3).map((m: any, i: number) => (
            <div key={i} className="mt-2">
              <p className="text-[11px] uppercase tracking-widest text-neon-purple">{m.partOfSpeech}</p>
              <ol className="list-decimal space-y-0.5 pl-5 text-sm text-white/75 marker:text-white/40">
                {(m.definitions ?? []).slice(0, 3).map((d: any, j: number) => (
                  <li key={j}>{d.definition}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Converter (units + currency) ─────────────────────────────────────────────
const UNITS: Record<string, Record<string, number>> = {
  Length: { m: 1, km: 1000, cm: 0.01, mi: 1609.344, ft: 0.3048, in: 0.0254, yd: 0.9144 },
  Weight: { kg: 1, g: 0.001, lb: 0.453592, oz: 0.0283495, ton: 1000 },
  Volume: { L: 1, mL: 0.001, gal: 3.78541, qt: 0.946353, cup: 0.236588 }
};
const CURR = ["USD", "EUR", "GBP", "INR", "JPY", "CNY", "AUD", "CAD", "AED", "SGD", "BRL", "ZAR", "NGN", "PKR", "BDT"];
function Converter() {
  const [cat, setCat] = useState("Length");
  const [val, setVal] = useState("1");
  const [from, setFrom] = useState("m");
  const [to, setTo] = useState("ft");
  // temp
  const [tFrom, setTFrom] = useState("C");
  const [tTo, setTTo] = useState("F");
  // currency
  const [cFrom, setCFrom] = useState("USD");
  const [cTo, setCTo] = useState("INR");
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [rateErr, setRateErr] = useState<string | null>(null);

  useEffect(() => {
    if (cat !== "Currency" || rates) return;
    (async () => {
      try {
        const r = await fetch("https://open.er-api.com/v6/latest/USD");
        const j = (await r.json()) as any;
        if (j?.rates) setRates(j.rates);
        else setRateErr("Rates unavailable.");
      } catch {
        setRateErr("Couldn't load rates.");
      }
    })();
  }, [cat, rates]);

  const num = parseFloat(val) || 0;
  let result = "";
  if (cat === "Temperature") {
    const toC = (v: number, u: string) => (u === "C" ? v : u === "F" ? (v - 32) * 5 / 9 : v - 273.15);
    const fromC = (c: number, u: string) => (u === "C" ? c : u === "F" ? c * 9 / 5 + 32 : c + 273.15);
    result = fromC(toC(num, tFrom), tTo).toFixed(2);
  } else if (cat === "Currency") {
    const rf = rates?.[cFrom];
    const rt = rates?.[cTo];
    if (rf && rt) result = ((num / rf) * rt).toFixed(2);
  } else {
    const map = UNITS[cat]!;
    result = ((num * (map[from] ?? 1)) / (map[to] ?? 1)).toFixed(4);
  }

  const cats = [...Object.keys(UNITS), "Temperature", "Currency"];
  return (
    <section className="surface-glass p-4">
      <h2 className="font-display text-lg font-semibold">🔄 Converter</h2>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={"rounded-lg border px-2.5 py-1 text-xs transition " + (c === cat ? "border-neon-purple/50 bg-neon-purple/20 text-white" : "border-white/10 bg-black/20 text-white/70 hover:bg-white/5")}>
            {c}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input type="number" value={val} onChange={(e) => setVal(e.target.value)} className="w-28 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 outline-none focus:border-neon-purple/60" />
        {cat === "Temperature" ? (
          <>
            <select value={tFrom} onChange={(e) => setTFrom(e.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-sm text-white/85">{["C", "F", "K"].map((u) => <option key={u}>{u}</option>)}</select>
            <span className="text-white/40">→</span>
            <select value={tTo} onChange={(e) => setTTo(e.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-sm text-white/85">{["C", "F", "K"].map((u) => <option key={u}>{u}</option>)}</select>
          </>
        ) : cat === "Currency" ? (
          <>
            <select value={cFrom} onChange={(e) => setCFrom(e.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-sm text-white/85">{CURR.map((u) => <option key={u}>{u}</option>)}</select>
            <span className="text-white/40">→</span>
            <select value={cTo} onChange={(e) => setCTo(e.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-sm text-white/85">{CURR.map((u) => <option key={u}>{u}</option>)}</select>
          </>
        ) : (
          <>
            <select value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-sm text-white/85">{Object.keys(UNITS[cat]!).map((u) => <option key={u}>{u}</option>)}</select>
            <span className="text-white/40">→</span>
            <select value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-sm text-white/85">{Object.keys(UNITS[cat]!).map((u) => <option key={u}>{u}</option>)}</select>
          </>
        )}
      </div>
      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-lg text-white">
        = <span className="font-semibold">{result || "…"}</span>
      </div>
      {cat === "Currency" && rateErr && <p className="mt-1 text-[11px] text-neon-amber">{rateErr}</p>}
      {cat === "Currency" && <p className="mt-1 text-[10px] text-white/35">Indicative rates (er-api.com) — not for trading.</p>}
    </section>
  );
}

// ── QR code (qrserver image API) ─────────────────────────────────────────────
function QrTool() {
  const [text, setText] = useState("");
  const [shown, setShown] = useState("");
  const src = shown ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(shown)}` : "";
  return (
    <section className="surface-glass p-4">
      <h2 className="font-display text-lg font-semibold">🔳 QR Code</h2>
      <div className="mt-2 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setShown(text.trim())} placeholder="Text, link, Wi-Fi, anything…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60" />
        <button type="button" onClick={() => setShown(text.trim())} disabled={!text.trim()} className="rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2 text-sm font-medium text-white hover:bg-neon-purple/30 disabled:opacity-50">Make QR</button>
      </div>
      {src && (
        <div className="mt-3 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="QR code" className="h-60 w-60 rounded-lg bg-white p-2" />
          <a href={src} target="_blank" rel="noopener noreferrer" className="mt-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] text-white/85 hover:bg-white/10">Open / download ↗</a>
        </div>
      )}
    </section>
  );
}

// ── Calculator (simple, safe) ────────────────────────────────────────────────
function Calculator() {
  const [disp, setDisp] = useState("0");
  const accRef = useRef<number | null>(null);
  const opRef = useRef<string | null>(null);
  const freshRef = useRef(true);

  function input(d: string) {
    if (freshRef.current) {
      setDisp(d === "." ? "0." : d);
      freshRef.current = false;
    } else {
      setDisp((s) => (d === "." && s.includes(".") ? s : s === "0" && d !== "." ? d : s + d));
    }
  }
  function compute(a: number, b: number, op: string): number {
    if (op === "+") return a + b;
    if (op === "−") return a - b;
    if (op === "×") return a * b;
    if (op === "÷") return b === 0 ? NaN : a / b;
    return b;
  }
  function setOp(op: string) {
    const cur = parseFloat(disp) || 0;
    if (opRef.current && !freshRef.current && accRef.current != null) {
      const res = compute(accRef.current, cur, opRef.current);
      accRef.current = res;
      setDisp(String(res));
    } else {
      accRef.current = cur;
    }
    opRef.current = op;
    freshRef.current = true;
  }
  function equals() {
    if (opRef.current != null && accRef.current != null) {
      const cur = parseFloat(disp) || 0;
      const res = compute(accRef.current, cur, opRef.current);
      setDisp(Number.isFinite(res) ? String(res) : "Error");
      accRef.current = null;
      opRef.current = null;
      freshRef.current = true;
    }
  }
  function clear() {
    setDisp("0");
    accRef.current = null;
    opRef.current = null;
    freshRef.current = true;
  }
  function pct() {
    setDisp((s) => String((parseFloat(s) || 0) / 100));
    freshRef.current = true;
  }
  function neg() {
    setDisp((s) => String((parseFloat(s) || 0) * -1));
  }

  const keys: { k: string; act: () => void; cls?: string }[] = [
    { k: "C", act: clear, cls: "text-neon-red" },
    { k: "±", act: neg },
    { k: "%", act: pct },
    { k: "÷", act: () => setOp("÷"), cls: "text-neon-purple" },
    { k: "7", act: () => input("7") }, { k: "8", act: () => input("8") }, { k: "9", act: () => input("9") }, { k: "×", act: () => setOp("×"), cls: "text-neon-purple" },
    { k: "4", act: () => input("4") }, { k: "5", act: () => input("5") }, { k: "6", act: () => input("6") }, { k: "−", act: () => setOp("−"), cls: "text-neon-purple" },
    { k: "1", act: () => input("1") }, { k: "2", act: () => input("2") }, { k: "3", act: () => input("3") }, { k: "+", act: () => setOp("+"), cls: "text-neon-purple" },
    { k: "0", act: () => input("0") }, { k: ".", act: () => input(".") }, { k: "=", act: equals, cls: "bg-neon-purple/25" }
  ];
  return (
    <section className="surface-glass p-4">
      <h2 className="font-display text-lg font-semibold">🧮 Calculator</h2>
      <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-right font-mono text-2xl text-white">
        <span className="block truncate">{disp}</span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {keys.map((b, i) => (
          <button
            key={i}
            type="button"
            onClick={b.act}
            className={"rounded-xl border border-white/10 bg-white/5 py-3 text-lg font-medium text-white transition hover:bg-white/10 " + (b.k === "0" ? "col-span-2" : "") + " " + (b.cls ?? "")}
          >
            {b.k}
          </button>
        ))}
      </div>
    </section>
  );
}
