"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type PublicationReport = {
  id: string;
  publication_id: string;
  publication_slug: string | null;
  publication_title: string | null;
  publication_status: "draft" | "published" | "hidden" | null;
  publication_is_adult: boolean | null;
  reporter_id: string | null;
  reporter_username: string | null;
  reason: string;
  status: "open" | "closed";
  reviewer_id: string | null;
  reviewer_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

const STATUS_TINT: Record<string, string> = {
  published: "border-neon-mint/40 bg-neon-mint/10 text-neon-mint",
  draft:     "border-white/15  bg-white/5     text-white/65",
  hidden:    "border-neon-red/40 bg-neon-red/10 text-neon-red"
};

export function PublicationReportRow({ row }: { row: PublicationReport }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pubStatus, setPubStatus] = useState(row.publication_status);

  async function close() {
    setBusy("close");
    setErr(null);
    const { error } = await supabase.rpc("admin_update_publication_report", {
      p_id: row.id,
      p_status: "closed",
      p_note: null
    });
    setBusy(null);
    if (error) {
      setErr(error.message);
      return;
    }
    setDone(true);
    router.refresh();
  }

  async function hideAndClose() {
    setBusy("hide");
    setErr(null);
    const { error: hideErr } = await supabase.rpc(
      "admin_set_publication_status",
      { p_id: row.publication_id, p_status: "hidden" }
    );
    if (hideErr) {
      setBusy(null);
      setErr(hideErr.message);
      return;
    }
    const { error: closeErr } = await supabase.rpc(
      "admin_update_publication_report",
      { p_id: row.id, p_status: "closed", p_note: "publication hidden" }
    );
    setBusy(null);
    if (closeErr) {
      setErr(closeErr.message);
      return;
    }
    setPubStatus("hidden");
    setDone(true);
    router.refresh();
  }

  return (
    <article className={clsx("surface-glass p-4", done && "opacity-50")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="rounded-md border border-neon-amber/40 bg-neon-amber/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-neon-amber">
            🚩 Report
          </span>
          {pubStatus && (
            <span
              className={clsx(
                "rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-widest",
                STATUS_TINT[pubStatus]
              )}
            >
              {pubStatus}
            </span>
          )}
          {row.publication_is_adult && (
            <span className="rounded-sm border border-neon-red/40 bg-neon-red/10 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-neon-red">
              18+
            </span>
          )}
          <span className="text-[11px] text-white/40">
            {new Date(row.created_at).toLocaleString()}
          </span>
          {row.reporter_username && (
            <span className="text-[11px] text-white/40">
              by{" "}
              <Link
                href={`/u/${row.reporter_username}`}
                className="text-white/55 hover:text-white"
              >
                @{row.reporter_username}
              </Link>
            </span>
          )}
        </div>
        <span className="text-[10px] text-white/35">id: {row.id.slice(0, 8)}</span>
      </div>

      <div className="mt-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[12px] text-white/80">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          Reported publication
        </p>
        <p className="mt-0.5">
          {row.publication_slug ? (
            <Link
              href={`/read/${row.publication_slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon-blue hover:underline"
            >
              {row.publication_title ?? row.publication_slug} ↗
            </Link>
          ) : (
            <span className="text-white/60">(deleted)</span>
          )}
        </p>
      </div>

      <div className="mt-2 whitespace-pre-wrap rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-[13px] text-white/85">
        {row.reason}
      </div>

      {err && <p className="mt-2 text-xs text-neon-red">{err}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void hideAndClose()}
          disabled={!!busy || pubStatus === "hidden"}
          className="rounded-lg border border-neon-red/30 bg-neon-red/10 px-3 py-1.5 text-xs font-medium text-neon-red hover:bg-neon-red/20 disabled:opacity-60"
        >
          {busy === "hide" ? "Hiding…" : "✕ Hide publication & close"}
        </button>
        <button
          type="button"
          onClick={() => void close()}
          disabled={!!busy}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10 disabled:opacity-60"
        >
          {busy === "close" ? "…" : "🗑 Dismiss"}
        </button>
        <span className="ml-auto self-center text-[10px] uppercase tracking-widest text-white/35">
          status: {done ? "closed" : row.status}
        </span>
      </div>
    </article>
  );
}
