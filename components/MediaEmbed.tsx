"use client";

import { useState } from "react";

/**
 * MediaEmbed — Wave 19.5.
 *
 * Detects YouTube and Spotify URLs inside a text message and renders a
 * lightweight clickable preview card. First click swaps to the real
 * embed iframe (so we don't load every iframe on initial render).
 */

type ParsedMedia =
  | { kind: "youtube"; id: string; url: string }
  | { kind: "spotify"; type: "track" | "album" | "playlist" | "episode" | "show"; id: string; url: string };

const YT_PATTERNS: RegExp[] = [
  /https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?[^\s]*?v=([A-Za-z0-9_-]{11})/i,
  /https?:\/\/youtu\.be\/([A-Za-z0-9_-]{11})/i,
  /https?:\/\/music\.youtube\.com\/watch\?[^\s]*?v=([A-Za-z0-9_-]{11})/i
];

const SPOTIFY_PATTERN =
  /https?:\/\/open\.spotify\.com\/(track|album|playlist|episode|show)\/([A-Za-z0-9]+)/i;

export function detectMedia(content: string | null | undefined): ParsedMedia | null {
  if (!content) return null;
  for (const re of YT_PATTERNS) {
    const m = content.match(re);
    if (m && m[1]) {
      return { kind: "youtube", id: m[1], url: m[0] };
    }
  }
  const sm = content.match(SPOTIFY_PATTERN);
  if (sm && sm[1] && sm[2]) {
    return {
      kind: "spotify",
      type: sm[1].toLowerCase() as ParsedMedia extends { kind: "spotify"; type: infer T } ? T : never,
      id: sm[2],
      url: sm[0]
    };
  }
  return null;
}

export function MediaEmbed({ media }: { media: ParsedMedia }) {
  const [playing, setPlaying] = useState(false);

  if (media.kind === "youtube") {
    const thumb = `https://i.ytimg.com/vi/${media.id}/hqdefault.jpg`;
    if (playing) {
      return (
        <div className="mt-1.5 aspect-video w-full max-w-md overflow-hidden rounded-xl border border-white/10">
          <iframe
            src={`https://www.youtube.com/embed/${media.id}?autoplay=1`}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
            loading="lazy"
          />
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        aria-label="Play YouTube video"
        className="group/embed mt-1.5 relative block aspect-video w-full max-w-md overflow-hidden rounded-xl border border-white/10"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt="YouTube thumbnail"
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center bg-black/30 transition group-hover/embed:bg-black/15"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/95 text-2xl text-ink-900 shadow-lg transition group-hover/embed:scale-110">
            ▶
          </span>
        </span>
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-white/80">
          YouTube
        </span>
      </button>
    );
  }

  // Spotify — height varies by type.
  const h =
    media.type === "track" || media.type === "episode" ? 152 : 380;
  return (
    <div className="mt-1.5 w-full max-w-md overflow-hidden rounded-xl border border-white/10">
      <iframe
        src={`https://open.spotify.com/embed/${media.type}/${media.id}?utm_source=karochat`}
        title="Spotify embed"
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        className="w-full"
        style={{ height: h }}
      />
    </div>
  );
}
