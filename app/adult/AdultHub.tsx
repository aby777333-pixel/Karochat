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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { COUNTRIES } from "@/lib/liveChannels";
import { ContentDisclaimer } from "@/components/ContentDisclaimer";

type Post = {
  id: string;
  author_id: string;
  kind: "image" | "video" | "audio" | "link" | "channel";
  media_url: string | null;
  external_url: string | null;
  title: string | null;
  category: string | null;
  country: string | null;
  region: string | null;
  is_public: boolean;
  created_at: string;
  author_username: string | null;
  author_display_name: string | null;
};

type RoomRow = { id: string; name: string; member_count: number };

const COUNTRY_NAMES = COUNTRIES.map((c) => c.name);
const ADULT_CATEGORIES = [
  "Amateur",
  "Couples",
  "Solo",
  "Gay",
  "Lesbian",
  "Trans",
  "Fetish & Kink",
  "BDSM",
  "Cosplay & Roleplay",
  "Short clip",
  "Full video",
  "Verification",
  "Other"
];

export function AdultHub({ userId }: { userId: string; userName: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();

  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [communityRooms, setCommunityRooms] = useState<RoomRow[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCountry, setFilterCountry] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create-your-own adult room.
  const [crName, setCrName] = useState("");
  const [crDesc, setCrDesc] = useState("");
  const [crVis, setCrVis] = useState<"public" | "listed" | "unlisted">("public");
  const [crBusy, setCrBusy] = useState(false);
  const [crErr, setCrErr] = useState<string | null>(null);

  // Composer state
  const [title, setTitle] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [category, setCategory] = useState("");

  // Wall view + filters.
  const [wallView, setWallView] = useState<"public" | "mine">("public");
  const [catFilter, setCatFilter] = useState("all");

  // Adult TV channels (country/state-wise, user-submitted live streams).
  const [channels, setChannels] = useState<Post[]>([]);
  const [chFilter, setChFilter] = useState("all");
  const [nowCh, setNowCh] = useState<{ url: string; title: string } | null>(null);
  const [chName, setChName] = useState("");
  const [chUrl, setChUrl] = useState("");
  const [chCountry, setChCountry] = useState("");
  const [chRegion, setChRegion] = useState("");
  const [chBusy, setChBusy] = useState(false);
  const [chNote, setChNote] = useState<string | null>(null);
  const [chErr, setChErr] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    let qb = supabase
      .from("adult_media_with_author")
      .select("*")
      .neq("kind", "channel")
      .order("created_at", { ascending: false })
      .limit(60);
    // "My posts" shows the author's own (public + private); RLS allows it.
    // "Public wall" shows public posts from everyone (attested adults only).
    if (wallView === "mine") qb = qb.eq("author_id", userId);
    else qb = qb.eq("is_public", true);
    if (filterCountry !== "all") qb = qb.eq("country", filterCountry);
    if (catFilter !== "all") qb = qb.eq("category", catFilter);
    const { data, error: e } = await qb;
    if (e) {
      setError(e.message);
      return;
    }
    setPosts((data ?? []) as Post[]);
  }, [supabase, filterCountry, catFilter, wallView, userId]);

  const loadChannels = useCallback(async () => {
    let qb = supabase
      .from("adult_media_with_author")
      .select("*")
      .eq("is_public", true)
      .eq("kind", "channel")
      .order("created_at", { ascending: false })
      .limit(120);
    if (chFilter !== "all") qb = qb.eq("country", chFilter);
    const { data, error: e } = await qb;
    if (e) {
      setChErr(e.message);
      return;
    }
    setChannels((data ?? []) as Post[]);
  }, [supabase, chFilter]);

  const loadCommunity = useCallback(async () => {
    const { data } = await supabase.rpc("browse_catalog", {
      p_category_slug: "adult",
      p_subcategory_slug: "adult-community",
      p_limit: 40
    });
    setCommunityRooms((data ?? []) as RoomRow[]);
  }, [supabase]);

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
        await Promise.all([loadPosts(), loadChannels(), loadCommunity()]);
      } catch {
        if (!cancelled) setError("Couldn't load the hub. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // loadPosts / loadChannels re-run on their filters below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Reload the feed / channels when their country filters change.
  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);
  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

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

  // Create a user-owned adult room (their own "category") and go to it.
  async function createAdultRoom() {
    const name = crName.trim();
    if (!name) {
      setCrErr("Give your room a name.");
      return;
    }
    setCrBusy(true);
    setCrErr(null);
    try {
      const { data, error: e } = await supabase
        .rpc("create_room", {
          p_name: name,
          p_description: crDesc.trim() || null,
          p_visibility: crVis
        })
        .single<{ id: string; invite_code: string | null; visibility: string }>();
      if (e || !data) throw e ?? new Error("Could not create the room.");
      // Tag it into the adult catalog (community subcategory) + enable voice/cam.
      // Best-effort: the room already works without this.
      await supabase
        .from("rooms")
        .update({
          category_slug: "adult",
          subcategory_slug: "adult-community",
          voice_enabled: true,
          cam_enabled: true
        })
        .eq("id", data.id);
      router.push(`/rooms/${data.id}`);
    } catch (e: any) {
      setCrErr(e?.message ?? "Could not create the room.");
      setCrBusy(false);
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
        category: category || null,
        country: country || null,
        region: region.trim() || null,
        is_public: visibility === "public"
      });
      if (insErr) throw insErr;
      setNote(visibility === "public" ? "✓ Shared to the public wall." : "✓ Saved privately.");
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
        category: category || null,
        country: country || null,
        region: region.trim() || null,
        is_public: visibility === "public"
      });
      if (insErr) throw insErr;
      setNote(visibility === "public" ? "✓ Link shared." : "✓ Saved privately.");
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

  // Add an adult TV channel / live stream (user-submitted; not curated by us).
  async function addChannel() {
    const url = chUrl.trim();
    if (!url || !chName.trim()) {
      setChErr("Add a channel name and a stream link.");
      return;
    }
    setChBusy(true);
    setChErr(null);
    setChNote(null);
    try {
      const href = url.startsWith("http") ? url : `https://${url}`;
      const { error: insErr } = await supabase.from("adult_media").insert({
        author_id: userId,
        kind: "channel",
        external_url: href,
        title: chName.trim(),
        country: chCountry || null,
        region: chRegion.trim() || null,
        is_public: true
      });
      if (insErr) throw insErr;
      setChNote("✓ Channel added.");
      setChName("");
      setChUrl("");
      setChRegion("");
      await loadChannels();
    } catch (e: any) {
      setChErr(e?.message ?? "Couldn't add the channel.");
    } finally {
      setChBusy(false);
    }
  }

  const isHls = (u: string | null) => !!u && /\.m3u8(\?|$)/i.test(u);

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

      {/* Create your own adult room */}
      <section className="surface-glass p-4">
        <h2 className="font-display text-lg font-semibold">Create your own adult room</h2>
        <p className="mt-0.5 text-[11px] text-white/50">
          Start your own adult room / category — name it, choose who can join, then
          invite people. Voice, video &amp; text are on.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={crName}
            onChange={(e) => setCrName(e.target.value)}
            placeholder="Room name / category…"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-red/60"
          />
          <select
            value={crVis}
            onChange={(e) => setCrVis(e.target.value as "public" | "listed" | "unlisted")}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 outline-none focus:border-neon-red/60"
          >
            <option value="public">🌐 Public — anyone can join</option>
            <option value="listed">📋 Listed — visible, request to join</option>
            <option value="unlisted">🔒 Private — invite only</option>
          </select>
        </div>
        <input
          value={crDesc}
          onChange={(e) => setCrDesc(e.target.value)}
          placeholder="Topic / description (optional)"
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-red/60"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void createAdultRoom()}
            disabled={crBusy || !crName.trim()}
            className="rounded-xl border border-neon-red/50 bg-neon-red/15 px-3 py-2 text-sm font-medium text-white transition hover:bg-neon-red/25 disabled:opacity-50"
          >
            {crBusy ? "Creating…" : "➕ Create room"}
          </button>
        </div>
        {crErr && <p className="mt-2 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{crErr}</p>}
      </section>

      {/* Community-created rooms */}
      <section className="surface-glass p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Community rooms</h2>
          <span className="text-[11px] text-white/40">created by members</span>
        </div>
        {communityRooms.length === 0 ? (
          <p className="px-1 py-5 text-center text-sm text-white/50">
            No community rooms yet — be the first to create one above.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {communityRooms.map((r) => (
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

      {/* Adult TV channels — country & state wise (user-submitted live streams) */}
      <section className="surface-glass p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Adult TV — channels</h2>
          <select
            value={chFilter}
            onChange={(e) => setChFilter(e.target.value)}
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

        {/* Player */}
        {nowCh && (
          <div className="mb-3 overflow-hidden rounded-xl border border-white/10 bg-black p-2">
            <div className="mb-1 flex items-center justify-between gap-2 px-1">
              <p className="min-w-0 truncate text-sm text-white">{nowCh.title}</p>
              <div className="flex items-center gap-1.5">
                <a
                  href={nowCh.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/65 hover:bg-white/10"
                >
                  Open ↗
                </a>
                <button
                  type="button"
                  onClick={() => setNowCh(null)}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/55 hover:bg-white/10"
                >
                  ✕ Stop
                </button>
              </div>
            </div>
            {isHls(nowCh.url) ? (
              <AdultTvPlayer url={nowCh.url} />
            ) : (
              <video
                key={nowCh.url}
                src={nowCh.url}
                controls
                autoPlay
                playsInline
                className="mx-auto block max-h-[70vh] w-full rounded-lg bg-black"
              />
            )}
          </div>
        )}

        {channels.length === 0 ? (
          <p className="px-1 py-5 text-center text-sm text-white/50">
            No channels yet — add the free adult channels you know below.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {channels.map((c) => {
              const url = c.external_url ?? "";
              const active = nowCh?.url === url;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => url && setNowCh({ url, title: c.title || "Channel" })}
                    className={
                      "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition " +
                      (active
                        ? "border-neon-red/50 bg-neon-red/10"
                        : "border-white/10 bg-black/20 hover:border-white/25 hover:bg-white/5")
                    }
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-white/90">
                        {c.title || "Channel"}
                      </span>
                      {(c.country || c.region) && (
                        <span className="block truncate text-[11px] text-white/40">
                          {[c.region, c.country].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-white/40">▶</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Add a channel */}
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-[11px] text-white/55">
            Add a free adult channel / live stream (HLS .m3u8 or direct video link),
            country &amp; state-wise. User-submitted — Karochat doesn&apos;t host or
            curate these streams.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input
              value={chName}
              onChange={(e) => setChName(e.target.value)}
              placeholder="Channel name"
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-red/60"
            />
            <input
              value={chUrl}
              onChange={(e) => setChUrl(e.target.value)}
              placeholder="Stream link (.m3u8 / .mp4)"
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-red/60"
            />
            <select
              value={chCountry}
              onChange={(e) => setChCountry(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 outline-none focus:border-neon-red/60"
            >
              <option value="">Country…</option>
              {COUNTRY_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <input
              value={chRegion}
              onChange={(e) => setChRegion(e.target.value)}
              placeholder="State / region (optional)"
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-red/60"
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void addChannel()}
              disabled={chBusy || !chUrl.trim() || !chName.trim()}
              className="rounded-xl border border-neon-red/50 bg-neon-red/15 px-3 py-2 text-sm font-medium text-white transition hover:bg-neon-red/25 disabled:opacity-50"
            >
              {chBusy ? "Adding…" : "➕ Add channel"}
            </button>
            {chNote && <span className="text-[11px] text-neon-mint">{chNote}</span>}
          </div>
          {chErr && (
            <p className="mt-2 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{chErr}</p>
          )}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-white/35">
          Live streams are third-party; availability varies and some may be offline.
          Only add channels you have the right to share. 18+ consenting adults only.
        </p>
      </section>

      {/* Composer */}
      <section className="surface-glass p-4">
        <p className="text-sm font-medium text-white">⬆️ Share your videos, shorts &amp; pics</p>
        <p className="mt-0.5 text-[11px] text-white/50">
          Upload your own image / video / short / audio (up to 512 MB) or paste a
          link. Write a caption, pick a category, set country &amp; state, and choose
          public or private.
        </p>

        {/* Public / private */}
        <div className="mt-3 inline-flex rounded-xl border border-white/10 bg-white/5 p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setVisibility("public")}
            className={
              "rounded-lg px-3 py-1.5 transition " +
              (visibility === "public" ? "bg-neon-mint/20 text-neon-mint" : "text-white/65 hover:bg-white/10")
            }
          >
            🌐 Public
          </button>
          <button
            type="button"
            onClick={() => setVisibility("private")}
            className={
              "rounded-lg px-3 py-1.5 transition " +
              (visibility === "private" ? "bg-neon-amber/20 text-neon-amber" : "text-white/65 hover:bg-white/10")
            }
          >
            🔒 Private
          </button>
        </div>
        {visibility === "private" && (
          <p className="mt-1 text-[10px] text-white/40">
            Private posts are visible only to you (under “My posts”).
          </p>
        )}

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Caption…"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 outline-none focus:border-neon-purple/60"
          >
            <option value="">Category…</option>
            {ADULT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setWallView("public")}
              className={
                "rounded-lg px-3 py-1.5 transition " +
                (wallView === "public" ? "bg-neon-purple/25 text-white" : "text-white/65 hover:bg-white/10")
              }
            >
              Public wall
            </button>
            <button
              type="button"
              onClick={() => setWallView("mine")}
              className={
                "rounded-lg px-3 py-1.5 transition " +
                (wallView === "mine" ? "bg-neon-purple/25 text-white" : "text-white/65 hover:bg-white/10")
              }
            >
              My posts
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white/85 outline-none focus:border-neon-purple/60"
            >
              <option value="all">All categories</option>
              {ADULT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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
        </div>
        {posts.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-white/50">
            {wallView === "mine"
              ? "You haven't posted anything yet."
              : "Nothing here yet — be the first to share."}
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
                <div className="space-y-1 px-3 py-2">
                  {(p.category || !p.is_public) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {p.category && (
                        <span className="rounded-md bg-neon-purple/15 px-1.5 py-0.5 text-[10px] text-neon-purple">
                          {p.category}
                        </span>
                      )}
                      {!p.is_public && (
                        <span className="rounded-md bg-neon-amber/15 px-1.5 py-0.5 text-[10px] text-neon-amber">
                          🔒 Private
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 text-[11px] text-white/45">
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

      <ContentDisclaimer scope="media" />
    </div>
  );
}

// HLS-capable player for adult channels (native HLS on Safari, hls.js elsewhere).
// Same approach as the TV & Radio / Sports players.
function AdultTvPlayer({ url }: { url: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !url) return;
    let destroyed = false;
    let hls: { destroy: () => void } | null = null;
    setErr(null);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      void video.play().catch(() => {});
    } else {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (destroyed) return;
          if (Hls.isSupported()) {
            const instance = new Hls({ enableWorker: true });
            hls = instance;
            instance.loadSource(url);
            instance.attachMedia(video);
            instance.on(Hls.Events.ERROR, (_evt, data) => {
              if (data?.fatal) {
                setErr("This stream couldn't be played here. Try another, or Open ↗.");
              }
            });
            void video.play?.().catch(() => {});
          } else {
            video.src = url;
          }
        })
        .catch(() => setErr("Player failed to load."));
    }

    return () => {
      destroyed = true;
      if (hls) {
        try {
          hls.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [url]);

  return (
    <div>
      <video
        ref={ref}
        controls
        playsInline
        className="mx-auto block max-h-[70vh] w-full rounded-lg bg-black"
      />
      {err && <p className="mt-1 text-[11px] text-neon-amber">{err}</p>}
    </div>
  );
}
