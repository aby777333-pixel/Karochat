"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useResizableHeight — Wave 18.
 *
 * Tracks a per-user, persistent "diminished" height (in CSS pixels) for the
 * chat scroller. `null` means "no override — let flex-1 fill". A number
 * means "lock the scroller to this many pixels".
 *
 * Persisted to localStorage so a refresh / room switch keeps the user's
 * preferred compact height.
 */
const MIN_HEIGHT = 140;
const MAX_HEIGHT = 1400;

export type SizePreset = "compact" | "normal" | "full";

type Stored = {
  px: number | null;
  preset: SizePreset;
};

function read(key: string): Stored {
  if (typeof window === "undefined") return { px: null, preset: "normal" };
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { px: null, preset: "normal" };
    const parsed = JSON.parse(raw);
    const px =
      typeof parsed?.px === "number" && Number.isFinite(parsed.px)
        ? Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, parsed.px))
        : null;
    const preset: SizePreset =
      parsed?.preset === "compact" || parsed?.preset === "full"
        ? parsed.preset
        : "normal";
    return { px, preset };
  } catch {
    return { px: null, preset: "normal" };
  }
}

function write(key: string, value: Stored) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage can be disabled — ignore.
  }
}

export function useResizableHeight(storageKey: string) {
  const initial = read(storageKey);
  const [px, setPx] = useState<number | null>(initial.px);
  const [preset, setPreset] = useState<SizePreset>(initial.preset);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startPxRef = useRef(0);
  const targetRef = useRef<HTMLElement | null>(null);

  // Persist whenever it changes.
  useEffect(() => {
    write(storageKey, { px, preset });
  }, [storageKey, px, preset]);

  const beginDrag = useCallback(
    (clientY: number, currentHeight: number, target: HTMLElement | null) => {
      draggingRef.current = true;
      startYRef.current = clientY;
      startPxRef.current = currentHeight;
      targetRef.current = target;
      // Once the user starts dragging the handle the preset notion breaks —
      // they're choosing a custom height.
      setPreset("normal");
      document.body.style.userSelect = "none";
      document.body.style.cursor = "row-resize";
    },
    []
  );

  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      if (!draggingRef.current) return;
      const clientY =
        "touches" in e ? (e.touches[0]?.clientY ?? startYRef.current) : e.clientY;
      const delta = clientY - startYRef.current;
      const next = Math.min(
        MAX_HEIGHT,
        Math.max(MIN_HEIGHT, startPxRef.current + delta)
      );
      setPx(next);
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
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
    setPreset("normal");
  }, []);

  const compact = useCallback(() => {
    setPx(MIN_HEIGHT);
    setPreset("compact");
  }, []);

  const full = useCallback(() => {
    setPx(null);
    setPreset("full");
  }, []);

  return { px, preset, beginDrag, reset, compact, full };
}

export const RESIZE_MIN = MIN_HEIGHT;
export const RESIZE_MAX = MAX_HEIGHT;
