"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useResizableHeight — Wave 18 / 19.
 *
 * Tracks a per-user, persistent width AND height for the chat section.
 * `null` for either dim means "no override — let flex fill". A number
 * means "lock this dimension".
 *
 * Resize can be initiated from any of the four edges (top, right, bottom,
 * left). The hook handles the delta-sign logic so callers just pass the
 * edge they're dragging from.
 */
const MIN_HEIGHT = 180;
const MAX_HEIGHT = 1400;
const COMPACT_HEIGHT = 260;

const MIN_WIDTH = 280;
const MAX_WIDTH = 1800;

export type SizePreset = "compact" | "normal" | "full";
export type ResizeEdge = "top" | "right" | "bottom" | "left";

type Stored = {
  px: number | null; // height lock
  wPx: number | null; // width lock
  preset: SizePreset;
};

function read(key: string): Stored {
  if (typeof window === "undefined")
    return { px: null, wPx: null, preset: "normal" };
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { px: null, wPx: null, preset: "normal" };
    const parsed = JSON.parse(raw);
    const px =
      typeof parsed?.px === "number" && Number.isFinite(parsed.px)
        ? Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, parsed.px))
        : null;
    const wPx =
      typeof parsed?.wPx === "number" && Number.isFinite(parsed.wPx)
        ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parsed.wPx))
        : null;
    const preset: SizePreset =
      parsed?.preset === "compact" || parsed?.preset === "full"
        ? parsed.preset
        : "normal";
    return { px, wPx, preset };
  } catch {
    return { px: null, wPx: null, preset: "normal" };
  }
}

function write(key: string, value: Stored) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function useResizableHeight(storageKey: string) {
  const initial = read(storageKey);
  const [px, setPx] = useState<number | null>(initial.px);
  const [wPx, setWPx] = useState<number | null>(initial.wPx);
  const [preset, setPreset] = useState<SizePreset>(initial.preset);

  const draggingRef = useRef<ResizeEdge | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startHRef = useRef(0);
  const startWRef = useRef(0);

  // Persist whenever it changes.
  useEffect(() => {
    write(storageKey, { px, wPx, preset });
  }, [storageKey, px, wPx, preset]);

  const beginDrag = useCallback(
    (
      edge: ResizeEdge,
      clientX: number,
      clientY: number,
      currentHeight: number,
      currentWidth: number
    ) => {
      draggingRef.current = edge;
      startXRef.current = clientX;
      startYRef.current = clientY;
      startHRef.current = currentHeight;
      startWRef.current = currentWidth;
      // Once the user starts dragging, the preset notion breaks.
      setPreset("normal");
      document.body.style.userSelect = "none";
      const cursor =
        edge === "left" || edge === "right" ? "col-resize" : "row-resize";
      document.body.style.cursor = cursor;
    },
    []
  );

  useEffect(() => {
    function clamp(value: number, min: number, max: number) {
      return Math.min(max, Math.max(min, value));
    }
    function onMove(e: MouseEvent | TouchEvent) {
      const edge = draggingRef.current;
      if (!edge) return;
      const clientX =
        "touches" in e
          ? (e.touches[0]?.clientX ?? startXRef.current)
          : e.clientX;
      const clientY =
        "touches" in e
          ? (e.touches[0]?.clientY ?? startYRef.current)
          : e.clientY;
      const dx = clientX - startXRef.current;
      const dy = clientY - startYRef.current;
      if (edge === "bottom") {
        setPx(clamp(startHRef.current + dy, MIN_HEIGHT, MAX_HEIGHT));
      } else if (edge === "top") {
        // Dragging the top edge DOWN should shrink the chat.
        setPx(clamp(startHRef.current - dy, MIN_HEIGHT, MAX_HEIGHT));
      } else if (edge === "right") {
        setWPx(clamp(startWRef.current + dx, MIN_WIDTH, MAX_WIDTH));
      } else if (edge === "left") {
        setWPx(clamp(startWRef.current - dx, MIN_WIDTH, MAX_WIDTH));
      }
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
    window.addEventListener("touchcancel", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchcancel", onUp);
    };
  }, []);

  const reset = useCallback(() => {
    setPx(null);
    setWPx(null);
    setPreset("normal");
  }, []);

  const compact = useCallback(() => {
    setPx(COMPACT_HEIGHT);
    setPreset("compact");
  }, []);

  const full = useCallback(() => {
    setPx(null);
    setWPx(null);
    setPreset("full");
  }, []);

  return { px, wPx, preset, beginDrag, reset, compact, full };
}

export const RESIZE_MIN = MIN_HEIGHT;
export const RESIZE_MAX = MAX_HEIGHT;
