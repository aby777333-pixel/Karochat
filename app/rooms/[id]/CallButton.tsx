"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const CallPanel = dynamic(
  () => import("./CallPanel").then((m) => m.CallPanel),
  { ssr: false }
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

  if (available === null) return null;
  if (!available) return null;

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

      {menuOpen && (
        <div
          className="surface-glass absolute right-0 top-full z-30 mt-2 w-48 p-1.5 shadow-xl"
          onMouseLeave={() => setMenuOpen(false)}
        >
          <div className="flex items-center justify-between px-2 pb-1">
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              Call
            </p>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close"
              title="Close"
              className="rounded-md border border-white/10 bg-white/5 px-1.5 text-[10px] text-white/60 hover:bg-white/10"
            >
              ✕
            </button>
          </div>
          <button
            onClick={() => {
              setMode("audio");
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/10"
          >
            <span>📞</span> Voice call
          </button>
          <button
            onClick={() => {
              setMode("video");
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/10"
          >
            <span>📹</span> Video call
          </button>
        </div>
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
