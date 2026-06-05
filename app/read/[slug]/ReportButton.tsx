"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  publicationId: string;
};

export function ReportButton({ publicationId }: Props) {
  const supabase = createSupabaseBrowserClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setErr("Please describe the issue (at least a few words).");
      return;
    }
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("report_publication", {
      p_id: publicationId,
      p_reason: trimmed
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <p className="rounded-lg border border-neon-mint/30 bg-neon-mint/10 px-3 py-2 text-[12px] text-neon-mint">
        ✓ Reported — thanks. An operator will review it.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
      >
        🚩 Report this publication
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label className="block text-[11px] uppercase tracking-widest text-white/45">
        Why are you reporting this?
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 1000))}
        placeholder="Tell us what's wrong — spam, harassment, NCII, copyright, etc."
        rows={3}
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-neon-red/40"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-white/35">
          {reason.length} / 1000
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setErr(null);
            }}
            disabled={busy}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg border border-neon-red/30 bg-neon-red/10 px-3 py-1.5 text-xs font-medium text-neon-red hover:bg-neon-red/20 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send report"}
          </button>
        </div>
      </div>
      {err && <p className="text-[12px] text-neon-red">{err}</p>}
    </form>
  );
}
