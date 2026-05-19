"use client";

import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
  GridLayout,
  ParticipantTile,
  useTracks
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";

type TokenResp = { token: string; url: string; room: string };

export function CallPanel({
  roomId,
  roomName,
  mode,
  onClose
}: {
  roomId: string;
  roomName: string;
  mode: "audio" | "video";
  onClose: () => void;
}) {
  const [token, setToken] = useState<TokenResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ roomId })
        });
        if (!alive) return;
        if (res.status === 503) {
          setError(
            "Calls aren't configured on this site yet. Ask the operator to set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET."
          );
          return;
        }
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j?.error ?? `failed (${res.status})`);
          return;
        }
        const j = await res.json();
        if (!alive) return;
        setToken(j);
      } catch (e: any) {
        if (alive) setError(e?.message ?? "request failed");
      }
    })();
    return () => {
      alive = false;
    };
  }, [roomId]);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative flex h-full w-full max-w-6xl flex-col bg-ink-900 md:m-6 md:rounded-2xl md:border md:border-white/10">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-neon-red opacity-70 animate-pulseDot" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-red shadow-glow-red" />
            </span>
            <span className="font-mono text-xs uppercase tracking-widest text-white/60">
              {mode} call
            </span>
            <span className="text-white/40">·</span>
            <span className="truncate">{roomName}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
          >
            Leave call
          </button>
        </header>

        <div className="flex flex-1 flex-col overflow-hidden">
          {error && (
            <div className="m-6 rounded-xl border border-neon-red/40 bg-neon-red/10 p-4 text-sm text-neon-red">
              {error}
            </div>
          )}

          {!token && !error && (
            <div className="flex flex-1 items-center justify-center text-sm text-white/50">
              <span className="mr-2 animate-pulseDot">●</span>Connecting…
            </div>
          )}

          {token && (
            <LiveKitRoom
              token={token.token}
              serverUrl={token.url}
              connect
              audio
              video={mode === "video"}
              onDisconnected={onClose}
              data-lk-theme="default"
              className="flex flex-1 flex-col"
            >
              {mode === "video" ? (
                <VideoConference />
              ) : (
                <AudioRoom />
              )}
              <RoomAudioRenderer />
            </LiveKitRoom>
          )}
        </div>
      </div>
    </div>
  );
}

function AudioRoom() {
  // Audio-only layout: tiles with mic activity, no camera feeds, full ControlBar.
  const tracks = useTracks(
    [
      { source: Track.Source.Microphone, withPlaceholder: true }
    ],
    { onlySubscribed: false }
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-auto p-4">
        <GridLayout tracks={tracks} style={{ height: "100%" }}>
          <ParticipantTile />
        </GridLayout>
      </div>
      <div className="border-t border-white/10 bg-black/40 p-2">
        <ControlBar
          controls={{ camera: false, microphone: true, screenShare: false, leave: true }}
        />
      </div>
    </div>
  );
}
