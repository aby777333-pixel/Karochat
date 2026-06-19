"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CommentSection } from "@/components/CommentSection";

export type SpotItem = {
  id: string;
  author_id: string;
  video_url: string;
  thumb_url: string | null;
  caption: string | null;
  is_public: boolean;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  author_username: string | null;
  author_display_name: string | null;
  author_is_guest: boolean | null;
  author_presence_state: string | null;
  viewer_liked: boolean;
};

function compact(n: number) {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

export function SpotlightFeed({
  currentUserId,
  initialItems,
  pageSize
}: {
  currentUserId: string;
  initialItems: SpotItem[];
  pageSize: number;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [items, setItems] = useState<SpotItem[]>(initialItems);
  const [muted, setMuted] = useState(true);
  const [commentsFor, setCommentsFor] = useState<SpotItem | null>(null);
  const [hasMore, setHasMore] = useState(initialItems.length >= pageSize);
  const [loading, setLoading] = useState(false);

  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const viewedRef = useRef<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const countView = useCallback(
    (id: string, authorId: string) => {
      if (authorId === currentUserId || viewedRef.current.has(id)) return;
      viewedRef.current.add(id);
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, view_count: it.view_count + 1 } : it)));
      void supabase.rpc("increment_short_view", { p_short_id: id });
    },
    [supabase, currentUserId]
  );

  // Autoplay the slide in view; pause the rest; count a view once.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLVideoElement;
          const id = el.dataset.id!;
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            el.muted = muted;
            el.play().catch(() => {});
            countView(id, el.dataset.author!);
          } else {
            el.pause();
          }
        }
      },
      { threshold: [0, 0.6, 1] }
    );
    videoRefs.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [items, muted, countView]);

  // Keep mute in sync across all videos when toggled.
  useEffect(() => {
    videoRefs.current.forEach((el) => {
      el.muted = muted;
    });
  }, [muted]);

  // Infinite scroll.
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const { data } = await supabase.rpc("list_spotlight", {
      p_limit: pageSize,
      p_offset: items.length
    });
    const page = (data ?? []) as SpotItem[];
    setItems((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...page.filter((p) => !seen.has(p.id))];
    });
    setHasMore(page.length >= pageSize);
    setLoading(false);
  }, [supabase, items.length, pageSize, loading, hasMore]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "400px" }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [loadMore]);

  async function toggleLike(it: SpotItem) {
    const wasLiked = it.viewer_liked;
    setItems((prev) =>
      prev.map((x) =>
        x.id === it.id
          ? { ...x, viewer_liked: !wasLiked, like_count: Math.max(0, x.like_count + (wasLiked ? -1 : 1)) }
          : x
      )
    );
    const { data, error } = await supabase.rpc("toggle_short_like", { p_short_id: it.id });
    if (error) {
      setItems((prev) =>
        prev.map((x) =>
          x.id === it.id ? { ...x, viewer_liked: wasLiked, like_count: it.like_count } : x
        )
      );
      return;
    }
    if (typeof data === "number") {
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, like_count: data } : x)));
    }
  }

  if (items.length === 0) {
    return (
      <div className="my-8 text-center">
        <p className="font-display text-lg">Nothing in Spotlight yet.</p>
        <p className="mt-1 text-sm text-white/55">Post a public short and it could land here.</p>
        <Link
          href="/shorts/new"
          className="mt-4 inline-block rounded-lg bg-neon-blue px-4 py-2 text-sm font-medium text-ink-900 shadow-glow-blue hover:bg-neon-blue/90"
        >
          + Post a short
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="-mx-4 h-[78vh] snap-y snap-mandatory overflow-y-auto scroll-smooth">
        {items.map((it) => {
          const name = it.author_display_name ?? it.author_username ?? "Someone";
          const handle = it.author_username ?? "anon";
          return (
            <section
              key={it.id}
              className="relative flex h-[78vh] snap-start items-center justify-center bg-black"
            >
              <video
                ref={(el) => {
                  if (el) videoRefs.current.set(it.id, el);
                  else videoRefs.current.delete(it.id);
                }}
                data-id={it.id}
                data-author={it.author_id}
                src={it.video_url}
                poster={it.thumb_url ?? undefined}
                playsInline
                loop
                muted={muted}
                preload="metadata"
                onClick={() => setMuted((m) => !m)}
                className="max-h-full w-full object-contain"
              />

              {/* Mute hint */}
              <button
                onClick={() => setMuted((m) => !m)}
                className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white/85 backdrop-blur"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? "🔇" : "🔊"}
              </button>

              {/* Right action rail */}
              <div className="absolute bottom-20 right-3 flex flex-col items-center gap-4 text-white">
                <button
                  onClick={() => void toggleLike(it)}
                  className="flex flex-col items-center gap-0.5"
                  aria-pressed={it.viewer_liked}
                  aria-label={it.viewer_liked ? "Unlike" : "Like"}
                >
                  <span className="text-2xl drop-shadow">{it.viewer_liked ? "❤️" : "🤍"}</span>
                  <span className="text-xs drop-shadow">{compact(it.like_count)}</span>
                </button>
                <button
                  onClick={() => setCommentsFor(it)}
                  className="flex flex-col items-center gap-0.5"
                  aria-label="Comments"
                >
                  <span className="text-2xl drop-shadow">💬</span>
                  <span className="text-xs drop-shadow">{compact(it.comment_count)}</span>
                </button>
                <div className="flex flex-col items-center gap-0.5 opacity-90">
                  <span className="text-xl drop-shadow">👁</span>
                  <span className="text-xs drop-shadow">{compact(it.view_count)}</span>
                </div>
              </div>

              {/* Bottom meta */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 pr-16">
                <Link href={`/u/${handle}`} className="text-sm font-semibold text-white hover:underline">
                  @{handle}
                  {it.author_is_guest && (
                    <span className="ml-1.5 rounded-sm bg-white/15 px-1 text-[9px] uppercase tracking-widest text-white/70">
                      guest
                    </span>
                  )}
                </Link>
                {it.caption && <p className="mt-1 line-clamp-2 text-sm text-white/90">{it.caption}</p>}
              </div>
            </section>
          );
        })}

        <div ref={sentinelRef} className="h-2" />
        {loading && <p className="py-3 text-center text-xs text-white/40">Loading more…</p>}
        {!hasMore && (
          <p className="py-4 text-center text-xs text-white/30">You’re all caught up ✨</p>
        )}
      </div>

      {commentsFor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCommentsFor(null);
          }}
        >
          <div className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-white/10 bg-ink-800 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-white">Comments</p>
              <button
                onClick={() => setCommentsFor(null)}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-white/60 hover:bg-white/10"
              >
                ✕
              </button>
            </div>
            <CommentSection
              kind="short"
              parentId={commentsFor.id}
              currentUserId={currentUserId}
              initialCount={commentsFor.comment_count}
            />
          </div>
        </div>
      )}
    </>
  );
}
