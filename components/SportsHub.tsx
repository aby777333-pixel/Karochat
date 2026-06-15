"use client";

// Karochat — Sports TV & Radio hub. Free sports channels from around the world,
// country-wise (plus a "Worldwide" sports list), playable inline. TV via iptv-org
// sports playlists (HLS through hls.js, code-split on demand); radio via
// radio-browser's "sports" tag. Third-party community streams — failures fall
// back to "open externally" gracefully.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SPORTS_COUNTRIES,
  fetchSportsTv,
  fetchSportsRadio,
  type SportsTv,
  type SportsRadio
} from "@/lib/sportsChannels";

type Mode = "tv" | "radio";
type Now = { name: string; url: string; kind: Mode } | null;

export function SportsHub() {
  const [mode, setMode] = useState<Mode>("tv");
  const [code, setCode] = useState("global");
  const [tv, setTv] = useState<SportsTv[]>([]);
  const [radio, setRadio] = useState<SportsRadio[]>([]);
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
          const list = await fetchSportsTv(code);
          if (!cancelled) setTv(list);
        } else {
          const list = await fetchSportsRadio(code);
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

  const country = SPORTS_COUNTRIES.find((c) => c.code === code);

  return (
    <section className="surface-glass mt-1 p-4 md:p-5">
      <h1 className="font-display text-xl font-semibold">⚽ Sports — TV &amp; Radio</h1>
      <p className="mt-1 text-sm text-white/55">
        Free sports channels &amp; stations from around the world — international to
        local. Pick Worldwide or a country and play right here.
      </p>

      <div className="mt-4 space-y-4">
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
              <SportsTvPlayer url={now.url} />
            ) : (
              <audio key={now.url} src={now.url} controls autoPlay className="w-full" />
            )}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setMode("tv")}
              className={
                "rounded-lg px-3 py-1.5 transition " +
                (mode === "tv" ? "bg-neon-mint/20 text-neon-mint" : "text-white/65 hover:bg-white/10")
              }
            >
              📺 TV
            </button>
            <button
              type="button"
              onClick={() => setMode("radio")}
              className={
                "rounded-lg px-3 py-1.5 transition " +
                (mode === "radio" ? "bg-neon-mint/20 text-neon-mint" : "text-white/65 hover:bg-white/10")
              }
            >
              📻 Radio
            </button>
          </div>
          <select
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 outline-none focus:border-neon-mint/60"
          >
            {SPORTS_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter channels…"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-mint/60"
          />
        </div>

        {err && <p className="rounded-md bg-neon-red/10 px-3 py-1.5 text-xs text-neon-red">{err}</p>}

        {loading ? (
          <p className="px-1 py-6 text-center text-sm text-white/50">
            <span className="mr-2 animate-pulseDot">●</span>Loading {mode === "tv" ? "TV" : "radio"}{" "}
            for {country?.name}…
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-white/50">
            No sports {mode === "tv" ? "channels" : "stations"} found for {country?.name}. Try
            Worldwide or another country.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(filtered as (SportsTv | SportsRadio)[]).map((c, i) => {
              const logo = mode === "tv" ? (c as SportsTv).logo : (c as SportsRadio).favicon;
              const sub =
                mode === "tv"
                  ? (c as SportsTv).group
                  : [
                      (c as SportsRadio).tags?.split(",")[0],
                      (c as SportsRadio).bitrate ? `${(c as SportsRadio).bitrate}kbps` : ""
                    ]
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
                        ? "border-neon-mint/50 bg-neon-mint/10"
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
          Channels are provided by third-party community directories (iptv-org &amp;
          radio-browser). Karochat doesn&apos;t host these streams; availability can
          vary by region and some may be offline. Use “Open ↗” if a channel won&apos;t
          play here.
        </p>
      </div>
    </section>
  );
}

// HLS-capable player (native HLS on Safari, hls.js elsewhere). Mirrors the
// TV & Radio player.
function SportsTvPlayer({ url }: { url: string }) {
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
