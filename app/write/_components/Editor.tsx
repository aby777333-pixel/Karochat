"use client";

// Karochat — shared write editor (new + edit).
//
// Drafts auto-save every 4s of idle while editing an existing publication.
// New (no id yet) saves on the first "Save draft" click, then auto-save
// kicks in for subsequent edits.
//
// Media uploads go to the `publications` Supabase Storage bucket under
// {user_id}/{publication_id}/{filename}. Bucket is public; URLs are
// stored on the row. Cover images write to the same path with a "cover-"
// prefix.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Markdown } from "@/components/Markdown";

type Category = {
  slug: string;
  label: string;
  icon: string | null;
  is_adult: boolean;
};

type Media = {
  id: string;
  kind: "image" | "pdf" | "video" | "audio";
  url: string;
  caption: string | null;
};

export type EditorInitial = {
  id: string | null;
  slug: string | null;
  title: string;
  subtitle: string;
  pen_name: string;
  category_slug: string | null;
  is_adult: boolean;
  cover_image_url: string | null;
  body_markdown: string;
  status: "draft" | "published" | "hidden";
  tags: string[];
};

export function Editor({
  initial,
  categories,
  userId
}: {
  initial: EditorInitial;
  categories: Category[];
  userId: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [id, setId] = useState<string | null>(initial.id);
  const [slug, setSlug] = useState<string | null>(initial.slug);
  const [title, setTitle] = useState(initial.title);
  const [subtitle, setSubtitle] = useState(initial.subtitle);
  const [penName, setPenName] = useState(initial.pen_name);
  const [category, setCategory] = useState(initial.category_slug ?? "");
  const [isAdult, setIsAdult] = useState(initial.is_adult);
  const [coverUrl, setCoverUrl] = useState(initial.cover_image_url ?? "");
  const [body, setBody] = useState(initial.body_markdown);
  const [tagsText, setTagsText] = useState(initial.tags.join(", "));
  const [status, setStatus] = useState<EditorInitial["status"]>(initial.status);

  const [media, setMedia] = useState<Media[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [improving, setImproving] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adult-category enforcement on client (server also enforces).
  useEffect(() => {
    const cat = categories.find((c) => c.slug === category);
    if (cat?.is_adult) setIsAdult(true);
  }, [category, categories]);

  // Load existing media when editing.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("list_publication_media", {
        p_publication_id: id
      });
      if (!cancelled) setMedia((data ?? []) as Media[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, supabase]);

  // Auto-save (existing rows only).
  useEffect(() => {
    if (!id) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      void save();
    }, 4000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle, penName, category, isAdult, body, tagsText, coverUrl]);

  function parseTags(): string[] {
    return tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  async function save(): Promise<string | null> {
    setSaveState("saving");
    setErrorMsg(null);

    if (!title.trim()) {
      setSaveState("error");
      setErrorMsg("Title is required.");
      return null;
    }

    if (id) {
      const { error } = await supabase.rpc("update_publication", {
        p_id: id,
        p_title: title.trim(),
        p_body_markdown: body,
        p_category_slug: category || null,
        p_pen_name: penName.trim() || null,
        p_subtitle: subtitle.trim() || null,
        p_tags: parseTags(),
        p_is_adult: isAdult,
        p_cover_image_url: coverUrl.trim() || null
      });
      if (error) {
        setSaveState("error");
        setErrorMsg(error.message);
        return null;
      }
      setSaveState("saved");
      setTimeout(
        () => setSaveState((s) => (s === "saved" ? "idle" : s)),
        1500
      );
      return id;
    } else {
      const { data, error } = await supabase.rpc("create_publication", {
        p_title: title.trim(),
        p_body_markdown: body,
        p_category_slug: category || null,
        p_pen_name: penName.trim() || null,
        p_subtitle: subtitle.trim() || null,
        p_tags: parseTags(),
        p_is_adult: isAdult,
        p_cover_image_url: coverUrl.trim() || null,
        p_publish: false
      });
      if (error || !data) {
        setSaveState("error");
        setErrorMsg(error?.message ?? "Could not create publication.");
        return null;
      }
      const newId = data as string;
      setId(newId);
      // Look up the new slug so the publish URL is right.
      const { data: row } = await supabase
        .from("publications")
        .select("slug")
        .eq("id", newId)
        .maybeSingle();
      if (row?.slug) setSlug(row.slug as string);
      setSaveState("saved");
      setTimeout(
        () => setSaveState((s) => (s === "saved" ? "idle" : s)),
        1500
      );
      // Redirect to /write/[id]/edit so back-button doesn't re-create.
      router.replace(`/write/${newId}/edit`);
      return newId;
    }
  }

  async function publish() {
    const pubId = await save();
    if (!pubId) return;
    const { error } = await supabase.rpc("publish_publication", {
      p_id: pubId
    });
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setStatus("published");
    router.refresh();
  }

  async function unpublish() {
    if (!id) return;
    const { error } = await supabase.rpc("unpublish_publication", {
      p_id: id
    });
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setStatus("draft");
    router.refresh();
  }

  async function deletePub() {
    if (!id) return;
    if (
      !window.confirm(
        "Delete this publication permanently? This can't be undone."
      )
    )
      return;
    const { error } = await supabase.rpc("delete_publication", { p_id: id });
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    router.replace("/write");
  }

  async function uploadFile(
    file: File,
    role: "cover" | "media"
  ): Promise<{ url: string; path: string } | null> {
    // Ensure we have an id (and therefore folder) before uploading.
    let pubId = id;
    if (!pubId) {
      pubId = await save();
      if (!pubId) return null;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
    const prefix = role === "cover" ? "cover-" : "";
    const path = `${userId}/${pubId}/${prefix}${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from("publications")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (upErr) {
      setErrorMsg(upErr.message);
      return null;
    }
    const { data: pub } = supabase.storage.from("publications").getPublicUrl(path);
    return { url: pub.publicUrl, path };
  }

  async function onCoverUpload(file: File) {
    const res = await uploadFile(file, "cover");
    if (!res) return;
    setCoverUrl(res.url);
    // Save the new cover URL immediately.
    if (id) {
      await supabase.rpc("update_publication", {
        p_id: id,
        p_cover_image_url: res.url
      });
    }
  }

  async function onMediaUpload(file: File) {
    const res = await uploadFile(file, "media");
    if (!res || !id) return;
    const kind = mimeKind(file.type);
    if (!kind) {
      setErrorMsg(`Unsupported file type: ${file.type}`);
      return;
    }
    const { data, error } = await supabase.rpc("register_publication_media", {
      p_publication_id: id,
      p_kind: kind,
      p_url: res.url,
      p_storage_path: res.path,
      p_caption: null,
      p_position: media.length * 10 + 100
    });
    if (error || !data) {
      setErrorMsg(error?.message ?? "Could not attach media.");
      return;
    }
    setMedia((m) => [
      ...m,
      {
        id: data as string,
        kind,
        url: res.url,
        caption: null
      }
    ]);
  }

  async function deleteMedia(mediaId: string) {
    const { error } = await supabase.rpc("delete_publication_media", {
      p_id: mediaId
    });
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setMedia((m) => m.filter((x) => x.id !== mediaId));
  }

  async function improveSelection() {
    const ta = bodyRef.current;
    if (!ta) return;
    const selStart = ta.selectionStart ?? 0;
    const selEnd = ta.selectionEnd ?? 0;
    const text =
      selStart < selEnd ? body.slice(selStart, selEnd) : body;
    if (!text.trim()) {
      setErrorMsg("Highlight some text first, or write a few sentences.");
      return;
    }
    setImproving(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/write/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "improve failed");
      const improved: string = String(data.improved ?? "").trim();
      if (!improved) throw new Error("empty response");
      if (selStart < selEnd) {
        setBody(body.slice(0, selStart) + improved + body.slice(selEnd));
      } else {
        setBody(improved);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || String(e));
    } finally {
      setImproving(false);
    }
  }

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const isPublished = status === "published";

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0">
        {/* Title + subtitle */}
        <div className="surface-glass p-4">
          <label className="block text-[10px] uppercase tracking-widest text-white/45">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your piece a title"
            maxLength={200}
            spellCheck
            className="mt-1 w-full bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-white/30"
          />
          <label className="mt-3 block text-[10px] uppercase tracking-widest text-white/45">
            Subtitle (optional)
          </label>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="A one-liner that pulls the reader in"
            spellCheck
            className="mt-1 w-full bg-transparent text-base text-white/85 outline-none placeholder:text-white/30"
          />
        </div>

        {/* Body + preview toggle */}
        <div className="surface-glass mt-4 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setPreviewing(false)}
                className={
                  "rounded-md px-2 py-1 " +
                  (previewing
                    ? "text-white/55 hover:text-white"
                    : "bg-white/10 text-white")
                }
              >
                ✍ Write
              </button>
              <button
                type="button"
                onClick={() => setPreviewing(true)}
                className={
                  "rounded-md px-2 py-1 " +
                  (previewing
                    ? "bg-white/10 text-white"
                    : "text-white/55 hover:text-white")
                }
              >
                👁 Preview
              </button>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-white/45">
              <span>{wordCount} words</span>
              <button
                type="button"
                onClick={improveSelection}
                disabled={improving}
                className="rounded-md border border-neon-mint/40 bg-neon-mint/10 px-2 py-1 text-neon-mint hover:bg-neon-mint/20 disabled:opacity-50"
                title="AI grammar + clarity pass on selection (or whole body)"
              >
                {improving ? "Improving…" : "✨ Improve with AI"}
              </button>
            </div>
          </div>

          {previewing ? (
            <div className="rounded-xl border border-white/5 bg-black/20 p-4">
              <Markdown source={body || "_(empty)_"} />
            </div>
          ) : (
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`Write here. Markdown supported:\n\n# Heading\n## Subheading\n**bold** *italic*\n- bullet\n1. number\n![alt](/your/image-url)\n\nBrowser spellcheck is on. Highlight a paragraph and hit "Improve with AI" for a grammar + clarity pass.`}
              spellCheck
              autoComplete="off"
              autoCorrect="on"
              className="min-h-[420px] w-full resize-y rounded-xl border border-white/5 bg-black/20 p-4 font-mono text-sm leading-relaxed text-white/90 outline-none placeholder:text-white/30 focus:border-neon-blue/40"
            />
          )}
        </div>

        {/* Media */}
        <div className="surface-glass mt-4 p-4">
          <p className="text-[10px] uppercase tracking-widest text-white/45">
            Attachments — images, PDFs, video, audio
          </p>
          {!id && (
            <p className="mt-2 text-[12px] text-white/55">
              Save the draft once before attaching media.
            </p>
          )}
          {id && (
            <>
              <input
                type="file"
                accept="image/*,application/pdf,video/*,audio/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onMediaUpload(f);
                  e.target.value = "";
                }}
                className="mt-2 block w-full text-sm text-white/80 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-white/20"
              />
              {media.length > 0 && (
                <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {media.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2 text-[12px]"
                    >
                      <span className="text-[10px] uppercase tracking-widest text-white/45">
                        {m.kind}
                      </span>
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 truncate text-neon-blue hover:underline"
                      >
                        {m.url.split("/").pop()}
                      </a>
                      <button
                        type="button"
                        onClick={() => void deleteMedia(m.id)}
                        className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-white/55 hover:bg-neon-red/15 hover:text-neon-red"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {errorMsg && (
          <p className="mt-3 rounded-xl border border-neon-red/30 bg-neon-red/10 p-3 text-sm text-neon-red">
            {errorMsg}
          </p>
        )}
      </div>

      <aside className="space-y-4">
        {/* Save bar */}
        <div className="surface-glass p-4 text-sm">
          <p className="text-[10px] uppercase tracking-widest text-white/45">
            Status
          </p>
          <p className="mt-1 font-display text-base font-semibold text-white">
            {isPublished ? "🌍 Published" : "📝 Draft"}
          </p>
          <p className="mt-1 text-[11px] text-white/50">
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && "Saved."}
            {saveState === "error" && "Save failed."}
            {saveState === "idle" && id && "Auto-saves while you type."}
            {saveState === "idle" && !id && "Click Save draft to start auto-saving."}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void save()}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
            >
              💾 Save draft
            </button>
            {isPublished ? (
              <button
                type="button"
                onClick={() => void unpublish()}
                className="rounded-lg border border-neon-amber/40 bg-neon-amber/10 px-3 py-2 text-sm text-neon-amber hover:bg-neon-amber/20"
              >
                ⏸ Unpublish
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void publish()}
                className="rounded-lg bg-neon-mint px-3 py-2 text-sm font-medium text-ink-900 hover:bg-neon-mint/90"
              >
                🌍 Publish
              </button>
            )}
            {isPublished && slug && (
              <Link
                href={`/read/${slug}`}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-sm text-white/80 hover:bg-white/10"
              >
                🔗 View public page
              </Link>
            )}
            {id && (
              <button
                type="button"
                onClick={() => void deletePub()}
                className="mt-2 rounded-lg border border-neon-red/30 bg-neon-red/5 px-3 py-2 text-sm text-neon-red/85 hover:bg-neon-red/15"
              >
                🗑 Delete permanently
              </button>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="surface-glass p-4 text-sm">
          <p className="text-[10px] uppercase tracking-widest text-white/45">
            Pen name
          </p>
          <input
            value={penName}
            onChange={(e) => setPenName(e.target.value)}
            placeholder="Leave blank to use your display name"
            className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] text-white outline-none focus:border-neon-blue/60"
          />
          <p className="mt-3 text-[10px] uppercase tracking-widest text-white/45">
            Category
          </p>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] text-white outline-none focus:border-neon-blue/60"
          >
            <option value="">— Pick one —</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.icon} {c.label}
                {c.is_adult ? " (18+)" : ""}
              </option>
            ))}
          </select>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-white/80">
            <input
              type="checkbox"
              checked={isAdult}
              onChange={(e) => setIsAdult(e.target.checked)}
              className="h-4 w-4"
            />
            18+ content (hidden from unattested readers)
          </label>
          <p className="mt-3 text-[10px] uppercase tracking-widest text-white/45">
            Tags (comma-separated)
          </p>
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="e.g. memoir, travel, india"
            className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] text-white outline-none focus:border-neon-blue/60"
          />
          <p className="mt-3 text-[10px] uppercase tracking-widest text-white/45">
            Cover image
          </p>
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt=""
              className="mt-1 h-24 w-full rounded-md object-cover"
            />
          ) : (
            <p className="mt-1 text-[12px] text-white/45">
              Optional. Shown on the library card + reader header.
            </p>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onCoverUpload(f);
              e.target.value = "";
            }}
            className="mt-2 block w-full text-[12px] text-white/80 file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-[12px] file:text-white hover:file:bg-white/20"
          />
        </div>
      </aside>
    </div>
  );
}

function mimeKind(mime: string): "image" | "pdf" | "video" | "audio" | null {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return null;
}
