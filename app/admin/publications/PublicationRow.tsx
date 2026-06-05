"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type AdminPublication = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  category_slug: string | null;
  status: "draft" | "published" | "hidden";
  is_adult: boolean;
  pen_name: string | null;
  author_profile_id: string;
  author_username: string | null;
  author_display_name: string | null;
  cover_image_url: string | null;
  view_count: number;
  language: string;
  tags: string[];
  body_markdown: string;
  open_report_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_TINT: Record<AdminPublication["status"], string> = {
  published: "border-neon-mint/40 bg-neon-mint/10 text-neon-mint",
  draft:     "border-white/15  bg-white/5     text-white/65",
  hidden:    "border-neon-red/40 bg-neon-red/10 text-neon-red"
};

export function PublicationRow({ row }: { row: AdminPublication }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [statusNow, setStatusNow] = useState(row.status);
  const [expanded, setExpanded] = useState(false);

  async function setStatus(next: "draft" | "published" | "hidden") {
    setBusy(next);
    setErr(null);
    const { data, error } = await supabase.rpc(
      "admin_set_publication_status",
      { p_id: row.id, p_status: next }
    );
    setBusy(null);
    if (error) {
      setErr(error.message);
      return;
    }
    if (data === false) {
      setErr("Row not found");
      return;
    }
    setStatusNow(next);
    router.refresh();
  }

  const author =
    row.pen_name?.trim() ||
    row.author_display_name?.trim() ||
    (row.author_username ? `@${row.author_username}` : "anon");

  return (
    <article className="surface-glass p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[96px_1fr]">
        {row.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.cover_image_url}
            alt=""
            className="h-32 w-24 rounded-lg border border-white/10 bg-black/40 object-cover"
          />
        ) : (
          <div className="flex h-32 w-24 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-neon-purple/30 to-neon-blue/20 text-3xl font-bold text-white">
            {row.title.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <Link
              href={`/read/${row.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display text-base font-semibold text-white hover:underline"
            >
              {row.title}
            </Link>
            <span
              className={clsx(
                "rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-widest",
                STATUS_TINT[statusNow]
              )}
            >
              {statusNow}
            </span>
            {row.is_adult && (
              <span className="rounded-sm border border-neon-red/40 bg-neon-red/10 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-neon-red">
                18+
              </span>
            )}
            {row.open_report_count > 0 && (
              <span className="rounded-sm border border-neon-amber/40 bg-neon-amber/10 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-neon-amber">
                🚩 {row.open_report_count} report
                {row.open_report_count === 1 ? "" : "s"}
              </span>
            )}
            <span className="ml-auto text-[10px] uppercase tracking-widest text-white/35">
              {new Date(row.created_at).toLocaleString()}
            </span>
          </div>

          {row.subtitle && (
            <p className="mt-1 text-[13px] text-white/70">{row.subtitle}</p>
          )}

          <p className="mt-1 text-[11px] text-white/50">
            by{" "}
            {row.author_username ? (
              <Link
                href={`/u/${row.author_username}`}
                className="text-white/75 hover:text-white"
                target="_blank"
                rel="noopener noreferrer"
              >
                {author}
              </Link>
            ) : (
              <span className="text-white/75">{author}</span>
            )}
            {row.category_slug ? ` · ${row.category_slug}` : ""}
            {" · "}
            {row.view_count} reads
            {" · "}
            {row.language.toUpperCase()}
            {row.tags.length > 0 ? ` · ${row.tags.join(", ")}` : ""}
          </p>

          {err && (
            <p className="mt-2 rounded-lg border border-neon-red/30 bg-neon-red/10 px-2 py-1 text-xs text-neon-red">
              {err}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={`/read/${row.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
            >
              Open public ↗
            </Link>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
            >
              {expanded ? "Hide body" : "Read body"}
            </button>

            {statusNow !== "hidden" ? (
              <button
                type="button"
                onClick={() => void setStatus("hidden")}
                disabled={!!busy}
                className="rounded-lg border border-neon-red/30 bg-neon-red/10 px-3 py-1.5 text-xs font-medium text-neon-red hover:bg-neon-red/20 disabled:opacity-60"
              >
                {busy === "hidden" ? "Hiding…" : "✕ Hide"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void setStatus("published")}
                disabled={!!busy}
                className="rounded-lg border border-neon-mint/40 bg-neon-mint/15 px-3 py-1.5 text-xs font-medium text-neon-mint hover:bg-neon-mint/25 disabled:opacity-60"
              >
                {busy === "published" ? "Restoring…" : "✓ Unhide"}
              </button>
            )}

            {statusNow === "draft" && (
              <button
                type="button"
                onClick={() => void setStatus("published")}
                disabled={!!busy}
                className="rounded-lg border border-neon-mint/40 bg-neon-mint/10 px-3 py-1.5 text-xs text-neon-mint hover:bg-neon-mint/20 disabled:opacity-60"
              >
                {busy === "published" ? "Publishing…" : "Publish"}
              </button>
            )}
          </div>

          {expanded && (
            <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[12px] leading-relaxed text-white/85">
              {row.body_markdown || "(empty)"}
            </pre>
          )}
        </div>
      </div>
    </article>
  );
}
