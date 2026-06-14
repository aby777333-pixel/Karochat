"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PresenceDot } from "@/components/PresenceDot";
import { CommentSection } from "@/components/CommentSection";
import { isDirectVideo } from "@/lib/videoEmbed";

export type VideoRow = {
  id: string;
  author_id: string;
  kind: "upload" | "link";
  video_url: string | null;
  external_url: string | null;
  embed_url: string | null;
  thumb_url: string | null;
  title: string;
  description: string | null;
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

export function VideosFeed({
  currentUserId,
  initialVideos,
  initiallyLiked
}: {
  currentUserId: string;
  initialVideos: VideoRow[];
  initiallyLiked: string[];
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [videos, setVideos] = useState<VideoRow[]>(initialVideos);
  const [liked, setLiked] = useState<Set<string>>(new Set(initiallyLiked));
  const [error, setError] = useState<string | null>(null);

  async function toggleLike(video: VideoRow) {
    const wasLiked = liked.has(video.id);
    setLiked((prev) => {
      const next = new Set(prev);
      if (wasLiked) next.delete(video.id);
      else next.add(video.id);
      return next;
    });
    setVideos((prev) =>
      prev.map((v) =>
        v.id === video.id
          ? { ...v, like_count: Math.max(0, v.like_count + (wasLiked ? -1 : 1)) }
          : v
      )
    );
    const { data, error: rpcErr } = await supabase.rpc("toggle_video_like", {
      p_video_id: video.id
    });
    if (rpcErr) {
      setError(rpcErr.message);
      setLiked((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.add(video.id);
        else next.delete(video.id);
        return next;
      });
      setVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, like_count: video.like_count } : v))
      );
      return;
    }
    if (typeof data === "number") {
      setVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, like_count: data } : v))
      );
    }
  }

  async function deleteVideo(video: VideoRow) {
    if (video.author_id !== currentUserId) return;
    if (!confirm("Delete this video?")) return;
    const { error: delErr } = await supabase.from("videos").delete().eq("id", video.id);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    setVideos((prev) => prev.filter((v) => v.id !== video.id));
  }

  async function toggleVisibility(video: VideoRow) {
    if (video.author_id !== currentUserId) return;
    const next = !video.is_public;
    setVideos((prev) =>
      prev.map((v) => (v.id === video.id ? { ...v, is_public: next } : v))
    );
    const { error: updErr } = await supabase
      .from("videos")
      .update({ is_public: next })
      .eq("id", video.id);
    if (updErr) {
      setError(updErr.message);
      setVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, is_public: video.is_public } : v))
      );
    }
  }

  if (videos.length === 0) {
    return (
      <section className="surface-glass mt-5 p-8 text-center">
        <p className="font-display text-lg">No videos yet.</p>
        <p className="mt-1 text-sm text-white/55">
          Upload a long-form video or paste a link from another site.
        </p>
        <Link
          href="/videos/new"
          className="mt-4 inline-block rounded-lg bg-neon-blue px-4 py-2 text-sm font-medium text-ink-900 shadow-glow-blue hover:bg-neon-blue/90"
        >
          + Add a video
        </Link>
      </section>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      {error && (
        <p className="rounded-md bg-neon-red/10 px-3 py-1.5 text-xs text-neon-red">{error}</p>
      )}
      {videos.map((v) => (
        <VideoCard
          key={v.id}
          video={v}
          currentUserId={currentUserId}
          isMine={v.author_id === currentUserId}
          isLiked={liked.has(v.id)}
          onLike={() => void toggleLike(v)}
          onDelete={() => void deleteVideo(v)}
          onToggleVisibility={() => void toggleVisibility(v)}
        />
      ))}
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

function VideoCard({
  video,
  currentUserId,
  isMine,
  isLiked,
  onLike,
  onDelete,
  onToggleVisibility
}: {
  video: VideoRow;
  currentUserId: string;
  isMine: boolean;
  isLiked: boolean;
  onLike: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
}) {
  const name = video.author_display_name ?? video.author_username ?? "Someone";
  const handle = video.author_username ?? "anon";

  // Decide how to render the player.
  const fileUrl =
    video.kind === "upload" && video.video_url
      ? video.video_url
      : video.external_url && isDirectVideo(video.external_url)
      ? video.external_url
      : null;

  return (
    <article className="surface-glass overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <PresenceDot state={video.author_presence_state ?? "offline"} pulse />
          <div className="min-w-0">
            <p className="truncate text-sm">
              <span className="text-white">{name}</span>
              {video.author_is_guest && (
                <span className="ml-1 rounded-sm bg-white/10 px-1 text-[9px] uppercase tracking-widest text-white/50">
                  guest
                </span>
              )}
            </p>
            <p className="truncate text-[11px] text-white/40">@{handle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/40">
          {!video.is_public && !isMine && (
            <span className="rounded-sm border border-white/10 bg-white/5 px-1.5 py-0.5 uppercase tracking-widest">
              🔒 private
            </span>
          )}
          {isMine && (
            <button
              type="button"
              onClick={onToggleVisibility}
              aria-label={video.is_public ? "Make this video private" : "Make this video public"}
              title={video.is_public ? "Currently public — tap to make private" : "Currently private — tap to make public"}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              {video.is_public ? "🌍 Public" : "🔒 Private"}
            </button>
          )}
          {isMine && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete this video"
              title="Delete"
              className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-white/60 hover:bg-neon-red/10 hover:text-neon-red"
            >
              🗑
            </button>
          )}
        </div>
      </header>

      {video.title && (
        <h2 className="px-4 pb-1 text-sm font-semibold text-white">{video.title}</h2>
      )}

      <div className="bg-black">
        {fileUrl ? (
          <video
            src={fileUrl}
            poster={video.thumb_url ?? undefined}
            controls
            playsInline
            preload="metadata"
            className="mx-auto block max-h-[80vh] w-full bg-black"
          />
        ) : video.embed_url ? (
          <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
            <iframe
              src={video.embed_url}
              title={video.title}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : video.external_url ? (
          <a
            href={video.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-neon-blue hover:underline"
          >
            ▶ Watch on {hostOf(video.external_url)} ↗
          </a>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 px-4 py-2">
        {video.external_url && (
          <a
            href={video.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-[11px] text-white/40 hover:text-white/70"
            title={video.external_url}
          >
            🔗 {hostOf(video.external_url)}
          </a>
        )}
        <button
          type="button"
          onClick={onLike}
          aria-pressed={isLiked}
          aria-label={isLiked ? "Unlike" : "Like"}
          className={clsx(
            "ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition",
            isLiked
              ? "bg-neon-red/85 text-white"
              : "bg-white/5 text-white/85 hover:bg-white/10"
          )}
        >
          <span aria-hidden>{isLiked ? "❤️" : "🤍"}</span>
          <span className="font-mono text-xs">{video.like_count}</span>
        </button>
      </div>

      {video.description && (
        <p className="whitespace-pre-wrap border-t border-white/5 px-4 py-2 text-sm text-white/80">
          {video.description}
        </p>
      )}

      <CommentSection
        kind="video"
        parentId={video.id}
        currentUserId={currentUserId}
        initialCount={video.comment_count ?? 0}
      />
    </article>
  );
}
