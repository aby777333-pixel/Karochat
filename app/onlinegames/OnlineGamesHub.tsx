"use client";

// Karochat — Online Games. Free games from around the world:
//   • Play in-browser — thousands of classic arcade, MS-DOS and console games
//     emulated by the Internet Archive (CORS API + official embed; allowed).
//   • Plus a curated directory of the biggest free online-game portals (open in
//     their own site). No hosting, no installs.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchArchive,
  embedUrl,
  detailsUrl,
  type ArchiveItem
} from "@/lib/archiveStories";

type Cat = { key: string; label: string; emoji: string; query: string };
const CATS: Cat[] = [
  { key: "arcade", label: "Arcade", emoji: "🕹️", query: "mediatype:(software) AND collection:(internetarcade)" },
  { key: "msdos", label: "MS-DOS classics", emoji: "💾", query: "mediatype:(software) AND collection:(softwarelibrary_msdos_games)" },
  { key: "console", label: "Console", emoji: "🎮", query: "mediatype:(software) AND collection:(consolelivingroom)" },
  { key: "apple", label: "Apple II", emoji: "🍎", query: "mediatype:(software) AND collection:(softwarelibrary_apple)" }
];

const PORTALS: { name: string; url: string; blurb: string }[] = [
  { name: "Poki", url: "https://poki.com", blurb: "Huge library of free browser games, no install." },
  { name: "CrazyGames", url: "https://www.crazygames.com", blurb: "Action, racing, .io & multiplayer games." },
  { name: "Coolmath Games", url: "https://www.coolmathgames.com", blurb: "Logic, puzzle & brain games." },
  { name: "Y8", url: "https://www.y8.com", blurb: "Classic flash-era & HTML5 games." },
  { name: "Miniclip", url: "https://www.miniclip.com", blurb: "Sports, arcade & multiplayer classics." },
  { name: "Addicting Games", url: "https://www.addictinggames.com", blurb: "Quick-play casual games." },
  { name: "itch.io (free)", url: "https://itch.io/games/free/platform-web", blurb: "Indie browser games, free to play." },
  { name: "Armor Games", url: "https://armorgames.com", blurb: "Strategy, RPG & adventure games." },
  { name: "GameSnacks (Google)", url: "https://gamesnacks.com", blurb: "Light, instant HTML5 games." },
  { name: "Lichess", url: "https://lichess.org", blurb: "Free online chess vs anyone, no ads." },
  { name: "Internet Arcade", url: "https://archive.org/details/internetarcade", blurb: "Thousands of emulated arcade machines." },
  { name: "Chess.com", url: "https://www.chess.com/play", blurb: "Play chess online with millions." }
];

type Now = { id: string; title: string } | null;

export function OnlineGamesHub() {
  const [catKey, setCatKey] = useState(CATS[0]?.key ?? "arcade");
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState(0);
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState<Now>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);

  const cat = useMemo(() => CATS.find((c) => c.key === catKey) ?? CATS[0]!, [catKey]);

  // When a game is picked, bring the player into view immediately.
  useEffect(() => {
    if (now) playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [now]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const list = await fetchArchive(cat.query, "Any", search, 48);
        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setErr("Couldn't reach the game library. Check your connection and retry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, submitted]);

  return (
    <div className="space-y-5">
      <section className="surface-glass tint-purple p-5">
        <h1 className="font-display text-xl font-semibold">🎮 Online Games</h1>
        <p className="mt-1 text-sm text-white/60">
          Free games from around the world. Play thousands of classic arcade,
          MS-DOS &amp; console games right here, or jump to the biggest free
          game portals. No downloads, no installs.
        </p>
        <a
          href="/fun#games"
          className="mt-3 inline-block rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
        >
          🎲 Quick mini-games (Tic-Tac-Toe, Reaction…) →
        </a>
      </section>

      {/* Play in-browser (Internet Archive) */}
      <section className="surface-glass p-4">
        <h2 className="font-display text-lg font-semibold">▶ Play in your browser</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CATS.map((c) => (
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
        <div className="mt-2 flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSubmitted((n) => n + 1)}
            placeholder="Search a game (e.g. Pac-Man, Prince of Persia)…"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
          />
          <button
            type="button"
            onClick={() => setSubmitted((n) => n + 1)}
            className="rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2 text-sm font-medium text-white hover:bg-neon-purple/30"
          >
            Search
          </button>
        </div>

        {now && (
          <div ref={playerRef} className="mt-3 scroll-mt-3 overflow-hidden rounded-xl border border-white/10 bg-black">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <p className="min-w-0 truncate text-sm text-white">🎮 {now.title}</p>
              <div className="flex items-center gap-1.5">
                <a href={detailsUrl(now.id)} target="_blank" rel="noopener noreferrer" className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/65 hover:bg-white/10">Open ↗</a>
                <button type="button" onClick={() => setNow(null)} className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/55 hover:bg-white/10">✕ Close</button>
              </div>
            </div>
            <iframe
              key={now.id}
              src={embedUrl(now.id)}
              title={now.title}
              className="h-[70vh] w-full"
              allow="autoplay; fullscreen; gamepad; clipboard-write"
              allowFullScreen
            />
            <p className="px-3 py-1.5 text-[10px] text-white/40">
              Click the screen and press a key/coin button to start. Emulated by the Internet Archive.
            </p>
          </div>
        )}

        {err && <p className="mt-2 rounded-md bg-neon-red/10 px-3 py-1.5 text-xs text-neon-red">{err}</p>}
        {loading ? (
          <p className="px-1 py-6 text-center text-sm text-white/50">
            <span className="mr-2 animate-pulseDot">●</span>Loading {cat.label.toLowerCase()} games…
          </p>
        ) : items.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-white/50">No games found — try another category or search.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {items.map((it) => {
              const active = now?.id === it.id;
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => setNow({ id: it.id, title: it.title })}
                    className={
                      "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition " +
                      (active ? "border-neon-purple/50 bg-neon-purple/10" : "border-white/10 bg-black/20 hover:border-white/25 hover:bg-white/5")
                    }
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-white/10 text-sm">🎮</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-white/90">{it.title}</span>
                      <span className="block truncate text-[11px] text-white/40">{[it.year, it.creator].filter(Boolean).join(" · ") || "play in browser"}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[10px] leading-relaxed text-white/35">
          Games are emulated &amp; streamed from the Internet Archive (archive.org). Karochat doesn&apos;t host them; availability can vary.
        </p>
      </section>

      {/* Free game portals */}
      <section className="surface-glass p-4">
        <h2 className="font-display text-lg font-semibold">🌍 More free game sites</h2>
        <p className="mt-0.5 text-[11px] text-white/50">The biggest free online-game portals — thousands of games, opens in their own site.</p>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PORTALS.map((p) => (
            <li key={p.name}>
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 transition hover:border-neon-blue/40 hover:bg-white/5"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-white">{p.name}</span>
                  <span className="shrink-0 text-[11px] text-neon-blue">Play ↗</span>
                </span>
                <span className="mt-0.5 block text-[11px] text-white/55">{p.blurb}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] leading-relaxed text-white/35">
          Third-party game sites with their own ads, accounts &amp; terms. Karochat isn&apos;t affiliated with them — play at your own discretion.
        </p>
      </section>
    </div>
  );
}
