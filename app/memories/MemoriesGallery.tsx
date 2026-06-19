"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type MemoryRow = {
  id: string;
  kind: "text" | "image" | "video";
  body: string | null;
  image_url: string | null;
  media_url: string | null;
  poster_url: string | null;
  audience_kind: "public" | "friends" | "close_friends";
  expires_at: string;
  created_at: string;
  view_count: number | null;
};

const AUDIENCE_LABEL: Record<MemoryRow["audience_kind"], string> = {
  public: "🌐 Everyone",
  friends: "👥 Friends",
  close_friends: "💚 Close"
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function MemoriesGallery({ initialMemories }: { initialMemories: MemoryRow[] }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [memories, setMemories] = useState<MemoryRow[]>(initialMemories);
  const [open, setOpen] = useState<MemoryRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function reshare(m: MemoryRow) {
    if (busy) return;
    setBusy(true);
    setNote(null);
    // Fresh 24h story re-using the same media; default expiry from the column.
    const { error } = await supabase.from("stories").insert({
      author_id: (await supabase.auth.getUser()).data.user?.id,
      kind: m.kind,
      body: m.body,
      image_url: m.image_url,
      media_url: m.media_url,
      poster_url: m.poster_url,
      audience_kind: m.audience_kind
    });
    setBusy(false);
    if (error) {
      setNote(error.message);
      return;
    }
    setNote("Re-shared as a new 24-hour moment.");
    setOpen(null);
    router.refresh();
  }

  async function remove(m: MemoryRow) {
    if (!confirm("Delete this memory permanently? This can't be undone.")) return;
    setBusy(true);
    const { error } = await supabase.from("stories").delete().eq("id", m.id);
    setBusy(false);
    if (error) {
      setNote(error.message);
      return;
    }
    setMemories((prev) => prev.filter((x) => x.id !== m.id));
    setOpen(null);
  }

  if (memories.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-8 text-center text-sm text-white/50">
        No memories yet. Moments you post will be archived here automatically.
      </p>
    );
  }

  return (
    <>
      {note && (
        <p className="mb-3 rounded-md bg-neon-mint/10 px-2 py-1 text-xs text-neon-mint">{note}</p>
      )}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {memories.map((m) => {
          const thumb = m.poster_url ?? m.image_url;
          const live = new Date(m.expires_at).getTime() > Date.now();
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setOpen(m)}
              className="relative aspect-[9/16] overflow-hidden rounded-lg border border-white/10 bg-ink-800"
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className="grid h-full w-full place-items-center bg-gradient-to-br from-neon-purple/30 via-neon-blue/25 to-neon-mint/25 px-1.5 text-center text-[10px] leading-tight text-white/85">
                  {m.body?.slice(0, 60) ?? "📝"}
                </span>
              )}
              {m.kind === "video" && (
                <span className="absolute right-1 top-1 text-xs drop-shadow">🎬</span>
              )}
              {live && (
                <span className="absolute left-1 top-1 rounded bg-neon-mint/80 px-1 text-[9px] font-medium text-ink-900">
                  LIVE
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 pb-1 pt-3 text-[9px] text-white/80">
                {fmtDate(m.created_at)}
              </span>
            </button>
          );
        })}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(null);
          }}
        >
          <div className="flex w-full max-w-md flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>
                {fmtDate(open.created_at)} · {AUDIENCE_LABEL[open.audience_kind]} · 👁{" "}
                {open.view_count ?? 0}
              </span>
              <button
                onClick={() => setOpen(null)}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 hover:bg-white/10"
              >
                ✕
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800">
              {open.kind === "video" && open.media_url ? (
                <video
                  src={open.media_url}
                  poster={open.poster_url ?? undefined}
                  controls
                  playsInline
                  className="max-h-[70vh] w-full bg-black object-contain"
                />
              ) : open.kind === "image" && open.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={open.image_url}
                  alt={open.body ?? ""}
                  className="max-h-[70vh] w-full bg-black object-contain"
                />
              ) : (
                <div className="grid min-h-[280px] place-items-center bg-gradient-to-br from-neon-purple/30 via-neon-blue/25 to-neon-mint/25 px-6 py-10 text-center">
                  <p className="text-lg font-medium text-white">{open.body}</p>
                </div>
              )}
              {open.kind !== "text" && open.body && (
                <p className="bg-black/40 px-4 py-2 text-sm text-white/85">{open.body}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void reshare(open)}
                disabled={busy}
                className="flex-1 rounded-lg border border-neon-blue/40 bg-neon-blue/10 px-3 py-2 text-sm text-neon-blue hover:bg-neon-blue/20 disabled:opacity-50"
              >
                ↻ Re-share
              </button>
              <button
                onClick={() => void remove(open)}
                disabled={busy}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-neon-red/10 hover:text-neon-red disabled:opacity-50"
              >
                🗑 Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
