"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type Complaint = {
  id: string;
  book_id: string;
  book_title: string;
  book_author: string | null;
  book_status: string;
  claimant_name: string;
  claimant_email: string;
  claim_basis: string;
  evidence_url: string | null;
  filed_at: string;
};

export function ComplaintRow({ row }: { row: Complaint }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<"upheld" | "rejected" | null>(null);
  const [note, setNote] = useState("");

  async function uphold() {
    setBusy("uphold");
    setErr(null);
    try {
      const { data, error } = await supabase.rpc("admin_takedown_book", {
        p_id: row.book_id,
        p_claimant: row.claimant_name,
        p_reason: note.trim() || row.claim_basis,
        p_complaint_id: row.id
      });
      if (error) throw error;
      if (data === false) throw new Error("Takedown failed");
      setDone("upheld");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Could not take down");
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    setBusy("reject");
    setErr(null);
    try {
      const { data, error } = await supabase.rpc("admin_reject_complaint", {
        p_complaint_id: row.id,
        p_note: note.trim() || null
      });
      if (error) throw error;
      if (data === false) throw new Error("Reject failed");
      setDone("rejected");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Could not reject");
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    return (
      <div
        className={clsx(
          "surface-glass p-4 text-sm",
          done === "upheld" ? "tint-red" : "tint-mint"
        )}
      >
        {done === "upheld"
          ? `✕ Upheld — ${row.book_title} taken down.`
          : `✓ Rejected — complaint closed, book stays live.`}
      </div>
    );
  }

  return (
    <div className="surface-glass p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <Link
          href={`/books/${row.book_id}`}
          className="font-display text-sm font-semibold text-white hover:underline"
        >
          {row.book_title}
        </Link>
        {row.book_author && (
          <span className="text-[12px] text-white/60">by {row.book_author}</span>
        )}
        <span className="rounded-sm border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-white/55">
          book status: {row.book_status}
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-white/35">
          filed {new Date(row.filed_at).toLocaleString()}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-[12px] sm:grid-cols-2">
        <div>
          <dt className="text-[10px] uppercase tracking-widest text-white/40">
            Claimant
          </dt>
          <dd className="text-white/85">
            {row.claimant_name} ·{" "}
            <a
              href={`mailto:${row.claimant_email}`}
              className="text-neon-blue hover:underline"
            >
              {row.claimant_email}
            </a>
          </dd>
        </div>
        {row.evidence_url && (
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-white/40">
              Evidence
            </dt>
            <dd>
              <a
                href={row.evidence_url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-[11px] text-neon-blue hover:underline"
              >
                {row.evidence_url}
              </a>
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-2">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          Claim basis
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words text-[12px] text-white/85">
          {row.claim_basis}
        </p>
      </div>

      {err && (
        <p className="mt-2 rounded-lg border border-neon-red/30 bg-neon-red/10 px-2 py-1 text-xs text-neon-red">
          {err}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 240))}
          placeholder="Optional reviewer note (visible internally)"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs outline-none placeholder:text-white/30 focus:border-white/30"
        />
        <button
          type="button"
          onClick={uphold}
          disabled={!!busy}
          className="rounded-lg border border-neon-red/30 bg-neon-red/10 px-3 py-1.5 text-xs font-medium text-neon-red hover:bg-neon-red/20 disabled:opacity-60"
        >
          {busy === "uphold" ? "Removing…" : "✕ Uphold · takedown"}
        </button>
        <button
          type="button"
          onClick={reject}
          disabled={!!busy}
          className="rounded-lg border border-neon-mint/40 bg-neon-mint/10 px-3 py-1.5 text-xs font-medium text-neon-mint hover:bg-neon-mint/20 disabled:opacity-60"
        >
          {busy === "reject" ? "Closing…" : "✓ Reject · keep live"}
        </button>
      </div>
    </div>
  );
}
