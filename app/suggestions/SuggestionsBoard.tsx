"use client";

// Karochat — community suggestions board.
//
// Composer + list with heart toggles. Admins additionally get status
// chips (planned / done / declined) and delete. All mutations go
// through the 0071 RPCs; the list refreshes after each action.

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type Suggestion = {
  suggestion_id: string;
  content: string;
  status: "new" | "planned" | "done" | "declined";
  created_at: string;
  author_username: string;
  author_display_name: string;
  author_avatar_url: string | null;
  heart_count: number;
  i_hearted: boolean;
  mine: boolean;
};

const STATUS_CHIP: Record<
  Suggestion["status"],
  { label: string; cls: string } | null
> = {
  new: null,
  planned: {
    label: "🛠 planned",
    cls: "border-neon-blue/40 bg-neon-blue/10 text-neon-blue"
  },
  done: {
    label: "✅ done",
    cls: "border-neon-mint/40 bg-neon-mint/10 text-neon-mint"
  },
  declined: {
    label: "not for now",
    cls: "border-white/15 bg-white/5 text-white/45"
  }
};

function ago(iso: string): string {
  const mins = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  );
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function SuggestionsBoard({
  initial,
  isGuest,
  isAdmin
}: {
  initial: Suggestion[];
  isGuest: boolean;
  isAdmin: boolean;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [items, setItems] = useState<Suggestion[]>(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sentMsg, setSentMsg] = useState<string | null>(null);

  async function refresh() {
    const { data } = await supabase.rpc("list_suggestions", { p_limit: 100 });
    if (data) setItems(data as Suggestion[]);
  }

  async function submit() {
    if (draft.trim().length < 5) {
      setErr("Say a little more — at least a few words.");
      return;
    }
    setBusy(true);
    setErr(null);
    setSentMsg(null);
    const { error } = await supabase.rpc("submit_suggestion", {
      p_content: draft.trim()
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setDraft("");
    setSentMsg("Thank you 💛 — your idea is on the wall.");
    await refresh();
  }

  async function toggleHeart(id: string) {
    // Optimistic flip; refresh corrects if anything disagrees.
    setItems((prev) =>
      prev.map((s) =>
        s.suggestion_id === id
          ? {
              ...s,
              i_hearted: !s.i_hearted,
              heart_count: s.heart_count + (s.i_hearted ? -1 : 1)
            }
          : s
      )
    );
    const { error } = await supabase.rpc("toggle_suggestion_heart", {
      p_suggestion_id: id
    });
    if (error) await refresh();
  }

  async function removeOwn(id: string) {
    const { error } = await supabase.rpc("delete_my_suggestion", {
      p_suggestion_id: id
    });
    if (!error) setItems((prev) => prev.filter((s) => s.suggestion_id !== id));
  }

  async function adminStatus(id: string, status: Suggestion["status"]) {
    const { error } = await supabase.rpc("admin_set_suggestion_status", {
      p_suggestion_id: id,
      p_status: status
    });
    if (!error) {
      setItems((prev) =>
        prev.map((s) => (s.suggestion_id === id ? { ...s, status } : s))
      );
    }
  }

  async function adminDelete(id: string) {
    const { error } = await supabase.rpc("admin_delete_suggestion", {
      p_suggestion_id: id
    });
    if (!error) setItems((prev) => prev.filter((s) => s.suggestion_id !== id));
  }

  return (
    <div className="space-y-5">
      {/* Composer */}
      {isGuest ? (
        <section className="surface-glass p-4 text-sm text-white/70">
          👋 Guests can read the wall — to add your own idea,{" "}
          <a href="/" className="text-neon-blue hover:underline">
            sign in free
          </a>{" "}
          (takes ~10 seconds).
        </section>
      ) : (
        <section className="surface-glass min-w-0 p-4">
          <label className="block text-[10px] uppercase tracking-widest text-white/45">
            Your idea
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
            rows={3}
            disabled={busy}
            placeholder="e.g. a 'compliment a stranger' button… rooms where two countries cook each other's food… anything that brings people closer"
            className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-amber/40 disabled:opacity-60"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-white/40">
              {draft.length} / 1000
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={busy || draft.trim().length < 5}
              className="rounded-xl bg-neon-amber px-4 py-2 text-sm font-medium text-ink-900 hover:bg-neon-amber/90 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Share it 💛"}
            </button>
          </div>
          {err && (
            <p className="mt-2 rounded-lg border border-neon-red/30 bg-neon-red/10 px-3 py-2 text-[12px] text-neon-red">
              {err}
            </p>
          )}
          {sentMsg && (
            <p className="mt-2 rounded-lg border border-neon-mint/30 bg-neon-mint/10 px-3 py-2 text-[12px] text-neon-mint">
              {sentMsg}
            </p>
          )}
        </section>
      )}

      {/* Wall */}
      <section>
        <h2 className="text-sm font-semibold text-white/80">
          From the community {items.length > 0 && `(${items.length})`}
        </h2>
        {items.length === 0 ? (
          <p className="surface-glass mt-2 p-4 text-sm text-white/55">
            No ideas yet — be the first. 🌱
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {items.map((s) => {
              const chip = STATUS_CHIP[s.status];
              return (
                <li key={s.suggestion_id} className="surface-glass min-w-0 p-3.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/45">
                    {s.author_avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.author_avatar_url}
                        alt=""
                        className="h-5 w-5 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-[10px]">
                        💡
                      </span>
                    )}
                    <span className="font-medium text-white/70">
                      {s.author_display_name}
                    </span>
                    <span>· {ago(s.created_at)}</span>
                    {chip && (
                      <span
                        className={`rounded-sm border px-1.5 py-0.5 text-[10px] uppercase tracking-widest ${chip.cls}`}
                      >
                        {chip.label}
                      </span>
                    )}
                  </div>

                  <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/85">
                    {s.content}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleHeart(s.suggestion_id)}
                      aria-pressed={s.i_hearted}
                      className={
                        "rounded-lg border px-2.5 py-1 text-[12px] transition " +
                        (s.i_hearted
                          ? "border-neon-red/40 bg-neon-red/10 text-neon-red"
                          : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10")
                      }
                    >
                      {s.i_hearted ? "❤️" : "🤍"} {s.heart_count}
                    </button>
                    {s.mine && (
                      <button
                        type="button"
                        onClick={() => void removeOwn(s.suggestion_id)}
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/50 hover:bg-white/10"
                      >
                        remove
                      </button>
                    )}
                    {isAdmin && (
                      <span className="ml-auto flex flex-wrap items-center gap-1">
                        {(["planned", "done", "declined"] as const).map(
                          (st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() =>
                                void adminStatus(s.suggestion_id, st)
                              }
                              className={
                                "rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-widest transition " +
                                (s.status === st
                                  ? "border-neon-blue/50 bg-neon-blue/15 text-neon-blue"
                                  : "border-white/10 bg-white/5 text-white/45 hover:bg-white/10")
                              }
                            >
                              {st}
                            </button>
                          )
                        )}
                        <button
                          type="button"
                          onClick={() => void adminDelete(s.suggestion_id)}
                          className="rounded-md border border-neon-red/30 bg-neon-red/10 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-neon-red hover:bg-neon-red/20"
                        >
                          ✕
                        </button>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
