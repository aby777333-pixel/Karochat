"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";
import { CommentSection } from "@/components/CommentSection";
import { PresenceDot } from "@/components/PresenceDot";

export type FeedPost = {
  id: string;
  author_profile_id: string;
  body_markdown: string | null;
  hashtags: string[] | null;
  location: string | null;
  media_urls: string[] | null;
  is_carousel: boolean;
  is_adult: boolean;
  audience_kind: "public" | "followers" | "close_friends" | "private";
  like_count: number;
  comment_count: number;
  save_count: number;
  created_at: string;
  author_username: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  author_is_guest: boolean | null;
  author_presence_state: string | null;
  viewer_liked: boolean;
  viewer_saved: boolean;
};

type Scope = "following" | "discover";
const AUDIENCE_BADGE: Record<FeedPost["audience_kind"], string | null> = {
  public: null,
  followers: "👥",
  close_friends: "💚",
  private: "🔒"
};

function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function FeedClient({
  currentUserId,
  initialPosts,
  pageSize
}: {
  currentUserId: string;
  initialPosts: FeedPost[];
  pageSize: number;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("following");
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);
  const [hasMore, setHasMore] = useState(initialPosts.length >= pageSize);
  const [loading, setLoading] = useState(false);
  const [composing, setComposing] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchPage = useCallback(
    async (s: Scope, offset: number) => {
      const { data } = await supabase.rpc("list_feed", {
        p_scope: s,
        p_limit: pageSize,
        p_offset: offset
      });
      return (data ?? []) as FeedPost[];
    },
    [supabase, pageSize]
  );

  async function switchScope(s: Scope) {
    if (s === scope) return;
    setScope(s);
    setLoading(true);
    const page = await fetchPage(s, 0);
    setPosts(page);
    setHasMore(page.length >= pageSize);
    setLoading(false);
  }

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const page = await fetchPage(scope, posts.length);
    setPosts((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...page.filter((p) => !seen.has(p.id))];
    });
    setHasMore(page.length >= pageSize);
    setLoading(false);
  }, [loading, hasMore, fetchPage, scope, posts.length, pageSize]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (e) => {
        if (e[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "500px" }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [loadMore]);

  function onPosted() {
    setComposing(false);
    void switchScope("following");
    // ensure refresh even if already on following
    setScope("following");
    void fetchPage("following", 0).then((page) => {
      setPosts(page);
      setHasMore(page.length >= pageSize);
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 rounded-xl border border-white/10 bg-white/5 p-1 text-sm">
          <button
            onClick={() => void switchScope("following")}
            className={`flex-1 rounded-lg px-3 py-1.5 transition ${
              scope === "following" ? "bg-neon-blue/15 text-white" : "text-white/60 hover:text-white"
            }`}
          >
            Following
          </button>
          <button
            onClick={() => void switchScope("discover")}
            className={`flex-1 rounded-lg px-3 py-1.5 transition ${
              scope === "discover" ? "bg-neon-blue/15 text-white" : "text-white/60 hover:text-white"
            }`}
          >
            Discover
          </button>
        </div>
        <Button onClick={() => setComposing(true)} className="shrink-0 px-3 py-2 text-sm">
          ＋ Post
        </Button>
      </div>

      {posts.length === 0 && !loading ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-10 text-center text-sm text-white/50">
          {scope === "following"
            ? "Your feed is empty. Follow people, or post the first photo."
            : "Nothing to discover yet. Be the first to post."}
        </p>
      ) : (
        <div className="space-y-5">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} currentUserId={currentUserId} />
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-2" />
      {loading && <p className="py-3 text-center text-xs text-white/40">Loading…</p>}

      {composing && (
        <Composer currentUserId={currentUserId} onClose={() => setComposing(false)} onPosted={onPosted} />
      )}
    </div>
  );
}

function PostCard({ post, currentUserId }: { post: FeedPost; currentUserId: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [liked, setLiked] = useState(post.viewer_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [saved, setSaved] = useState(post.viewer_saved);
  const [idx, setIdx] = useState(0);
  const media = post.media_urls ?? [];
  const name = post.author_display_name ?? post.author_username ?? "Someone";
  const handle = post.author_username ?? "anon";

  async function toggleLike() {
    const was = liked;
    setLiked(!was);
    setLikeCount((c) => Math.max(0, c + (was ? -1 : 1)));
    const { data, error } = await supabase.rpc("toggle_post_like", { p_post_id: post.id });
    if (error) {
      setLiked(was);
      setLikeCount(post.like_count);
    } else if (typeof data === "number") {
      setLikeCount(data);
    }
  }

  async function toggleSave() {
    const was = saved;
    setSaved(!was);
    const { error } = await supabase.rpc("toggle_post_save", { p_post_id: post.id });
    if (error) setSaved(was);
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      <header className="flex items-center gap-2 px-3 py-2">
        <Link href={`/u/${handle}`} className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10">
            {post.author_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.author_avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs">{name.slice(0, 1).toUpperCase()}</span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm text-white">{name}</span>
            <span className="block truncate text-[11px] text-white/40">@{handle}</span>
          </span>
        </Link>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-white/40">
          <PresenceDot state={post.author_presence_state ?? "offline"} />
          {AUDIENCE_BADGE[post.audience_kind] && <span>{AUDIENCE_BADGE[post.audience_kind]}</span>}
          <span>{ago(post.created_at)}</span>
        </span>
      </header>

      {/* Media / carousel */}
      {media.length > 0 && (
        <div className="relative bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media[idx]} alt="" className="mx-auto block max-h-[70vh] w-full object-contain" />
          {media.length > 1 && (
            <>
              {idx > 0 && (
                <button
                  onClick={() => setIdx((i) => i - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-2 py-1 text-white/90"
                  aria-label="Previous"
                >
                  ‹
                </button>
              )}
              {idx < media.length - 1 && (
                <button
                  onClick={() => setIdx((i) => i + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-2 py-1 text-white/90"
                  aria-label="Next"
                >
                  ›
                </button>
              )}
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                {media.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${i === idx ? "bg-white" : "bg-white/40"}`}
                  />
                ))}
              </div>
              <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white/90">
                {idx + 1}/{media.length}
              </span>
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 px-3 py-2 text-sm">
        <button onClick={() => void toggleLike()} className="flex items-center gap-1.5" aria-pressed={liked}>
          <span className="text-lg">{liked ? "❤️" : "🤍"}</span>
          <span className="text-xs text-white/70">{likeCount}</span>
        </button>
        <span className="flex items-center gap-1.5 text-white/50">
          <span className="text-lg">💬</span>
          <span className="text-xs">{post.comment_count}</span>
        </span>
        <button onClick={() => void toggleSave()} className="ml-auto text-lg" aria-pressed={saved} aria-label="Save">
          {saved ? "🔖" : "📑"}
        </button>
      </div>

      {(post.body_markdown || (post.location && post.location.length > 0)) && (
        <div className="px-3 pb-2">
          {post.location && <p className="text-[11px] text-white/40">📍 {post.location}</p>}
          {post.body_markdown && (
            <p className="text-sm text-white/90">
              <span className="font-medium text-white">@{handle}</span> {post.body_markdown}
            </p>
          )}
        </div>
      )}

      <div className="px-3 pb-2">
        <CommentSection
          kind="post"
          parentId={post.id}
          currentUserId={currentUserId}
          initialCount={post.comment_count}
        />
      </div>
    </article>
  );
}

const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const AUDIENCES = [
  { key: "public", label: "🌐 Everyone" },
  { key: "followers", label: "👥 Followers" },
  { key: "close_friends", label: "💚 Close" },
  { key: "private", label: "🔒 Only me" }
] as const;

function Composer({
  currentUserId,
  onClose,
  onPosted
}: {
  currentUserId: string;
  onClose: () => void;
  onPosted: () => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]["key"]>("public");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const chosen = Array.from(e.target.files ?? []);
    if (!chosen.length) return;
    const room = MAX_IMAGES - files.length;
    const accepted: File[] = [];
    for (const f of chosen.slice(0, room)) {
      if (f.size > MAX_IMAGE_BYTES) {
        setError("Each image must be under 8 MB.");
        continue;
      }
      accepted.push(f);
    }
    setFiles((prev) => [...prev, ...accepted]);
    setPreviews((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  }

  function removeAt(i: number) {
    URL.revokeObjectURL(previews[i]!);
    setFiles((prev) => prev.filter((_, n) => n !== i));
    setPreviews((prev) => prev.filter((_, n) => n !== i));
  }

  function parseHashtags(text: string): string[] {
    return Array.from(new Set((text.match(/#([\p{L}0-9_]+)/gu) ?? []).map((t) => t.slice(1).toLowerCase())));
  }

  async function submit() {
    if (busy) return;
    if (files.length === 0) return setError("Add at least one photo.");
    setBusy(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i]!;
        setStatus(`Uploading ${i + 1}/${files.length}…`);
        const ext = (f.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${currentUserId}/post-${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage
          .from("chat-images")
          .upload(path, f, { contentType: f.type, upsert: false });
        if (up.error) throw up.error;
        const url = supabase.storage.from("chat-images").getPublicUrl(path).data.publicUrl;
        const scan = await fetch("/api/scan/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicUrl: url, bucket: "chat-images", path })
        });
        const sd = await scan.json().catch(() => ({}));
        if (sd?.blocked) throw new Error("An image was flagged by our scanner — not posted.");
        urls.push(url);
      }
      setStatus("Posting…");
      const { error: insErr } = await supabase.from("posts").insert({
        author_profile_id: currentUserId,
        body_markdown: caption.trim() || null,
        hashtags: parseHashtags(caption),
        location: location.trim() || null,
        media_urls: urls,
        is_carousel: urls.length > 1,
        audience_kind: audience
      });
      if (insErr) throw insErr;
      onPosted();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't post.");
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-3 backdrop-blur sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-white/10 bg-ink-800 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">New post</h2>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-white/60 hover:bg-white/10 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {previews.length > 0 && (
          <div className="scroll-thin flex gap-2 overflow-x-auto">
            {previews.map((src, i) => (
              <div key={src} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-24 w-24 rounded-lg object-cover" />
                <button
                  onClick={() => removeAt(i)}
                  className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-ink-900/90 text-[11px] text-white/80"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => fileRef.current?.click()}
          disabled={files.length >= MAX_IMAGES}
          className="w-full rounded-xl border border-dashed border-white/15 bg-white/5 px-3 py-3 text-sm text-white/70 hover:bg-white/10 disabled:opacity-50"
        >
          🖼️ {files.length === 0 ? "Add photos" : `Add more (${files.length}/${MAX_IMAGES})`}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={pick} />

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Write a caption… #hashtags"
          className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/60"
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={80}
          placeholder="Add location (optional)"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/60"
        />

        <div className="grid grid-cols-4 gap-1.5">
          {AUDIENCES.map((a) => (
            <button
              key={a.key}
              onClick={() => setAudience(a.key)}
              className={`rounded-lg border px-1.5 py-2 text-[11px] transition ${
                audience === a.key
                  ? "border-neon-mint/60 bg-neon-mint/10 text-white"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {error && <p className="rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{error}</p>}

        <Button onClick={() => void submit()} disabled={busy} className="w-full">
          {busy ? status ?? "Posting…" : "Share"}
        </Button>
      </div>
    </div>
  );
}
