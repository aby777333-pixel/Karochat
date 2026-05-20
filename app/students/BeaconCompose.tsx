"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const SUBJECTS = [
  "physics","mathematics","chemistry","biology","computer-science",
  "economics","history","english-literature","law","accounting","finance",
  "statistics","medicine","engineering","philosophy","psychology",
  "sociology","political-science"
];

const URGENCIES = [
  { value: "casual", label: "Casual — within an hour" },
  { value: "urgent", label: "Urgent — within minutes" },
  { value: "live",   label: "Live — fire it right now" }
];

export function BeaconCompose({
  onClose,
  defaultSubject
}: {
  onClose: () => void;
  defaultSubject: string;
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [text, setText] = useState("");
  const [subject, setSubject] = useState(defaultSubject || "mathematics");
  const [context, setContext] = useState("");
  const [urgency, setUrgency] = useState<"casual" | "urgent" | "live">("urgent");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [routedId, setRoutedId] = useState<string | null>(null);

  async function fire() {
    setSending(true);
    setErr(null);
    try {
      const { data, error } = await supabase.rpc("create_beacon", {
        p_question_text: text.trim(),
        p_question_voice_url: null,
        p_question_image_url: null,
        p_context_note: context.trim() || null,
        p_urgency: urgency,
        p_subject: subject
      });
      if (error) throw error;
      setRoutedId(data as string);

      // Kick off server-side routing — fire-and-forget.
      void fetch("/api/students/beacons/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beacon_id: data })
      });

      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Could not fire beacon.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="surface-glass tint-red my-auto w-[min(560px,94vw)] p-6"
      >
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-semibold text-white">
            🆘 Fire a Help Beacon
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {routedId ? (
          <div className="mt-4">
            <p className="text-sm text-white/85">
              🟢 Beacon fired. Karo is classifying your question and routing
              to the right helpers right now. Watch this card &mdash; when
              someone accepts, a session opens.
            </p>
            <p className="mt-3 text-[11px] text-white/45">
              Beacon ID: <span className="font-mono">{routedId.slice(0, 8)}</span>
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-neon-blue px-3 py-1.5 text-sm font-medium text-ink-900 hover:bg-neon-blue/90"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <label className="mt-4 block text-[11px] uppercase tracking-widest text-white/50">
              Your question
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 500))}
              rows={4}
              placeholder="e.g. I'm stuck on integration by parts — when do I pick u vs dv?"
              className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-red/40"
            />
            <p className="mt-0.5 text-right text-[10px] text-white/35">
              {text.length}/500
            </p>

            <label className="mt-3 block text-[11px] uppercase tracking-widest text-white/50">
              Subject
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none"
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/-/g, " ")}
                </option>
              ))}
            </select>

            <label className="mt-3 block text-[11px] uppercase tracking-widest text-white/50">
              Context (optional)
            </label>
            <input
              value={context}
              onChange={(e) => setContext(e.target.value.slice(0, 240))}
              placeholder="e.g. JEE Main prep · Class 12 boards next week"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-red/40"
            />

            <p className="mt-3 text-[11px] uppercase tracking-widest text-white/50">
              Urgency
            </p>
            <div className="mt-2 grid grid-cols-1 gap-1.5">
              {URGENCIES.map((u) => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => setUrgency(u.value as any)}
                  className={clsx(
                    "rounded-lg border px-3 py-2 text-left text-sm transition",
                    urgency === u.value
                      ? "border-neon-red/60 bg-neon-red/10 text-white"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  )}
                >
                  {u.label}
                </button>
              ))}
            </div>

            {err && <p className="mt-2 text-xs text-neon-red">{err}</p>}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void fire()}
                disabled={!text.trim() || sending}
                className="flex-1 rounded-lg bg-neon-red px-3 py-2 text-sm font-semibold text-white hover:bg-neon-red/90 disabled:opacity-60"
              >
                {sending ? "Firing…" : "🆘 Fire beacon"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
