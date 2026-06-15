"use client";

// Karochat — Live TV & Radio player. Country-wise free channels embedded and
// playable inside Karochat: radio via radio-browser.info (<audio>), TV via
// iptv-org per-country HLS playlists (hls.js, code-split on demand). Third-party
// community streams — failures are handled gracefully with an "open externally"
// fallback.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  COUNTRIES,
  fetchRadio,
  fetchTv,
  type RadioStation,
  type TvChannel
} from "@/lib/liveChannels";

type Mode = "tv" | "radio";
type Now = { name: string; url: string; kind: Mode } | null;

export function LiveTvRadio() {
  const [mode, setMode] = useState<Mode>("radio");
  const [code, setCode] = useState("us");
  const [tv, setTv] = useState<TvChannel[]>([]);
  const [radio, setRadio] = useState<RadioStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState<Now>(null);
  const [q, setQ] = useState("");
  const playerRef = useRef<HTMLDivElement | null>(null);

  // When a channel is picked, bring the player into view immediately.
  useEffect(() => {
    if (now) playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [now]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        if (mode === "tv") {
          const list = await fetchTv(code);
          if (!cancelled) setTv(list);
        } else {
          const list = await fetchRadio(code);
          if (!cancelled) setRadio(list);
        }
      } catch {
        if (!cancelled) setErr("Couldn't load channels. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, code]);

  const list = mode === "tv" ? tv : radio;
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return (list as { name: string }[]).filter((c) => c.name.toLowerCase().includes(term));
  }, [list, q]);

  const country = COUNTRIES.find((c) => c.code === code);

  return (
    <div className="space-y-4">
      {/* Now playing */}
      {now && (
        <div ref={playerRef} className="surface-glass scroll-mt-3 overflow-hidden p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm">
              <span className="text-white/50">Now playing · </span>
              <span className="text-white">{now.name}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <a
                href={now.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/65 hover:bg-white/10"
              >
                Open ↗
              </a>
              <button
                type="button"
                onClick={() => setNow(null)}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/55 hover:bg-white/10"
              >
                ✕ Stop
              </button>
            </div>
          </div>
          {now.kind === "tv" ? (
            <TvPlayer url={now.url} />
          ) : (
            <RadioPlayer url={now.url} />
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setMode("radio")}
            className={
              "rounded-lg px-3 py-1.5 transition " +
              (mode === "radio" ? "bg-neon-blue/20 text-neon-blue" : "text-white/65 hover:bg-white/10")
            }
          >
            📻 Radio
          </button>
          <button
            type="button"
            onClick={() => setMode("tv")}
            className={
              "rounded-lg px-3 py-1.5 transition " +
              (mode === "tv" ? "bg-neon-blue/20 text-neon-blue" : "text-white/65 hover:bg-white/10")
            }
          >
            📺 TV
          </button>
        </div>
        <select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 outline-none focus:border-neon-blue/60"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter channels…"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/60"
        />
      </div>

      {err && <p className="rounded-md bg-neon-red/10 px-3 py-1.5 text-xs text-neon-red">{err}</p>}

      {loading ? (
        <p className="px-1 py-6 text-center text-sm text-white/50">
          <span className="mr-2 animate-pulseDot">●</span>Loading {mode === "tv" ? "TV" : "radio"}{" "}
          channels for {country?.name}…
        </p>
      ) : filtered.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-white/50">
          No {mode === "tv" ? "TV" : "radio"} channels found for {country?.name}. Try another
          country.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(filtered as (TvChannel | RadioStation)[]).map((c, i) => {
            const logo = mode === "tv" ? (c as TvChannel).logo : (c as RadioStation).favicon;
            const sub =
              mode === "tv"
                ? (c as TvChannel).group
                : [(c as RadioStation).tags?.split(",")[0], (c as RadioStation).bitrate ? `${(c as RadioStation).bitrate}kbps` : ""]
                    .filter(Boolean)
                    .join(" · ");
            const active = now?.url === c.url;
            return (
              <li key={`${c.url}-${i}`}>
                <button
                  type="button"
                  onClick={() => setNow({ name: c.name, url: c.url, kind: mode })}
                  className={
                    "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition " +
                    (active
                      ? "border-neon-blue/50 bg-neon-blue/10"
                      : "border-white/10 bg-black/20 hover:border-white/25 hover:bg-white/5")
                  }
                >
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logo}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded bg-white/10 object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                  ) : (
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-white/10 text-sm">
                      {mode === "tv" ? "📺" : "📻"}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-white/90">{c.name}</span>
                    {sub && <span className="block truncate text-[11px] text-white/40">{sub}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[10px] leading-relaxed text-white/35">
        Channels are provided by third-party community directories (radio-browser
        &amp; iptv-org). Karochat doesn&apos;t host these streams; availability can
        vary by region and some may be offline. Use “Open ↗” if a channel won&apos;t
        play here.
      </p>
    </div>
  );
}

// HLS-capable TV player. Uses native HLS on Safari, hls.js (code-split) elsewhere.
function TvPlayer({ url }: { url: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !url) return;
    let destroyed = false;
    let hls: { destroy: () => void } | null = null;
    setErr(null);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      void video.play().catch(() => {});
    } else {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (destroyed) return;
          if (Hls.isSupported()) {
            const instance = new Hls({ enableWorker: true });
            hls = instance;
            instance.loadSource(url);
            instance.attachMedia(video);
            instance.on(Hls.Events.ERROR, (_evt, data) => {
              if (data?.fatal) {
                setErr("This stream couldn't be played here. Try another channel or Open ↗.");
              }
            });
            void video.play?.().catch(() => {});
          } else {
            video.src = url;
          }
        })
        .catch(() => setErr("Player failed to load."));
    }

    return () => {
      destroyed = true;
      if (hls) {
        try {
          hls.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [url]);

  return (
    <div>
      <video
        ref={ref}
        controls
        playsInline
        className="mx-auto block max-h-[70vh] w-full rounded-lg bg-black"
      />
      {err && <p className="mt-1 text-[11px] text-neon-amber">{err}</p>}
    </div>
  );
}

// Radio player — native controls under a dark, psychedelic animated equalizer.
// The bars are decorative (they dance while playing, freeze when paused): routing
// a cross-origin stream through Web Audio's analyser would mute it, so we don't.
function RadioPlayer({ url }: { url: string }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <div className={"rad-aud relative h-32 w-full" + (playing ? " is-playing" : "")}>
        <div className="rad-bg" aria-hidden />
        <div className="rad-eq" aria-hidden>
          {Array.from({ length: 32 }).map((_, i) => (
            <span key={i} style={{ animationDelay: `${(i % 16) * 0.06}s` }} />
          ))}
        </div>
        <style>{`
          .rad-bg{position:absolute;inset:0;background:
            radial-gradient(120% 120% at 15% 20%, #7c3aed 0%, transparent 45%),
            radial-gradient(120% 120% at 85% 25%, #db2777 0%, transparent 45%),
            radial-gradient(140% 140% at 50% 95%, #0ea5e9 0%, transparent 50%),
            #0a0a12;filter:saturate(1.15);animation:radHue 16s linear infinite}
          @keyframes radHue{to{filter:hue-rotate(360deg) saturate(1.15)}}
          .rad-eq{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;gap:3px;padding:0 8px 8px}
          .rad-eq span{flex:1;max-width:9px;height:14%;border-radius:3px 3px 0 0;
            background:linear-gradient(to top,#22d3ee,#a78bfa,#f472b6);opacity:.85;
            animation:radBar 1s ease-in-out infinite;animation-play-state:paused;
            box-shadow:0 0 8px rgba(167,139,250,.45)}
          .rad-aud.is-playing .rad-eq span{animation-play-state:running}
          @keyframes radBar{0%,100%{height:14%}25%{height:72%}50%{height:34%}75%{height:90%}}
          @media (prefers-reduced-motion: reduce){.rad-bg,.rad-eq span{animation:none}}
        `}</style>
      </div>
      <div className="bg-black/60 p-2">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio
          ref={ref}
          key={url}
          src={url}
          controls
          autoPlay
          className="w-full"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      </div>
    </div>
  );
}
