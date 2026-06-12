"use client";

import { useEffect, useRef, useState } from "react";

/**
 * GifPicker — Wave 18.
 *
 * Searches Tenor's public API (no API key required for unauthenticated
 * trending requests via the v1 anonymous endpoint). The legacy
 * `g.tenor.com/v1/search` endpoint accepts a public client_key plus a
 * 30-result limit. If the call fails (rate-limit, network, etc.) we fall
 * back to a curated reaction grid so the feature still works offline.
 */
const TENOR_KEY = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ"; // public web key, harmless
const TENOR_CLIENT = "karochat";

type Gif = { id: string; url: string; preview: string; alt: string };

const FALLBACK: Gif[] = [
  { id: "f1", url: "https://media.giphy.com/media/3ohc1f6kQjEqzZ8O7C/giphy.gif", preview: "https://media.giphy.com/media/3ohc1f6kQjEqzZ8O7C/200w.gif", alt: "thumbs up" },
  { id: "f2", url: "https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif", preview: "https://media.giphy.com/media/26u4cqiYI30juCOGY/200w.gif", alt: "applause" },
  { id: "f3", url: "https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif", preview: "https://media.giphy.com/media/l0HlBO7eyXzSZkJri/200w.gif", alt: "fire" },
  { id: "f4", url: "https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif", preview: "https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/200w.gif", alt: "love it" }
];

export function GifPicker({
  onPick,
  onClose
}: {
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(true);
  const [usedFallback, setUsedFallback] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [onClose]);

  // Search/trending fetch — debounced 250ms.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const endpoint = query.trim()
          ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query.trim())}&key=${TENOR_KEY}&client_key=${TENOR_CLIENT}&limit=24&media_filter=gif`
          : `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&client_key=${TENOR_CLIENT}&limit=24&media_filter=gif`;
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`tenor ${res.status}`);
        const json = await res.json();
        const parsed: Gif[] = (json.results ?? []).map((r: any) => {
          const url = r?.media_formats?.gif?.url ?? r?.media_formats?.mediumgif?.url;
          const preview =
            r?.media_formats?.tinygif?.url ??
            r?.media_formats?.nanogif?.url ??
            url;
          return {
            id: String(r.id),
            url,
            preview,
            alt: String(r.content_description ?? r.title ?? "GIF")
          };
        }).filter((g: Gif) => g.url && g.preview);
        if (cancelled) return;
        if (parsed.length === 0) throw new Error("empty");
        setGifs(parsed);
        setUsedFallback(false);
      } catch {
        if (cancelled) return;
        setGifs(FALLBACK);
        setUsedFallback(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="GIF picker"
      className="fixed inset-x-3 bottom-28 z-[60] mx-auto w-auto max-w-[340px] rounded-xl border border-white/10 bg-ink-800/95 p-2 shadow-xl backdrop-blur sm:absolute sm:inset-x-auto sm:bottom-12 sm:left-0 sm:mx-0 sm:w-[320px] sm:max-w-none"
    >
      <div className="flex items-center gap-2 px-1 pb-1.5">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Tenor GIFs…"
          className="flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none placeholder:text-white/30 focus:border-neon-blue/50"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close GIF picker"
          className="rounded-md border border-white/10 bg-white/5 px-1.5 text-[10px] text-white/60 hover:bg-white/10"
        >
          ✕
        </button>
      </div>
      {loading && (
        <p className="px-2 py-3 text-center text-[11px] text-white/40">
          Loading GIFs…
        </p>
      )}
      {!loading && (
        <>
          {usedFallback && (
            <p className="px-2 pb-1 text-[10px] text-white/40">
              Search unavailable — showing reactions.
            </p>
          )}
          <div className="grid max-h-72 grid-cols-2 gap-1 overflow-y-auto">
            {gifs.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onPick(g.url)}
                className="overflow-hidden rounded-md border border-white/5 transition hover:border-neon-blue/50"
                aria-label={`Send GIF: ${g.alt}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.preview}
                  alt={g.alt}
                  className="block h-28 w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
            {gifs.length === 0 && (
              <p className="col-span-2 px-2 py-4 text-center text-[11px] text-white/40">
                No GIFs matched.
              </p>
            )}
          </div>
        </>
      )}
      <p className="mt-1 px-1 text-[9px] text-white/30">
        Powered by Tenor · GIFs are public images.
      </p>
    </div>
  );
}
