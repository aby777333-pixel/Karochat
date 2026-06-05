"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type StoryRow = {
  id: string;
  author_id: string;
  kind: "text" | "image";
  body: string | null;
  image_url: string | null;
  expires_at: string;
  created_at: string;
  author_username: string | null;
  author_display_name: string | null;
  author_is_guest: boolean | null;
  author_presence_state: string | null;
};

export function StoriesStrip({
  initialStories,
  currentUserId,
  isAdmin = false
}: {
  initialStories: StoryRow[];
  currentUserId: string;
  isAdmin?: boolean;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [stories, setStories] = useState<StoryRow[]>(initialStories);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Drop stories that quietly expired client-side.
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setStories((prev) => prev.filter((s) => new Date(s.expires_at).getTime() > now));
    }, 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // You can always delete your own moment (RLS: stories_delete_own); an
  // operator can take down anyone's via the admin_delete_story RPC.
  function canDelete(story: StoryRow) {
    return story.author_id === currentUserId || isAdmin;
  }

  async function deleteStory(story: StoryRow) {
    if (!confirm("Delete this moment?")) return;
    const mine = story.author_id === currentUserId;
    const { error } = mine
      ? await supabase.from("stories").delete().eq("id", story.id)
      : await supabase.rpc("admin_delete_story", { p_id: story.id });
    if (error) {
      alert(error.message);
      return;
    }
    setStories((prev) => prev.filter((s) => s.id !== story.id));
    setOpenIndex(null);
    router.refresh();
  }

  if (stories.length === 0) {
    return (
      <section className="surface-glass tint-purple flex items-center gap-3 overflow-x-auto px-4 py-3 pr-10">
        <Link
          href="/stories/new"
          className="flex shrink-0 items-center gap-2 rounded-xl border border-dashed border-neon-blue/40 bg-neon-blue/5 px-3 py-2 text-xs text-neon-blue hover:bg-neon-blue/10"
        >
          <span aria-hidden className="text-base">＋</span>
          <span>Post a moment</span>
        </Link>
        <span className="text-[11px] text-white/40">No live moments right now.</span>
      </section>
    );
  }

  return (
    <>
      <section className="surface-glass tint-purple flex items-center gap-2 overflow-x-auto px-3 py-3 pr-10">
        <Link
          href="/stories/new"
          className="flex shrink-0 flex-col items-center gap-1 rounded-xl border border-dashed border-neon-blue/40 bg-neon-blue/5 px-3 py-2 text-[11px] text-neon-blue hover:bg-neon-blue/10"
          title="Post a 24-hour moment"
        >
          <span aria-hidden className="text-lg leading-none">＋</span>
          <span>Add</span>
        </Link>
        {stories.map((s, i) => {
          const author = s.author_display_name ?? s.author_username ?? "anon";
          const handle = s.author_username ?? "anon";
          const mine = s.author_id === currentUserId;
          return (
            <div key={s.id} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setOpenIndex(i)}
                className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-2 hover:bg-white/10"
                aria-label={`Open story by ${author}`}
              >
                <div className="h-12 w-12 overflow-hidden rounded-lg bg-black/30">
                  {s.kind === "image" && s.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-neon-purple/30 via-neon-blue/30 to-neon-mint/30 text-[10px] text-white/85">
                      📝
                    </div>
                  )}
                </div>
                <span className="max-w-[64px] truncate text-[10px] text-white/70">
                  @{handle}
                </span>
              </button>
              {canDelete(s) && (
                <button
                  type="button"
                  onClick={() => void deleteStory(s)}
                  className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-white/15 bg-ink-800/90 text-[11px] leading-none text-white/70 shadow-sm hover:bg-neon-red/20 hover:text-neon-red"
                  aria-label={mine ? "Delete your moment" : "Remove this moment (admin)"}
                  title={mine ? "Delete this moment" : "Remove this moment (admin)"}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </section>

      {openIndex !== null && stories[openIndex] && (
        <StoryViewer
          story={stories[openIndex]!}
          hasPrev={openIndex > 0}
          hasNext={openIndex < stories.length - 1}
          onPrev={() => setOpenIndex(Math.max(0, openIndex - 1))}
          onNext={() => setOpenIndex(Math.min(stories.length - 1, openIndex + 1))}
          onClose={() => setOpenIndex(null)}
          onDelete={
            canDelete(stories[openIndex]!)
              ? () => void deleteStory(stories[openIndex]!)
              : undefined
          }
        />
      )}
    </>
  );
}

function StoryViewer({
  story,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
  onDelete
}: {
  story: StoryRow;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "ArrowRight" && hasNext) onNext();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hasPrev, hasNext, onPrev, onNext, onClose]);

  const author = story.author_display_name ?? story.author_username ?? "Someone";
  const expiresIn = Math.max(
    0,
    Math.round((new Date(story.expires_at).getTime() - Date.now()) / 60000)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex w-full max-w-md flex-col gap-2">
        <div className="flex items-center justify-between gap-3 text-xs text-white/70">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-white/60 hover:bg-white/10"
              aria-label="Back"
              title="Back"
            >
              ←
            </button>
            <p className="min-w-0 truncate">
              <span className="text-white">{author}</span>
              <span className="ml-2 text-white/40">@{story.author_username ?? "anon"}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 text-white/40">
            <span>{expiresIn}m left</span>
            {onDelete && (
              <button
                onClick={onDelete}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-white/60 hover:bg-neon-red/10 hover:text-neon-red"
                aria-label="Delete"
              >
                🗑
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-white/60 hover:bg-white/10"
              aria-label="Close"
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-800/80 shadow-glow-blue">
          {story.kind === "image" && story.image_url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={story.image_url}
                alt={story.body ?? "story"}
                className="block max-h-[75vh] w-full bg-black object-contain"
              />
              {story.body && (
                <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-sm text-white">
                  {story.body}
                </p>
              )}
            </>
          ) : (
            <div className="grid min-h-[300px] place-items-center bg-gradient-to-br from-neon-purple/30 via-neon-blue/25 to-neon-mint/25 px-6 py-12 text-center">
              <p className="text-xl font-medium leading-snug text-white">
                {story.body}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2">
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10 disabled:opacity-30"
          >
            ← Prev
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10 disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
