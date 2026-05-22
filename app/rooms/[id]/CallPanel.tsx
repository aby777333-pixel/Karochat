"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
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
  onClose,
  isOwner = false,
  inviteCode = null
}: {
  roomId: string;
  roomName: string;
  mode: "audio" | "video";
  onClose: () => void;
  isOwner?: boolean;
  inviteCode?: string | null;
}) {
  const [token, setToken] = useState<TokenResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Wave 19 — the call no longer covers the chat. It docks to the left
  // half on desktop; the right half remains the live chat so people can
  // keep talking while the call is up. Users can toggle "fullscreen" to
  // expand the call across the viewport.
  const [fullscreen, setFullscreen] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [ending, setEnding] = useState(false);

  // Wave 19.2 — resizable docked panel width. `null` = use the default
  // 58% / 55% class breakpoints; a number locks the panel to that pixel
  // width. Persisted per user.
  const PANEL_WIDTH_KEY = "karochat:call-panel-width";
  const PANEL_WIDTH_MIN = 320;
  const PANEL_WIDTH_MAX = 1400;
  const [panelWidth, setPanelWidth] = useState<number | null>(null);
  const panelDragRef = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PANEL_WIDTH_KEY);
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= PANEL_WIDTH_MIN && n <= PANEL_WIDTH_MAX) {
          setPanelWidth(n);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    function move(e: MouseEvent | TouchEvent) {
      const drag = panelDragRef.current;
      if (!drag) return;
      const clientX =
        "touches" in e ? (e.touches[0]?.clientX ?? drag.startX) : e.clientX;
      const next = Math.min(
        PANEL_WIDTH_MAX,
        Math.max(PANEL_WIDTH_MIN, drag.startW + (clientX - drag.startX))
      );
      setPanelWidth(next);
    }
    function up() {
      if (!panelDragRef.current) return;
      panelDragRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      try {
        if (panelWidth !== null) {
          window.localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth));
        }
      } catch {
        // ignore
      }
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchcancel", up);
    };
  }, [panelWidth]);

  function startPanelDrag(clientX: number) {
    const w = panelWidth ?? (typeof window !== "undefined" ? Math.round(window.innerWidth * 0.58) : 800);
    panelDragRef.current = { startX: clientX, startW: w };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }

  function resetPanelWidth() {
    setPanelWidth(null);
    try {
      window.localStorage.removeItem(PANEL_WIDTH_KEY);
    } catch {
      // ignore
    }
  }

  async function copyInvite() {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const url = inviteCode
      ? `${base}/rooms/${roomId}?invite=${encodeURIComponent(inviteCode)}`
      : `${base}/rooms/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 1500);
    } catch {
      // ignore
    }
  }

  async function endForEveryone() {
    if (!confirm("End the call for everyone in this room?")) return;
    setEnding(true);
    try {
      await fetch("/api/livekit/end", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId })
      });
    } catch {
      // ignore — we'll close locally anyway
    } finally {
      setEnding(false);
      onClose();
    }
  }

  useEffect(() => {
    // Mark the call as active for any global CSS that wants to react,
    // but DON'T freeze body scroll — the chat alongside us must stay
    // scrollable + interactable.
    document.documentElement.dataset.callActive = "true";
    return () => {
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

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className={clsx(
        // z-40 so chat composer popovers (z-60) can still appear above
        // the call when the user interacts with the chat on the right.
        "fixed z-40 flex justify-center",
        fullscreen
          ? "inset-0 bg-ink-900"
          : // Default dock: align the inner panel to the same max-w-6xl
            // container that the chat lives in, so the call sits in the
            // same column the chat usually does — not glued to the viewport
            // edge.
            "inset-0 px-1 py-4 md:py-6 pointer-events-none"
      )}
      role="dialog"
      aria-modal={fullscreen}
      aria-label={`${mode} call in ${roomName}`}
    >
      <div
        className={clsx(
          "relative flex w-full max-w-6xl",
          // Pull through pointer events on the call panel itself; the
          // outer wrapper is click-through everywhere else so the chat
          // sidebar stays interactive.
          !fullscreen && "pointer-events-none"
        )}
      >
        <div
          className={clsx(
            "pointer-events-auto relative flex flex-col bg-ink-900 shadow-2xl",
            fullscreen
              ? "h-full w-full"
              : // Inside the centered max-w-6xl row: take ~58% width on
                // desktop, full width on mobile. When the user has dragged
                // the right-edge handle, an inline width takes over.
                "h-full md:rounded-r-2xl md:border-r md:border-white/10",
            !fullscreen && panelWidth === null && "w-full md:w-[58%] lg:w-[55%]"
          )}
          style={
            !fullscreen && panelWidth !== null
              ? { width: panelWidth, maxWidth: "100%" }
              : undefined
          }
        >
          {!fullscreen && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize call width — drag to make wider or narrower"
              title="Drag to resize · double-click to reset"
              onMouseDown={(e) => {
                e.preventDefault();
                startPanelDrag(e.clientX);
              }}
              onTouchStart={(e) => {
                const t = e.touches[0];
                if (!t) return;
                startPanelDrag(t.clientX);
              }}
              onDoubleClick={resetPanelWidth}
              className="group/edge absolute inset-y-0 right-0 z-30 hidden w-2 cursor-col-resize touch-none transition hover:bg-neon-blue/40 md:block"
            >
              <span className="pointer-events-none absolute top-1/2 right-0 h-12 w-1.5 -translate-y-1/2 rounded-l-full bg-white/15 transition group-hover/edge:bg-neon-blue" />
            </div>
          )}
        <header className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-neon-red opacity-70 animate-pulseDot" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-red shadow-glow-red" />
            </span>
            <span className="font-mono text-xs uppercase tracking-widest text-white/60">
              {mode} call
            </span>
            <span className="text-white/40">·</span>
            <span className="truncate text-xs text-white/80">{roomName}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => void copyInvite()}
              title="Copy invite link to share with anyone"
              aria-label="Copy invite link"
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/80 hover:bg-white/10"
            >
              {copiedInvite ? "✓ Copied" : "↗ Invite"}
            </button>
            {!fullscreen && panelWidth !== null && (
              <button
                type="button"
                onClick={resetPanelWidth}
                title="Reset call panel width"
                aria-label="Reset call panel width"
                className="hidden rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-[10px] text-white/55 hover:bg-white/10 md:inline-flex"
              >
                ↔ {Math.round(panelWidth)}px · reset
              </button>
            )}
            <button
              type="button"
              onClick={() => setFullscreen((f) => !f)}
              aria-pressed={fullscreen}
              aria-label={fullscreen ? "Dock call to left" : "Expand call full-screen"}
              title={fullscreen ? "Dock to left (show chat)" : "Expand full-screen"}
              className="hidden rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/80 hover:bg-white/10 md:inline-flex"
            >
              {fullscreen ? "⇤ Dock" : "⛶ Full"}
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={() => void endForEveryone()}
                disabled={ending}
                title="End meeting for everyone (owner only)"
                aria-label="End meeting for everyone"
                className="rounded-lg border border-neon-red/40 bg-neon-red/5 px-2 py-1.5 text-xs text-neon-red/85 hover:bg-neon-red/15 disabled:opacity-50"
              >
                ⏹ End meeting
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg border border-neon-red/50 bg-neon-red/15 px-3 py-1.5 text-xs text-neon-red hover:bg-neon-red/25"
            >
              Leave call
            </button>
          </div>
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
    </div>,
    document.body
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
