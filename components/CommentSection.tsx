"use client";

// Karochat — shared comment thread for Shorts and long-form Videos.
//
// Self-contained: lazily loads comments when expanded, lets the signed-in user
// add and delete (own) comments, and keeps a local count in sync with the
// DB-maintained comment_count trigger. Reused by ShortsFeed and VideosFeed by
// passing kind="short" | "video".

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type CommentRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_username: string | null;
  author_display_name: string | null;
  author_is_guest: boolean | null;
};

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

export function CommentSection({
  kind,
  parentId,
  currentUserId,
  initialCount
}: {
  kind: "short" | "video" | "post" | "note" | "story";
  parentId: string;
  currentUserId: string;
  initialCount: number;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [count, setCount] = useState(initialCount);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // While we open a 1-to-1 DM with a commenter (id of the author being opened).
  const [dmOpening, setDmOpening] = useState<string | null>(null);

  // Tapping a commenter's name opens (or reuses) a private DM room with them —
  // same path the rest of the app uses (get_or_create_dm → /rooms/{id}). Own
  // comments and guests (who have no inbox) are not openable.
  const openDm = useCallback(
    async (authorId: string) => {
      if (!authorId || authorId === currentUserId || dmOpening) return;
      setDmOpening(authorId);
      setErr(null);
      const { data, error } = await supabase.rpc("get_or_create_dm", {
        p_target_user_id: authorId
      });
      if (error || !data) {
        setDmOpening(null);
        setErr(error?.message ?? "Couldn't open a private chat with this person.");
        return;
      }
      router.push(`/rooms/${data}`);
      router.refresh();
    },
    [supabase, router, currentUserId, dmOpening]
  );

  const view = `${kind}_comments_with_author`;
  const table = `${kind}_comments`;
  const idCol = `${kind}_id`;

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from(view)
      .select("*")
      .eq(idCol, parentId)
      .order("created_at", { ascending: true })
      .limit(300);
    if (error) setErr(error.message);
    else {
      const rows = (data ?? []) as CommentRow[];
      setComments(rows);
      setCount(rows.length);
    }
    setLoading(false);
  }, [supabase, view, idCol, parentId]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && comments === null) void load();
  }

  async function post() {
    const text = body.trim();
    if (!text || posting) return;
    setPosting(true);
    setErr(null);
    const { error } = await supabase
      .from(table)
      .insert({ [idCol]: parentId, author_id: currentUserId, body: text });
    if (error) {
      setErr(error.message);
      setPosting(false);
      return;
    }
    setBody("");
    setCount((c) => c + 1);
    await load();
    setPosting(false);
  }

  async function remove(id: string) {
    const prev = comments;
    setComments((cs) => (cs ? cs.filter((c) => c.id !== id) : cs));
    setCount((c) => Math.max(0, c - 1));
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      setErr(error.message);
      setComments(prev ?? null);
      setCount((c) => c + 1);
    }
  }

  return (
    <div className="border-t border-white/5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-white/60 transition hover:text-white/85"
      >
        <span aria-hidden>💬</span>
        <span>
          {count > 0 ? `${count} comment${count === 1 ? "" : "s"}` : "Comments"}
        </span>
        <span className="ml-auto text-white/30">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-3">
          {/* Composer */}
          <div className="flex items-start gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void post();
                }
              }}
              rows={1}
              maxLength={1000}
              placeholder="Add a comment…"
              className="min-h-[2.25rem] flex-1 resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/60"
            />
            <button
              type="button"
              onClick={() => void post()}
              disabled={!body.trim() || posting}
              className="shrink-0 rounded-xl border border-neon-blue/50 bg-neon-blue/20 px-3 py-2 text-sm font-medium text-white transition hover:bg-neon-blue/30 disabled:opacity-50"
            >
              {posting ? "…" : "Post"}
            </button>
          </div>

          {err && (
            <p className="rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{err}</p>
          )}

          {loading && <p className="text-xs text-white/40">Loading comments…</p>}

          {!loading && comments && comments.length === 0 && (
            <p className="text-xs text-white/40">No comments yet. Be the first.</p>
          )}

          {comments && comments.length > 0 && (
            <ul className="space-y-2">
              {comments.map((c) => {
                const name = c.author_display_name ?? c.author_username ?? "Someone";
                // A name is tappable (→ private DM) unless it's the viewer's own
                // comment or a guest (guests can't receive DMs).
                const canDm = c.author_id !== currentUserId && !c.author_is_guest;
                return (
                  <li key={c.id} className="rounded-xl border border-white/5 bg-white/5 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-xs">
                        {canDm ? (
                          <button
                            type="button"
                            onClick={() => void openDm(c.author_id)}
                            disabled={dmOpening === c.author_id}
                            title={`Message ${name} privately`}
                            className="rounded text-neon-blue underline decoration-dotted underline-offset-2 hover:text-neon-blue/80 disabled:opacity-60"
                          >
                            {dmOpening === c.author_id ? "Opening…" : name}
                          </button>
                        ) : (
                          <span className="text-white/85">{name}</span>
                        )}
                        {c.author_is_guest && (
                          <span className="ml-1 rounded-sm bg-white/10 px-1 text-[9px] uppercase tracking-widest text-white/45">
                            guest
                          </span>
                        )}
                        <span className="ml-2 text-white/35">{timeAgo(c.created_at)}</span>
                      </p>
                      {c.author_id === currentUserId && (
                        <button
                          type="button"
                          onClick={() => void remove(c.id)}
                          aria-label="Delete comment"
                          title="Delete"
                          className="shrink-0 rounded-md px-1.5 text-white/40 hover:text-neon-red"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/85">
                      {c.body}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
