"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Owner-controlled room rules (markdown) + a "got it" acknowledgement gate.
 * Appears as a small button in the chat header. If the caller hasn't yet
 * acknowledged the current rules, the modal opens automatically and blocks
 * dismissal until they tap "got it" — which lets them participate.
 */
export function RoomRulesPanel({
  roomId,
  roomName,
  isOwner,
  initialRules,
  initiallyAcknowledged
}: {
  roomId: string;
  roomName: string;
  isOwner: boolean;
  initialRules: string | null;
  initiallyAcknowledged: boolean;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [rules, setRules] = useState<string | null>(initialRules);
  const [acknowledged, setAcknowledged] = useState<boolean>(initiallyAcknowledged);
  // Force-open when rules exist and caller hasn't acked yet.
  const mustAck = !!rules && !acknowledged;
  const [open, setOpen] = useState<boolean>(mustAck);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(rules ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-open if rules state ever requires re-ack (e.g. owner re-saves).
  useEffect(() => {
    if (!!rules && !acknowledged) setOpen(true);
  }, [rules, acknowledged]);

  // Esc closes ONLY if user has already acked (so the gate stays sticky).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !mustAck) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, mustAck]);

  async function acknowledge() {
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("acknowledge_room_rules", {
      p_room_id: roomId
    });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setAcknowledged(true);
    setOpen(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const text = draft.trim();
    const { error: rpcErr } = await supabase.rpc("set_room_rules", {
      p_room_id: roomId,
      p_rules: text || null
    });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setRules(text || null);
    setEditing(false);
    // Owner is auto-acked by the RPC; everyone else gets reset.
    setAcknowledged(true);
    router.refresh();
  }

  // If there are no rules and the caller isn't the owner, hide the button.
  if (!rules && !isOwner) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setEditing(false);
          setDraft(rules ?? "");
        }}
        title="Room rules"
        aria-label="Room rules"
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        <span aria-hidden>📜</span>
        <span>Rules</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !mustAck) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rules-title"
            className="surface-glass w-[min(520px,94vw)] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                {!mustAck && (
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Back"
                    title="Back"
                    className="mt-0.5 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/60 hover:bg-white/10"
                  >
                    ←
                  </button>
                )}
                <div className="min-w-0">
                  <p id="rules-title" className="font-display text-base font-semibold">
                    {mustAck ? "Read the rules before you chat" : `Rules · ${roomName}`}
                  </p>
                  {mustAck && (
                    <p className="mt-0.5 text-xs text-neon-amber">
                      The owner has set rules for this room. Tap “Got it” to continue.
                    </p>
                  )}
                </div>
              </div>
              {!mustAck && (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  title="Close (Esc)"
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/60 hover:bg-white/10"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="mt-4">
              {editing ? (
                <>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={4000}
                    rows={10}
                    placeholder={
                      "Be kind. No slurs. Adult content stays inside the marked threads. …"
                    }
                    className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-neon-blue/60"
                  />
                  <p className="mt-1 text-[10px] text-white/40">
                    Plain text (markdown coming later). Saving wipes everyone else&apos;s
                    acknowledgement so they read the new copy.
                  </p>
                </>
              ) : rules ? (
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 p-3 font-sans text-sm leading-relaxed text-white/85">
                  {rules}
                </pre>
              ) : (
                <p className="rounded-xl border border-dashed border-white/10 bg-black/20 px-3 py-4 text-center text-xs text-white/50">
                  No rules yet. {isOwner && "Tap “Edit” to write the first set."}
                </p>
              )}
            </div>

            {error && (
              <p className="mt-3 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">
                {error}
              </p>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              {isOwner && !editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    setDraft(rules ?? "");
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                >
                  {rules ? "Edit" : "Write rules"}
                </button>
              )}
              {isOwner && editing && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={busy}
                    className="rounded-lg bg-neon-blue px-3 py-1.5 text-xs font-medium text-ink-900 shadow-glow-blue transition hover:bg-neon-blue/90 disabled:opacity-50"
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                </>
              )}
              {!isOwner && rules && mustAck && !editing && (
                <button
                  type="button"
                  onClick={() => void acknowledge()}
                  disabled={busy}
                  className="rounded-lg bg-neon-blue px-4 py-1.5 text-xs font-medium text-ink-900 shadow-glow-blue transition hover:bg-neon-blue/90 disabled:opacity-50"
                >
                  {busy ? "…" : "Got it"}
                </button>
              )}
              {!isOwner && rules && !mustAck && !editing && (
                <span className="text-[11px] text-white/40">You acknowledged these rules.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
