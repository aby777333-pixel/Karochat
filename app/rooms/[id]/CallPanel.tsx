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
  // Wave 19 — the call no longer covers the chat. Three placement modes:
  //   "dock"       — default, glued to the left half of the chat column
  //   "float"      — free-floating draggable window, sits anywhere on screen
  //   "fullscreen" — covers the whole viewport
  type Mode = "dock" | "float" | "fullscreen";
  const POS_KEY = "karochat:call-panel-pos";
  const [placement, setPlacement] = useState<Mode>("dock");
  const fullscreen = placement === "fullscreen";
  const [floatPos, setFloatPos] = useState<{ x: number; y: number } | null>(null);
  const headerDragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [ending, setEnding] = useState(false);

  // Wave 19.2 / 19.6 — resizable docked panel from any of the four edges.
  // Width and height are independent: `null` means "use the default
  // breakpoints"; a number locks that dimension to a pixel value. Both
  // are persisted per user.
  const PANEL_SIZE_KEY = "karochat:call-panel-size";
  const PANEL_W_MIN = 320;
  const PANEL_W_MAX = 1800;
  const PANEL_H_MIN = 280;
  const PANEL_H_MAX = 1400;
  type PanelEdge = "top" | "right" | "bottom" | "left";
  const [panelWidth, setPanelWidth] = useState<number | null>(null);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const panelDragRef = useRef<{
    edge: PanelEdge;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PANEL_SIZE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const w = typeof parsed?.w === "number" ? parsed.w : null;
      const h = typeof parsed?.h === "number" ? parsed.h : null;
      if (w !== null && Number.isFinite(w) && w >= PANEL_W_MIN && w <= PANEL_W_MAX) {
        setPanelWidth(w);
      }
      if (h !== null && Number.isFinite(h) && h >= PANEL_H_MIN && h <= PANEL_H_MAX) {
        setPanelHeight(h);
      }
    } catch {
      // ignore
    }
    // Load float placement + position too.
    try {
      const raw = window.localStorage.getItem(POS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (
        parsed?.mode === "float" &&
        typeof parsed?.x === "number" &&
        typeof parsed?.y === "number"
      ) {
        setPlacement("float");
        setFloatPos({ x: parsed.x, y: parsed.y });
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist placement + position whenever they change.
  useEffect(() => {
    try {
      if (placement === "float" && floatPos) {
        window.localStorage.setItem(
          POS_KEY,
          JSON.stringify({ mode: "float", x: floatPos.x, y: floatPos.y })
        );
      } else if (placement === "dock") {
        window.localStorage.removeItem(POS_KEY);
      }
    } catch {
      // ignore
    }
  }, [placement, floatPos]);

  // Drag-the-header handlers — only active in float mode.
  useEffect(() => {
    function move(e: MouseEvent | TouchEvent) {
      const drag = headerDragRef.current;
      if (!drag) return;
      const clientX =
        "touches" in e ? (e.touches[0]?.clientX ?? drag.startX) : e.clientX;
      const clientY =
        "touches" in e ? (e.touches[0]?.clientY ?? drag.startY) : e.clientY;
      const nextX = drag.startPosX + (clientX - drag.startX);
      const nextY = drag.startPosY + (clientY - drag.startY);
      // Keep the panel mostly on-screen — leave at least 80px of header visible.
      const w = panelWidth ?? 700;
      const maxX = (typeof window !== "undefined" ? window.innerWidth : 1200) - 80;
      const minX = 80 - w;
      const maxY = (typeof window !== "undefined" ? window.innerHeight : 800) - 40;
      setFloatPos({
        x: Math.min(maxX, Math.max(minX, nextX)),
        y: Math.min(maxY, Math.max(0, nextY))
      });
    }
    function up() {
      if (!headerDragRef.current) return;
      headerDragRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
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

  function startHeaderDrag(clientX: number, clientY: number) {
    if (placement !== "float") return;
    const pos = floatPos ?? { x: 60, y: 60 };
    headerDragRef.current = {
      startX: clientX,
      startY: clientY,
      startPosX: pos.x,
      startPosY: pos.y
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  }

  function enterFloatMode() {
    // Initial float position — center-ish of the viewport.
    if (typeof window === "undefined") return;
    const w = panelWidth ?? 640;
    const h = panelHeight ?? 480;
    const x = Math.max(20, Math.round((window.innerWidth - w) / 2));
    const y = Math.max(20, Math.round((window.innerHeight - h) / 3));
    setFloatPos({ x, y });
    setPlacement("float");
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PANEL_SIZE_KEY,
        JSON.stringify({ w: panelWidth, h: panelHeight })
      );
    } catch {
      // ignore
    }
  }, [panelWidth, panelHeight]);

  useEffect(() => {
    function clamp(v: number, lo: number, hi: number) {
      return Math.min(hi, Math.max(lo, v));
    }
    function move(e: MouseEvent | TouchEvent) {
      const drag = panelDragRef.current;
      if (!drag) return;
      const clientX =
        "touches" in e ? (e.touches[0]?.clientX ?? drag.startX) : e.clientX;
      const clientY =
        "touches" in e ? (e.touches[0]?.clientY ?? drag.startY) : e.clientY;
      const dx = clientX - drag.startX;
      const dy = clientY - drag.startY;
      if (drag.edge === "right") {
        setPanelWidth(clamp(drag.startW + dx, PANEL_W_MIN, PANEL_W_MAX));
      } else if (drag.edge === "left") {
        setPanelWidth(clamp(drag.startW - dx, PANEL_W_MIN, PANEL_W_MAX));
      } else if (drag.edge === "bottom") {
        setPanelHeight(clamp(drag.startH + dy, PANEL_H_MIN, PANEL_H_MAX));
      } else if (drag.edge === "top") {
        setPanelHeight(clamp(drag.startH - dy, PANEL_H_MIN, PANEL_H_MAX));
      }
    }
    function up() {
      if (!panelDragRef.current) return;
      panelDragRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
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
  }, []);

  function startPanelDrag(edge: PanelEdge, clientX: number, clientY: number) {
    const rect = innerRef.current?.getBoundingClientRect();
    const w = panelWidth ?? rect?.width ?? Math.round((typeof window !== "undefined" ? window.innerWidth : 1200) * 0.58);
    const h = panelHeight ?? rect?.height ?? (typeof window !== "undefined" ? window.innerHeight - 96 : 720);
    panelDragRef.current = { edge, startX: clientX, startY: clientY, startW: w, startH: h };
    document.body.style.userSelect = "none";
    document.body.style.cursor =
      edge === "left" || edge === "right" ? "col-resize" : "row-resize";
  }

  function resetPanelSize() {
    setPanelWidth(null);
    setPanelHeight(null);
    try {
      window.localStorage.removeItem(PANEL_SIZE_KEY);
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
  const isFloat = placement === "float";
  return createPortal(
    <div
      className={clsx(
        // z-40 so chat composer popovers (z-60) can still appear above
        // the call when the user interacts with the chat on the right.
        "fixed z-40",
        fullscreen
          ? "inset-0 flex justify-center bg-ink-900"
          : isFloat
          ? // Float mode: invisible wrapper covering the viewport. The
            // inner panel is positioned absolutely at floatPos and is the
            // only thing that catches clicks.
            "inset-0 pointer-events-none"
          : // Dock mode: align the inner panel to the same max-w-6xl
            // container that the chat lives in.
            "inset-0 flex justify-center px-1 py-4 md:py-6 pointer-events-none"
      )}
      role="dialog"
      aria-modal={fullscreen}
      aria-label={`${mode} call in ${roomName}`}
    >
      <div
        className={clsx(
          "relative flex w-full",
          fullscreen && "max-w-none",
          !fullscreen && !isFloat && "max-w-6xl pointer-events-none",
          isFloat && "h-0 w-0 pointer-events-none"
        )}
      >
        <div
          ref={innerRef}
          className={clsx(
            "pointer-events-auto relative flex flex-col bg-ink-900 shadow-2xl",
            fullscreen
              ? "h-full w-full"
              : "md:rounded-2xl md:border md:border-white/10",
            !fullscreen && !isFloat && panelWidth === null && "w-full md:w-[58%] lg:w-[55%]",
            !fullscreen && !isFloat && panelHeight === null && "h-full",
            isFloat && "fixed rounded-2xl border border-white/15"
          )}
          style={
            fullscreen
              ? undefined
              : isFloat
              ? {
                  top: floatPos?.y ?? 60,
                  left: floatPos?.x ?? 60,
                  width: panelWidth ?? 640,
                  height: panelHeight ?? 480
                }
              : {
                  ...(panelWidth !== null
                    ? { width: panelWidth, maxWidth: "100%" }
                    : {}),
                  ...(panelHeight !== null
                    ? { height: panelHeight, maxHeight: "100%" }
                    : {})
                }
          }
        >
          {!fullscreen && (
            <>
              {/* RIGHT edge — make wider/narrower from the right */}
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize call from right edge"
                title="Drag to resize · double-click to reset"
                onMouseDown={(e) => {
                  e.preventDefault();
                  startPanelDrag("right", e.clientX, e.clientY);
                }}
                onTouchStart={(e) => {
                  const t = e.touches[0];
                  if (!t) return;
                  startPanelDrag("right", t.clientX, t.clientY);
                }}
                onDoubleClick={resetPanelSize}
                className="group/edge absolute inset-y-0 right-0 z-30 hidden w-2 cursor-col-resize touch-none transition hover:bg-neon-blue/40 md:block"
              >
                <span className="pointer-events-none absolute top-1/2 right-0 h-12 w-1.5 -translate-y-1/2 rounded-l-full bg-white/15 transition group-hover/edge:bg-neon-blue" />
              </div>
              {/* LEFT edge — make wider/narrower from the left */}
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize call from left edge"
                title="Drag to resize · double-click to reset"
                onMouseDown={(e) => {
                  e.preventDefault();
                  startPanelDrag("left", e.clientX, e.clientY);
                }}
                onTouchStart={(e) => {
                  const t = e.touches[0];
                  if (!t) return;
                  startPanelDrag("left", t.clientX, t.clientY);
                }}
                onDoubleClick={resetPanelSize}
                className="group/edge absolute inset-y-0 left-0 z-30 hidden w-2 cursor-col-resize touch-none transition hover:bg-neon-blue/40 md:block"
              >
                <span className="pointer-events-none absolute top-1/2 left-0 h-12 w-1.5 -translate-y-1/2 rounded-r-full bg-white/15 transition group-hover/edge:bg-neon-blue" />
              </div>
              {/* TOP edge — shorter/taller from the top */}
              <div
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize call from top edge"
                title="Drag to resize · double-click to reset"
                onMouseDown={(e) => {
                  e.preventDefault();
                  startPanelDrag("top", e.clientX, e.clientY);
                }}
                onTouchStart={(e) => {
                  const t = e.touches[0];
                  if (!t) return;
                  startPanelDrag("top", t.clientX, t.clientY);
                }}
                onDoubleClick={resetPanelSize}
                className="group/edge absolute inset-x-0 top-0 z-30 hidden h-2 cursor-row-resize touch-none transition hover:bg-neon-blue/40 md:block"
              >
                <span className="pointer-events-none absolute left-1/2 top-0 h-1.5 w-12 -translate-x-1/2 rounded-b-full bg-white/15 transition group-hover/edge:bg-neon-blue" />
              </div>
              {/* BOTTOM edge — shorter/taller from the bottom */}
              <div
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize call from bottom edge"
                title="Drag to resize · double-click to reset"
                onMouseDown={(e) => {
                  e.preventDefault();
                  startPanelDrag("bottom", e.clientX, e.clientY);
                }}
                onTouchStart={(e) => {
                  const t = e.touches[0];
                  if (!t) return;
                  startPanelDrag("bottom", t.clientX, t.clientY);
                }}
                onDoubleClick={resetPanelSize}
                className="group/edge absolute inset-x-0 bottom-0 z-30 hidden h-2 cursor-row-resize touch-none transition hover:bg-neon-blue/40 md:block"
              >
                <span className="pointer-events-none absolute left-1/2 bottom-0 h-1.5 w-12 -translate-x-1/2 rounded-t-full bg-white/15 transition group-hover/edge:bg-neon-blue" />
              </div>
            </>
          )}
        <header
          onMouseDown={(e) => {
            if (!isFloat) return;
            // Don't start a drag when clicking a button inside the header.
            if ((e.target as HTMLElement).closest("button")) return;
            e.preventDefault();
            startHeaderDrag(e.clientX, e.clientY);
          }}
          onTouchStart={(e) => {
            if (!isFloat) return;
            if ((e.target as HTMLElement).closest("button")) return;
            const t = e.touches[0];
            if (!t) return;
            startHeaderDrag(t.clientX, t.clientY);
          }}
          className={clsx(
            "flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2",
            isFloat && "cursor-grab active:cursor-grabbing select-none"
          )}
        >
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
            {!fullscreen && (panelWidth !== null || panelHeight !== null) && (
              <button
                type="button"
                onClick={resetPanelSize}
                title="Reset call panel size"
                aria-label="Reset call panel size"
                className="hidden rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-[10px] text-white/55 hover:bg-white/10 md:inline-flex"
              >
                ⤡ {panelWidth !== null ? `${Math.round(panelWidth)}w` : "auto"} ·{" "}
                {panelHeight !== null ? `${Math.round(panelHeight)}h` : "auto"} · reset
              </button>
            )}
            {/* Three placement modes, picked side-by-side. */}
            <div className="hidden items-center rounded-lg border border-white/10 bg-white/5 p-0.5 md:inline-flex">
              <button
                type="button"
                onClick={() => setPlacement("dock")}
                aria-pressed={placement === "dock"}
                title="Dock to the left of the chat"
                className={clsx(
                  "rounded-md px-2 py-1 text-[11px] transition",
                  placement === "dock"
                    ? "bg-neon-blue/20 text-neon-blue"
                    : "text-white/65 hover:bg-white/10"
                )}
              >
                ⇤ Dock
              </button>
              <button
                type="button"
                onClick={() => (placement === "float" ? setPlacement("dock") : enterFloatMode())}
                aria-pressed={placement === "float"}
                title="Float — drag this call anywhere on screen"
                className={clsx(
                  "rounded-md px-2 py-1 text-[11px] transition",
                  placement === "float"
                    ? "bg-neon-blue/20 text-neon-blue"
                    : "text-white/65 hover:bg-white/10"
                )}
              >
                🪟 Float
              </button>
              <button
                type="button"
                onClick={() => setPlacement(placement === "fullscreen" ? "dock" : "fullscreen")}
                aria-pressed={fullscreen}
                title="Expand full-screen"
                className={clsx(
                  "rounded-md px-2 py-1 text-[11px] transition",
                  fullscreen
                    ? "bg-neon-blue/20 text-neon-blue"
                    : "text-white/65 hover:bg-white/10"
                )}
              >
                ⛶ Full
              </button>
            </div>
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

      {/* Bottom toolbar (above the ControlBar). Allow wrapping so it never
         clips at narrow widths -- on a thin call panel the reactions
         simply wrap to a second row. */}
      <div className="absolute inset-x-0 bottom-16 z-10 flex flex-wrap items-center justify-center gap-1 px-2 pb-1 md:bottom-20 md:gap-1.5 md:px-4">
        <button
          type="button"
          onClick={toggleHand}
          aria-pressed={meRaised}
          className={
            (meRaised
              ? "border-neon-amber/60 bg-neon-amber/20 text-neon-amber"
              : "border-white/15 bg-black/50 text-white/85 hover:bg-white/10") +
            " rounded-full border px-2 py-0.5 text-[11px] backdrop-blur md:px-2.5 md:py-1"
          }
          title={meRaised ? "Lower hand" : "Raise hand"}
        >
          ✋ <span className="hidden md:inline">{meRaised ? "raised" : "raise hand"}</span>
        </button>
        {REACTIONS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => react(e)}
            className="rounded-full border border-white/15 bg-black/50 px-1.5 py-0.5 text-sm text-white backdrop-blur transition hover:scale-110 hover:bg-white/10 md:px-2 md:py-1 md:text-base"
            aria-label={`Send ${e}`}
            title={`Send ${e}`}
          >
            {e}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void requestPictureInPicture()}
          className="rounded-full border border-white/15 bg-black/50 px-2 py-0.5 text-[11px] text-white/85 backdrop-blur hover:bg-white/10 md:px-2.5 md:py-1"
          aria-label="Picture-in-picture"
          title="Picture-in-picture"
        >
          🪟 <span className="hidden md:inline">PiP</span>
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
