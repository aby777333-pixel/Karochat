"use client";

// Karochat — External references panel (v9 Phase 2.1).
//
// Fetches Project Gutenberg + OpenLibrary refs for the current book.
// Renders a small two-column list. If both upstreams return empty, the
// panel collapses to a single line so we don't take up screen space.

import { useEffect, useState } from "react";

type Ref = {
  source: "gutenberg" | "openlibrary";
  title: string;
  author: string | null;
  url: string;
  downloads?: number | null;
  publish_year?: number | null;
  cover_url?: string | null;
  is_free_full_text?: boolean;
};

export function ExternalRefsPanel({
  title,
  author
}: {
  title: string;
  author: string | null;
}) {
  const [gutenberg, setGutenberg] = useState<Ref[] | null>(null);
  const [openlibrary, setOpenlibrary] = useState<Ref[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/books/external", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, author })
        });
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setErr(j?.error ?? "Could not load references.");
          return;
        }
        setGutenberg(j.gutenberg ?? []);
        setOpenlibrary(j.openlibrary ?? []);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Could not load references.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [title, author]);

  const loading = gutenberg === null && openlibrary === null && !err;
  const empty =
    (gutenberg?.length ?? 0) === 0 && (openlibrary?.length ?? 0) === 0;

  if (loading) {
    return (
      <section className="surface-glass mt-6 p-5">
        <p className="text-[10px] uppercase tracking-widest text-white/45">
          🔎 Looking for this book elsewhere…
        </p>
      </section>
    );
  }

  if (err) {
    return (
      <section className="surface-glass mt-6 p-5 text-[12px] text-white/55">
        Couldn&apos;t reach the public catalogs. {err}
      </section>
    );
  }

  if (empty) {
    return (
      <section className="surface-glass mt-6 p-5 text-[12px] text-white/55">
        No matches in Project Gutenberg or OpenLibrary for &quot;{title}&quot;.
      </section>
    );
  }

  return (
    <section className="surface-glass mt-6 p-5">
      <p className="text-[10px] uppercase tracking-widest text-white/45">
        🔎 Find this book elsewhere
      </p>
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Column
          tint="border-neon-mint/30 bg-neon-mint/5"
          accent="text-neon-mint/80"
          label="Project Gutenberg (free, full text)"
          empty="Not on Gutenberg yet."
          items={gutenberg ?? []}
        />
        <Column
          tint="border-neon-blue/30 bg-neon-blue/5"
          accent="text-neon-blue/80"
          label="OpenLibrary (metadata + borrow)"
          empty="No OpenLibrary record."
          items={openlibrary ?? []}
        />
      </div>
      <p className="mt-3 text-[11px] text-white/40">
        Gutenberg results are public-domain works — usually free, full
        text, multiple formats. OpenLibrary results are catalog metadata
        + borrow / buy links.
      </p>
    </section>
  );
}

function Column({
  tint,
  accent,
  label,
  empty,
  items
}: {
  tint: string;
  accent: string;
  label: string;
  empty: string;
  items: Ref[];
}) {
  return (
    <div className={`rounded-xl border ${tint} p-3`}>
      <p className={`text-[10px] uppercase tracking-widest ${accent}`}>{label}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-[12px] text-white/45">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2 text-[13px]">
          {items.map((r, i) => (
            <li key={`${r.source}-${i}`}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-md border border-white/10 bg-black/30 p-2 transition hover:bg-white/10"
              >
                <p className="font-medium text-white">
                  {r.title}
                  {r.is_free_full_text && (
                    <span className="ml-1 rounded-sm border border-neon-mint/40 bg-neon-mint/10 px-1 text-[9px] uppercase tracking-widest text-neon-mint">
                      Full text
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[11px] text-white/55">
                  {r.author ?? "Unknown author"}
                  {typeof r.publish_year === "number"
                    ? ` · first published ${r.publish_year}`
                    : ""}
                  {typeof r.downloads === "number"
                    ? ` · ${r.downloads.toLocaleString()} downloads`
                    : ""}
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
