"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Karochat Whiteboard — MVP version.
 *
 *  • Multi-page (tap "+" to add)
 *  • Tools: pen, highlighter, eraser, text
 *  • Color picker (8 colors)
 *  • Real-time multi-cursor + draw via Supabase Realtime broadcast
 *  • Auto-save: every 5 seconds the local strokes are POSTed to
 *    whiteboard_pages.data (Postgres jsonb).
 *  • Reconnect-resilient — initial load pulls existing strokes.
 *
 * Future (already accounted for in schema): Yjs CRDT for sub-50ms latency,
 * handwriting → LaTeX OCR via Karo, voice annotations, snap-to-grid.
 */

type Tool = "pen" | "highlighter" | "eraser" | "text";

type Stroke = {
  id: string;
  tool: Tool;
  color: string;
  width: number;
  points: { x: number; y: number }[];
  text?: string;
};

const COLORS = [
  "#FFFFFF", "#37D8C2", "#5A95FF", "#FF5E78", "#FFB627",
  "#B36BFF", "#A8E6CF", "#FFD93D"
];

const TOOLS: { value: Tool; label: string; emoji: string }[] = [
  { value: "pen",          label: "Pen",         emoji: "✏️" },
  { value: "highlighter",  label: "Highlighter", emoji: "🖍" },
  { value: "eraser",       label: "Eraser",      emoji: "🩹" },
  { value: "text",         label: "Text",        emoji: "T" }
];

export function Whiteboard({
  whiteboardId,
  currentUserId
}: {
  whiteboardId: string;
  currentUserId: string;
}) {
  const supabase = createSupabaseBrowserClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#37D8C2");
  const [pages, setPages] = useState<Stroke[][]>([[]]);
  const [pageIndex, setPageIndex] = useState(0);
  const [cursors, setCursors] = useState<Record<string, { x: number; y: number; color: string }>>({});
  const drawingRef = useRef<Stroke | null>(null);
  const dirtyRef = useRef(false);

  // -------------------------------------------------------------------------
  // Load initial pages from DB
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("whiteboard_pages")
        .select("page_index, data")
        .eq("whiteboard_id", whiteboardId)
        .order("page_index", { ascending: true });
      if (cancelled) return;
      if (!data || data.length === 0) {
        setPages([[]]);
        return;
      }
      const loaded: Stroke[][] = [];
      for (const row of data) {
        loaded[row.page_index] = (row.data?.strokes ?? []) as Stroke[];
      }
      // Fill any holes with empty arrays
      for (let i = 0; i < loaded.length; i++) {
        if (!loaded[i]) loaded[i] = [];
      }
      setPages(loaded.length > 0 ? loaded : [[]]);
    })();
    return () => {
      cancelled = true;
    };
  }, [whiteboardId, supabase]);

  // -------------------------------------------------------------------------
  // Realtime broadcast — incoming strokes + cursors
  // -------------------------------------------------------------------------
  useEffect(() => {
    const channel = supabase.channel(`wb:${whiteboardId}`, {
      config: { broadcast: { self: false } }
    });
    channel
      .on("broadcast", { event: "stroke" }, ({ payload }) => {
        const { pageIndex: pi, stroke } = payload as { pageIndex: number; stroke: Stroke };
        setPages((prev) => {
          const next = prev.map((p) => p.slice());
          while (next.length <= pi) next.push([]);
          next[pi] = [...(next[pi] ?? []), stroke];
          return next;
        });
      })
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        const { userId, x, y, color: c } = payload as any;
        if (userId === currentUserId) return;
        setCursors((prev) => ({ ...prev, [userId]: { x, y, color: c } }));
      })
      .on("broadcast", { event: "clear-page" }, ({ payload }) => {
        const { pageIndex: pi } = payload as { pageIndex: number };
        setPages((prev) => prev.map((p, i) => (i === pi ? [] : p)));
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [whiteboardId, supabase, currentUserId]);

  // -------------------------------------------------------------------------
  // Auto-save (debounced 5s)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const id = setInterval(async () => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      // Upsert all pages.
      const rows = pages.map((p, i) => ({
        whiteboard_id: whiteboardId,
        page_index: i,
        data: { strokes: p },
        updated_at: new Date().toISOString()
      }));
      await supabase
        .from("whiteboard_pages")
        .upsert(rows, { onConflict: "whiteboard_id,page_index" });
      await supabase
        .from("whiteboards")
        .update({ page_count: pages.length, updated_at: new Date().toISOString() })
        .eq("id", whiteboardId);
    }, 5000);
    return () => clearInterval(id);
  }, [pages, supabase, whiteboardId]);

  // -------------------------------------------------------------------------
  // Render strokes
  // -------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const strokes = pages[pageIndex] ?? [];
    for (const s of strokes) {
      paintStroke(ctx, s);
    }
    if (drawingRef.current) paintStroke(ctx, drawingRef.current);
  }, [pages, pageIndex]);

  function paintStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
    if (s.tool === "text" && s.text) {
      ctx.fillStyle = s.color;
      ctx.font = `${s.width * 6}px ui-sans-serif, system-ui`;
      const p = s.points[0];
      if (p) ctx.fillText(s.text, p.x, p.y);
      return;
    }
    ctx.beginPath();
    ctx.strokeStyle = s.tool === "highlighter" ? s.color + "66" : s.color;
    ctx.lineWidth = s.tool === "highlighter" ? s.width * 4 : s.tool === "eraser" ? s.width * 6 : s.width;
    ctx.globalCompositeOperation = s.tool === "eraser" ? "destination-out" : "source-over";
    for (let i = 0; i < s.points.length; i++) {
      const p = s.points[i];
      if (!p) continue;
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  // -------------------------------------------------------------------------
  // Drawing handlers
  // -------------------------------------------------------------------------
  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (tool === "text") {
      const text = prompt("Text to add:");
      if (!text) return;
      const stroke: Stroke = {
        id: crypto.randomUUID(),
        tool: "text",
        color,
        width: 3,
        points: [{ x, y }],
        text
      };
      commitStroke(stroke);
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = {
      id: crypto.randomUUID(),
      tool,
      color,
      width: tool === "highlighter" ? 4 : tool === "eraser" ? 3 : 2,
      points: [{ x, y }]
    };
  }

  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Broadcast cursor for everyone, even when not drawing.
    void supabase.channel(`wb:${whiteboardId}`).send({
      type: "broadcast",
      event: "cursor",
      payload: { userId: currentUserId, x, y, color }
    });

    if (!drawingRef.current) return;
    drawingRef.current.points.push({ x, y });
    // re-render
    const ctx = canvas.getContext("2d");
    if (ctx) paintStroke(ctx, drawingRef.current);
  }

  function endDraw() {
    if (!drawingRef.current) return;
    commitStroke(drawingRef.current);
    drawingRef.current = null;
  }

  function commitStroke(stroke: Stroke) {
    setPages((prev) => {
      const next = prev.map((p) => p.slice());
      while (next.length <= pageIndex) next.push([]);
      next[pageIndex] = [...(next[pageIndex] ?? []), stroke];
      return next;
    });
    dirtyRef.current = true;
    void supabase.channel(`wb:${whiteboardId}`).send({
      type: "broadcast",
      event: "stroke",
      payload: { pageIndex, stroke }
    });
  }

  function clearPage() {
    if (!confirm("Clear this page for everyone?")) return;
    setPages((prev) => prev.map((p, i) => (i === pageIndex ? [] : p)));
    dirtyRef.current = true;
    void supabase.channel(`wb:${whiteboardId}`).send({
      type: "broadcast",
      event: "clear-page",
      payload: { pageIndex }
    });
  }

  function addPage() {
    setPages((prev) => {
      const next = [...prev, []];
      setPageIndex(next.length - 1);
      return next;
    });
    dirtyRef.current = true;
  }

  return (
    <div ref={wrapperRef} className="flex flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 pb-2">
        {TOOLS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTool(t.value)}
            className={clsx(
              "rounded-md border px-2 py-1 text-xs transition",
              tool === t.value
                ? "border-neon-blue/60 bg-neon-blue/15 text-white"
                : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10"
            )}
            title={t.label}
          >
            {t.emoji}
          </button>
        ))}
        <div className="mx-1 h-5 w-px bg-white/10" />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={clsx(
              "h-6 w-6 rounded-md border transition",
              color === c ? "border-white" : "border-white/10 hover:border-white/40"
            )}
            style={{ background: c }}
            title={c}
          />
        ))}
        <div className="mx-1 h-5 w-px bg-white/10" />
        <button
          type="button"
          onClick={clearPage}
          className="rounded-md border border-neon-red/40 bg-neon-red/10 px-2 py-1 text-xs text-neon-red hover:bg-neon-red/20"
        >
          🗑 clear page
        </button>
      </div>

      {/* Canvas */}
      <div className="relative mt-2 flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#1a1f2a]">
        <canvas
          ref={canvasRef}
          onPointerDown={startDraw}
          onPointerMove={moveDraw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
          className="absolute inset-0 h-full w-full touch-none"
        />
        {/* Cursors overlay */}
        {Object.entries(cursors).map(([uid, c]) => (
          <div
            key={uid}
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: c.x, top: c.y }}
            aria-hidden
          >
            <div
              className="h-3 w-3 rounded-full border-2 border-white"
              style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }}
            />
            <span className="absolute left-3 top-3 rounded bg-black/60 px-1 text-[9px] text-white">
              {uid.slice(0, 6)}
            </span>
          </div>
        ))}
      </div>

      {/* Page tabs */}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {pages.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setPageIndex(i)}
            className={clsx(
              "rounded-md border px-2 py-0.5 text-[11px]",
              i === pageIndex
                ? "border-neon-blue/60 bg-neon-blue/15 text-white"
                : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10"
            )}
          >
            page {i + 1}
          </button>
        ))}
        <button
          type="button"
          onClick={addPage}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70 hover:bg-white/10"
        >
          + new page
        </button>
      </div>
    </div>
  );
}
