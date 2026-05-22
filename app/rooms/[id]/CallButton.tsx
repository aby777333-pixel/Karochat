"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";

const CallPanel = dynamic(
  () => import("./CallPanel").then((m) => m.CallPanel),
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

export function CallButton({
  roomId,
  roomName
}: {
  roomId: string;
  roomName: string;
}) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"audio" | "video" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/livekit/token", { method: "GET" })
      .then((r) => r.json())
      .then((j) => {
        if (alive) setAvailable(!!j.configured);
      })
      .catch(() => alive && setAvailable(false));
    return () => {
      alive = false;
    };
  }, []);

  // ESC closes the call mode picker.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Show a disabled placeholder if the upstream isn't configured, instead of
  // hiding silently — that way users know calls exist and why this one's off.
  if (available === null) return null;
  if (!available) {
    return (
      <button
        type="button"
        disabled
        title="Calls aren't configured on this site yet."
        aria-label="Calls unavailable"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/30"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92Z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={menuOpen}
        title="Start a call"
        aria-label="Start a call"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-neon-blue/40 bg-neon-blue/10 text-neon-blue transition hover:bg-neon-blue/20"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92Z"/>
        </svg>
      </button>

      {menuOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMenuOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="call-mode-title"
            className="surface-glass my-auto w-[min(360px,92vw)] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Back"
                  title="Back"
                  className="mt-0.5 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/60 hover:bg-white/10"
                >
                  ←
                </button>
                <div className="min-w-0">
                  <p
                    id="call-mode-title"
                    className="font-display text-base font-semibold"
                  >
                    Start a call in {roomName}
                  </p>
                  <p className="mt-0.5 text-xs text-white/55">
                    Pick voice or video. Others in the room can join in.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close"
                title="Close (Esc)"
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/60 hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setMode("audio");
                  setMenuOpen(false);
                }}
                className="flex flex-col items-center gap-1 rounded-xl border border-neon-blue/40 bg-neon-blue/10 px-4 py-4 text-sm text-neon-blue hover:bg-neon-blue/20"
              >
                <span aria-hidden className="text-2xl">📞</span>
                <span>Voice call</span>
              </button>
              <button
                onClick={() => {
                  setMode("video");
                  setMenuOpen(false);
                }}
                className="flex flex-col items-center gap-1 rounded-xl border border-neon-purple/40 bg-neon-purple/10 px-4 py-4 text-sm text-neon-purple hover:bg-neon-purple/20"
              >
                <span aria-hidden className="text-2xl">📹</span>
                <span>Video call</span>
              </button>
            </div>

            {launchError && (
              <p className="mt-3 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">
                {launchError}
              </p>
            )}
          </div>
        </div>,
        document.body
      )}

      {mode && (
        <CallPanel
          roomId={roomId}
          roomName={roomName}
          mode={mode}
          onClose={() => setMode(null)}
        />
      )}
    </div>
  );
}
