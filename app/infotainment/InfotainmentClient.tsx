"use client";

// Karochat — Infotainment hub (client).
//
// A mobile-first entertainment hub built entirely on existing primitives:
//   • Rooms + LiveKit  → live stages, karaoke, podcasts, radio, watch parties
//   • create_room RPC  → "Go live" instantly (routes into a video broadcast)
//   • Shorts           → upload videos
//   • Room file-share  → share/upload music in music rooms
//   • Curated, real free / royalty-free sources for movies & music
//
// No popovers or floating overlays — every control is inline and stays within
// the screen at any width. Nothing here changes existing behaviour; it only
// links into features that already work.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type InfoRoom = {
  id: string;
  name: string;
  topic: string | null;
  subcategory_slug: string;
  visibility: "public" | "listed" | "unlisted" | "secret";
  voice_enabled: boolean;
  cam_enabled: boolean;
  member_count: number;
};

type GroupDef = { slug: string; label: string; emoji: string };

// Display order + labels for the room groups.
const GROUPS: GroupDef[] = [
  { slug: "info-live", label: "Live Stages & Broadcasts", emoji: "📡" },
  { slug: "info-karaoke", label: "Karaoke", emoji: "🎤" },
  { slug: "info-singalong", label: "Sing-Along", emoji: "🎶" },
  { slug: "info-duet", label: "Duet Karaoke", emoji: "👯" },
  { slug: "info-music", label: "Music & Artists", emoji: "🎵" },
  { slug: "info-podcasts", label: "Podcasts", emoji: "🎙️" },
  { slug: "info-radio", label: "Internet Radio", emoji: "📻" },
  { slug: "info-watch", label: "Watch Parties", emoji: "🍿" },
  { slug: "info-collab", label: "Music Collaboration", emoji: "🎹" },
  { slug: "info-talent", label: "Talent & Competitions", emoji: "🏆" },
  { slug: "info-creators", label: "Creators & Channels", emoji: "🎭" },
  { slug: "info-freemedia", label: "Free Movies & Music", emoji: "🎬" },
  { slug: "info-royalty", label: "Royalty-Free Media", emoji: "🆓" }
];

// Real, legal free-to-watch / public-domain sources.
const FREE_MEDIA: { name: string; desc: string; url: string }[] = [
  { name: "Internet Archive — Films", desc: "Thousands of free & public-domain movies", url: "https://archive.org/details/feature_films" },
  { name: "Internet Archive — Audio", desc: "Free music, concerts & audio (Live Music Archive)", url: "https://archive.org/details/audio" },
  { name: "Public Domain Movies", desc: "Classic films now in the public domain", url: "https://publicdomainmovie.net/" },
  { name: "Wikimedia Commons — Video", desc: "Freely licensed videos & footage", url: "https://commons.wikimedia.org/wiki/Category:Videos" },
  { name: "Musopen", desc: "Free public-domain classical recordings & sheet music", url: "https://musopen.org/" },
  { name: "Free Music Archive", desc: "Curated free-to-download music", url: "https://freemusicarchive.org/" }
];

// Real royalty-free / Creative-Commons asset libraries for creators.
const ROYALTY_FREE: { name: string; desc: string; url: string }[] = [
  { name: "Pixabay", desc: "Royalty-free music, video & SFX (no attribution)", url: "https://pixabay.com/music/" },
  { name: "Pexels Videos", desc: "Free stock video footage", url: "https://www.pexels.com/videos/" },
  { name: "ccMixter", desc: "Creative Commons music for remixing", url: "https://ccmixter.org/" },
  { name: "Incompetech", desc: "Royalty-free music by Kevin MacLeod (CC-BY)", url: "https://incompetech.com/music/" },
  { name: "Mixkit", desc: "Free music, SFX & video clips", url: "https://mixkit.co/" },
  { name: "Openverse", desc: "Search 800M+ openly-licensed media", url: "https://openverse.org/" }
];

export function InfotainmentClient({
  rooms,
  username
}: {
  rooms: InfoRoom[];
  username: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byGroup = useMemo(() => {
    const map = new Map<string, InfoRoom[]>();
    for (const r of rooms) {
      const list = map.get(r.subcategory_slug) ?? [];
      list.push(r);
      map.set(r.subcategory_slug, list);
    }
    return map;
  }, [rooms]);

  async function joinAndEnter(room: InfoRoom) {
    if (busy) return;
    setBusy(room.id);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    if (room.visibility === "public" || room.visibility === "listed") {
      const { error: rpcErr } = await supabase.rpc("join_public_room", {
        p_room_id: room.id
      });
      if (rpcErr && !rpcErr.message.toLowerCase().includes("already")) {
        setError(rpcErr.message);
        setBusy(null);
        return;
      }
    }
    router.push(`/rooms/${room.id}`);
    router.refresh();
  }

  // Go live: spin up a fresh public room (voice+cam), tag it under
  // Infotainment → Live, and drop the creator straight into a video broadcast.
  async function goLive(mode: "video" | "audio") {
    if (busy) return;
    setBusy("golive");
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const stamp = new Date().toISOString().slice(5, 16).replace("T", " ");
    const { data, error: rpcErr } = await supabase
      .rpc("create_room", {
        p_name: `🔴 ${username} Live`,
        p_description: `Live broadcast started by ${username} · ${stamp}`,
        p_visibility: "public"
      })
      .single<{ id: string }>();
    if (rpcErr || !data) {
      setError(rpcErr?.message ?? "Could not start the broadcast.");
      setBusy(null);
      return;
    }
    // Best-effort: file it under Infotainment → Live so it's discoverable.
    await supabase
      .from("rooms")
      .update({ category_slug: "infotainment", subcategory_slug: "info-live" })
      .eq("id", data.id);
    router.push(`/rooms/${data.id}?call=${mode}`);
    router.refresh();
  }

  return (
    <div className="mt-5 space-y-5">
      {/* Hero */}
      <section className="surface-glass tint-purple p-5 sm:p-7">
        <p className="text-[10px] uppercase tracking-widest text-neon-purple/70">
          🎬 Infotainment
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white sm:text-3xl">
          Watch. Listen. Sing. Go live.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          Free movies & music, karaoke and sing-alongs, podcasts, radio and
          watch parties — and anyone can go live and broadcast to KaroChat.
        </p>
      </section>

      {error && (
        <p className="rounded-md bg-neon-red/10 px-3 py-2 text-xs text-neon-red">
          {error}
        </p>
      )}

      {/* Quick actions */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => void goLive("video")}
          disabled={busy === "golive"}
          className="flex flex-col items-center gap-2 rounded-2xl border border-neon-red/40 bg-gradient-to-b from-red-500/20 to-black/40 px-2 py-4 text-center transition hover:-translate-y-0.5 hover:border-neon-red/70 disabled:opacity-60"
        >
          <span className="text-2xl">📡</span>
          <span className="text-xs font-bold text-white">
            {busy === "golive" ? "Starting…" : "Go Live"}
          </span>
        </button>
        <Link
          href="/shorts/new"
          className="flex flex-col items-center gap-2 rounded-2xl border border-white/12 bg-gradient-to-b from-zinc-700/60 to-black px-2 py-4 text-center transition hover:-translate-y-0.5 hover:border-white/25"
        >
          <span className="text-2xl">📹</span>
          <span className="text-xs font-bold text-white">Upload Video</span>
        </Link>
        <a
          href="#karaoke"
          className="flex flex-col items-center gap-2 rounded-2xl border border-white/12 bg-gradient-to-b from-zinc-700/60 to-black px-2 py-4 text-center transition hover:-translate-y-0.5 hover:border-white/25"
        >
          <span className="text-2xl">🎤</span>
          <span className="text-xs font-bold text-white">Karaoke</span>
        </a>
        <a
          href="#freemedia"
          className="flex flex-col items-center gap-2 rounded-2xl border border-white/12 bg-gradient-to-b from-zinc-700/60 to-black px-2 py-4 text-center transition hover:-translate-y-0.5 hover:border-white/25"
        >
          <span className="text-2xl">🎬</span>
          <span className="text-xs font-bold text-white">Free Media</span>
        </a>
      </section>

      {/* Go Live & Broadcast */}
      <section id="golive" className="surface-glass tint-amber scroll-mt-20 p-5">
        <h2 className="font-display text-lg font-semibold text-white">
          📡 Go live & broadcast
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-white/70">
          Start an instant live room and broadcast video or audio to anyone who
          joins. Share the room link, or use the in-room call button to ring &
          push-notify members. Bigger lobby-wide audience invites are rolling
          out next.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void goLive("video")}
            disabled={busy === "golive"}
            className="rounded-xl border border-neon-red/40 bg-neon-red/15 px-4 py-2 text-sm font-medium text-neon-red transition hover:bg-neon-red/25 disabled:opacity-60"
          >
            {busy === "golive" ? "Starting…" : "🔴 Start video broadcast"}
          </button>
          <button
            type="button"
            onClick={() => void goLive("audio")}
            disabled={busy === "golive"}
            className="rounded-xl border border-neon-blue/40 bg-neon-blue/15 px-4 py-2 text-sm font-medium text-neon-blue transition hover:bg-neon-blue/25 disabled:opacity-60"
          >
            🎙️ Start audio broadcast
          </button>
        </div>
      </section>

      {/* Upload your media */}
      <section className="surface-glass tint-blue p-5">
        <h2 className="font-display text-lg font-semibold text-white">
          ⬆️ Upload your music & videos
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-white/70">
          Post videos & shorts to your profile, or share music files directly
          in any Music or Creator room (drag a file into the chat).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/shorts/new"
            className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/85 hover:bg-white/10"
          >
            📹 Upload a video / short
          </Link>
          <a
            href="#info-music"
            className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/85 hover:bg-white/10"
          >
            🎵 Share music in a room
          </a>
        </div>
      </section>

      {/* Karaoke & live singing */}
      <div id="karaoke" className="scroll-mt-20" />
      <RoomGroup
        def={GROUPS.find((g) => g.slug === "info-karaoke")!}
        rooms={byGroup.get("info-karaoke") ?? []}
        busy={busy}
        onEnter={joinAndEnter}
      />
      <RoomGroup
        def={GROUPS.find((g) => g.slug === "info-singalong")!}
        rooms={byGroup.get("info-singalong") ?? []}
        busy={busy}
        onEnter={joinAndEnter}
      />
      <RoomGroup
        def={GROUPS.find((g) => g.slug === "info-duet")!}
        rooms={byGroup.get("info-duet") ?? []}
        busy={busy}
        onEnter={joinAndEnter}
      />

      {/* Remaining live/creator groups */}
      {["info-live", "info-podcasts", "info-radio", "info-watch", "info-music", "info-collab", "info-talent", "info-creators"].map(
        (slug) => (
          <RoomGroup
            key={slug}
            def={GROUPS.find((g) => g.slug === slug)!}
            rooms={byGroup.get(slug) ?? []}
            busy={busy}
            onEnter={joinAndEnter}
            anchorId={slug}
          />
        )
      )}

      {/* Free movies & music — real, legal sources */}
      <section id="freemedia" className="surface-glass tint-mint scroll-mt-20 p-5">
        <h2 className="font-display text-lg font-semibold text-white">
          🎬 Free movies & music
        </h2>
        <p className="mt-1 text-sm text-white/65">
          Hand-picked, legal places to watch free films and stream free music.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {FREE_MEDIA.map((m) => (
            <MediaCard key={m.url} {...m} />
          ))}
        </ul>
        <RoomGroupBare
          rooms={byGroup.get("info-freemedia") ?? []}
          busy={busy}
          onEnter={joinAndEnter}
          note="Discuss & swap finds in:"
        />
      </section>

      {/* Royalty-free media */}
      <section id="royalty" className="surface-glass tint-blue scroll-mt-20 p-5">
        <h2 className="font-display text-lg font-semibold text-white">
          🆓 Royalty-free videos & music
        </h2>
        <p className="mt-1 text-sm text-white/65">
          Free-to-use assets for your videos, streams and projects.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {ROYALTY_FREE.map((m) => (
            <MediaCard key={m.url} {...m} />
          ))}
        </ul>
        <RoomGroupBare
          rooms={byGroup.get("info-royalty") ?? []}
          busy={busy}
          onEnter={joinAndEnter}
          note="Trade resources in:"
        />
      </section>

      <p className="px-1 pb-6 text-center text-[11px] text-white/35">
        More creator tools (music studio, AI generation, monetization &
        lobby-wide live invites) are on the way.
      </p>
    </div>
  );
}

function RoomGroup({
  def,
  rooms,
  busy,
  onEnter,
  anchorId
}: {
  def: GroupDef;
  rooms: InfoRoom[];
  busy: string | null;
  onEnter: (r: InfoRoom) => void;
  anchorId?: string;
}) {
  if (rooms.length === 0) return null;
  return (
    <section
      id={anchorId}
      className="surface-glass scroll-mt-20 p-5"
    >
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold text-white">
        <span aria-hidden>{def.emoji}</span> {def.label}
        <span className="font-mono text-[11px] font-normal text-white/40">
          · {rooms.length}
        </span>
      </h2>
      <ul className="flex flex-col gap-1.5">
        {rooms.map((r) => (
          <RoomRow key={r.id} room={r} busy={busy} onEnter={onEnter} />
        ))}
      </ul>
    </section>
  );
}

function RoomGroupBare({
  rooms,
  busy,
  onEnter,
  note
}: {
  rooms: InfoRoom[];
  busy: string | null;
  onEnter: (r: InfoRoom) => void;
  note: string;
}) {
  if (rooms.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] uppercase tracking-widest text-white/40">
        {note}
      </p>
      <ul className="flex flex-col gap-1.5">
        {rooms.slice(0, 6).map((r) => (
          <RoomRow key={r.id} room={r} busy={busy} onEnter={onEnter} />
        ))}
      </ul>
    </div>
  );
}

function RoomRow({
  room,
  busy,
  onEnter
}: {
  room: InfoRoom;
  busy: string | null;
  onEnter: (r: InfoRoom) => void;
}) {
  const empty = room.member_count === 0;
  return (
    <li>
      <button
        type="button"
        onClick={() => onEnter(room)}
        disabled={busy === room.id}
        className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left transition hover:bg-white/5 disabled:opacity-60"
        title={room.topic ?? room.name}
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="break-words text-sm font-medium text-white">
              {room.name}
            </span>
            <span className="font-mono text-[11px] text-white/45">
              · {room.member_count}
            </span>
            {room.voice_enabled && (
              <span className="rounded-sm bg-neon-blue/15 px-1 text-[9px] text-neon-blue">
                🎙️
              </span>
            )}
            {room.cam_enabled && (
              <span className="rounded-sm bg-neon-amber/15 px-1 text-[9px] text-neon-amber">
                📹
              </span>
            )}
          </span>
        </span>
        <span
          className={
            "shrink-0 self-start rounded-lg border px-2.5 py-1 text-[11px] " +
            (empty
              ? "border-white/10 bg-white/5 text-white/75"
              : "border-neon-blue/30 bg-neon-blue/10 text-neon-blue")
          }
        >
          {busy === room.id ? "…" : empty ? "Be first →" : "Join →"}
        </span>
      </button>
    </li>
  );
}

function MediaCard({
  name,
  desc,
  url
}: {
  name: string;
  desc: string;
  url: string;
}) {
  return (
    <li>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-full flex-col gap-0.5 rounded-xl border border-white/10 bg-black/20 px-3 py-2 transition hover:border-white/25 hover:bg-white/5"
      >
        <span className="flex items-center gap-1 text-sm font-medium text-white">
          {name}
          <span aria-hidden className="text-white/30">↗</span>
        </span>
        <span className="text-[11px] leading-snug text-white/55">{desc}</span>
      </a>
    </li>
  );
}
