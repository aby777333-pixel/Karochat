"use client";

// Karochat — "Explain a passage" panel (v9 Phase 2.1).
//
// Lets a reader paste a passage from any book (or any text they're
// reading) and ask Karo to explain it — context, vocabulary,
// references, translation. POSTs to /api/books/explain.
//
// Per-paragraph integration with PDF.js is still deferred to a later
// pass; this panel works regardless of format because the reader
// pastes the text themselves.

import { useState } from "react";
import { Markdown } from "@/components/Markdown";

const LANGS = [
  ["", "No translation"],
  ["English", "English"],
  ["Hindi", "Hindi"],
  ["Tamil", "Tamil"],
  ["Telugu", "Telugu"],
  ["Malayalam", "Malayalam"],
  ["Kannada", "Kannada"],
  ["Bengali", "Bengali"],
  ["Marathi", "Marathi"],
  ["Gujarati", "Gujarati"],
  ["Punjabi", "Punjabi"],
  ["Urdu", "Urdu"],
  ["Spanish", "Spanish"],
  ["French", "French"],
  ["German", "German"],
  ["Portuguese", "Portuguese"],
  ["Arabic", "Arabic"]
] as const;

export function ExplainPanel({
  bookTitle,
  bookAuthor
}: {
  bookTitle: string;
  bookAuthor: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [passage, setPassage] = useState("");
  const [lang, setLang] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);

  async function submit() {
    if (!passage.trim()) {
      setErr("Paste a passage first.");
      return;
    }
    setBusy(true);
    setErr(null);
    setReply(null);
    try {
      const r = await fetch("/api/books/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passage: passage.trim(),
          book_title: bookTitle,
          book_author: bookAuthor,
          target_language: lang || null
        })
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j?.error ?? "Karo couldn't explain that — try again.");
        return;
      }
      setReply(j.reply as string);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-glass mt-6 p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
            💞 Ask Karo to explain a passage
          </p>
          <p className="mt-1 text-[12px] text-white/65">
            Paste any 1-3 sentences from the book. Karo gives a short, plain
            explanation — context, vocabulary, references — and can translate
            it too.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
          aria-expanded={open}
        >
          {open ? "Close" : "Open ↓"}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <textarea
            value={passage}
            onChange={(e) => setPassage(e.target.value.slice(0, 4000))}
            rows={4}
            placeholder="Paste a passage from the book here (up to 4000 characters)…"
            className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-mint/40"
            disabled={busy}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              disabled={busy}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white outline-none focus:border-neon-mint/40"
            >
              {LANGS.map(([v, label]) => (
                <option key={v} value={v}>
                  {v === "" ? label : `Translate to ${label}`}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-white/45">
              {passage.length} / 4000
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !passage.trim()}
              className="rounded-xl bg-neon-mint px-3 py-1.5 text-sm font-medium text-ink-900 hover:bg-neon-mint/90 disabled:opacity-60"
            >
              {busy ? "Karo is thinking…" : "Explain →"}
            </button>
          </div>

          {err && (
            <p className="rounded-lg border border-neon-red/30 bg-neon-red/10 px-3 py-2 text-[12px] text-neon-red">
              {err}
            </p>
          )}

          {reply && (
            <article className="surface-glass tint-mint p-4">
              <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
                💞 Karo
              </p>
              <div className="mt-2">
                <Markdown source={reply} />
              </div>
              <p className="mt-3 border-t border-white/10 pt-2 text-[11px] text-white/45">
                Karo is an AI assistant. Cross-check anything load-bearing.
              </p>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
