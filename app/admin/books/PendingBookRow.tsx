"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type PendingBook = {
  id: string;
  title: string;
  author: string | null;
  uploader_username: string | null;
  language: string;
  format: string;
  license_type: string;
  age_suitability: string;
  cover_url: string | null;
  file_url: string;
  page_count: number | null;
  file_size_bytes: number | null;
  uploaded_at: string;
  file_signed_url?: string | null;
};

const LICENSE_TINT: Record<string, string> = {
  public_domain: "border-neon-mint/40 bg-neon-mint/10 text-neon-mint",
  creative_commons: "border-neon-blue/40 bg-neon-blue/10 text-neon-blue",
  author_uploaded: "border-neon-amber/40 bg-neon-amber/10 text-neon-amber",
  author_permission: "border-white/20 bg-white/5 text-white/75",
  fair_use: "border-white/20 bg-white/5 text-white/75"
};

export function PendingBookRow({ row }: { row: PendingBook }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "takedown" | null>(null);
  const [reason, setReason] = useState("");

  async function approve() {
    setBusy("approve");
    setErr(null);
    try {
      const { data, error } = await supabase.rpc("admin_approve_book", {
        p_id: row.id
      });
      if (error) throw error;
      if (data === false) throw new Error("Row not found / wrong state");
      setDone("approved");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Approval failed");
    } finally {
      setBusy(null);
    }
  }

  async function takedown() {
    setBusy("takedown");
    setErr(null);
    try {
      const { data, error } = await supabase.rpc("admin_takedown_book", {
        p_id: row.id,
        p_claimant: null,
        p_reason: reason.trim() || "admin pre-review takedown",
        p_complaint_id: null
      });
      if (error) throw error;
      if (data === false) throw new Error("Takedown failed");
      setDone("takedown");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Takedown failed");
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    return (
      <div
        className={clsx(
          "surface-glass p-4 text-sm",
          done === "approved" ? "tint-mint" : "tint-red"
        )}
      >
        {done === "approved"
          ? `✓ Approved — ${row.title} is now live.`
          : `✕ Taken down — ${row.title} removed, hash banned.`}
      </div>
    );
  }

  const lic = LICENSE_TINT[row.license_type] ?? "border-white/15 bg-white/5 text-white/65";
  const sizeMb = row.file_size_bytes
    ? (row.file_size_bytes / (1024 * 1024)).toFixed(2)
    : "—";

  return (
    <div className="surface-glass p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[120px_1fr]">
        {row.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.cover_url}
            alt={`${row.title} cover`}
            className="h-44 w-30 rounded-lg border border-white/10 bg-black/40 object-cover"
          />
        ) : (
          <div className="flex h-44 w-30 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-neon-blue/30 to-neon-mint/20 text-4xl font-bold text-white">
            {row.title.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <Link
              href={`/books/${row.id}`}
              className="font-display text-sm font-semibold text-white hover:underline"
            >
              {row.title}
            </Link>
            {row.author && (
              <span className="text-[12px] text-white/65">by {row.author}</span>
            )}
            <span className="ml-auto text-[10px] uppercase tracking-widest text-white/35">
              {new Date(row.uploaded_at).toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-white/55">
            @{row.uploader_username ?? "—"} · {row.language.toUpperCase()} ·{" "}
            {row.format.toUpperCase()} ·{" "}
            {row.page_count ? `${row.page_count}p · ` : ""}
            {sizeMb} MB
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
            <span className={clsx("rounded-sm border px-1.5 py-0.5", lic)}>
              {row.license_type.replace("_", "-")}
            </span>
            {row.age_suitability !== "all" && (
              <span className="rounded-sm border border-neon-amber/40 bg-neon-amber/10 px-1.5 py-0.5 text-neon-amber">
                {row.age_suitability.replace("plus", "+")}
              </span>
            )}
          </div>

          {row.file_signed_url && (
            <a
              href={row.file_signed_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-[11px] text-neon-blue hover:underline"
            >
              Open file ↗
            </a>
          )}

          {err && (
            <p className="mt-2 rounded-lg border border-neon-red/30 bg-neon-red/10 px-2 py-1 text-xs text-neon-red">
              {err}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={approve}
              disabled={!!busy}
              className="rounded-lg border border-neon-mint/40 bg-neon-mint/15 px-3 py-1.5 text-xs font-medium text-neon-mint hover:bg-neon-mint/25 disabled:opacity-60"
            >
              {busy === "approve" ? "Approving…" : "✓ Approve · go live"}
            </button>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 240))}
              placeholder="Takedown reason (optional)"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs outline-none placeholder:text-white/30 focus:border-neon-red/40"
            />
            <button
              type="button"
              onClick={takedown}
              disabled={!!busy}
              className="rounded-lg border border-neon-red/30 bg-neon-red/10 px-3 py-1.5 text-xs font-medium text-neon-red hover:bg-neon-red/20 disabled:opacity-60"
            >
              {busy === "takedown" ? "Removing…" : "✕ Takedown"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
