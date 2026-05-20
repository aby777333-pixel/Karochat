"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function BeaconCard({
  beacon,
  currentUserId
}: {
  beacon: any;
  currentUserId: string;
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mine = beacon.asker_profile_id === currentUserId;
  const answered = beacon.status === "answered";
  const ago = (() => {
    const ms = Date.now() - new Date(beacon.created_at).getTime();
    if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
    return `${Math.round(ms / 3_600_000)}h ago`;
  })();

  async function accept() {
    setBusy(true);
    setErr(null);
    try {
      const { data, error } = await supabase.rpc("accept_beacon", {
        p_beacon_id: beacon.id
      });
      if (error) throw error;
      if (data) router.push(`/students/session/${data}`);
    } catch (e: any) {
      setErr(e?.message ?? "Could not accept.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setErr(null);
    try {
      await supabase.rpc("cancel_beacon", { p_beacon_id: beacon.id });
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Could not cancel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="surface-glass p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="rounded-md border border-neon-red/40 bg-neon-red/10 px-2 py-0.5 text-[11px] uppercase tracking-widest text-neon-red">
            🆘 {beacon.subject?.replace(/-/g, " ") ?? "unknown"}
          </span>
          <span className="text-[11px] uppercase tracking-widest text-white/40">
            {beacon.urgency} · {beacon.status}
          </span>
          <span className="text-[11px] text-white/40">{ago}</span>
        </div>
        {mine && beacon.status === "routing" && (
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={busy}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/55 hover:bg-white/10 disabled:opacity-50"
          >
            cancel
          </button>
        )}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-white/90">
        {beacon.karo_rewritten_question ?? beacon.question_text}
      </p>
      {beacon.context_note && (
        <p className="mt-1 text-[11px] text-white/45">
          context: {beacon.context_note}
        </p>
      )}
      {err && <p className="mt-2 text-xs text-neon-red">{err}</p>}
      {!mine && beacon.status === "routing" && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void accept()}
            disabled={busy}
            className="rounded-lg bg-neon-mint px-3 py-1.5 text-sm font-medium text-ink-900 hover:bg-neon-mint/90 disabled:opacity-60"
          >
            {busy ? "…" : "🤝 Help"}
          </button>
        </div>
      )}
      {answered && beacon.session_id && (
        <div className="mt-3">
          <a
            href={`/students/session/${beacon.session_id}`}
            className="rounded-lg border border-neon-blue/40 bg-neon-blue/10 px-3 py-1.5 text-xs text-neon-blue hover:bg-neon-blue/20"
          >
            → Enter session
          </a>
        </div>
      )}
    </li>
  );
}
