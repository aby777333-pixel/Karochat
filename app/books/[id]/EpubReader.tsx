"use client";

// Karochat — EPUB reader (v9 Phase 2.1).
//
// Replaces the placeholder "download in your e-reader" message for
// EPUB books. Uses epubjs to render the book in an iframe-style
// pagination view inside a full-screen modal.
//
// Bookmarks: when the modal opens, we call upsert_book_bookmark with
// the current location (CFI) once the user navigates. When the modal
// re-opens we read the bookmark via supabase and rendition.display(cfi).
//
// Known caveats:
//   • epubjs internally depends on @xmldom/xmldom which has CVE
//     advisories. Mitigation today: uploads go through license + 3-
//     strike enforcement (Phase 2). Hardening = server-side EPUB
//     sanitisation, planned for a later phase.
//   • epubjs is dynamically imported so it doesn't bloat the books
//     listing or the PDF reader path.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  bookId: string;
  fileUrl: string; // signed URL to the EPUB inside books-files bucket
  title: string;
  initialBookmarkCfi?: string | null;
  onClose: () => void;
};

type Rendition = {
  display: (target?: string) => Promise<unknown>;
  next: () => Promise<unknown>;
  prev: () => Promise<unknown>;
  on: (ev: string, handler: (...args: any[]) => void) => void;
  off: (ev: string, handler: (...args: any[]) => void) => void;
  themes: {
    register: (name: string, styles: Record<string, any>) => void;
    select: (name: string) => void;
    fontSize: (size: string) => void;
  };
  destroy: () => void;
  currentLocation: () => any;
};

type Book = {
  ready: Promise<unknown>;
  renderTo: (el: HTMLElement, opts?: Record<string, unknown>) => Rendition;
  destroy: () => void;
};

const FONT_SIZES = [
  ["small", "85%"],
  ["medium", "100%"],
  ["large", "118%"],
  ["xlarge", "140%"]
] as const;
type FontKey = (typeof FONT_SIZES)[number][0];

export function EpubReader({
  bookId,
  fileUrl,
  title,
  initialBookmarkCfi,
  onClose
}: Props) {
  const supabase = createSupabaseBrowserClient();
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [fontKey, setFontKey] = useState<FontKey>("medium");
  const [theme, setTheme] = useState<"dark" | "light" | "sepia">("dark");

  // Save the latest CFI we observed so the bookmark write debounces.
  const lastCfiRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Dynamic import so epubjs only loads when the reader opens.
        const epubjs = await import("epubjs");
        const ePub = (epubjs as any).default ?? epubjs;
        if (cancelled) return;
        const book: Book = ePub(fileUrl);
        bookRef.current = book;
        await book.ready;
        if (cancelled || !viewerRef.current) return;
        const rendition: Rendition = book.renderTo(viewerRef.current, {
          width: "100%",
          height: "100%",
          flow: "paginated",
          spread: "auto"
        });
        renditionRef.current = rendition;

        rendition.themes.register("dark", {
          body: {
            background: "#0b0c0f",
            color: "#e8eaed",
            "font-family":
              "ui-serif, Georgia, Cambria, 'Times New Roman', serif",
            "line-height": "1.6"
          },
          a: { color: "#7cd0ff" }
        });
        rendition.themes.register("light", {
          body: {
            background: "#ffffff",
            color: "#1a1d22",
            "font-family":
              "ui-serif, Georgia, Cambria, 'Times New Roman', serif",
            "line-height": "1.6"
          },
          a: { color: "#0356b8" }
        });
        rendition.themes.register("sepia", {
          body: {
            background: "#f4ecd8",
            color: "#3a2f1d",
            "font-family":
              "ui-serif, Georgia, Cambria, 'Times New Roman', serif",
            "line-height": "1.6"
          },
          a: { color: "#5b3a18" }
        });
        rendition.themes.select("dark");
        rendition.themes.fontSize("100%");

        rendition.on("relocated", (loc: any) => {
          const cfi = loc?.start?.cfi as string | undefined;
          if (cfi) lastCfiRef.current = cfi;
        });

        await rendition.display(initialBookmarkCfi || undefined);
        if (!cancelled) setReady(true);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Could not open this EPUB.");
      }
    }

    load();
    return () => {
      cancelled = true;
      try {
        renditionRef.current?.destroy();
      } catch {}
      try {
        bookRef.current?.destroy();
      } catch {}
      renditionRef.current = null;
      bookRef.current = null;
    };
  }, [fileUrl, initialBookmarkCfi]);

  // Persist bookmark on unmount + on a 10-second interval while open.
  useEffect(() => {
    const t = setInterval(() => {
      void persistBookmark();
    }, 10_000);
    return () => {
      clearInterval(t);
      void persistBookmark();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persistBookmark() {
    const cfi = lastCfiRef.current;
    if (!cfi) return;
    try {
      await supabase.rpc("upsert_book_bookmark", {
        p_book_id: bookId,
        p_page_or_cfi: cfi
      });
    } catch {
      /* best effort */
    }
  }

  function applyFont(k: FontKey) {
    setFontKey(k);
    const size = FONT_SIZES.find((f) => f[0] === k)?.[1] ?? "100%";
    renditionRef.current?.themes.fontSize(size);
  }

  function applyTheme(t: "dark" | "light" | "sepia") {
    setTheme(t);
    renditionRef.current?.themes.select(t);
  }

  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") void renditionRef.current?.next();
    else if (e.key === "ArrowLeft") void renditionRef.current?.prev();
    else if (e.key === "Escape") onClose();
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`EPUB reader for ${title}`}
      tabIndex={-1}
      onKeyDown={onKey}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/60 px-4 py-2">
        <p className="truncate font-display text-sm font-semibold text-white">
          📖 {title}
        </p>
        <div className="flex items-center gap-1.5 text-[11px]">
          <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-1">
            <span className="text-white/55">A</span>
            {FONT_SIZES.map(([k]) => (
              <button
                key={k}
                type="button"
                onClick={() => applyFont(k)}
                className={
                  "rounded px-1.5 py-0.5 text-[10px] " +
                  (fontKey === k
                    ? "bg-neon-mint/20 text-neon-mint"
                    : "text-white/65 hover:bg-white/10")
                }
                aria-pressed={fontKey === k}
                aria-label={`Font size ${k}`}
              >
                {k === "small"
                  ? "S"
                  : k === "medium"
                  ? "M"
                  : k === "large"
                  ? "L"
                  : "XL"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-1">
            {(["dark", "sepia", "light"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => applyTheme(t)}
                className={
                  "rounded px-1.5 py-0.5 text-[10px] capitalize " +
                  (theme === t
                    ? "bg-neon-mint/20 text-neon-mint"
                    : "text-white/65 hover:bg-white/10")
                }
                aria-pressed={theme === t}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reader"
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-white/75 hover:bg-white/10"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {err && (
        <p className="mx-auto mt-6 max-w-md rounded-xl border border-neon-red/30 bg-neon-red/10 p-3 text-sm text-neon-red">
          Couldn&apos;t open this EPUB: {err}
        </p>
      )}

      <div className="relative flex-1 overflow-hidden">
        <button
          type="button"
          onClick={() => void renditionRef.current?.prev()}
          aria-label="Previous page"
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 px-3 py-2 text-3xl text-white/30 hover:text-white/80"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => void renditionRef.current?.next()}
          aria-label="Next page"
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 px-3 py-2 text-3xl text-white/30 hover:text-white/80"
        >
          ›
        </button>

        <div
          ref={viewerRef}
          className="mx-auto h-full max-w-3xl"
          aria-busy={!ready}
        />
        {!ready && !err && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12px] text-white/45">
            Loading book…
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}
