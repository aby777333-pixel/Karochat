"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type KitItem = {
  id: string;
  kind: "link" | "snippet" | "flashcard" | "note";
  title: string;
  body: string;
  authorId: string;
  createdAt: number;
};

/**
 * Teaching kit — a per-room scratchpad for shareable resources (links,
 * code snippets, flashcards, notes). Stored in localStorage per
 * (user, room) so each member curates their own list; the "Share to chat"
 * button drops a formatted message into the room so the kit can travel.
 *
 * Designed for the Students area but available in every room — anyone
 * teaching anyone benefits from a clean place to drop resources.
 */
export function TeachingKitButton({
  roomId,
  currentUserId
}: {
  roomId: string;
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Open teaching kit"
        aria-label="Open teaching kit"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-neon-purple/40 bg-neon-purple/10 text-neon-purple transition hover:bg-neon-purple/20"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>

      {open && typeof document !== "undefined" &&
        createPortal(
          <TeachingKitPanel
            roomId={roomId}
            currentUserId={currentUserId}
            onClose={() => setOpen(false)}
          />,
          document.body
        )}
    </>
  );
}

function storageKey(userId: string, roomId: string) {
  return `karochat:kit:${userId}:${roomId}`;
}

function TeachingKitPanel({
  roomId,
  currentUserId,
  onClose
}: {
  roomId: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [items, setItems] = useState<KitItem[]>([]);
  const [kind, setKind] = useState<KitItem["kind"]>("link");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState<string | null>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(currentUserId, roomId));
      if (raw) {
        const parsed = JSON.parse(raw) as KitItem[];
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      // ignore
    }
  }, [currentUserId, roomId]);

  function persist(next: KitItem[]) {
    setItems(next);
    try {
      window.localStorage.setItem(
        storageKey(currentUserId, roomId),
        JSON.stringify(next)
      );
    } catch {
      // ignore quota errors
    }
  }

  function add() {
    if (!title.trim() && !body.trim()) return;
    const item: KitItem = {
      id: Math.random().toString(36).slice(2),
      kind,
      title: title.trim() || formatKindLabel(kind),
      body: body.trim(),
      authorId: currentUserId,
      createdAt: Date.now()
    };
    persist([item, ...items]);
    setTitle("");
    setBody("");
  }

  function remove(id: string) {
    persist(items.filter((i) => i.id !== id));
  }

  async function shareToChat(item: KitItem) {
    setBusy(true);
    setShared(null);
    const formatted = formatForChat(item);
    const { error } = await supabase.from("messages").insert({
      room_id: roomId,
      sender_id: currentUserId,
      content: formatted,
      type: "text"
    });
    setBusy(false);
    if (error) {
      setShared(`Couldn't share: ${error.message}`);
      return;
    }
    setShared(`Shared "${item.title}" to chat.`);
    setTimeout(() => setShared(null), 2500);
  }

  return (
    <div
      className="fixed inset-0 z-[85] flex items-start justify-end bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Teaching kit"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="surface-glass h-full w-[min(420px,100vw)] overflow-y-auto p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-neon-purple/80">
              🧰 Teaching kit
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold text-white">
              Resources for this room
            </h2>
            <p className="mt-1 text-xs text-white/55">
              Your kit is private. Hit <strong>Share</strong> to drop an item
              into the chat for everyone.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
            className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/60 hover:bg-white/10"
          >
            ✕
          </button>
        </header>

        {/* Add new */}
        <section className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex flex-wrap gap-1 text-[11px]">
            {(["link", "snippet", "flashcard", "note"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-md border px-2 py-1 transition ${
                  kind === k
                    ? "border-neon-purple/60 bg-neon-purple/10 text-neon-purple"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {kindGlyph(k)} {formatKindLabel(k)}
              </button>
            ))}
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder={
              kind === "link"
                ? "Title (e.g. Khan Academy — derivatives)"
                : kind === "flashcard"
                ? "Front of the card"
                : "Title (optional)"
            }
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-purple/60"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={kind === "snippet" ? 5 : 3}
            placeholder={
              kind === "link"
                ? "https://… (paste a URL)"
                : kind === "snippet"
                ? "Paste code, math, or any block of text."
                : kind === "flashcard"
                ? "Back of the card — the answer."
                : "Anything you'd want to reread later."
            }
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs outline-none focus:border-neon-purple/60"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={add}
              className="rounded-lg border border-neon-purple/40 bg-neon-purple/15 px-3 py-1.5 text-xs text-neon-purple hover:bg-neon-purple/25"
            >
              + Add to kit
            </button>
          </div>
        </section>

        {shared && (
          <p className="mt-3 rounded-md bg-neon-mint/10 px-2 py-1 text-xs text-neon-mint">
            {shared}
          </p>
        )}

        <section className="mt-4">
          <p className="text-[10px] uppercase tracking-widest text-white/40">
            In your kit · {items.length}
          </p>
          {items.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-xs text-white/45">
              Nothing here yet. Drop a link, a snippet, a flashcard, or a note.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white">
                      {kindGlyph(it.kind)} {it.title}
                    </p>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => void shareToChat(it)}
                        disabled={busy}
                        title="Post to room chat"
                        className="rounded-md border border-neon-mint/30 bg-neon-mint/10 px-2 py-0.5 text-[10px] text-neon-mint hover:bg-neon-mint/20 disabled:opacity-60"
                      >
                        Share
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(it.id)}
                        title="Remove from kit"
                        className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60 hover:bg-white/10"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {it.body && (
                    <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-black/30 p-2 font-mono text-[11px] text-white/75">
                      {it.body}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

function kindGlyph(k: KitItem["kind"]) {
  switch (k) {
    case "link":
      return "🔗";
    case "snippet":
      return "✂️";
    case "flashcard":
      return "🃏";
    case "note":
      return "📝";
  }
}

function formatKindLabel(k: KitItem["kind"]) {
  switch (k) {
    case "link":
      return "Link";
    case "snippet":
      return "Snippet";
    case "flashcard":
      return "Flashcard";
    case "note":
      return "Note";
  }
}

function formatForChat(item: KitItem) {
  switch (item.kind) {
    case "link":
      return `🔗 **${item.title}**\n${item.body}`;
    case "snippet":
      return `✂️ **${item.title}**\n\`\`\`\n${item.body}\n\`\`\``;
    case "flashcard":
      return `🃏 **${item.title}**\n${item.body ? `↳ ${item.body}` : ""}`;
    case "note":
      return `📝 **${item.title}**\n${item.body}`;
  }
}
