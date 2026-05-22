"use client";

import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
  GridLayout,
  ParticipantTile,
  useTracks,
  useDataChannel,
  useLocalParticipant,
  useParticipants
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

  // While the call panel is mounted, freeze the body scroll behind it so
  // the chat doesn't peek/scroll under the call.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.dataset.callActive = "true";
    return () => {
      document.body.style.overflow = prevOverflow;
      delete document.documentElement.dataset.callActive;
    };
  }, []);

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
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink-900"
      role="dialog"
      aria-modal="true"
      aria-label={`${mode} call in ${roomName}`}
    >
      <div className="relative flex h-full w-full max-w-6xl flex-col bg-ink-900">
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
              className="relative flex flex-1 flex-col"
            >
              {mode === "video" ? <VideoConference /> : <AudioRoom />}
              <CallExtras />
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
        {/* Wave 18 — screen share now allowed in audio calls (Teams-style). */}
        <ControlBar
          controls={{ camera: false, microphone: true, screenShare: true, leave: true }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CallExtras — Wave 18.
//
// Floating overlay layered on top of the call surface. Provides Teams/Skype-
// flavored extras that work in both audio and video modes:
//   • Raise hand (toggle, broadcast over data channel)
//   • Reactions strip (👏 ❤️ 🔥 😂) that floats briefly for everyone
//   • Hand-up roster
// ---------------------------------------------------------------------------
type ReactionPing = { id: string; emoji: string; name: string };
type RaiseEvent = { kind: "raise" | "lower"; participant: string };

const REACTIONS = ["👏", "❤️", "🔥", "😂", "🎉", "🙌"];

function CallExtras() {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [pings, setPings] = useState<ReactionPing[]>([]);
  const [hands, setHands] = useState<Set<string>>(new Set());
  const [meRaised, setMeRaised] = useState(false);

  // Reactions data channel.
  const { send: sendReaction } = useDataChannel(
    "karochat-reactions",
    (msg) => {
      try {
        const decoded = new TextDecoder().decode(msg.payload);
        const parsed = JSON.parse(decoded) as { emoji: string; name: string };
        if (!parsed?.emoji) return;
        const ping: ReactionPing = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          emoji: parsed.emoji,
          name: parsed.name ?? "someone"
        };
        setPings((prev) => [...prev, ping]);
        setTimeout(() => {
          setPings((prev) => prev.filter((p) => p.id !== ping.id));
        }, 2800);
      } catch {
        // bad payload — ignore
      }
    }
  );

  // Raise-hand data channel.
  const { send: sendHand } = useDataChannel(
    "karochat-raise",
    (msg) => {
      try {
        const decoded = new TextDecoder().decode(msg.payload);
        const parsed = JSON.parse(decoded) as RaiseEvent;
        if (!parsed?.participant) return;
        setHands((prev) => {
          const next = new Set(prev);
          if (parsed.kind === "raise") next.add(parsed.participant);
          else next.delete(parsed.participant);
          return next;
        });
      } catch {
        // ignore
      }
    }
  );

  function react(emoji: string) {
    const name =
      (localParticipant?.name as string | undefined) ??
      (localParticipant?.identity as string | undefined) ??
      "someone";
    const payload = new TextEncoder().encode(JSON.stringify({ emoji, name }));
    void sendReaction(payload, { reliable: false });
    // Show locally too.
    const ping: ReactionPing = {
      id: `${Date.now()}-self`,
      emoji,
      name: "you"
    };
    setPings((prev) => [...prev, ping]);
    setTimeout(() => {
      setPings((prev) => prev.filter((p) => p.id !== ping.id));
    }, 2800);
  }

  function toggleHand() {
    const name =
      (localParticipant?.name as string | undefined) ??
      (localParticipant?.identity as string | undefined) ??
      "someone";
    const next = !meRaised;
    setMeRaised(next);
    setHands((prev) => {
      const s = new Set(prev);
      if (next) s.add(name);
      else s.delete(name);
      return s;
    });
    const payload = new TextEncoder().encode(
      JSON.stringify({ kind: next ? "raise" : "lower", participant: name })
    );
    void sendHand(payload, { reliable: true });
  }

  // Resolve names for hand-up roster against current participants.
  const handList = Array.from(hands);

  return (
    <>
      {/* Hand-up roster (top-right) */}
      {handList.length > 0 && (
        <div className="pointer-events-none absolute right-4 top-4 z-10 rounded-xl border border-neon-amber/40 bg-neon-amber/10 px-3 py-1.5 text-xs text-neon-amber backdrop-blur">
          <p className="text-[10px] uppercase tracking-widest opacity-80">
            ✋ raised
          </p>
          <p>{handList.slice(0, 4).join(", ")}{handList.length > 4 ? ` +${handList.length - 4}` : ""}</p>
        </div>
      )}

      {/* Floating reaction pings */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex flex-col items-center gap-1"
        aria-live="polite"
      >
        {pings.slice(-6).map((p) => (
          <div
            key={p.id}
            className="rounded-full border border-white/15 bg-black/60 px-3 py-1 text-sm text-white shadow-lg animate-rise"
          >
            <span className="mr-1.5 text-base">{p.emoji}</span>
            <span className="text-white/75">{p.name}</span>
          </div>
        ))}
      </div>

      {/* Bottom toolbar (above the ControlBar) */}
      <div className="absolute inset-x-0 bottom-16 z-10 flex items-center justify-center gap-1.5 px-4 pb-1 md:bottom-20">
        <button
          type="button"
          onClick={toggleHand}
          aria-pressed={meRaised}
          className={
            (meRaised
              ? "border-neon-amber/60 bg-neon-amber/20 text-neon-amber"
              : "border-white/15 bg-black/40 text-white/85 hover:bg-white/10") +
            " rounded-full border px-2.5 py-1 text-xs backdrop-blur"
          }
          title={meRaised ? "Lower hand" : "Raise hand"}
        >
          {meRaised ? "✋ raised" : "✋ raise hand"}
        </button>
        {REACTIONS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => react(e)}
            className="rounded-full border border-white/15 bg-black/40 px-2 py-1 text-base text-white backdrop-blur transition hover:scale-110 hover:bg-white/10"
            aria-label={`Send ${e}`}
            title={`Send ${e}`}
          >
            {e}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void requestPictureInPicture()}
          className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-xs text-white/85 backdrop-blur hover:bg-white/10"
          aria-label="Picture-in-picture"
          title="Picture-in-picture"
        >
          🪟 PiP
        </button>
        <span className="ml-1 hidden text-[10px] text-white/40 md:inline">
          · {participants.length} in call
        </span>
      </div>
    </>
  );
}

async function requestPictureInPicture() {
  // Find the first <video> rendered by LiveKit (participant tiles).
  // Browsers without document.pictureInPictureEnabled will silently fail.
  if (typeof document === "undefined") return;
  if (!(document as any).pictureInPictureEnabled) {
    alert("Picture-in-picture isn't supported in this browser.");
    return;
  }
  const videos = Array.from(document.querySelectorAll("video"));
  // Pick the largest visible video element with a srcObject (a live track).
  const candidate = videos
    .filter((v) => (v as HTMLVideoElement).srcObject)
    .sort(
      (a, b) =>
        (b as HTMLVideoElement).getBoundingClientRect().width -
        (a as HTMLVideoElement).getBoundingClientRect().width
    )[0] as HTMLVideoElement | undefined;
  if (!candidate) {
    alert("No video stream is active to pop out yet.");
    return;
  }
  try {
    if ((document as any).pictureInPictureElement) {
      await (document as any).exitPictureInPicture();
    } else {
      await candidate.requestPictureInPicture();
    }
  } catch (e) {
    console.warn("[call] PiP failed", e);
  }
}
