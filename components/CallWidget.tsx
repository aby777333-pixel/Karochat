"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * CallWidget — Wave 18.5.
 *
 * Skype/Teams-style call card embedded inside every room. Shows:
 *  • Audio | Video tabs
 *  • A persistent "Session ID" derived from the room id (copyable)
 *  • Mic / Cam / Screen-share visual quick toggles (preference defaults
 *    surfaced into the call panel; actual mute/etc happens inside the
 *    LiveKit ControlBar once you join)
 *  • A big green "Start call" button that launches the existing
 *    CallPanel in the chosen mode
 *  • A presence ribbon showing how many people are currently in the room
 *
 * Collapsible per-room (state persisted to localStorage), so it never
 * permanently steals chat real estate.
 */

const CallPanel = dynamic(
  () => import("@/app/rooms/[id]/CallPanel").then((m) => m.CallPanel),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">
        <p className="rounded-xl border border-white/10 bg-ink-800/95 px-4 py-3 text-sm text-white/80">
          <span className="mr-2 inline-block animate-pulseDot">●</span>
          Loading call…
        </p>
      </div>
    )
  }
);

type Mode = "audio" | "video";

const COLLAPSE_KEY_PREFIX = "karochat:call-widget-collapsed:";
const PREF_KEY = "karochat:call-prefs";

type Prefs = { mic: boolean; cam: boolean; share: boolean; mode: Mode };

function readPrefs(): Prefs {
  if (typeof window === "undefined")
    return { mic: true, cam: false, share: false, mode: "audio" };
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (!raw) return { mic: true, cam: false, share: false, mode: "audio" };
    const p = JSON.parse(raw);
    return {
      mic: p?.mic !== false,
      cam: !!p?.cam,
      share: !!p?.share,
      mode: p?.mode === "video" ? "video" : "audio"
    };
  } catch {
    return { mic: true, cam: false, share: false, mode: "audio" };
  }
}

function writePrefs(p: Prefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

export function CallWidget({
  roomId,
  roomName,
  currentUserId,
  currentUsername
}: {
  roomId: string;
  roomName: string;
  currentUserId: string;
  currentUsername: string;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const collapseKey = `${COLLAPSE_KEY_PREFIX}${roomId}`;

  const [available, setAvailable] = useState<boolean | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(collapseKey) === "1";
    } catch {
      return false;
    }
  });
  const [prefs, setPrefs] = useState<Prefs>(() => readPrefs());
  const [activeMode, setActiveMode] = useState<Mode | null>(null);
  const [copied, setCopied] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);

  // Detect whether LiveKit is configured — same check the legacy CallButton
  // does. If not configured, render a disabled state rather than hiding.
  useEffect(() => {
    let alive = true;
    fetch("/api/livekit/token", { method: "GET" })
      .then((r) => r.json())
      .then((j) => alive && setAvailable(!!j.configured))
      .catch(() => alive && setAvailable(false));
    return () => {
      alive = false;
    };
  }, []);

  // Subscribe to the room presence channel so we can show "N here now".
  useEffect(() => {
    const channel = supabase.channel(`room-presence:${roomId}`, {
      config: { presence: { key: currentUserId } }
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineCount(Object.keys(state).length || 1);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: currentUserId,
            username: currentUsername,
            online_at: new Date().toISOString()
          });
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, roomId, currentUserId, currentUsername]);

  // Persist collapse state per-room so users keep their layout choice.
  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(collapseKey, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  function setMode(mode: Mode) {
    const next = { ...prefs, mode };
    setPrefs(next);
    writePrefs(next);
  }

  function togglePref(key: keyof Omit<Prefs, "mode">) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    writePrefs(next);
  }

  function startCall() {
    setActiveMode(prefs.mode);
  }

  async function copySession() {
    try {
      await navigator.clipboard.writeText(shortSession(roomId));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  // Collapsed pill — single row, click to expand.
  if (collapsed) {
    return (
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-r from-neon-blue/10 via-neon-purple/5 to-transparent px-3 py-1.5">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={false}
          className="flex flex-1 items-center gap-2 truncate rounded-md px-1 py-0.5 text-left text-[12px] text-white/80 hover:bg-white/5"
          title="Show call widget"
        >
          <span aria-hidden className="text-base">📞</span>
          <span className="truncate">
            <span className="font-medium text-neon-blue">Voice & video</span>{" "}
            <span className="text-white/45">· {onlineCount} here · tap to expand</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("audio");
            setActiveMode("audio");
          }}
          disabled={available === false}
          className="shrink-0 rounded-md border border-neon-blue/40 bg-neon-blue/10 px-2 py-0.5 text-[11px] text-neon-blue hover:bg-neon-blue/20 disabled:opacity-50"
          title="Quick voice call"
        >
          📞 call
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("video");
            setActiveMode("video");
          }}
          disabled={available === false}
          className="shrink-0 rounded-md border border-neon-purple/40 bg-neon-purple/10 px-2 py-0.5 text-[11px] text-neon-purple hover:bg-neon-purple/20 disabled:opacity-50"
          title="Quick video call"
        >
          📹 video
        </button>
        {activeMode && (
          <CallPanel
            roomId={roomId}
            roomName={roomName}
            mode={activeMode}
            onClose={() => setActiveMode(null)}
          />
        )}
      </div>
    );
  }

  // Expanded card — the Skype/Teams-style widget.
  return (
    <div className="border-b border-white/5 bg-gradient-to-br from-neon-blue/8 via-black/40 to-neon-purple/8 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-lg">📞</span>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/80">
            Voice & Video
          </p>
          <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/55">
            {onlineCount} here
          </span>
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label="Collapse call widget"
          title="Collapse"
          className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/55 hover:bg-white/10"
        >
          ▾ hide
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => setMode("audio")}
          aria-pressed={prefs.mode === "audio"}
          className={clsx(
            "rounded-lg border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest transition",
            prefs.mode === "audio"
              ? "border-neon-blue/60 bg-neon-blue/15 text-neon-blue"
              : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/80"
          )}
        >
          🎤 Voice
        </button>
        <button
          type="button"
          onClick={() => setMode("video")}
          aria-pressed={prefs.mode === "video"}
          className={clsx(
            "rounded-lg border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest transition",
            prefs.mode === "video"
              ? "border-neon-purple/60 bg-neon-purple/15 text-neon-purple"
              : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/80"
          )}
        >
          📹 Video
        </button>
      </div>

      <p className="mt-1.5 text-[11px] text-white/55">
        Start a {prefs.mode === "video" ? "video" : "voice"} call. Everyone in{" "}
        <span className="text-white/80">{roomName}</span> can hop in.
      </p>

      {/* Session ID */}
      <div className="mt-2 flex items-center justify-between rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[10px]">
        <span className="text-white/45 uppercase tracking-widest">Session</span>
        <span className="ml-2 flex min-w-0 items-center gap-1.5">
          <code className="truncate font-mono text-neon-blue">
            {shortSession(roomId)}
          </code>
          <button
            type="button"
            onClick={copySession}
            aria-label="Copy session ID"
            className="rounded border border-white/10 bg-white/5 px-1 text-[10px] text-white/65 hover:bg-white/10"
            title="Copy"
          >
            {copied ? "✓" : "⎘"}
          </button>
        </span>
      </div>

      {/* Quick-toggle controls + big green Start. */}
      <div className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => togglePref("mic")}
          aria-pressed={prefs.mic}
          aria-label="Toggle microphone on join"
          title={prefs.mic ? "Mic will be on when you join" : "Mic will be muted when you join"}
          className={clsx(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full border transition",
            prefs.mic
              ? "border-white/20 bg-white/10 text-white"
              : "border-neon-red/50 bg-neon-red/10 text-neon-red"
          )}
        >
          {prefs.mic ? "🎙" : "🔇"}
        </button>
        <button
          type="button"
          onClick={() => togglePref("cam")}
          aria-pressed={prefs.cam}
          aria-label="Toggle camera on join"
          title={prefs.cam ? "Camera will be on when you join" : "Camera will be off when you join"}
          className={clsx(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full border transition",
            prefs.cam
              ? "border-neon-purple/60 bg-neon-purple/10 text-neon-purple"
              : "border-white/20 bg-white/10 text-white/60"
          )}
        >
          {prefs.cam ? "📹" : "📷"}
        </button>
        <button
          type="button"
          onClick={startCall}
          disabled={available === false}
          aria-label={`Start ${prefs.mode} call`}
          className={clsx(
            "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-50",
            "bg-neon-mint text-ink-900 shadow-[0_0_24px_rgba(25,229,193,0.45)] hover:bg-neon-mint/90"
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="currentColor"
            aria-hidden
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92Z" />
          </svg>
          <span>Start call</span>
        </button>
        <button
          type="button"
          onClick={() => togglePref("share")}
          aria-pressed={prefs.share}
          aria-label="Plan to share screen"
          title={
            prefs.share
              ? "We'll remind you to share screen after joining"
              : "Share screen later (toggled in the call)"
          }
          className={clsx(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full border transition",
            prefs.share
              ? "border-neon-blue/60 bg-neon-blue/10 text-neon-blue"
              : "border-white/20 bg-white/10 text-white/60"
          )}
        >
          🖥
        </button>
      </div>

      {available === false && (
        <p className="mt-1.5 text-[10px] text-neon-red/85">
          Calls aren&apos;t configured on this site yet — ask the operator to
          set the LiveKit env vars.
        </p>
      )}

      {available === null && (
        <p className="mt-1.5 text-[10px] text-white/35">
          <span className="mr-1 inline-block animate-pulseDot">●</span>
          Checking call availability…
        </p>
      )}

      {activeMode && (
        <CallPanel
          roomId={roomId}
          roomName={roomName}
          mode={activeMode}
          onClose={() => setActiveMode(null)}
        />
      )}
    </div>
  );
}

function shortSession(id: string): string {
  // First chunk of the UUID + uppercase suffix — readable like a room code.
  const clean = id.replace(/-/g, "").toUpperCase();
  if (clean.length <= 12) return clean;
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
}
