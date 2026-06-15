"use client";

// Karochat — Adult (18+) hub. Visible only to attested adults (the page gates
// access). Three things:
//   • Adult rooms — jump into the existing adult / alternative-lifestyle rooms
//     (country/state via the catalog) for live audio/video/text.
//   • Community media — attested adults share THEIR OWN adult image/video/audio
//     (gated bucket) or paste external links, organised country/region wise.
//   • Clear content rules — your own content only / you hold the rights; 18+;
//     consensual; no minors / non-consensual / illegal content.
//
// Karochat hosts no third-party explicit catalog; this is user-generated only.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { COUNTRIES } from "@/lib/liveChannels";

type Post = {
  id: string;
  author_id: string;
  kind: "image" | "video" | "audio" | "link";
  media_url: string | null;
  external_url: string | null;
  title: string | null;
  country: string | null;
  region: string | null;
  created_at: string;
  author_username: string | null;
  author_display_name: string | null;
};

type RoomRow = { id: string; name: string; member_count: number };

const COUNTRY_NAMES = COUNTRIES.map((c) => c.name);

export function AdultHub({ userId }: { userId: string; userName: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();

  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCountry, setFilterCountry] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Composer state
  const [title, setTitle] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    let qb = supabase
      .from("adult_media_with_author")
      .select("*")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(60);
    if (filterCountry !== "all") qb = qb.eq("country", filterCountry);
    const { data, error: e } = await qb;
    if (e) {
      setError(e.message);
      return;
    }
    setPosts((data ?? []) as Post[]);
  }, [supabase, filterCountry]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [adultRooms, altRooms] = await Promise.all([
          supabase.rpc("browse_catalog", { p_category_slug: "adult", p_limit: 30 }),
          supabase.rpc("browse_catalog", { p_category_slug: "alt-lifestyle", p_limit: 30 })
        ]);
        if (!cancelled) {
          const merged: RoomRow[] = [];
          for (const r of [...(adultRooms.data ?? []), ...(altRooms.data ?? [])] as RoomRow[]) {
            merged.push(r);
          }
          merged.sort((a, b) => b.member_count - a.member_count);
          setRooms(merged.slice(0, 16));
        }
        await loadPosts();
      } catch {
        if (!cancelled) setError("Couldn't load the hub. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // loadPosts re-runs on filter change below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Reload the feed when the country filter changes.
  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  async function joinRoom(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      const { error: e } = await supabase.rpc("join_public_room", { p_room_id: id });
      if (e && !e.message.includes("already")) throw e;
      router.push(`/rooms/${id}`);
    } catch (e: any) {
      setError(e?.message ?? "Could not join.");
      setBusy(null);
    }
  }

  function pickAndUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*,audio/*";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) void uploadFile(f);
    };
    input.click();
  }

  async function uploadFile(f: File) {
    const kind: Post["kind"] = f.type.startsWith("image")
      ? "image"
      : f.type.startsWith("video")
      ? "video"
      : f.type.startsWith("audio")
      ? "audio"
      : "image";
    if (f.size > 200 * 1024 * 1024) {
      setError("File is over 200 MB — pick a smaller one.");
      return;
    }
    setUploading(true);
    setError(null);
    setNote(null);
    try {
      const ext = (f.name.split(".").pop() ?? "bin").toLowerCase();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("adult-media")
        .upload(path, f, { contentType: f.type || "application/octet-stream", upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("adult-media").getPublicUrl(path);
      const { error: insErr } = await supabase.from("adult_media").insert({
        author_id: userId,
        kind,
        media_url: pub.publicUrl,
        title: title.trim() || null,
        country: country || null,
        region: region.trim() || null,
        is_public: true
      });
      if (insErr) throw insErr;
      setNote("✓ Shared.");
      setTitle("");
      setRegion("");
      await loadPosts();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't share that file.");
    } finally {
      setUploading(false);
    }
  }

  async function addLink() {
    const u = linkUrl.trim();
    if (!u) return;
    setUploading(true);
    setError(null);
    setNote(null);
    try {
      const href = u.startsWith("http") ? u : `https://${u}`;
      const { error: insErr } = await supabase.from("adult_media").insert({
        author_id: userId,
        kind: "link",
        external_url: href,
        title: title.trim() || null,
        country: country || null,
        region: region.trim() || null,
        is_public: true
      });
      if (insErr) throw insErr;
      setNote("✓ Link shared.");
      setLinkUrl("");
      setTitle("");
      setRegion("");
      await loadPosts();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't share that link.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="surface-glass tint-purple p-5">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-xl font-semibold">🔞 Adult — 18+</h1>
          <span className="rounded-md bg-neon-red/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-neon-red">
            18+ only
          </span>
        </div>
        <p className="mt-1 text-sm text-white/60">
          A grown-ups space for adult rooms (live audio/video/text) and a community
          media wall where adults share their own content, country &amp; state wise.
        </p>
        <div className="mt-3 rounded-xl border border-neon-red/30 bg-neon-red/5 px-3 py-2 text-[11px] leading-relaxed text-white/70">
          <span className="font-medium text-neon-red">Rules:</span> share only your own
          content or content you have the rights to. Everyone shown must be a consenting
          adult (18+). No minors, no non-consensual or revenge content, no illegal
          material — these are removed and reported. You are responsible for what you
          post.
        </div>
      </section>

      {/* Adult rooms */}
      <section className="surface-glass p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Adult rooms — live</h2>
          <span className="text-[11px] text-white/40">audio · video · text</span>
        </div>
        {loading ? (
          <p className="px-1 py-5 text-center text-sm text-white/50">
            <span className="mr-2 animate-pulseDot">●</span>Loading…
          </p>
        ) : rooms.length === 0 ? (
          <p className="px-1 py-5 text-center text-sm text-white/50">No adult rooms right now.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {rooms.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => void joinRoom(r.id)}
                  disabled={!!busy}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-left transition hover:border-neon-purple/40 hover:bg-white/5 disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-white/90">{r.name}</span>
                    <span className="block text-[11px] text-white/40">{r.member_count} in room</span>
                  </span>
                  <span className="shrink-0 rounded-md border border-neon-purple/30 bg-neon-purple/10 px-2 py-0.5 text-[11px] text-neon-purple">
                    {busy === r.id ? "…" : "Join →"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Composer */}
      <section className="surface-glass p-4">
        <p className="text-sm font-medium text-white">⬆️ Share to the wall</p>
        <p className="mt-0.5 text-[11px] text-white/50">
          Your own image / video / audio, or an external link. Add a country &amp;
          state so others can find it locally.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
          />
          <div className="flex gap-2">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 outline-none focus:border-neon-purple/60"
            >
              <option value="">Country…</option>
              {COUNTRY_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="State / region"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={pickAndUpload}
            disabled={uploading}
            className="rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2 text-sm font-medium text-white transition hover:bg-neon-purple/30 disabled:opacity-50"
          >
            {uploading ? "Sharing…" : "📤 Upload file"}
          </button>
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void addLink();
            }}
            placeholder="…or paste a link"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
          />
          <button
            type="button"
            onClick={() => void addLink()}
            disabled={uploading || !linkUrl.trim()}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/85 transition hover:bg-white/10 disabled:opacity-50"
          >
            Add link
          </button>
        </div>
        {note && <p className="mt-2 text-[11px] text-neon-mint">{note}</p>}
        {error && <p className="mt-2 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{error}</p>}
      </section>

      {/* Feed */}
      <section className="surface-glass p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Community wall</h2>
          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white/85 outline-none focus:border-neon-purple/60"
          >
            <option value="all">All countries</option>
            {COUNTRY_NAMES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        {posts.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-white/50">
            Nothing here yet — be the first to share.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {posts.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                {p.kind === "image" && p.media_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.media_url} alt={p.title ?? ""} className="max-h-80 w-full object-contain bg-black" />
                )}
                {p.kind === "video" && p.media_url && (
                  <video src={p.media_url} controls playsInline className="w-full bg-black" />
                )}
                {p.kind === "audio" && p.media_url && (
                  <div className="p-3">
                    <audio src={p.media_url} controls className="w-full" />
                  </div>
                )}
                {p.kind === "link" && p.external_url && (
                  <a
                    href={p.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-3 py-4 text-sm text-neon-blue underline-offset-2 hover:underline"
                  >
                    🔗 {p.title || p.external_url} ↗
                  </a>
                )}
                <div className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] text-white/45">
                  <span className="min-w-0 truncate">
                    {p.title ? <span className="text-white/70">{p.title} · </span> : null}
                    {p.author_display_name || p.author_username || "someone"}
                  </span>
                  {(p.country || p.region) && (
                    <span className="shrink-0">
                      {[p.region, p.country].filter(Boolean).join(", ")}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[10px] leading-relaxed text-white/35">
          Community-uploaded content. Report anything that breaks the rules — illegal,
          non-consensual or minor-involving content is removed and reported to
          authorities.
        </p>
      </section>
    </div>
  );
}
