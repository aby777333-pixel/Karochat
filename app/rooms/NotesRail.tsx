"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CommentSection } from "@/components/CommentSection";

export type NoteRow = {
  id: string;
  author_profile_id: string;
  body: string;
  audience_kind: "public" | "followers" | "close_friends";
  created_at: string;
  expires_at: string;
  author_username: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  is_mine: boolean;
};

const AUDIENCE_OPTS: { value: NoteRow["audience_kind"]; label: string; hint: string }[] = [
  { value: "followers", label: "Followers", hint: "People who follow you" },
  { value: "close_friends", label: "Close friends", hint: "Your 💚 list only" },
  { value: "public", label: "Anyone", hint: "Visible to everyone" }
];

function initials(name: string | null, handle: string | null): string {
  const base = (name || handle || "?").trim();
  return base.slice(0, 1).toUpperCase();
}

function Avatar({ url, name, handle }: { url: string | null; name: string | null; handle: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-10 w-10 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500/60 to-cyan-500/60 text-sm font-semibold text-white">
      {initials(name, handle)}
    </div>
  );
}

export function NotesRail({
  initialNotes,
  currentUserId
}: {
  initialNotes: NoteRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [notes, setNotes] = useState<NoteRow[]>(initialNotes);
  const [composeOpen, setComposeOpen] = useState(false);
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<NoteRow["audience_kind"]>("followers");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  // The friend note opened in the detail / comments sheet.
  const [viewNote, setViewNote] = useState<NoteRow | null>(null);

  const myNote = notes.find((n) => n.is_mine) || null;
  // Own note first, then most recent.
  const others = notes
    .filter((n) => !n.is_mine)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  function openCompose() {
    setError(null);
    setBody(myNote?.body ?? "");
    setAudience(myNote?.audience_kind ?? "followers");
    setComposeOpen(true);
  }

  async function refresh() {
    const { data } = await supabase.rpc("list_active_notes");
    if (data) setNotes(data as NoteRow[]);
  }

  async function share() {
    const trimmed = body.trim();
    if (!trimmed) {
      setError("Write something first.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("set_my_note", {
      p_body: trimmed.slice(0, 60),
      p_audience: audience
    });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message || "Could not share your note.");
      return;
    }
    setComposeOpen(false);
    await refresh();
  }

  async function clearNote() {
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("clear_my_note");
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message || "Could not clear your note.");
      return;
    }
    setComposeOpen(false);
    await refresh();
  }

  async function openDM(note: NoteRow) {
    setOpening(note.author_profile_id);
    const { data, error: rpcErr } = await supabase.rpc("get_or_create_dm", {
      p_target_user_id: note.author_profile_id
    });
    setOpening(null);
    if (rpcErr || !data) return;
    router.push(`/rooms/${data}`);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-white/40">
        <span>📝 Notes</span>
        <span className="text-white/25">· 24h</span>
      </div>

      <div className="scroll-thin flex items-start gap-3 overflow-x-auto px-1 pb-1">
        {/* Your note — compose / edit */}
        <button
          type="button"
          onClick={openCompose}
          className="flex w-[68px] shrink-0 flex-col items-center gap-1 text-center"
        >
          <div className="relative">
            <Avatar
              url={myNote?.author_avatar_url ?? null}
              name={myNote?.author_display_name ?? "You"}
              handle={myNote?.author_username ?? null}
            />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-bold text-black ring-2 ring-[#0b0f14]">
              {myNote ? "✎" : "+"}
            </span>
          </div>
          {myNote ? (
            <span className="line-clamp-2 max-w-[68px] rounded-lg bg-white/10 px-1.5 py-0.5 text-[10px] leading-tight text-white/80">
              {myNote.body}
            </span>
          ) : (
            <span className="text-[10px] text-white/50">Leave a note</span>
          )}
        </button>

        {/* Friends' notes */}
        {others.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => setViewNote(n)}
            className="flex w-[68px] shrink-0 flex-col items-center gap-1 text-center"
          >
            <div className="relative">
              <Avatar
                url={n.author_avatar_url}
                name={n.author_display_name}
                handle={n.author_username}
              />
              <span className="absolute -top-2 left-1/2 max-w-[110px] -translate-x-1/2 whitespace-nowrap rounded-full bg-white/15 px-1.5 py-px text-[9px] text-white/85 backdrop-blur">
                💬
              </span>
            </div>
            <span className="line-clamp-2 max-w-[68px] rounded-lg bg-white/10 px-1.5 py-0.5 text-[10px] leading-tight text-white/85">
              {n.body}
            </span>
            <span className="max-w-[68px] truncate text-[10px] text-white/45">
              {n.author_display_name || n.author_username || "Someone"}
            </span>
          </button>
        ))}

        {others.length === 0 && (
          <div className="flex h-[78px] items-center px-2 text-[11px] text-white/30">
            No notes from your circle yet.
          </div>
        )}
      </div>

      {viewNote && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center"
          onClick={() => setViewNote(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-white/10 bg-[#0b0f14] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 p-4">
              <Avatar
                url={viewNote.author_avatar_url}
                name={viewNote.author_display_name}
                handle={viewNote.author_username}
              />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => openDM(viewNote)}
                  disabled={opening === viewNote.author_profile_id}
                  title="Message privately"
                  className="text-sm font-semibold text-cyan-300 underline decoration-dotted underline-offset-2 hover:text-cyan-200 disabled:opacity-60"
                >
                  {opening === viewNote.author_profile_id
                    ? "Opening…"
                    : viewNote.author_display_name || viewNote.author_username || "Someone"}
                </button>
                <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-snug text-white">
                  {viewNote.body}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewNote(null)}
                aria-label="Close"
                className="shrink-0 rounded-md px-1.5 py-0.5 text-white/40 hover:text-white"
              >
                ✕
              </button>
            </div>
            <CommentSection
              kind="note"
              parentId={viewNote.id}
              currentUserId={currentUserId}
              initialCount={0}
            />
          </div>
        </div>
      )}

      {composeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center"
          onClick={() => !busy && setComposeOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b0f14] p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Leave a note</h3>
              <span className="text-[11px] text-white/40">{body.length}/60</span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 60))}
              maxLength={60}
              rows={2}
              autoFocus
              placeholder="Share a thought…"
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan-400/50 focus:outline-none"
            />

            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {AUDIENCE_OPTS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAudience(opt.value)}
                  title={opt.hint}
                  className={`rounded-lg border px-2 py-1.5 text-[11px] transition ${
                    audience === opt.value
                      ? "border-cyan-400/60 bg-cyan-400/15 text-white"
                      : "border-white/10 bg-white/5 text-white/60 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {error && <p className="mt-2 text-[11px] text-rose-400">{error}</p>}

            <div className="mt-4 flex items-center justify-between gap-2">
              {myNote ? (
                <button
                  type="button"
                  onClick={clearNote}
                  disabled={busy}
                  className="rounded-lg px-3 py-2 text-[12px] text-rose-300/80 hover:text-rose-300 disabled:opacity-50"
                >
                  Clear note
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setComposeOpen(false)}
                  disabled={busy}
                  className="rounded-lg px-3 py-2 text-[12px] text-white/60 hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={share}
                  disabled={busy || !body.trim()}
                  className="rounded-lg bg-cyan-500 px-4 py-2 text-[12px] font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
                >
                  {busy ? "Sharing…" : myNote ? "Update" : "Share"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
