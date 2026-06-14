"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PresenceDot } from "@/components/PresenceDot";
import { CommentSection } from "@/components/CommentSection";

export type ShortRow = {
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
};

export function ShortsFeed({
  currentUserId,
  initialShorts,
  initiallyLiked
}: {
  currentUserId: string;
  initialShorts: ShortRow[];
  initiallyLiked: string[];
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [shorts, setShorts] = useState<ShortRow[]>(initialShorts);
  const [liked, setLiked] = useState<Set<string>>(new Set(initiallyLiked));
  const [error, setError] = useState<string | null>(null);

  async function toggleLike(short: ShortRow) {
    const wasLiked = liked.has(short.id);
    setLiked((prev) => {
      const next = new Set(prev);
      if (wasLiked) next.delete(short.id);
      else next.add(short.id);
      return next;
    });
    setShorts((prev) =>
      prev.map((s) =>
        s.id === short.id
          ? { ...s, like_count: Math.max(0, s.like_count + (wasLiked ? -1 : 1)) }
          : s
      )
    );
    const { data, error: rpcErr } = await supabase.rpc("toggle_short_like", {
      p_short_id: short.id
    });
    if (rpcErr) {
      setError(rpcErr.message);
      // revert on failure
      setLiked((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.add(short.id);
        else next.delete(short.id);
        return next;
      });
      setShorts((prev) =>
        prev.map((s) =>
          s.id === short.id ? { ...s, like_count: short.like_count } : s
        )
      );
      return;
    }
    if (typeof data === "number") {
      setShorts((prev) =>
        prev.map((s) => (s.id === short.id ? { ...s, like_count: data } : s))
      );
    }
  }

  async function deleteShort(short: ShortRow) {
    if (short.author_id !== currentUserId) return;
    if (!confirm("Delete this short?")) return;
    const { error: delErr } = await supabase
      .from("shorts")
      .delete()
      .eq("id", short.id);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    setShorts((prev) => prev.filter((s) => s.id !== short.id));
  }

  // Move a short between Public and Private. RLS lets authors update their own.
  async function toggleVisibility(short: ShortRow) {
    if (short.author_id !== currentUserId) return;
    const next = !short.is_public;
    // Optimistic flip.
    setShorts((prev) =>
      prev.map((s) => (s.id === short.id ? { ...s, is_public: next } : s))
    );
    const { error: updErr } = await supabase
      .from("shorts")
      .update({ is_public: next })
      .eq("id", short.id);
    if (updErr) {
      setError(updErr.message);
      // Revert on failure.
      setShorts((prev) =>
        prev.map((s) =>
          s.id === short.id ? { ...s, is_public: short.is_public } : s
        )
      );
    }
  }

  if (shorts.length === 0) {
    return (
      <section className="surface-glass mt-5 p-8 text-center">
        <p className="font-display text-lg">No shorts yet.</p>
        <p className="mt-1 text-sm text-white/55">
          Be the first to post a 60-second moment.
        </p>
        <Link
          href="/shorts/new"
          className="mt-4 inline-block rounded-lg bg-neon-blue px-4 py-2 text-sm font-medium text-ink-900 shadow-glow-blue hover:bg-neon-blue/90"
        >
          + Post a short
        </Link>
      </section>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      {error && (
        <p className="rounded-md bg-neon-red/10 px-3 py-1.5 text-xs text-neon-red">
          {error}
        </p>
      )}
      {shorts.map((s) => (
        <ShortCard
          key={s.id}
          short={s}
          currentUserId={currentUserId}
          isMine={s.author_id === currentUserId}
          isLiked={liked.has(s.id)}
          onLike={() => void toggleLike(s)}
          onDelete={() => void deleteShort(s)}
          onToggleVisibility={() => void toggleVisibility(s)}
        />
      ))}
    </div>
  );
}

function ShortCard({
  short,
  currentUserId,
  isMine,
  isLiked,
  onLike,
  onDelete,
  onToggleVisibility
}: {
  short: ShortRow;
  currentUserId: string;
  isMine: boolean;
  isLiked: boolean;
  onLike: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Autoplay-on-scroll: when ≥60% of the card is visible, play. Otherwise pause.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            el.play().catch(() => {
              // autoplay blocked — user can press play
            });
          } else {
            el.pause();
          }
        }
      },
      { threshold: [0, 0.6, 1] }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const name = short.author_display_name ?? short.author_username ?? "Someone";
  const handle = short.author_username ?? "anon";

  return (
    <article className="surface-glass overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <PresenceDot state={short.author_presence_state ?? "offline"} pulse />
          <div className="min-w-0">
            <p className="truncate text-sm">
              <span className="text-white">{name}</span>
              {short.author_is_guest && (
                <span className="ml-1 rounded-sm bg-white/10 px-1 text-[9px] uppercase tracking-widest text-white/50">
                  guest
                </span>
              )}
            </p>
            <p className="truncate text-[11px] text-white/40">@{handle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/40">
          {!short.is_public && !isMine && (
            <span className="rounded-sm border border-white/10 bg-white/5 px-1.5 py-0.5 uppercase tracking-widest">
              🔒 private
            </span>
          )}
          {isMine && (
            <button
              type="button"
              onClick={onToggleVisibility}
              aria-label={short.is_public ? "Make this short private" : "Make this short public"}
              title={short.is_public ? "Currently public — tap to make private" : "Currently private — tap to make public"}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              {short.is_public ? "🌍 Public" : "🔒 Private"}
            </button>
          )}
          {isMine && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete this short"
              title="Delete"
              className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-white/60 hover:bg-neon-red/10 hover:text-neon-red"
            >
              🗑
            </button>
          )}
        </div>
      </header>

      <div className="relative bg-black">
        <video
          ref={videoRef}
          src={short.video_url}
          poster={short.thumb_url ?? undefined}
          controls
          playsInline
          loop
          muted
          preload="metadata"
          className="mx-auto block max-h-[80vh] w-full bg-black"
        />
        <button
          type="button"
          onClick={onLike}
          aria-pressed={isLiked}
          aria-label={isLiked ? "Unlike" : "Like"}
          className={clsx(
            "absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm shadow-lg backdrop-blur transition",
            isLiked
              ? "bg-neon-red/85 text-white"
              : "bg-black/55 text-white/85 hover:bg-black/70"
          )}
        >
          <span aria-hidden>{isLiked ? "❤️" : "🤍"}</span>
          <span className="font-mono text-xs">{short.like_count}</span>
        </button>
      </div>

      {short.caption && (
        <p className="border-t border-white/5 px-4 py-2 text-sm text-white/85">
          {short.caption}
        </p>
      )}

      <CommentSection
        kind="short"
        parentId={short.id}
        currentUserId={currentUserId}
        initialCount={short.comment_count ?? 0}
      />
    </article>
  );
}
