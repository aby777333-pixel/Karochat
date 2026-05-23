"use client";

import {
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Point = { x: number; y: number };

type Stroke = {
  id: string;
  points: Point[];
  color: string;
  width: number;
  authorId: string;
};

const COLORS = [
  "#7af5d8", // neon mint
  "#7ab4ff", // neon blue
  "#bfa6ff", // neon purple
  "#ffd47a", // neon amber
  "#ff7a8a", // neon red
  "#ffffff", // white
  "#0a0a0a"  // ink (eraser-ish on light bg)
];

const WIDTHS = [2, 4, 8, 16];

/**
 * Shared whiteboard for a room. Each stroke is broadcast on the
 * `wb:<roomId>` realtime channel; everyone in the room sees the same
 * canvas in real time. State is ephemeral (in-memory) — a refresh wipes
 * the board. Persistence can be layered onto `whiteboard_pages` later if
 * needed.
 */
export function WhiteboardButton({
  roomId,
  currentUserId
}: {
  roomId: string;
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Open shared whiteboard"
        aria-label="Open shared whiteboard"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-neon-amber/40 bg-neon-amber/10 text-neon-amber transition hover:bg-neon-amber/20"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {open && typeof document !== "undefined" &&
        createPortal(
          <WhiteboardPanel
            roomId={roomId}
            currentUserId={currentUserId}
            onClose={() => setOpen(false)}
          />,
          document.body
        )}
    </>
  );
}

function WhiteboardPanel({
  roomId,
  currentUserId,
  onClose
}: {
  roomId: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef<Stroke | null>(null);

  const [color, setColor] = useState<string>(COLORS[0] ?? "#7af5d8");
  const [width, setWidth] = useState<number>(WIDTHS[1] ?? 4);
  const [eraser, setEraser] = useState(false);
  const [peers, setPeers] = useState(1);

  // Setup canvas + realtime
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    // resize-aware sizing
    function resize() {
      const ratio = window.devicePixelRatio || 1;
      const rect = wrap!.getBoundingClientRect();
      canvas!.width = Math.floor(rect.width * ratio);
      canvas!.height = Math.floor(rect.height * ratio);
      canvas!.style.width = `${rect.width}px`;
      canvas!.style.height = `${rect.height}px`;
      const ctx = canvas!.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      redraw();
    }
    resize();
    window.addEventListener("resize", resize);

    const channel = supabase.channel(`wb:${roomId}`, {
      config: { broadcast: { self: false }, presence: { key: currentUserId } }
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "stroke" }, (payload) => {
        const s = (payload as any).payload as Stroke | undefined;
        if (!s) return;
        strokesRef.current.push(s);
        drawStroke(s);
      })
      .on("broadcast", { event: "clear" }, () => {
        strokesRef.current = [];
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setPeers(Object.keys(state).length || 1);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.track({ joined_at: Date.now() });
        }
      });

    return () => {
      window.removeEventListener("resize", resize);
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, supabase, currentUserId]);

  function getPos(e: ReactMouseEvent | ReactTouchEvent): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let clientX: number;
    let clientY: number;
    if ("touches" in e) {
      const t = e.touches[0] ?? e.changedTouches?.[0];
      if (!t) return { x: 0, y: 0 };
      clientX = t.clientX;
      clientY = t.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function drawStroke(s: Stroke) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || s.points.length === 0) return;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const first = s.points[0];
    if (!first) return;
    if (s.points.length === 1) {
      ctx.beginPath();
      ctx.arc(first.x, first.y, s.width / 2, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < s.points.length; i++) {
      const pt = s.points[i];
      if (!pt) continue;
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
  }

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokesRef.current) drawStroke(s);
  }

  function pointerDown(e: ReactMouseEvent | ReactTouchEvent) {
    e.preventDefault();
    const p = getPos(e);
    drawingRef.current = {
      id: Math.random().toString(36).slice(2),
      points: [p],
      color: eraser ? "#0d1117" : color,
      width: eraser ? Math.max(width * 3, 12) : width,
      authorId: currentUserId
    };
    drawStroke(drawingRef.current);
  }

  function pointerMove(e: ReactMouseEvent | ReactTouchEvent) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const p = getPos(e);
    const last = drawingRef.current.points[drawingRef.current.points.length - 1];
    if (!last) return;
    const dx = p.x - last.x;
    const dy = p.y - last.y;
    if (dx * dx + dy * dy < 1.5) return; // throttle
    drawingRef.current.points.push(p);
    // draw just the latest segment
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = drawingRef.current.color;
    ctx.lineWidth = drawingRef.current.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function pointerUp() {
    if (!drawingRef.current) return;
    const finished = drawingRef.current;
    strokesRef.current.push(finished);
    drawingRef.current = null;
    channelRef.current?.send({
      type: "broadcast",
      event: "stroke",
      payload: finished
    });
  }

  function clearBoard() {
    strokesRef.current = [];
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    channelRef.current?.send({
      type: "broadcast",
      event: "clear",
      payload: {}
    });
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `karochat-whiteboard-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Shared whiteboard"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-ink-900/80 px-4 py-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-display text-base font-semibold text-white">
            🖼️ Whiteboard
          </span>
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/55">
            {peers} on board
          </span>
          <span className="text-[10px] text-white/40">
            shared live · ephemeral
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-1.5 py-1">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setColor(c);
                  setEraser(false);
                }}
                aria-label={`Color ${c}`}
                title={c}
                className={`h-5 w-5 rounded-full border ${
                  color === c && !eraser
                    ? "border-white"
                    : "border-white/20 hover:border-white/40"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-1.5 py-1">
            {WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWidth(w)}
                title={`Stroke ${w}px`}
                className={`grid h-6 w-6 place-items-center rounded ${
                  width === w ? "bg-white/15" : "hover:bg-white/10"
                }`}
              >
                <span
                  className="rounded-full bg-white"
                  style={{ width: w, height: w }}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setEraser((e) => !e)}
            title="Eraser"
            className={`rounded-lg border px-2 py-1 text-xs ${
              eraser
                ? "border-neon-red/40 bg-neon-red/15 text-neon-red"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            🩹 Eraser
          </button>
          <button
            type="button"
            onClick={clearBoard}
            title="Clear the whole board for everyone"
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
          >
            🧹 Clear
          </button>
          <button
            type="button"
            onClick={download}
            title="Download as PNG"
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
          >
            ⬇ PNG
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close"
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
          >
            ✕
          </button>
        </div>
      </header>

      <div ref={wrapRef} className="flex-1 bg-[#0d1117]">
        <canvas
          ref={canvasRef}
          onMouseDown={pointerDown}
          onMouseMove={pointerMove}
          onMouseUp={pointerUp}
          onMouseLeave={pointerUp}
          onTouchStart={pointerDown}
          onTouchMove={pointerMove}
          onTouchEnd={pointerUp}
          className="block h-full w-full cursor-crosshair touch-none"
        />
      </div>
    </div>
  );
}
