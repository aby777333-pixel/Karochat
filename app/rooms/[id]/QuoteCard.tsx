"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Theme = "dark" | "polaroid" | "neon";

const THEMES: { id: Theme; label: string; emoji: string }[] = [
  { id: "dark",     label: "Dark serif", emoji: "🌑" },
  { id: "polaroid", label: "Polaroid",   emoji: "📸" },
  { id: "neon",     label: "Neon",       emoji: "💿" }
];

/**
 * v5 V10 starter — pull-quote / share receipt for a single message.
 * Renders a styled card with all inline styles (so it survives SVG
 * foreignObject serialization) and exports it as a 1080×1350 PNG with
 * a Karochat watermark.
 */
export function QuoteCard({
  authorName,
  authorHandle,
  content,
  roomName,
  createdAt,
  onClose
}: {
  authorName: string;
  authorHandle: string;
  content: string;
  roomName: string;
  createdAt: string;
  onClose: () => void;
}) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // ESC closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dateLabel = useMemo(() => {
    try {
      const d = new Date(createdAt);
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    } catch {
      return "";
    }
  }, [createdAt]);

  const colors = themeColors(theme);
  // The card itself is 1080×1350 — Instagram-ratio friendly. We render
  // it at a smaller display size in the modal and scale on export.
  const CARD_W = 1080;
  const CARD_H = 1350;
  const DISPLAY_SCALE = 0.34;

  async function downloadPng() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const node = cardRef.current;
      if (!node) throw new Error("card not ready");
      // Clone the node so we can swap to absolute pixel sizing for export.
      const cloned = node.cloneNode(true) as HTMLElement;
      cloned.style.transform = "";
      cloned.style.transformOrigin = "";
      cloned.style.width = `${CARD_W}px`;
      cloned.style.height = `${CARD_H}px`;
      cloned.style.position = "absolute";
      cloned.style.left = "-99999px";
      document.body.appendChild(cloned);
      const html = cloned.outerHTML;
      document.body.removeChild(cloned);

      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}">` +
          `<foreignObject width="100%" height="100%">` +
            `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${CARD_W}px;height:${CARD_H}px;">` +
              html +
            `</div>` +
          `</foreignObject>` +
        `</svg>`;

      const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("image render failed"));
        img.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = CARD_W;
      canvas.height = CARD_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas not supported");
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, CARD_W, CARD_H);
      ctx.drawImage(img, 0, 0, CARD_W, CARD_H);
      URL.revokeObjectURL(url);

      const pngBlob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))), "image/png");
      });
      const pngUrl = URL.createObjectURL(pngBlob);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `karochat-card-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(pngUrl), 5000);
    } catch (e: any) {
      // Many browsers reject foreignObject → canvas due to security taint.
      // Surface a friendly fallback so users can screenshot manually.
      setError(
        e?.message ??
          "Couldn't export here — your browser blocked it. Screenshot the card above instead."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-card-title"
        className="surface-glass my-auto w-[min(540px,94vw)] max-h-[90vh] overflow-y-auto p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back"
              title="Back"
              className="mt-0.5 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/60 hover:bg-white/10"
            >
              ←
            </button>
            <div className="min-w-0">
              <p id="quote-card-title" className="font-display text-base font-semibold">
                Share as card
              </p>
              <p className="mt-0.5 text-xs text-white/55">
                One tap → a 1080×1350 PNG you can post anywhere.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
            className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/60 hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* Theme picker */}
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={`flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-xs transition ${
                theme === t.id
                  ? "border-neon-blue/60 bg-neon-blue/10 text-white"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              <span aria-hidden className="text-base">{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Card preview — scaled down for display, full-size on export. */}
        <div className="mt-4 flex justify-center">
          <div
            style={{
              width: CARD_W * DISPLAY_SCALE,
              height: CARD_H * DISPLAY_SCALE,
              overflow: "hidden",
              borderRadius: 24
            }}
          >
            <div
              ref={cardRef}
              style={{
                width: CARD_W,
                height: CARD_H,
                transform: `scale(${DISPLAY_SCALE})`,
                transformOrigin: "top left",
                ...cardStyle(colors)
              }}
            >
              <div style={innerStyle(colors)}>
                <div style={topRowStyle(colors)}>
                  <span style={authorChipStyle(colors)}>
                    {authorName} · @{authorHandle}
                  </span>
                  <span style={dateStyle(colors)}>{dateLabel}</span>
                </div>
                <p style={quoteStyle(colors)}>“{content}”</p>
                <div style={bottomRowStyle(colors)}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={roomStyle(colors)}>{roomName}</span>
                    <span style={hintStyle(colors)}>from a room on Karochat</span>
                  </div>
                  <span style={wordmarkStyle(colors)}>karochat</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-neon-amber/10 px-2 py-1 text-xs text-neon-amber">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => void downloadPng()}
            disabled={busy}
            className="flex-1 rounded-xl bg-neon-blue px-4 py-2 text-sm font-medium text-ink-900 shadow-glow-blue hover:bg-neon-blue/90 disabled:opacity-50"
          >
            {busy ? "Rendering…" : "Download PNG"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Close
          </button>
        </div>
        <p className="mt-2 text-[10px] text-white/40">
          Watermarked with a small Karochat wordmark. Vault DMs and deleted
          messages can&apos;t be exported.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline-style helpers — kept here because foreignObject in SVG only renders
// styles that are inline, never Tailwind class-driven styles.
// ---------------------------------------------------------------------------
type CardColors = {
  bg: string;
  panelBg: string;
  text: string;
  muted: string;
  accent: string;
  font: string;
  border: string;
};

function themeColors(theme: Theme): CardColors {
  if (theme === "polaroid") {
    return {
      bg: "#f5efe6",
      panelBg: "#ffffff",
      text: "#1c1c1c",
      muted: "#7a6e5e",
      accent: "#a06b3e",
      font: '"Iowan Old Style", "Georgia", serif',
      border: "rgba(0,0,0,0.08)"
    };
  }
  if (theme === "neon") {
    return {
      bg: "#0a0014",
      panelBg: "linear-gradient(160deg, #170028 0%, #0a0014 100%)",
      text: "#ffffff",
      muted: "rgba(255,255,255,0.55)",
      accent: "#19E5C1",
      font: '"JetBrains Mono", "ui-monospace", monospace',
      border: "rgba(25, 229, 193, 0.35)"
    };
  }
  return {
    bg: "#0A0A0A",
    panelBg: "linear-gradient(160deg, #14141A 0%, #08080C 100%)",
    text: "#F3F3F5",
    muted: "rgba(243, 243, 245, 0.55)",
    accent: "#00B4FF",
    font: '"Iowan Old Style", "Georgia", serif',
    border: "rgba(255,255,255,0.08)"
  };
}

function cardStyle(c: CardColors): React.CSSProperties {
  return {
    background: c.bg,
    color: c.text,
    fontFamily: c.font,
    padding: 60,
    boxSizing: "border-box"
  };
}
function innerStyle(c: CardColors): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    background: c.panelBg,
    border: `2px solid ${c.border}`,
    borderRadius: 32,
    padding: 64,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    boxShadow: "0 30px 80px rgba(0,0,0,0.45)"
  };
}
function topRowStyle(_c: CardColors): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%"
  };
}
function authorChipStyle(c: CardColors): React.CSSProperties {
  return {
    fontSize: 22,
    fontWeight: 600,
    color: c.accent,
    letterSpacing: 1
  };
}
function dateStyle(c: CardColors): React.CSSProperties {
  return {
    fontSize: 20,
    color: c.muted,
    fontVariantNumeric: "tabular-nums"
  };
}
function quoteStyle(c: CardColors): React.CSSProperties {
  return {
    fontSize: 64,
    lineHeight: 1.18,
    color: c.text,
    fontWeight: 500,
    marginTop: 28,
    marginBottom: 28,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word"
  };
}
function bottomRowStyle(_c: CardColors): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end"
  };
}
function roomStyle(c: CardColors): React.CSSProperties {
  return {
    fontSize: 28,
    color: c.text,
    fontWeight: 600
  };
}
function hintStyle(c: CardColors): React.CSSProperties {
  return {
    fontSize: 18,
    color: c.muted,
    marginTop: 4
  };
}
function wordmarkStyle(c: CardColors): React.CSSProperties {
  return {
    fontSize: 28,
    color: c.muted,
    letterSpacing: 4,
    textTransform: "uppercase"
  };
}
