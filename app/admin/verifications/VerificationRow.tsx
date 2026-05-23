"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type PendingRow = {
  id: string;
  profile_id: string;
  username: string | null;
  display_name: string | null;
  is_guest: boolean;
  status: string;
  country: string;
  education_level: string;
  syllabus: string | null;
  institution: string | null;
  verification_method: "id_upload" | "result_upload" | string;
  is_minor: boolean;
  guardian_email: string | null;
  guardian_phone: string | null;
  id_card_url: string | null;
  id_expiry_date: string | null;
  marksheet_url: string | null;
  result_date: string | null;
  created_at: string;
  id_card_signed_url?: string | null;
  marksheet_signed_url?: string | null;
};

export function VerificationRow({ r }: { r: PendingRow }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);
  const [note, setNote] = useState("");

  async function approve() {
    setBusy("approve");
    setErr(null);
    try {
      const { data, error } = await supabase.rpc(
        "admin_approve_verification",
        { p_id: r.id }
      );
      if (error) throw error;
      if (data === false) throw new Error("Row not found");
      setDone("approved");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Approval failed");
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    setBusy("reject");
    setErr(null);
    try {
      const { data, error } = await supabase.rpc(
        "admin_reject_verification",
        { p_id: r.id, p_note: note.trim() || null }
      );
      if (error) throw error;
      if (data === false) throw new Error("Row not found");
      setDone("rejected");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Rejection failed");
    } finally {
      setBusy(null);
    }
  }

  const photoUrl =
    r.verification_method === "id_upload"
      ? r.id_card_signed_url
      : r.marksheet_signed_url;
  const dateLabel =
    r.verification_method === "id_upload" ? "ID valid until" : "Result date";
  const dateValue =
    r.verification_method === "id_upload" ? r.id_expiry_date : r.result_date;

  if (done) {
    return (
      <div
        className={clsx(
          "surface-glass p-4 text-sm",
          done === "approved" ? "tint-mint" : "tint-red"
        )}
      >
        {done === "approved"
          ? `✓ Approved — ${r.username ?? r.display_name ?? "user"} is verified.`
          : `✕ Rejected — ${r.username ?? r.display_name ?? "user"} notified.`}
      </div>
    );
  }

  return (
    <div className="surface-glass p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr]">
        {/* Uploaded photo */}
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <a
              href={photoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
              title="Open full size in a new tab"
            >
              <img
                src={photoUrl}
                alt={`${r.verification_method} upload`}
                className="h-44 w-full object-cover"
              />
            </a>
          ) : (
            <div className="flex h-44 w-full items-center justify-center text-[11px] text-white/40">
              (no photo)
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-display text-sm font-semibold text-white">
              @{r.username ?? "—"}
            </span>
            {r.display_name && (
              <span className="text-xs text-white/55">{r.display_name}</span>
            )}
            {r.is_guest && (
              <span className="rounded-sm border border-white/15 bg-white/5 px-1 text-[9px] uppercase tracking-widest text-white/55">
                guest
              </span>
            )}
            {r.is_minor && (
              <span className="rounded-sm border border-neon-amber/40 bg-neon-amber/10 px-1 text-[9px] uppercase tracking-widest text-neon-amber">
                minor
              </span>
            )}
            <span className="ml-auto text-[10px] uppercase tracking-widest text-white/35">
              {new Date(r.created_at).toLocaleString()}
            </span>
          </div>

          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] sm:grid-cols-3">
            <Field label="Method" value={r.verification_method} />
            <Field label="Country" value={r.country} />
            <Field label="Level" value={r.education_level} />
            <Field label="Syllabus" value={r.syllabus ?? "—"} />
            <Field
              label="Institution"
              value={r.institution ?? "—"}
              className="sm:col-span-2"
            />
            <Field
              label={dateLabel}
              value={dateValue ? new Date(dateValue).toLocaleDateString() : "—"}
            />
          </dl>

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
              {busy === "approve" ? "Approving…" : "✓ Approve"}
            </button>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 240))}
              placeholder="Optional rejection note shown to the student"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs outline-none placeholder:text-white/30 focus:border-neon-red/40"
            />
            <button
              type="button"
              onClick={reject}
              disabled={!!busy}
              className="rounded-lg border border-neon-red/30 bg-neon-red/10 px-3 py-1.5 text-xs font-medium text-neon-red hover:bg-neon-red/20 disabled:opacity-60"
            >
              {busy === "reject" ? "Rejecting…" : "✕ Reject"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  className
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[10px] uppercase tracking-widest text-white/40">
        {label}
      </dt>
      <dd className="truncate text-white/80">{value}</dd>
    </div>
  );
}
