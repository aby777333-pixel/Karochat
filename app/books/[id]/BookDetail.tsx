"use client";

// Karochat — Book detail + pop-up reader + report modal (v9 Phase 2,
// extended in Phase 2.1 with EPUB reader, OpenLibrary/Gutenberg
// cross-reference, and a Karo "explain a passage" panel).
//
// PDF: native browser viewer in an iframe (unchanged from Phase 2).
// EPUB: epubjs-powered inline reader (Phase 2.1).
// MOBI: still falls back to download — MOBI inline rendering is
// browser-hostile; will land with a server-side mobi→epub convert step.

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { EpubReader } from "./EpubReader";
import { ExternalRefsPanel } from "./ExternalRefsPanel";
import { ExplainPanel } from "./ExplainPanel";

type Book = {
  id: string;
  title: string;
  author: string | null;
  uploader_profile_id: string | null;
  uploader_username: string | null;
  uploader_display_name: string | null;
  language: string;
  file_url: string;
  file_size_bytes: number | null;
  format: string;
  cover_url: string | null;
  isbn: string | null;
  page_count: number | null;
  word_count: number | null;
  license_type: string;
  cc_license_code: string | null;
  genres: string[];
  syllabus_codes: string[];
  age_suitability: string;
  visibility: string;
  download_count: number;
  read_count: number;
  avg_rating: number | null;
  rating_count: number;
  status: string;
  uploaded_at: string;
  can_read: boolean;
  is_owner: boolean;
};

const LICENSE_LABEL: Record<string, string> = {
  public_domain: "Public domain",
  creative_commons: "Creative Commons",
  author_uploaded: "Author-uploaded",
  author_permission: "Author-permission",
  fair_use: "Fair-use claim",
  unspecified: "—"
};

export function BookDetail({
  book,
  signedUrl
}: {
  book: Book;
  signedUrl: string | null;
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [readerOpen, setReaderOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  async function recordDownload() {
    try {
      await supabase.rpc("record_book_download", { p_id: book.id });
      router.refresh();
    } catch {
      // best effort
    }
  }

  const isPdf = book.format === "pdf";
  const isEpub = book.format === "epub";
  const canOpenInline = isPdf || isEpub;
  const sizeMb = book.file_size_bytes
    ? (book.file_size_bytes / (1024 * 1024)).toFixed(2)
    : null;

  return (
    <>
      <section className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
        <Cover url={book.cover_url} title={book.title} />

        <div className="min-w-0">
          {book.status === "pending_review" && (
            <p className="rounded-md border border-neon-amber/30 bg-neon-amber/10 px-2 py-1 text-[11px] text-neon-amber">
              ⏳ Pending operator review — not yet visible to the public library.
            </p>
          )}
          <h1 className="mt-1 font-display text-3xl font-semibold text-white">
            {book.title}
          </h1>
          {book.author && (
            <p className="mt-1 text-sm text-white/70">by {book.author}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            <Badge tint="border-neon-mint/40 bg-neon-mint/10 text-neon-mint">
              {LICENSE_LABEL[book.license_type] ?? book.license_type}
              {book.cc_license_code && ` · ${book.cc_license_code}`}
            </Badge>
            <Badge tint="border-white/15 bg-white/5 text-white/70">
              {book.format.toUpperCase()}
            </Badge>
            <Badge tint="border-white/15 bg-white/5 text-white/70">
              {book.language.toUpperCase()}
            </Badge>
            {book.page_count && (
              <Badge tint="border-white/15 bg-white/5 text-white/70">
                {book.page_count} pages
              </Badge>
            )}
            {sizeMb && (
              <Badge tint="border-white/15 bg-white/5 text-white/70">
                {sizeMb} MB
              </Badge>
            )}
            {book.age_suitability !== "all" && (
              <Badge tint="border-neon-amber/40 bg-neon-amber/10 text-neon-amber">
                {book.age_suitability.replace("plus", "+")}
              </Badge>
            )}
          </div>

          {book.uploader_username && (
            <p className="mt-3 text-[12px] text-white/55">
              Uploaded by{" "}
              <span className="text-white/85">
                @{book.uploader_username}
              </span>{" "}
              ·{" "}
              {new Date(book.uploaded_at).toLocaleDateString()} · {book.read_count} reads ·{" "}
              {book.download_count} downloads
            </p>
          )}

          {book.genres.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-1.5">
              {book.genres.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/65"
                >
                  {g}
                </span>
              ))}
            </p>
          )}

          {book.can_read ? (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setReaderOpen(true)}
                disabled={!signedUrl}
                className="rounded-xl bg-neon-mint px-4 py-2 text-sm font-medium text-ink-900 hover:bg-neon-mint/90 disabled:opacity-60"
              >
                📖 Read now
              </button>
              {signedUrl && (
                <a
                  href={signedUrl}
                  download
                  onClick={() => void recordDownload()}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85 hover:bg-white/10"
                >
                  ⬇️ Download
                </a>
              )}
              {signedUrl && (
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85 hover:bg-white/10"
                >
                  ↗️ Open in new tab
                </a>
              )}
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="ml-auto rounded-xl border border-neon-red/30 bg-neon-red/10 px-3 py-2 text-xs text-neon-red hover:bg-neon-red/20"
              >
                🚩 Report copyright
              </button>
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/65">
              This book isn&apos;t available to read yet — either it&apos;s
              still pending review, or its visibility is set to private.
            </p>
          )}

          {!canOpenInline && book.can_read && (
            <p className="mt-3 text-[11px] text-white/45">
              In-app MOBI reader hasn&apos;t landed yet — for now, download and
              open in your e-reader of choice.
            </p>
          )}
        </div>
      </section>

      {book.can_read && (
        <>
          <ExternalRefsPanel title={book.title} author={book.author} />
          <ExplainPanel bookTitle={book.title} bookAuthor={book.author} />
        </>
      )}

      {readerOpen && signedUrl && isEpub && (
        <EpubReader
          bookId={book.id}
          fileUrl={signedUrl}
          title={book.title}
          onClose={() => setReaderOpen(false)}
        />
      )}

      {readerOpen && signedUrl && isPdf &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex flex-col bg-black/85 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reader-title"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/60 px-4 py-2">
              <p
                id="reader-title"
                className="truncate font-display text-sm font-semibold text-white"
              >
                📖 {book.title}
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/75 hover:bg-white/10"
                >
                  Open in new tab ↗
                </a>
                <button
                  type="button"
                  onClick={() => setReaderOpen(false)}
                  aria-label="Close reader"
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/75 hover:bg-white/10"
                >
                  ✕ Close
                </button>
              </div>
            </div>
            <iframe
              src={signedUrl}
              title={book.title}
              className="flex-1 w-full bg-white"
            />
          </div>,
          document.body
        )}

      {reportOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <ReportModal
            book={book}
            onClose={() => setReportOpen(false)}
          />,
          document.body
        )}
    </>
  );
}

function Cover({ url, title }: { url: string | null; title: string }) {
  if (url) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`${title} cover`} className="aspect-[2/3] w-full object-cover" />
      </div>
    );
  }
  return (
    <div className="flex aspect-[2/3] items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-neon-blue/30 to-neon-mint/20 text-6xl font-bold text-white">
      {title.slice(0, 1).toUpperCase()}
    </div>
  );
}

function Badge({
  children,
  tint
}: {
  children: React.ReactNode;
  tint: string;
}) {
  return (
    <span className={clsx("rounded-sm border px-1.5 py-0.5", tint)}>
      {children}
    </span>
  );
}

function ReportModal({
  book,
  onClose
}: {
  book: Book;
  onClose: () => void;
}) {
  const supabase = createSupabaseBrowserClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [basis, setBasis] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase.rpc("report_book_copyright", {
        p_book_id: book.id,
        p_claimant_name: name.trim(),
        p_claimant_email: email.trim(),
        p_claim_basis: basis.trim(),
        p_evidence_url: evidence.trim() || null
      });
      if (error) throw error;
      setDone(true);
    } catch (e: any) {
      setErr(e?.message ?? "Could not file the complaint.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="surface-glass tint-red my-auto w-[min(520px,94vw)] p-5">
        <div className="flex items-center justify-between">
          <p className="font-display text-base font-semibold text-white">
            🚩 Report copyright violation
          </p>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="text-xs text-white/55 hover:text-white"
          >
            ✕
          </button>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-white/75">
          File a complaint about <strong>{book.title}</strong>. Karochat
          aims to resolve valid claims within 24 hours. Three valid claims
          against the same uploader = permanent upload ban.
        </p>

        {done ? (
          <>
            <p className="mt-4 rounded-md border border-neon-mint/30 bg-neon-mint/10 px-3 py-2 text-sm text-neon-mint">
              ✓ Complaint filed. You&apos;ll hear back at {email} within 24
              hours.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 hover:bg-white/10"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-3 space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 120))}
                placeholder="Your full name"
                className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-neon-red/40"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value.slice(0, 200))}
                placeholder="Your email (we reply here)"
                className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-neon-red/40"
              />
              <textarea
                value={basis}
                onChange={(e) => setBasis(e.target.value.slice(0, 2000))}
                rows={4}
                placeholder="Why this is a violation — e.g., 'I am the author and never authorized this upload', or 'I represent the publisher under contract dated …'"
                className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-neon-red/40"
              />
              <input
                value={evidence}
                onChange={(e) => setEvidence(e.target.value.slice(0, 500))}
                placeholder="Evidence URL (optional — contract, registration page, store listing, etc.)"
                className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-neon-red/40"
              />
            </div>
            {err && (
              <p className="mt-2 rounded-md bg-neon-red/15 px-2 py-1 text-[11px] text-neon-red">
                {err}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={
                  busy || !name.trim() || !email.trim() || !basis.trim()
                }
                className="flex-1 rounded-lg bg-neon-red px-3 py-2 text-sm font-medium text-white hover:bg-neon-red/90 disabled:opacity-50"
              >
                {busy ? "Filing…" : "File complaint"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
