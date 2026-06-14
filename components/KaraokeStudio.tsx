"use client";

// Karochat — Karaoke / Singing Studio (SMULE-style).
//
// A self-contained, mobile-first modal singers open from the 🎤 button in ANY
// room. It layers a few capabilities on top of the room's EXISTING voice call
// (LiveKit) and the EXISTING `music` storage bucket — no new backend infra:
//
//   • Sing      — backing-track player. Load a track from a local file (any
//                 common audio format), a direct URL, or share it to the whole
//                 room. Transport (play / pause / seek / volume / loop / tempo),
//                 a mic deck (pick any input device, reverb monitor so you hear
//                 yourself, and record-your-cover that mixes mic + backing), and
//                 ROOM-SYNCED playback so two or more people press play once and
//                 sing together over the same track. Voices travel over the
//                 room's voice call (📞); the backing track stays in sync here.
//   • Library   — inbuilt karaoke / world-music catalog: by region & genre
//                 worldwide, plus India state-wise.
//   • Lyrics    — paste lyrics, auto-scrolling teleprompter (speed + font).
//   • Tuner     — live mic pitch detection (note + in-tune meter).
//   • Metronome — adjustable BPM click.
//
// Room sync uses the same infra-free Supabase Realtime broadcast pattern as the
// whiteboard/typing indicators (channel only, no tables, no RLS) and only turns
// on when a roomId is supplied. Everything degrades gracefully: if a feature
// isn't available (no mic permission, browser can't record, etc.) it shows a
// note and never affects the rest of the studio or the room.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Same accept list the music uploader uses, so the studio takes everything the
// `music` bucket allows (mp3 / wav / m4a / ogg / flac / aac / webm / mp4 audio).
const AUDIO_ACCEPT =
  "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/aac,audio/mp4,audio/x-m4a,audio/flac,.mp3,.wav,.m4a,.ogg,.flac,.aac,.opus";
const MAX_UPLOAD_BYTES = 40 * 1024 * 1024; // matches the bucket's 40 MB cap

type Tab = "sing" | "library" | "lyrics" | "tuner" | "metronome";

export function KaraokeStudio({
  open,
  onClose,
  roomName,
  roomId,
  userId,
  userName
}: {
  open: boolean;
  onClose: () => void;
  roomName: string;
  // Optional — when present, playback can be synced across everyone in the room
  // and local files can be shared to the room. Omitting them keeps the studio
  // fully usable in solo mode (no behavioural change for existing callers).
  roomId?: string;
  userId?: string;
  userName?: string;
}) {
  const [tab, setTab] = useState<Tab>("sing");
  // A query the Library tab can hand to the Sing tab's "Find a backing track".
  const [findSeed, setFindSeed] = useState<string>("");

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
        className="flex h-full w-full flex-col overflow-hidden bg-ink-900/95 sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl sm:border sm:border-white/10"
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
            ["sing", "🎤 Sing"],
            ["library", "🌍 Library"],
            ["lyrics", "📜 Lyrics"],
            ["tuner", "🎯 Tuner"],
            ["metronome", "🥁 Metronome"]
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
          {tab === "sing" && (
            <SingStage
              roomName={roomName}
              roomId={roomId}
              userId={userId}
              userName={userName}
              findSeed={findSeed}
            />
          )}
          {tab === "library" && (
            <Library
              onPick={(q) => {
                setFindSeed(q);
                setTab("sing");
              }}
            />
          )}
          {tab === "lyrics" && <LyricsTeleprompter />}
          {tab === "tuner" && <VocalTuner active={tab === "tuner"} />}
          {tab === "metronome" && <Metronome />}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────
function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
}

function ytKaraoke(q: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    q.trim() + " karaoke"
  )}`;
}

function pickAudioMime(): string {
  const cands = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const c of cands) {
    try {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
        return c;
      }
    } catch {
      // ignore
    }
  }
  return "";
}

function pickVideoMime(): string {
  const cands = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4"
  ];
  for (const c of cands) {
    try {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
        return c;
      }
    } catch {
      // ignore
    }
  }
  return "";
}

// Turn a music-site link into an embeddable player URL where the site allows it
// (YouTube / Spotify / SoundCloud). Returns null for everything else so the
// caller can just open it in a new tab.
function toEmbed(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      const m = u.pathname.match(/\/(embed|shorts|live)\/([^/?]+)/);
      if (m && m[2]) return `https://www.youtube.com/embed/${m[2]}`;
    }
    if (host.endsWith("spotify.com")) {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`;
      }
    }
    if (host.endsWith("soundcloud.com")) {
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.href)}&auto_play=false`;
    }
  } catch {
    // not a URL — caller falls back to opening as a search/site
  }
  return null;
}

// ── Sing stage (player + room sync + mic deck) ───────────────────────────────
type Track = { title: string; url: string; syncable: boolean; local: boolean };

function SingStage({
  roomName,
  roomId,
  userId,
  userName,
  findSeed
}: {
  roomName: string;
  roomId?: string;
  userId?: string;
  userName?: string;
  findSeed: string;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [track, setTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [dur, setDur] = useState(0);
  const [pos, setPos] = useState(0);
  const [vol, setVol] = useState(1);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [urlInput, setUrlInput] = useState("");
  const [findQ, setFindQ] = useState("");
  const [uploading, setUploading] = useState(false);

  // Invite audience + "play a music website" extras.
  const [invited, setInvited] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // Sync is available only when a room context is present.
  const canSync = !!roomId;
  const [syncOn, setSyncOn] = useState<boolean>(!!roomId);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const controllerRef = useRef(false); // am I currently driving the room?
  const trackRef = useRef<Track | null>(null);
  trackRef.current = track;
  const rateRef = useRef(1);
  rateRef.current = rate;

  // Seed the "find a backing track" box from the Library tab.
  useEffect(() => {
    if (findSeed) setFindQ(findSeed);
  }, [findSeed]);

  // Keep the <audio> element configured from React state.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = vol;
  }, [vol]);
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.loop = loop;
  }, [loop]);
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    try {
      a.playbackRate = rate;
      // Keep pitch steady while changing tempo (great for practice) where supported.
      (a as unknown as { preservesPitch?: boolean }).preservesPitch = true;
    } catch {
      // ignore
    }
  }, [rate]);

  const broadcast = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      const ch = channelRef.current;
      if (!ch) return;
      void ch.send({ type: "broadcast", event, payload });
    },
    []
  );

  // ── Room sync channel ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !syncOn) {
      channelRef.current = null;
      return;
    }
    const channel = supabase.channel(`karaoke:${roomId}`, {
      config: { broadcast: { self: false } }
    });

    const applyLoad = (p: { url?: string; title?: string }) => {
      if (!p?.url) return;
      controllerRef.current = false;
      setTrack({ title: p.title || "Shared track", url: p.url, syncable: true, local: false });
    };
    const applyPlay = (p: { positionSec?: number; atMs?: number; rate?: number }) => {
      controllerRef.current = false;
      const a = audioRef.current;
      if (!a) return;
      const r = p.rate ?? 1;
      const target =
        (p.positionSec ?? 0) +
        (p.atMs ? Math.max(0, (Date.now() - p.atMs) / 1000) * r : 0);
      try {
        a.playbackRate = r;
      } catch {
        // ignore
      }
      try {
        if (Number.isFinite(target)) a.currentTime = Math.max(0, target);
      } catch {
        // ignore
      }
      void a.play().catch(() => {});
    };
    const applyPause = (p: { positionSec?: number }) => {
      controllerRef.current = false;
      const a = audioRef.current;
      if (!a) return;
      a.pause();
      try {
        if (typeof p.positionSec === "number") a.currentTime = Math.max(0, p.positionSec);
      } catch {
        // ignore
      }
    };
    const applySync = (p: {
      positionSec?: number;
      atMs?: number;
      rate?: number;
      playing?: boolean;
    }) => {
      if (controllerRef.current) return; // I'm the one driving — ignore others
      const a = audioRef.current;
      if (!a) return;
      const r = p.rate ?? 1;
      const target =
        (p.positionSec ?? 0) +
        (p.atMs ? Math.max(0, (Date.now() - p.atMs) / 1000) * r : 0);
      if (Number.isFinite(target) && Math.abs(a.currentTime - target) > 0.7) {
        try {
          a.currentTime = Math.max(0, target);
        } catch {
          // ignore
        }
      }
      if (p.playing && a.paused) void a.play().catch(() => {});
    };

    channel
      .on("broadcast", { event: "load" }, ({ payload }) => applyLoad(payload as any))
      .on("broadcast", { event: "play" }, ({ payload }) => applyPlay(payload as any))
      .on("broadcast", { event: "pause" }, ({ payload }) => applyPause(payload as any))
      .on("broadcast", { event: "seek" }, ({ payload }) => {
        const p = payload as any;
        applyPause({ positionSec: p.positionSec });
        if (p.playing) applyPlay({ positionSec: p.positionSec, atMs: p.atMs, rate: p.rate });
      })
      .on("broadcast", { event: "sync" }, ({ payload }) => applySync(payload as any))
      .on("broadcast", { event: "hello" }, () => {
        // A newcomer asked for the current state — only the active driver answers.
        if (!controllerRef.current) return;
        const t = trackRef.current;
        const a = audioRef.current;
        if (t?.syncable && t.url) broadcast("load", { url: t.url, title: t.title });
        if (a && t?.syncable) {
          broadcast("sync", {
            positionSec: a.currentTime,
            atMs: Date.now(),
            rate: rateRef.current,
            playing: !a.paused
          });
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") broadcast("hello", { by: userName ?? "someone" });
      });

    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [roomId, syncOn, supabase, broadcast, userName]);

  // Heartbeat — the active driver re-broadcasts position so late joiners and
  // anyone who drifted can re-align.
  useEffect(() => {
    if (!roomId || !syncOn) return;
    const iv = setInterval(() => {
      const a = audioRef.current;
      if (!a || a.paused) return;
      if (!controllerRef.current) return;
      if (!trackRef.current?.syncable) return;
      broadcast("sync", {
        positionSec: a.currentTime,
        atMs: Date.now(),
        rate: rateRef.current,
        playing: true
      });
    }, 4000);
    return () => clearInterval(iv);
  }, [roomId, syncOn, broadcast]);

  // ── Local track loaders ──────────────────────────────────────────────────
  const setObjectUrl = useCallback((url: string | null) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = url;
  }, []);

  useEffect(() => {
    // Revoke any object URL on unmount.
    return () => setObjectUrl(null);
  }, [setObjectUrl]);

  function loadFile(f: File) {
    setErr(null);
    const url = URL.createObjectURL(f);
    setObjectUrl(url);
    setTrack({
      title: f.name.replace(/\.[^.]+$/, ""),
      url,
      syncable: false,
      local: true
    });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      // Local playback has no size limit; the cap only matters for sharing.
      loadFile(f);
      setErr("Loaded locally. (Over 40 MB — too big to share to the room.)");
      return;
    }
    loadFile(f);
    e.target.value = "";
  }

  function loadUrl() {
    const u = urlInput.trim();
    if (!u) return;
    setErr(null);
    setObjectUrl(null);
    setTrack({ title: "Track from link", url: u, syncable: true, local: false });
    if (canSync && syncOn) {
      controllerRef.current = true;
      broadcast("load", { url: u, title: "Track from link" });
    }
    setUrlInput("");
  }

  // Upload the picked file to the shared `music` bucket and broadcast it so
  // everyone in the room can load the very same backing track and sync to it.
  async function shareToRoom(f: File) {
    if (!userId) {
      setErr("Sign in to share a track to the room.");
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setErr("That file is over 40 MB — too big to share. Pick a smaller MP3.");
      return;
    }
    setUploading(true);
    setErr(null);
    try {
      const ext = (f.name.split(".").pop() ?? "mp3").toLowerCase();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("music")
        .upload(path, f, { contentType: f.type || "audio/mpeg", upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("music").getPublicUrl(path);
      const url = pub.publicUrl;
      setObjectUrl(null);
      const title = f.name.replace(/\.[^.]+$/, "");
      setTrack({ title, url, syncable: true, local: false });
      if (canSync && syncOn) {
        controllerRef.current = true;
        broadcast("load", { url, title });
      }
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't share the track.");
    } finally {
      setUploading(false);
    }
  }

  // ── Transport (user-initiated → also broadcast) ──────────────────────────
  function userPlay() {
    const a = audioRef.current;
    if (!a || !track) return;
    void a.play().catch((e) => setErr(e?.message ?? "Couldn't play."));
    if (track.syncable && canSync && syncOn) {
      controllerRef.current = true;
      broadcast("play", { positionSec: a.currentTime, atMs: Date.now(), rate });
    }
  }
  function userPause() {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    if (track?.syncable && canSync && syncOn) {
      controllerRef.current = true;
      broadcast("pause", { positionSec: a.currentTime });
    }
  }
  function userSeek(t: number) {
    const a = audioRef.current;
    if (!a) return;
    try {
      a.currentTime = t;
    } catch {
      // ignore
    }
    setPos(t);
    if (track?.syncable && canSync && syncOn) {
      controllerRef.current = true;
      broadcast("seek", { positionSec: t, atMs: Date.now(), playing: !a.paused, rate });
    }
  }

  // Invite the room's audience: copy the link, try the native share sheet, and
  // drop an invite line into the room chat so people see it.
  async function inviteAudience() {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const url = roomId ? `${base}/rooms/${roomId}` : base;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "Sing with me on Karochat",
          text: `🎤 Come sing with me in ${roomName}!`,
          url
        });
      }
    } catch {
      // user dismissed the share sheet — fine
    }
    if (roomId && userId) {
      try {
        await supabase.from("messages").insert({
          sender_id: userId,
          room_id: roomId,
          content: `🎤 Karaoke time in ${roomName}! Open the voice call (📞), grab a mic and sing with me → ${url}`,
          type: "text"
        });
      } catch {
        // posting an invite is best-effort
      }
    }
    setInvited(true);
    setTimeout(() => setInvited(false), 2200);
  }

  // "Play a music website": embed YouTube / Spotify / SoundCloud inline where
  // allowed, otherwise open the site in a new tab.
  function openMusicSite(raw?: string) {
    const value = (raw ?? siteUrl).trim();
    if (!value) return;
    const embed = toEmbed(value);
    if (embed) {
      setEmbedSrc(embed);
      return;
    }
    const href =
      value.startsWith("http://") || value.startsWith("https://")
        ? value
        : `https://${value}`;
    if (typeof window !== "undefined") {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }

  const findHref = ytKaraoke(findQ.trim() || "popular song");
  const MUSIC_SITES: { label: string; href: string }[] = [
    { label: "YouTube", href: "https://www.youtube.com" },
    { label: "YouTube Music", href: "https://music.youtube.com" },
    { label: "Spotify", href: "https://open.spotify.com" },
    { label: "SoundCloud", href: "https://soundcloud.com" },
    { label: "JioSaavn", href: "https://www.jiosaavn.com" },
    { label: "Gaana", href: "https://gaana.com" },
    { label: "Wynk", href: "https://wynk.in" },
    { label: "Apple Music", href: "https://music.apple.com" }
  ];

  return (
    <div className="space-y-4">
      {/* Sing-together explainer */}
      <div className="rounded-xl border border-neon-mint/30 bg-neon-mint/5 p-3 text-[11px] leading-relaxed text-white/70">
        <p className="font-medium text-neon-mint">Sing together 🎶</p>
        <p className="mt-0.5">
          Open the room&apos;s voice call (📞) so everyone hears each other.
          Load or share a backing track below — when{" "}
          <span className="text-white/85">Sync</span> is on, one tap plays it for
          the whole room in time, and you all sing over it.
        </p>
        {roomId && (
          <button
            type="button"
            onClick={() => void inviteAudience()}
            className="mt-2 rounded-lg border border-neon-mint/40 bg-neon-mint/10 px-3 py-1.5 text-[11px] font-medium text-neon-mint transition hover:bg-neon-mint/20"
          >
            {invited ? "✓ Invite shared" : "📣 Ask audience to join"}
          </button>
        )}
      </div>

      {/* Hidden file input shared by "Load file" + "Share to room" */}
      <input
        ref={fileRef}
        type="file"
        accept={AUDIO_ACCEPT}
        className="hidden"
        onChange={onFile}
      />

      {/* Track source picker */}
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-left text-sm text-white/85 transition hover:border-neon-purple/50 hover:bg-white/5"
        >
          <span className="block font-medium text-white">🎵 Load an audio file</span>
          <span className="text-[11px] text-white/45">
            mp3 · wav · m4a · ogg · flac · aac — plays for you
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            // Re-use the same picker, but route the result to a share. We stash
            // an intent flag the change handler can't see, so instead trigger a
            // dedicated picker via a one-off listener.
            const input = document.createElement("input");
            input.type = "file";
            input.accept = AUDIO_ACCEPT;
            input.onchange = () => {
              const f = input.files?.[0];
              if (f) void shareToRoom(f);
            };
            input.click();
          }}
          disabled={!canSync || uploading}
          title={canSync ? "Upload & play for everyone in the room" : "Join a room to share"}
          className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-left text-sm text-white/85 transition hover:border-neon-mint/50 hover:bg-white/5 disabled:opacity-40"
        >
          <span className="block font-medium text-white">
            {uploading ? "📤 Sharing…" : "📤 Share a track to the room"}
          </span>
          <span className="text-[11px] text-white/45">
            Everyone loads it &amp; sings in sync
          </span>
        </button>
      </div>

      {/* URL loader */}
      <div className="flex gap-2">
        <input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") loadUrl();
          }}
          placeholder="…or paste a direct audio link (.mp3 / .m4a / .ogg)"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
        />
        <button
          type="button"
          onClick={loadUrl}
          disabled={!urlInput.trim()}
          className="shrink-0 rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-neon-purple/30 disabled:opacity-50"
        >
          Load
        </button>
      </div>

      {/* Player */}
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <audio
          ref={audioRef}
          src={track?.url}
          preload="auto"
          crossOrigin="anonymous"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
          onDurationChange={(e) => setDur(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setPos(e.currentTarget.currentTime || 0)}
          onEnded={() => setPlaying(false)}
          onError={() =>
            track ? setErr("Couldn't load that track (format or link issue).") : undefined
          }
        />

        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm text-white/85" title={track?.title}>
            {track ? track.title : "No track loaded"}
          </p>
          {track && (
            <span
              className={
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] " +
                (track.syncable
                  ? "bg-neon-mint/15 text-neon-mint"
                  : "bg-white/10 text-white/45")
              }
              title={
                track.syncable
                  ? "This track can play in sync for the whole room"
                  : "Local file — plays only on your device. Share it to sing together."
              }
            >
              {track.syncable ? "syncable" : "local only"}
            </span>
          )}
        </div>

        {/* Seek bar */}
        <div className="mt-3 flex items-center gap-2 text-[11px] text-white/55">
          <span className="w-9 text-right tabular-nums">{fmtTime(pos)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(dur, 0.1)}
            step={0.1}
            value={Math.min(pos, dur || 0)}
            onChange={(e) => userSeek(Number(e.target.value))}
            disabled={!track}
            className="min-w-0 flex-1 accent-neon-purple"
            aria-label="Seek"
          />
          <span className="w-9 tabular-nums">{fmtTime(dur)}</span>
        </div>

        {/* Transport buttons */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => (playing ? userPause() : userPlay())}
            disabled={!track}
            className="rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-neon-purple/30 disabled:opacity-50"
          >
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>
          <button
            type="button"
            onClick={() => userSeek(0)}
            disabled={!track}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-50"
            title="Restart"
          >
            ⏮
          </button>
          <button
            type="button"
            onClick={() => setLoop((l) => !l)}
            aria-pressed={loop}
            className={
              "rounded-xl border px-3 py-2 text-sm transition " +
              (loop
                ? "border-neon-amber/50 bg-neon-amber/15 text-neon-amber"
                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10")
            }
            title="Loop the track"
          >
            🔁
          </button>
          {canSync && (
            <button
              type="button"
              onClick={() => setSyncOn((s) => !s)}
              aria-pressed={syncOn}
              className={
                "rounded-xl border px-3 py-2 text-xs font-medium transition " +
                (syncOn
                  ? "border-neon-mint/50 bg-neon-mint/15 text-neon-mint"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10")
              }
              title="Play this track in time for everyone in the room"
            >
              {syncOn ? "🔗 Sync on" : "🔗 Sync off"}
            </button>
          )}
        </div>

        {/* Volume + tempo */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-1.5 text-[11px] text-white/55">
            🔊
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={vol}
              onChange={(e) => setVol(Number(e.target.value))}
              className="accent-neon-purple"
              aria-label="Volume"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-white/55">
            Tempo {rate.toFixed(2)}×
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="accent-neon-amber"
              aria-label="Tempo / slow-down"
            />
          </label>
          {rate !== 1 && (
            <button
              type="button"
              onClick={() => setRate(1)}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/55 hover:bg-white/10"
            >
              reset tempo
            </button>
          )}
        </div>
      </div>

      {err && (
        <p className="rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{err}</p>
      )}

      {/* Record deck — mic, camera, record & post */}
      <RecordDeck
        audioRef={audioRef}
        roomId={roomId}
        userId={userId}
        userName={userName}
      />

      {/* Find a backing track (YouTube fallback) */}
      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-[11px] text-white/55">
          Don&apos;t have a file? Find a karaoke / instrumental track, then record
          it or use a direct link above.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={findQ}
            onChange={(e) => setFindQ(e.target.value)}
            placeholder="Song or artist…"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
          />
          <a
            href={findHref}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/85 transition hover:border-white/25 hover:bg-white/5"
          >
            ▶ Search ↗
          </a>
        </div>
      </div>

      {/* Play a music website — embed where allowed, else open in a new tab */}
      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-[11px] text-white/55">
          Play from a music site — paste a YouTube / Spotify / SoundCloud link to
          play it here, or open any music website.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") openMusicSite();
            }}
            placeholder="Paste a music link or website…"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
          />
          <button
            type="button"
            onClick={() => openMusicSite()}
            disabled={!siteUrl.trim()}
            className="shrink-0 rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2 text-sm font-medium text-white transition hover:bg-neon-purple/30 disabled:opacity-50"
          >
            ▶ Play
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MUSIC_SITES.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-white/75 transition hover:border-white/25 hover:bg-white/5"
            >
              {s.label} ↗
            </a>
          ))}
        </div>
        {embedSrc && (
          <div className="mt-3">
            <div className="mb-1 flex justify-end">
              <button
                type="button"
                onClick={() => setEmbedSrc(null)}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/55 hover:bg-white/10"
              >
                ✕ Close player
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
              <iframe
                src={embedSrc}
                title="Music player"
                className="h-48 w-full"
                allow="autoplay; encrypted-media; clipboard-write; picture-in-picture"
                allowFullScreen
              />
            </div>
            <p className="mt-1 text-[10px] text-white/40">
              External player — its audio can&apos;t be captured in recordings; use
              it as a reference or sing-along.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Record deck — mic + camera, reverb monitor, record / auto-record, post ───
function RecordDeck({
  audioRef,
  roomId,
  userId,
  userName
}: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  roomId?: string;
  userId?: string;
  userName?: string;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [on, setOn] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [monitor, setMonitor] = useState(0); // hear-yourself volume (0 by default → no speaker feedback)
  const [reverb, setReverb] = useState(0.3);
  const [recording, setRecording] = useState(false);
  const [autoRecord, setAutoRecord] = useState(false);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [clipKind, setClipKind] = useState<"audio" | "video">("audio");
  const [err, setErr] = useState<string | null>(null);

  // Camera (small inbuilt self-view; turns recordings into video).
  const [camOn, setCamOn] = useState(false);
  const [camDevices, setCamDevices] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState<string>("");

  // Posting / sharing.
  const [posting, setPosting] = useState(false);
  const [postedUrl, setPostedUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micSrcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dryRef = useRef<GainNode | null>(null);
  const wetRef = useRef<GainNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const recDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const backingTapRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const clipUrlRef = useRef<string | null>(null);
  const clipBlobRef = useRef<Blob | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const camOnRef = useRef(false);
  camOnRef.current = camOn;

  const canRecord = typeof MediaRecorder !== "undefined";

  const setClip = useCallback((url: string | null, blob?: Blob | null) => {
    if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current);
    clipUrlRef.current = url;
    clipBlobRef.current = blob ?? null;
    setClipUrl(url);
    setPostedUrl(null);
    setNotice(null);
  }, []);

  const stopCamera = useCallback(() => {
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamOn(false);
  }, []);

  const stopMic = useCallback(() => {
    try {
      if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    } catch {
      // ignore
    }
    recRef.current = null;
    setRecording(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    micSrcRef.current = null;
    dryRef.current = null;
    wetRef.current = null;
    monitorGainRef.current = null;
    recDestRef.current = null;
    backingTapRef.current = null;
    if (ctxRef.current) {
      void ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    setOn(false);
  }, []);

  useEffect(() => {
    return () => {
      stopMic();
      stopCamera();
      setClip(null);
    };
  }, [stopMic, stopCamera, setClip]);

  // Attach the camera stream to the preview <video> once it mounts.
  useEffect(() => {
    if (camOn && videoRef.current && camStreamRef.current) {
      videoRef.current.srcObject = camStreamRef.current;
      void videoRef.current.play().catch(() => {});
    }
  }, [camOn]);

  // Reverb impulse response (decaying noise).
  function makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  // Apply dry/wet whenever reverb amount changes.
  useEffect(() => {
    if (dryRef.current) dryRef.current.gain.value = 1 - reverb * 0.5;
    if (wetRef.current) wetRef.current.gain.value = reverb;
  }, [reverb]);
  useEffect(() => {
    if (monitorGainRef.current) monitorGainRef.current.gain.value = monitor;
  }, [monitor]);

  async function startMic() {
    setErr(null);
    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId
          ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true }
          : { echoCancellation: true, noiseSuppression: true }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const AC: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      ctxRef.current = ctx;

      const src = ctx.createMediaStreamSource(stream);
      micSrcRef.current = src;

      const dry = ctx.createGain();
      dry.gain.value = 1 - reverb * 0.5;
      dryRef.current = dry;

      const convolver = ctx.createConvolver();
      convolver.buffer = makeImpulse(ctx, 2.2, 2.5);
      const wet = ctx.createGain();
      wet.gain.value = reverb;
      wetRef.current = wet;

      const monitorGain = ctx.createGain();
      monitorGain.gain.value = monitor;
      monitorGainRef.current = monitorGain;

      // mic → dry → (monitor)         and  mic → convolver → wet → (monitor)
      src.connect(dry);
      src.connect(convolver);
      convolver.connect(wet);
      dry.connect(monitorGain);
      wet.connect(monitorGain);
      monitorGain.connect(ctx.destination);

      // Recording bus (always available; only tapped when recording).
      const recDest = ctx.createMediaStreamDestination();
      recDestRef.current = recDest;
      dry.connect(recDest);
      wet.connect(recDest);

      // Populate the device list now that we have permission (labels appear).
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        setDevices(list.filter((d) => d.kind === "audioinput"));
      } catch {
        // ignore
      }

      setOn(true);
    } catch (e: any) {
      setErr(
        e?.name === "NotAllowedError"
          ? "Mic permission denied. Allow microphone access to sing."
          : "Couldn't start the microphone."
      );
      stopMic();
    }
  }

  async function startCamera() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: camId ? { deviceId: { exact: camId } } : true,
        audio: false
      });
      camStreamRef.current = stream;
      setCamOn(true);
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        setCamDevices(list.filter((d) => d.kind === "videoinput"));
      } catch {
        // ignore
      }
    } catch (e: any) {
      setErr(
        e?.name === "NotAllowedError"
          ? "Camera permission denied. Allow camera access to record video."
          : "Couldn't start the camera."
      );
      stopCamera();
    }
  }

  function startRecording() {
    setErr(null);
    const ctx = ctxRef.current;
    const recDest = recDestRef.current;
    if (!ctx || !recDest || !canRecord) {
      setErr("Turn on your mic first to record.");
      return;
    }
    try {
      // Tap the backing track into the recording bus so the cover includes it.
      const a = audioRef.current as (HTMLAudioElement & { captureStream?: () => MediaStream }) | null;
      if (a && typeof a.captureStream === "function" && !backingTapRef.current) {
        try {
          const bstream = a.captureStream();
          if (bstream.getAudioTracks().length) {
            const bsrc = ctx.createMediaStreamSource(bstream);
            bsrc.connect(recDest);
            backingTapRef.current = bsrc;
          }
        } catch {
          // backing tap failed (e.g. cross-origin) — record the vocal only
        }
      }

      // Video if the camera is on, else audio only.
      const useVideo =
        camOnRef.current &&
        !!camStreamRef.current &&
        camStreamRef.current.getVideoTracks().length > 0;
      const kind: "audio" | "video" = useVideo ? "video" : "audio";
      const stream = useVideo
        ? new MediaStream([
            ...(camStreamRef.current as MediaStream).getVideoTracks(),
            ...recDest.stream.getAudioTracks()
          ])
        : recDest.stream;
      const mime = useVideo ? pickVideoMime() : pickAudioMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mime || (useVideo ? "video/webm" : "audio/webm")
        });
        setClipKind(kind);
        setClip(URL.createObjectURL(blob), blob);
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't start recording.");
    }
  }

  function stopRecording() {
    try {
      recRef.current?.stop();
    } catch {
      // ignore
    }
    recRef.current = null;
    setRecording(false);
  }

  // Auto-record: arm to the backing player's play/pause/ended.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !autoRecord || !on) return;
    const onPlay = () => {
      if (ctxRef.current && !recRef.current) startRecording();
    };
    const onStop = () => {
      if (recRef.current) stopRecording();
    };
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onStop);
    a.addEventListener("ended", onStop);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onStop);
      a.removeEventListener("ended", onStop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRecord, on]);

  // ── posting / sharing ──────────────────────────────────────────────────────
  function flash(msg: string) {
    setNotice(msg);
  }

  async function postToMusic() {
    const blob = clipBlobRef.current;
    if (!blob) return;
    if (!userId) {
      setErr("Sign in to post your cover.");
      return;
    }
    if (blob.size > 40 * 1024 * 1024) {
      setErr("That take is over 40 MB — record a shorter one to post to Music.");
      return;
    }
    setPosting(true);
    setErr(null);
    try {
      const ext = (blob.type || "").includes("mp4") ? "m4a" : "webm";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("music")
        .upload(path, blob, { contentType: blob.type || "audio/webm", upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("music").getPublicUrl(path);
      const { error: insErr } = await supabase.from("tracks").insert({
        owner_id: userId,
        audio_url: pub.publicUrl,
        title: `Karaoke cover · ${new Date().toLocaleDateString()}`,
        artist: userName || null,
        is_public: true
      });
      if (insErr) throw insErr;
      setPostedUrl(pub.publicUrl);
      flash("✓ Posted to Music — find it in Live & Karaoke music.");
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't post to Music.");
    } finally {
      setPosting(false);
    }
  }

  async function postToShorts() {
    const blob = clipBlobRef.current;
    if (!blob) return;
    if (!userId) {
      setErr("Sign in to post your cover.");
      return;
    }
    if (blob.size > 50 * 1024 * 1024) {
      setErr("That clip is over 50 MB — record a shorter one to post to Shorts.");
      return;
    }
    setPosting(true);
    setErr(null);
    try {
      const baseMime = (blob.type || "video/webm").split(";")[0] || "video/webm";
      const ext = baseMime.includes("mp4") ? "mp4" : "webm";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("shorts")
        .upload(path, blob, { contentType: baseMime, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("shorts").getPublicUrl(path);
      const { error: insErr } = await supabase.from("shorts").insert({
        author_id: userId,
        video_url: pub.publicUrl,
        caption: "🎤 Karaoke cover",
        is_public: true
      });
      if (insErr) throw insErr;
      setPostedUrl(pub.publicUrl);
      flash("✓ Posted to Shorts — find it in the Shorts feed.");
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't post to Shorts.");
    } finally {
      setPosting(false);
    }
  }

  async function shareToChat() {
    const blob = clipBlobRef.current;
    if (!blob) return;
    if (!roomId || !userId) {
      setErr("Join a room & sign in to share to the chat.");
      return;
    }
    if (blob.size > 50 * 1024 * 1024) {
      setErr("That take is over 50 MB — too big to share to the chat.");
      return;
    }
    setPosting(true);
    setErr(null);
    try {
      const baseMime =
        (blob.type || (clipKind === "video" ? "video/webm" : "audio/webm")).split(";")[0] ||
        "audio/webm";
      const ext = baseMime.includes("mp4")
        ? clipKind === "video"
          ? "mp4"
          : "m4a"
        : "webm";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-files")
        .upload(path, blob, { contentType: baseMime, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("chat-files").getPublicUrl(path);
      const { error: insErr } = await supabase.from("messages").insert({
        sender_id: userId,
        room_id: roomId,
        content: "🎤 My karaoke cover",
        file_url: pub.publicUrl,
        file_name: `karaoke-cover.${ext}`,
        file_size: blob.size,
        file_mime: baseMime,
        type: "file"
      });
      if (insErr) throw insErr;
      flash("✓ Shared to the room chat.");
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't share to the chat.");
    } finally {
      setPosting(false);
    }
  }

  async function shareLink() {
    if (!postedUrl) return;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "My karaoke cover", url: postedUrl });
        return;
      }
    } catch {
      // fall through to copy
    }
    try {
      await navigator.clipboard.writeText(postedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  }

  const downloadExt =
    clipKind === "video"
      ? (clipBlobRef.current?.type || "").includes("mp4")
        ? "mp4"
        : "webm"
      : (clipBlobRef.current?.type || "").includes("mp4")
      ? "m4a"
      : "webm";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-white">🎙️ Mic &amp; camera</p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => (camOn ? stopCamera() : void startCamera())}
            className={
              "rounded-xl px-3 py-1.5 text-xs font-medium transition " +
              (camOn
                ? "border border-neon-blue/50 bg-neon-blue/15 text-neon-blue hover:bg-neon-blue/25"
                : "border border-white/15 bg-white/5 text-white/85 hover:bg-white/10")
            }
            title="Small inbuilt camera — turn recordings into video"
          >
            {camOn ? "📷 Camera on" : "📷 Camera"}
          </button>
          <button
            type="button"
            onClick={() => (on ? stopMic() : void startMic())}
            className={
              "rounded-xl px-3 py-1.5 text-xs font-medium transition " +
              (on
                ? "border border-neon-red/40 bg-neon-red/15 text-neon-red hover:bg-neon-red/25"
                : "border border-neon-mint/40 bg-neon-mint/15 text-neon-mint hover:bg-neon-mint/25")
            }
          >
            {on ? "■ Stop mic" : "🎤 Turn on mic"}
          </button>
        </div>
      </div>

      {/* Camera self-view */}
      {camOn && (
        <div className="mt-3 space-y-2">
          <div className="relative inline-block overflow-hidden rounded-xl border border-white/10 bg-black">
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className="h-28 w-40 object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            {recording && (
              <span className="absolute left-1.5 top-1.5 rounded-full bg-neon-red/80 px-1.5 py-0.5 text-[9px] font-medium text-white">
                ● REC
              </span>
            )}
          </div>
          {camDevices.length > 1 && (
            <select
              value={camId}
              onChange={(e) => {
                setCamId(e.target.value);
                stopCamera();
                setTimeout(() => void startCamera(), 60);
              }}
              className="block w-full max-w-[16rem] rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white/85 outline-none focus:border-neon-blue/60"
            >
              <option value="">Default camera</option>
              {camDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "Camera"}
                </option>
              ))}
            </select>
          )}
          <p className="text-[10px] text-white/40">
            Want to see each other? Open the room&apos;s video call (📞) — this is
            your own preview, captured into video recordings.
          </p>
        </div>
      )}

      {on && (
        <div className="mt-3 space-y-3">
          {devices.length > 1 && (
            <label className="block text-[11px] text-white/55">
              Input device
              <select
                value={deviceId}
                onChange={(e) => {
                  setDeviceId(e.target.value);
                  // Re-open with the new device.
                  stopMic();
                  setTimeout(() => void startMic(), 60);
                }}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white/85 outline-none focus:border-neon-mint/60"
              >
                <option value="">Default microphone</option>
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || "Microphone"}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-1.5 text-[11px] text-white/55">
              Hear myself
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={monitor}
                onChange={(e) => setMonitor(Number(e.target.value))}
                className="accent-neon-mint"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-white/55">
              Reverb
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={reverb}
                onChange={(e) => setReverb(Number(e.target.value))}
                className="accent-neon-purple"
              />
            </label>
          </div>
          {monitor > 0 && (
            <p className="text-[10px] text-white/40">
              🎧 Use headphones — monitoring through speakers can echo into the call.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => (recording ? stopRecording() : startRecording())}
              disabled={!canRecord}
              className={
                "rounded-xl px-3 py-1.5 text-xs font-medium transition " +
                (recording
                  ? "border border-neon-red/50 bg-neon-red/20 text-neon-red hover:bg-neon-red/30"
                  : "border border-white/15 bg-white/5 text-white/85 hover:bg-white/10") +
                (canRecord ? "" : " opacity-40")
              }
              title="Record your cover (camera + mic + backing track)"
            >
              {recording
                ? "■ Stop recording"
                : camOn
                ? "⏺ Record video"
                : "⏺ Record cover"}
            </button>
            {recording && <span className="text-[11px] text-neon-red">● recording…</span>}
            <label className="flex items-center gap-1.5 text-[11px] text-white/55">
              <input
                type="checkbox"
                checked={autoRecord}
                onChange={(e) => setAutoRecord(e.target.checked)}
                className="accent-neon-red"
              />
              Auto-record when the track plays
            </label>
          </div>

          {clipUrl && (
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">
              <p className="mb-1 text-[11px] text-white/55">
                Your take {clipKind === "video" ? "(video)" : "(audio)"}:
              </p>
              {clipKind === "video" ? (
                <video src={clipUrl} controls playsInline className="w-full rounded-lg" />
              ) : (
                <audio src={clipUrl} controls className="w-full" />
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={clipUrl}
                  download={`karochat-cover.${downloadExt}`}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/85 hover:bg-white/10"
                >
                  ⬇ Download
                </a>
                {clipKind === "video" ? (
                  <button
                    type="button"
                    onClick={() => void postToShorts()}
                    disabled={posting}
                    className="rounded-lg border border-neon-purple/40 bg-neon-purple/15 px-3 py-1 text-[11px] text-white hover:bg-neon-purple/25 disabled:opacity-50"
                  >
                    🎬 Post to Shorts
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void postToMusic()}
                    disabled={posting}
                    className="rounded-lg border border-neon-mint/40 bg-neon-mint/15 px-3 py-1 text-[11px] text-neon-mint hover:bg-neon-mint/25 disabled:opacity-50"
                  >
                    🎵 Post to Music
                  </button>
                )}
                {roomId && (
                  <button
                    type="button"
                    onClick={() => void shareToChat()}
                    disabled={posting}
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/85 hover:bg-white/10 disabled:opacity-50"
                  >
                    💬 Share to room
                  </button>
                )}
                {postedUrl && (
                  <button
                    type="button"
                    onClick={() => void shareLink()}
                    className="rounded-lg border border-neon-blue/40 bg-neon-blue/10 px-3 py-1 text-[11px] text-neon-blue hover:bg-neon-blue/20"
                  >
                    {copied ? "✓ Link copied" : "🔗 Share link"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setClip(null)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60 hover:bg-white/10"
                >
                  Discard
                </button>
              </div>
              {posting && (
                <p className="mt-1 text-[10px] text-white/45">Uploading…</p>
              )}
              {notice && <p className="mt-1 text-[10px] text-neon-mint">{notice}</p>}
            </div>
          )}
        </div>
      )}

      {err && (
        <p className="mt-2 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{err}</p>
      )}
    </div>
  );
}

// ── Library — inbuilt world + India state-wise catalog ───────────────────────
const WORLD_LIBRARY: { region: string; items: string[] }[] = [
  {
    region: "🇮🇳 India — popular",
    items: [
      "Bollywood Hindi",
      "Punjabi Bhangra",
      "Tamil",
      "Telugu",
      "Malayalam",
      "Kannada",
      "Marathi",
      "Bengali",
      "Gujarati",
      "Bhojpuri",
      "Indian devotional bhajan",
      "Ghazal"
    ]
  },
  {
    region: "🌏 Asia",
    items: [
      "K-Pop Korean",
      "J-Pop Japanese",
      "Mandarin C-Pop",
      "Cantonese",
      "Thai",
      "Vietnamese",
      "Indonesian",
      "Filipino OPM"
    ]
  },
  {
    region: "🕌 Middle East & Africa",
    items: [
      "Arabic",
      "Turkish",
      "Persian Farsi",
      "Hebrew",
      "Afrobeats Nigerian",
      "Amapiano South African",
      "Ethiopian",
      "North African Rai"
    ]
  },
  {
    region: "🌎 Americas",
    items: [
      "English Pop",
      "Country",
      "Hip-Hop / Rap",
      "R&B / Soul",
      "Gospel",
      "Latin Reggaeton",
      "Spanish Pop",
      "Brazilian Bossa & Samba",
      "Mariachi"
    ]
  },
  {
    region: "🇪🇺 Europe",
    items: [
      "French Chanson",
      "Italian",
      "German Schlager",
      "Spanish Flamenco",
      "Russian",
      "Greek",
      "Portuguese Fado",
      "Celtic / Irish"
    ]
  },
  {
    region: "🎸 Genres & eras",
    items: [
      "Rock classics",
      "80s",
      "90s",
      "2000s",
      "Jazz standards",
      "Blues",
      "Reggae",
      "EDM",
      "Acoustic / Unplugged",
      "Disney & musicals"
    ]
  }
];

const INDIA_STATES: { state: string; style: string }[] = [
  { state: "Andhra Pradesh", style: "Telugu" },
  { state: "Arunachal Pradesh", style: "folk" },
  { state: "Assam", style: "Bihu / Assamese" },
  { state: "Bihar", style: "Bhojpuri / Maithili" },
  { state: "Chhattisgarh", style: "Chhattisgarhi folk" },
  { state: "Goa", style: "Konkani" },
  { state: "Gujarat", style: "Garba / Dandiya" },
  { state: "Haryana", style: "Haryanvi" },
  { state: "Himachal Pradesh", style: "Pahari folk" },
  { state: "Jharkhand", style: "Nagpuri / Jhumar" },
  { state: "Karnataka", style: "Kannada" },
  { state: "Kerala", style: "Malayalam / Mappila" },
  { state: "Madhya Pradesh", style: "folk" },
  { state: "Maharashtra", style: "Marathi / Lavani" },
  { state: "Manipur", style: "Manipuri" },
  { state: "Meghalaya", style: "Khasi folk" },
  { state: "Mizoram", style: "Mizo" },
  { state: "Nagaland", style: "Naga folk" },
  { state: "Odisha", style: "Odia" },
  { state: "Punjab", style: "Punjabi / Bhangra" },
  { state: "Rajasthan", style: "Rajasthani folk" },
  { state: "Sikkim", style: "Nepali / Sikkimese" },
  { state: "Tamil Nadu", style: "Tamil" },
  { state: "Telangana", style: "Telugu / folk" },
  { state: "Tripura", style: "Tripuri folk" },
  { state: "Uttar Pradesh", style: "Hindi / Bhojpuri" },
  { state: "Uttarakhand", style: "Garhwali / Kumaoni" },
  { state: "West Bengal", style: "Bengali / Rabindra Sangeet" },
  { state: "Jammu & Kashmir", style: "Kashmiri" }
];

function Library({ onPick }: { onPick: (q: string) => void }) {
  const [q, setQ] = useState("");

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/60">
        Pick a style to find karaoke / instrumental backing tracks. Tap{" "}
        <span className="text-white/80">Find</span> to search in the Sing tab, or
        open it on YouTube. Then load a link or record over it in{" "}
        <span className="text-white/80">🎤 Sing</span>.
      </p>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q.trim()) onPick(q.trim());
          }}
          placeholder="Search any song, artist or language…"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
        />
        <button
          type="button"
          onClick={() => q.trim() && onPick(q.trim())}
          disabled={!q.trim()}
          className="shrink-0 rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-neon-purple/30 disabled:opacity-50"
        >
          Find
        </button>
      </div>

      {WORLD_LIBRARY.map((group) => (
        <div key={group.region}>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-white/45">
            {group.region}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.items.map((item) => (
              <LibChip key={item} label={item} query={`${item} songs`} onPick={onPick} />
            ))}
          </div>
        </div>
      ))}

      <div>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-white/45">
          🇮🇳 India — state by state
        </p>
        <div className="flex flex-wrap gap-2">
          {INDIA_STATES.map((s) => (
            <LibChip
              key={s.state}
              label={s.state}
              sub={s.style}
              query={`${s.state} ${s.style} songs`}
              onPick={onPick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function LibChip({
  label,
  sub,
  query,
  onPick
}: {
  label: string;
  sub?: string;
  query: string;
  onPick: (q: string) => void;
}) {
  return (
    <span className="inline-flex items-stretch overflow-hidden rounded-lg border border-white/10 bg-black/20 text-xs">
      <button
        type="button"
        onClick={() => onPick(query)}
        className="px-2.5 py-1.5 text-left text-white/85 transition hover:bg-white/10"
        title={`Find ${label} backing tracks`}
      >
        {label}
        {sub && <span className="ml-1 text-white/40">· {sub}</span>}
      </button>
      <a
        href={ytKaraoke(query)}
        target="_blank"
        rel="noopener noreferrer"
        className="grid place-items-center border-l border-white/10 px-2 text-white/45 transition hover:bg-white/10 hover:text-white/80"
        title="Open on YouTube"
        aria-label={`Open ${label} on YouTube`}
      >
        ↗
      </a>
    </span>
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
