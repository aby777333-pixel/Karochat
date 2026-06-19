"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type StoryRow = {
  id: string;
  author_id: string;
  kind: "text" | "image" | "video";
  body: string | null;
  image_url: string | null;
  media_url: string | null;
  poster_url: string | null;
  audience_kind: "public" | "friends" | "close_friends";
  expires_at: string;
  created_at: string;
  author_username: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  author_is_guest: boolean | null;
  author_presence_state: string | null;
  view_count: number | null;
  viewer_seen: boolean | null;
};

type Group = {
  authorId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  stories: StoryRow[];
  mine: boolean;
  hasUnseen: boolean;
  hasCloseFriends: boolean;
};

const IMAGE_MS = 5000;
const AUDIENCE_BADGE: Record<StoryRow["audience_kind"], string | null> = {
  public: null,
  friends: "👥",
  close_friends: "💚"
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
  const [openGroup, setOpenGroup] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<string>>(
    () => new Set(initialStories.filter((s) => s.viewer_seen).map((s) => s.id))
  );

  // Drop stories that quietly expired client-side (own stories stay until reload).
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setStories((prev) =>
        prev.filter(
          (s) => s.author_id === currentUserId || new Date(s.expires_at).getTime() > now
        )
      );
    }, 60 * 1000);
    return () => clearInterval(t);
  }, [currentUserId]);

  // Group by author, ordered oldest-first within a ring.
  const groups = useMemo<Group[]>(() => {
    const byAuthor = new Map<string, StoryRow[]>();
    for (const s of stories) {
      const arr = byAuthor.get(s.author_id) ?? [];
      arr.push(s);
      byAuthor.set(s.author_id, arr);
    }
    const out: Group[] = [];
    for (const [authorId, arr] of byAuthor) {
      arr.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      const first = arr[0]!;
      const mine = authorId === currentUserId;
      out.push({
        authorId,
        username: first.author_username ?? "anon",
        displayName: first.author_display_name ?? first.author_username ?? "anon",
        avatarUrl: first.author_avatar_url,
        stories: arr,
        mine,
        hasUnseen: !mine && arr.some((s) => !seen.has(s.id)),
        hasCloseFriends: arr.some((s) => s.audience_kind === "close_friends")
      });
    }
    // Your ring first, then rings with unseen content, then the rest.
    out.sort((a, b) => {
      if (a.mine !== b.mine) return a.mine ? -1 : 1;
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      const al = a.stories[a.stories.length - 1]!.created_at;
      const bl = b.stories[b.stories.length - 1]!.created_at;
      return +new Date(bl) - +new Date(al);
    });
    return out;
  }, [stories, seen, currentUserId]);

  const markSeen = useCallback(
    (story: StoryRow) => {
      if (story.author_id === currentUserId) return;
      if (seen.has(story.id)) return;
      setSeen((prev) => new Set(prev).add(story.id));
      void supabase.rpc("mark_story_viewed", { p_story_id: story.id });
    },
    [seen, supabase, currentUserId]
  );

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
    router.refresh();
  }

  return (
    <>
      <section className="surface-glass tint-purple flex items-center gap-3 overflow-x-auto px-3 py-3 pr-10">
        <Link
          href="/stories/new"
          className="flex shrink-0 flex-col items-center gap-1.5"
          title="Post a 24-hour moment"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full border border-dashed border-neon-blue/50 bg-neon-blue/5 text-2xl leading-none text-neon-blue">
            ＋
          </span>
          <span className="text-[11px] text-neon-blue">Add</span>
        </Link>

        {groups.length === 0 && (
          <span className="self-center text-[11px] text-white/40">No live moments right now.</span>
        )}

        {groups.map((g, i) => {
          const ringClass = g.mine
            ? "from-white/40 to-white/20"
            : g.hasUnseen
              ? g.hasCloseFriends
                ? "from-neon-mint to-neon-mint/60"
                : "from-neon-purple via-neon-blue to-neon-mint"
              : "from-white/15 to-white/10";
          const cover = g.stories.find((s) => s.poster_url || s.image_url);
          const coverUrl = cover?.poster_url ?? cover?.image_url ?? null;
          return (
            <button
              key={g.authorId}
              type="button"
              onClick={() => setOpenGroup(i)}
              className="flex shrink-0 flex-col items-center gap-1.5"
              aria-label={`Open ${g.mine ? "your" : g.displayName + "'s"} story`}
            >
              <span
                className={`grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br ${ringClass} p-[2px]`}
              >
                <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-ink-800">
                  {coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : g.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="bg-gradient-to-br from-neon-purple/30 via-neon-blue/30 to-neon-mint/30 grid h-full w-full place-items-center text-sm">
                      {g.stories[0]!.kind === "video" ? "🎬" : "📝"}
                    </span>
                  )}
                </span>
              </span>
              <span className="max-w-[64px] truncate text-[10px] text-white/70">
                {g.mine ? "You" : `@${g.username}`}
              </span>
            </button>
          );
        })}
      </section>

      {openGroup !== null && groups[openGroup] && (
        <StoryViewer
          groups={groups}
          startGroup={openGroup}
          currentUserId={currentUserId}
          onSeen={markSeen}
          canDelete={canDelete}
          onDelete={deleteStory}
          onClose={() => setOpenGroup(null)}
        />
      )}
    </>
  );
}

function StoryViewer({
  groups,
  startGroup,
  currentUserId,
  onSeen,
  canDelete,
  onDelete,
  onClose
}: {
  groups: Group[];
  startGroup: number;
  currentUserId: string;
  onSeen: (s: StoryRow) => void;
  canDelete: (s: StoryRow) => boolean;
  onDelete: (s: StoryRow) => void;
  onClose: () => void;
}) {
  const [gi, setGi] = useState(startGroup);
  const [si, setSi] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const group = groups[gi]!;
  const story = group.stories[si]!;

  const next = useCallback(() => {
    setProgress(0);
    if (si < group.stories.length - 1) {
      setSi((v) => v + 1);
    } else if (gi < groups.length - 1) {
      setGi((v) => v + 1);
      setSi(0);
    } else {
      onClose();
    }
  }, [si, gi, group.stories.length, groups.length, onClose]);

  const prev = useCallback(() => {
    setProgress(0);
    if (si > 0) {
      setSi((v) => v - 1);
    } else if (gi > 0) {
      const pg = groups[gi - 1]!;
      setGi((v) => v - 1);
      setSi(pg.stories.length - 1);
    }
  }, [si, gi, groups]);

  // Mark seen whenever the active story changes.
  useEffect(() => {
    onSeen(story);
  }, [story, onSeen]);

  // Auto-advance for text/image (video drives its own progress via timeupdate).
  useEffect(() => {
    if (story.kind === "video" || paused) return;
    const start = Date.now();
    const tick = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / IMAGE_MS);
      setProgress(p);
      if (p >= 1) {
        clearInterval(tick);
        next();
      }
    }, 50);
    return () => clearInterval(tick);
  }, [story, paused, next]);

  // Keyboard nav.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [prev, next, onClose]);

  const mine = story.author_id === currentUserId;
  const author = story.author_display_name ?? story.author_username ?? "Someone";
  const expiresIn = Math.max(
    0,
    Math.round((new Date(story.expires_at).getTime() - Date.now()) / 60000)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 backdrop-blur"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex h-full w-full max-w-md flex-col gap-2 py-2">
        {/* Segment progress bars */}
        <div className="flex gap-1 px-1">
          {group.stories.map((s, idx) => (
            <span key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/20">
              <span
                className="block h-full bg-white"
                style={{
                  width: idx < si ? "100%" : idx === si ? `${progress * 100}%` : "0%"
                }}
              />
            </span>
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-1 text-xs text-white/70">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10">
              {group.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={group.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[11px]">{author.slice(0, 1).toUpperCase()}</span>
              )}
            </span>
            <p className="min-w-0 truncate">
              <span className="text-white">{mine ? "You" : author}</span>
              <span className="ml-1.5 text-white/40">·{expiresIn}m</span>
              {AUDIENCE_BADGE[story.audience_kind] && (
                <span className="ml-1.5" title={story.audience_kind.replace("_", " ")}>
                  {AUDIENCE_BADGE[story.audience_kind]}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-white/50">
            {canDelete(story) && (
              <button
                onClick={() => onDelete(story)}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 hover:bg-neon-red/10 hover:text-neon-red"
                aria-label="Delete"
                title="Delete"
              >
                🗑
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 hover:bg-white/10"
              aria-label="Close"
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Media */}
        <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-ink-800/80">
          {story.kind === "video" && story.media_url ? (
            <video
              key={story.id}
              ref={videoRef}
              src={story.media_url}
              poster={story.poster_url ?? undefined}
              autoPlay
              playsInline
              controls={false}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration) setProgress(Math.min(1, v.currentTime / v.duration));
              }}
              onEnded={next}
              className="h-full w-full bg-black object-contain"
            />
          ) : story.kind === "image" && story.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={story.image_url}
              alt={story.body ?? "story"}
              className="h-full w-full bg-black object-contain"
            />
          ) : (
            <div className="grid h-full place-items-center bg-gradient-to-br from-neon-purple/30 via-neon-blue/25 to-neon-mint/25 px-6 text-center">
              <p className="text-xl font-medium leading-snug text-white">{story.body}</p>
            </div>
          )}

          {/* Caption overlay for media stories */}
          {story.kind !== "text" && story.body && (
            <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-sm text-white">
              {story.body}
            </p>
          )}

          {/* Tap zones: left third = prev, right two-thirds = next. Center press pauses. */}
          <button
            type="button"
            aria-label="Previous"
            onClick={prev}
            className="absolute inset-y-0 left-0 w-1/3"
          />
          <button
            type="button"
            aria-label="Next"
            onClick={next}
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
            className="absolute inset-y-0 right-0 w-2/3"
          />
        </div>

        {/* Seen-by for your own stories */}
        {mine && (
          <div className="px-1 text-center text-[11px] text-white/45">
            👁 Seen by {story.view_count ?? 0}
            {(story.view_count ?? 0) === 1 ? " person" : " people"}
          </div>
        )}
      </div>
    </div>
  );
}
