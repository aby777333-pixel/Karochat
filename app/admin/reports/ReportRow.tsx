"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Report = {
  id: string;
  reporter_id: string | null;
  reporter_handle: string | null;
  target_kind: "message" | "user" | "room";
  target_id: string;
  category: string;
  body: string | null;
  status: "new" | "triaged" | "actioned" | "dismissed";
  reviewer_id: string | null;
  priority: number;
  created_at: string;
};

const CATEGORY_TINT: Record<string, string> = {
  minor:    "border-neon-red/70  bg-neon-red/15  text-neon-red",
  ncii:     "border-neon-red/70  bg-neon-red/15  text-neon-red",
  doxxing:  "border-neon-amber/60 bg-neon-amber/15 text-neon-amber",
  violence: "border-neon-amber/60 bg-neon-amber/15 text-neon-amber",
  hate:     "border-neon-amber/60 bg-neon-amber/15 text-neon-amber",
  spam:     "border-white/15 bg-white/5 text-white/65",
  other:    "border-white/15 bg-white/5 text-white/65"
};

export function ReportRow({ r }: { r: Report }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function setStatus(next: "triaged" | "actioned" | "dismissed") {
    setBusy(next);
    setErr(null);
    const { error } = await supabase.rpc("admin_update_report", {
      p_id: r.id,
      p_status: next
    });
    setBusy(null);
    if (error) {
      setErr(error.message);
      return;
    }
    setDone(true);
    router.refresh();
  }

  return (
    <article
      className={clsx(
        "surface-glass p-4 transition",
        done && "opacity-50"
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span
            className={clsx(
              "rounded-md border px-2 py-0.5 text-[11px] uppercase tracking-widest",
              CATEGORY_TINT[r.category] ?? CATEGORY_TINT.other
            )}
          >
            {r.category}
          </span>
          <span className="text-[11px] uppercase tracking-widest text-white/40">
            P{r.priority} · {r.target_kind}
          </span>
          <span className="text-[11px] text-white/40">
            {new Date(r.created_at).toLocaleString()}
          </span>
          {r.reporter_handle && (
            <span className="text-[11px] text-white/40">
              by{" "}
              <Link
                href={`/u/${r.reporter_handle}`}
                className="text-white/55 hover:text-white"
              >
                @{r.reporter_handle}
              </Link>
            </span>
          )}
        </div>
        <span className="text-[10px] text-white/35">id: {r.id.slice(0, 8)}</span>
      </div>

      <div className="mt-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[12px] text-white/80">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          Target
        </p>
        <p className="mt-0.5 font-mono break-all">{r.target_id}</p>
        {r.target_kind === "user" && (
          <Link
            href={`/u/${r.target_id}`}
            className="mt-1 inline-block text-[11px] text-neon-blue hover:underline"
          >
            Open profile →
          </Link>
        )}
      </div>

      {r.body && (
        <div className="mt-2 whitespace-pre-wrap rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-[13px] text-white/85">
          {r.body}
        </div>
      )}

      {err && <p className="mt-2 text-xs text-neon-red">{err}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void setStatus("triaged")}
          disabled={!!busy}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10 disabled:opacity-60"
        >
          {busy === "triaged" ? "…" : "👀 Triage"}
        </button>
        <button
          type="button"
          onClick={() => void setStatus("actioned")}
          disabled={!!busy}
          className="rounded-lg bg-neon-red px-3 py-1.5 text-xs font-medium text-white hover:bg-neon-red/90 disabled:opacity-60"
        >
          {busy === "actioned" ? "…" : "✅ Actioned"}
        </button>
        <button
          type="button"
          onClick={() => void setStatus("dismissed")}
          disabled={!!busy}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/55 hover:bg-white/10 disabled:opacity-60"
        >
          {busy === "dismissed" ? "…" : "🗑 Dismiss"}
        </button>
        <span className="ml-auto self-center text-[10px] uppercase tracking-widest text-white/35">
          status: {r.status}
        </span>
      </div>
    </article>
  );
}
