"use client";

// Karochat — Audiobooks & audio/video Stories hub.
//
// Browse & play thousands of FREE audiobooks, stories, old-time radio, poetry
// and public-domain films from the Internet Archive (archive.org) — by topic
// and language — played inline via archive.org's official embed. Plus: upload
// your own audio (→ Music) or video (→ Videos), or loop any external link.
// No new backend; reuses the existing music/videos buckets + tables.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  CATEGORIES,
  LANGUAGES,
  fetchArchive,
  embedUrl,
  detailsUrl,
  type ArchiveItem
} from "@/lib/archiveStories";

type Now = { id: string; title: string } | null;

export function AudiobooksHub({
  userId,
  userName
}: {
  userId: string;
  userName: string;
}) {
  const [catKey, setCatKey] = useState(CATEGORIES[0]?.key ?? "audiobooks");
  const [language, setLanguage] = useState("Any");
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState(0); // bump to trigger a fetch
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState<Now>(null);

  const cat = useMemo(() => CATEGORIES.find((c) => c.key === catKey) ?? CATEGORIES[0]!, [catKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const list = await fetchArchive(cat.query, language, search);
        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setErr("Couldn't reach the free library. Check your connection and retry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // search only re-runs on submit (submitted), not on every keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, language, submitted]);

  return (
    <div className="space-y-5">
      <section className="surface-glass tint-purple p-5">
        <h1 className="font-display text-xl font-semibold">🎧 Audiobooks &amp; Stories</h1>
        <p className="mt-1 text-sm text-white/60">
          Thousands of free audiobooks, stories, old-time radio, poetry and
          public-domain films — in many languages, from the Internet Archive.
          Listen &amp; watch right here, or share your own.
        </p>

        {/* Category chips */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCatKey(c.key)}
              className={
                "rounded-lg border px-2.5 py-1.5 text-xs transition " +
                (c.key === catKey
                  ? "border-neon-purple/50 bg-neon-purple/20 text-white"
                  : "border-white/10 bg-black/20 text-white/75 hover:bg-white/5")
              }
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        {/* Search + language */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 outline-none focus:border-neon-purple/60"
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l === "Any" ? "Any language" : l}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSubmitted((n) => n + 1);
            }}
            placeholder="Search titles, authors, topics…"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
          />
          <button
            type="button"
            onClick={() => setSubmitted((n) => n + 1)}
            className="shrink-0 rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2 text-sm font-medium text-white transition hover:bg-neon-purple/30"
          >
            Search
          </button>
        </div>
      </section>

      {/* Player */}
      {now && (
        <section className="surface-glass overflow-hidden p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm">
              <span className="text-white/50">Now playing · </span>
              <span className="text-white">{now.title}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <a
                href={detailsUrl(now.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/65 hover:bg-white/10"
              >
                Open ↗
              </a>
              <button
                type="button"
                onClick={() => setNow(null)}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/55 hover:bg-white/10"
              >
                ✕ Close
              </button>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
            <iframe
              key={now.id}
              src={embedUrl(now.id)}
              title={now.title}
              className="h-64 w-full"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
            />
          </div>
        </section>
      )}

      {/* Results */}
      <section className="surface-glass p-4">
        {err && <p className="mb-2 rounded-md bg-neon-red/10 px-3 py-1.5 text-xs text-neon-red">{err}</p>}
        {loading ? (
          <p className="px-1 py-6 text-center text-sm text-white/50">
            <span className="mr-2 animate-pulseDot">●</span>Loading {cat.label.toLowerCase()}…
          </p>
        ) : items.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-white/50">
            Nothing found. Try another category, language or search.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {items.map((it) => {
              const active = now?.id === it.id;
              const isVideo = it.mediatype === "movies";
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => setNow({ id: it.id, title: it.title })}
                    className={
                      "flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left transition " +
                      (active
                        ? "border-neon-purple/50 bg-neon-purple/10"
                        : "border-white/10 bg-black/20 hover:border-white/25 hover:bg-white/5")
                    }
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-white/10 text-sm">
                      {isVideo ? "🎬" : "🎧"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-white/90">{it.title}</span>
                      <span className="block truncate text-[11px] text-white/40">
                        {[it.creator, it.language, it.year].filter(Boolean).join(" · ") || it.mediatype}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[10px] leading-relaxed text-white/35">
          Content is streamed from the Internet Archive (archive.org). Karochat
          doesn&apos;t host these files; availability can vary. Use “Open ↗” to view
          on archive.org.
        </p>
      </section>

      {/* Share your own */}
      <ShareYourOwn userId={userId} userName={userName} />
    </div>
  );
}

// Upload your own audio (→ Music) or video (→ Videos), or loop any external link.
function ShareYourOwn({ userId, userName }: { userId: string; userName: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [src, setSrc] = useState<string | null>(null);
  const [srcKind, setSrcKind] = useState<"audio" | "video">("audio");
  const objUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
    };
  }, []);

  const uploadAudio = useCallback(
    async (f: File) => {
      if (f.size > 40 * 1024 * 1024) {
        setErr("Audio is over 40 MB — pick a smaller file to publish to Music.");
        return;
      }
      setBusy(true);
      setErr(null);
      setNote(null);
      try {
        const ext = (f.name.split(".").pop() ?? "mp3").toLowerCase();
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("music")
          .upload(path, f, { contentType: f.type || "audio/mpeg", upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("music").getPublicUrl(path);
        const { error: insErr } = await supabase.from("tracks").insert({
          owner_id: userId,
          audio_url: pub.publicUrl,
          title: f.name.replace(/\.[^.]+$/, "") || "My audio story",
          artist: userName || null,
          is_public: true
        });
        if (insErr) throw insErr;
        setNote("✓ Published to Music — find it in Live & Karaoke music.");
      } catch (e: any) {
        setErr(e?.message ?? "Couldn't publish your audio.");
      } finally {
        setBusy(false);
      }
    },
    [supabase, userId, userName]
  );

  const uploadVideo = useCallback(
    async (f: File) => {
      if (f.size > 200 * 1024 * 1024) {
        setErr("Video is over 200 MB — pick a smaller file to publish to Videos.");
        return;
      }
      setBusy(true);
      setErr(null);
      setNote(null);
      try {
        const baseMime = (f.type || "video/mp4").split(";")[0] || "video/mp4";
        const ext = (f.name.split(".").pop() ?? "mp4").toLowerCase();
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("videos")
          .upload(path, f, { contentType: baseMime, upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("videos").getPublicUrl(path);
        const { error: insErr } = await supabase.from("videos").insert({
          author_id: userId,
          kind: "upload",
          video_url: pub.publicUrl,
          title: f.name.replace(/\.[^.]+$/, "") || "My video story",
          is_public: true
        });
        if (insErr) throw insErr;
        setNote("✓ Published to Videos — find it in the Videos feed.");
      } catch (e: any) {
        setErr(e?.message ?? "Couldn't publish your video.");
      } finally {
        setBusy(false);
      }
    },
    [supabase, userId]
  );

  function pickFile(kind: "audio" | "video") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = kind === "audio" ? "audio/*" : "video/*";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) void (kind === "audio" ? uploadAudio(f) : uploadVideo(f));
    };
    input.click();
  }

  function loadUrl() {
    const u = url.trim();
    if (!u) return;
    setSrc(u);
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>, kind: "audio" | "video") {
    const f = e.target.files?.[0];
    if (!f) return;
    if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
    const obj = URL.createObjectURL(f);
    objUrlRef.current = obj;
    setSrcKind(kind);
    setSrc(obj);
    e.target.value = "";
  }

  return (
    <section className="surface-glass p-4">
      <p className="text-sm font-medium text-white">⬆️ Share your own story</p>
      <p className="mt-0.5 text-[11px] text-white/50">
        Publish an audio story to Music or a video story to Videos, so others can
        find it — or just preview/loop a link &amp; file here.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => pickFile("audio")}
          disabled={busy}
          className="rounded-xl border border-neon-mint/40 bg-neon-mint/15 px-3 py-2 text-sm font-medium text-neon-mint transition hover:bg-neon-mint/25 disabled:opacity-50"
        >
          🎵 Publish audio
        </button>
        <button
          type="button"
          onClick={() => pickFile("video")}
          disabled={busy}
          className="rounded-xl border border-neon-blue/40 bg-neon-blue/15 px-3 py-2 text-sm font-medium text-white transition hover:bg-neon-blue/25 disabled:opacity-50"
        >
          🎬 Publish video
        </button>
      </div>
      {busy && <p className="mt-2 text-[11px] text-white/45">Uploading…</p>}
      {note && <p className="mt-2 text-[11px] text-neon-mint">{note}</p>}
      {err && <p className="mt-2 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{err}</p>}

      <div className="mt-4 border-t border-white/10 pt-3">
        <p className="text-[11px] text-white/55">Or just preview a link / file here:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadUrl();
            }}
            placeholder="Paste an audio/video link…"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
          />
          <button
            type="button"
            onClick={loadUrl}
            disabled={!url.trim()}
            className="shrink-0 rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2 text-sm font-medium text-white transition hover:bg-neon-purple/30 disabled:opacity-50"
          >
            Play
          </button>
          <label className="shrink-0 cursor-pointer rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/85 transition hover:bg-white/5">
            Audio file
            <input type="file" accept="audio/*" className="hidden" onChange={(e) => onFile(e, "audio")} />
          </label>
          <label className="shrink-0 cursor-pointer rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/85 transition hover:bg-white/5">
            Video file
            <input type="file" accept="video/*" className="hidden" onChange={(e) => onFile(e, "video")} />
          </label>
        </div>
        {src && (
          <div className="mt-3">
            {srcKind === "video" ? (
              <video key={src} src={src} controls playsInline className="w-full rounded-lg" />
            ) : (
              <audio key={src} src={src} controls className="w-full" />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
