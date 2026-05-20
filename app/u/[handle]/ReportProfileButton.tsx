"use client";

import { useState } from "react";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const CATEGORIES: { value: string; label: string; hint: string }[] = [
  { value: "minor",    label: "Account belongs to a minor", hint: "Anyone under 18." },
  { value: "ncii",     label: "Posting non-consensual intimate imagery", hint: "Sexual imagery without consent." },
  { value: "doxxing",  label: "Doxxing / private info leak",  hint: "Real-name / address / phone exposed." },
  { value: "violence", label: "Threats or call to violence",  hint: "Specific threats or organized incitement." },
  { value: "hate",     label: "Organized hate",               hint: "Recruitment / dehumanization." },
  { value: "spam",     label: "Spam / scam / impersonation",  hint: "Mass posting / phishing." },
  { value: "other",    label: "Something else",               hint: "Tell us in the note." }
];

export function ReportProfileButton({
  profileId,
  handle
}: {
  profileId: string;
  handle: string;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!category || sending) return;
    setSending(true);
    setErr(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc("create_report", {
      p_target_kind: "user",
      p_target_id: profileId,
      p_category: category,
      p_body: body.trim() || null
    });
    setSending(false);
    if (error) {
      // Most common case: anon user trying to file. Surface it cleanly.
      setErr(
        error.message.includes("authenticated")
          ? "Sign in to file a report."
          : error.message
      );
      return;
    }
    setDone(true);
  }

  function reset() {
    setOpen(false);
    setCategory("");
    setBody("");
    setDone(false);
    setErr(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-neon-red/30 bg-neon-red/5 px-3 py-2 text-sm text-neon-red/85 hover:bg-neon-red/10"
        title={`Report @${handle}`}
      >
        🚩 Report
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) reset();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="surface-glass tint-red my-auto w-[min(480px,94vw)] p-5"
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-semibold text-white">
                🚩 Report @{handle}
              </p>
              <button
                type="button"
                onClick={reset}
                aria-label="Close"
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {done ? (
              <>
                <p className="mt-3 text-sm text-white/85">
                  Got it. Reports involving minors or NCII jump our queue
                  immediately. Thank you.
                </p>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-lg bg-neon-blue px-4 py-2 text-sm font-medium text-ink-900 hover:bg-neon-blue/90"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-[11px] uppercase tracking-widest text-white/40">
                  What&apos;s wrong?
                </p>
                <div className="mt-2 space-y-1.5">
                  {CATEGORIES.map((c) => {
                    const active = category === c.value;
                    return (
                      <button
                        type="button"
                        key={c.value}
                        onClick={() => setCategory(c.value)}
                        className={clsx(
                          "block w-full rounded-lg border px-3 py-2 text-left transition",
                          active
                            ? "border-neon-red/60 bg-neon-red/10 text-white"
                            : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                        )}
                      >
                        <p className="text-sm">{c.label}</p>
                        <p className="text-[11px] text-white/45">{c.hint}</p>
                      </button>
                    );
                  })}
                </div>

                <p className="mt-3 text-[11px] uppercase tracking-widest text-white/40">
                  Add context (optional)
                </p>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, 1000))}
                  rows={3}
                  placeholder="Anything else our reviewers should know…"
                  className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-red/40"
                />
                <p className="mt-0.5 text-right text-[10px] text-white/35">
                  {body.length}/1000
                </p>

                {err && <p className="mt-2 text-xs text-neon-red">{err}</p>}

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={!category || sending}
                    className="flex-1 rounded-lg bg-neon-red px-3 py-2 text-sm font-medium text-white hover:bg-neon-red/90 disabled:opacity-60"
                  >
                    {sending ? "Sending…" : "Send report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
