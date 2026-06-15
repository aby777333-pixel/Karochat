"use client";

// Karochat — Files & Apps hub. Users share files (PDFs, eBooks, documents,
// software, APKs, archives…) with a heading, caption, description and category,
// public or private. Others can read PDFs in-browser or download/install.
// Reuses the gated shared_files table + shared-files bucket (migration 0095).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ContentDisclaimer } from "@/components/ContentDisclaimer";

type FileRow = {
  id: string;
  owner_id: string;
  title: string;
  caption: string | null;
  description: string | null;
  category: string | null;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  file_mime: string | null;
  is_public: boolean;
  download_count: number;
  created_at: string;
  author_username: string | null;
  author_display_name: string | null;
};

const CATEGORIES = ["PDF", "eBook", "Document", "Software", "App (APK)", "Archive", "Audio", "Image", "Other"];
const MAX_BYTES = 500 * 1024 * 1024; // matches the bucket cap (500 MB)

function fmtSize(b: number | null): string {
  if (!b || b <= 0) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function catIcon(c: string | null, mime: string | null): string {
  const k = (c || "").toLowerCase();
  if (k.includes("pdf")) return "📕";
  if (k.includes("ebook")) return "📚";
  if (k.includes("doc")) return "📄";
  if (k.includes("software")) return "💿";
  if (k.includes("apk") || k.includes("app")) return "📱";
  if (k.includes("archive")) return "🗜️";
  if (k.includes("audio")) return "🎵";
  if (k.includes("image")) return "🖼️";
  if ((mime || "").includes("pdf")) return "📕";
  return "📦";
}

function inferCategory(name: string, mime: string): string {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  if (ext === "pdf" || mime.includes("pdf")) return "PDF";
  if (["epub", "mobi", "azw3"].includes(ext)) return "eBook";
  if (["doc", "docx", "odt", "txt", "rtf", "ppt", "pptx", "xls", "xlsx", "csv"].includes(ext)) return "Document";
  if (["exe", "msi", "dmg", "pkg", "deb", "rpm", "appimage"].includes(ext)) return "Software";
  if (ext === "apk") return "App (APK)";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "Archive";
  if (mime.startsWith("audio")) return "Audio";
  if (mime.startsWith("image")) return "Image";
  return "Other";
}

export function FilesHub({ userId, userName }: { userId: string; userName: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [uploading, setUploading] = useState(false);
  const [progressNote, setProgressNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [files, setFiles] = useState<FileRow[]>([]);
  const [view, setView] = useState<"public" | "mine">("public");
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    let qb = supabase
      .from("shared_files_with_author")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80);
    if (view === "mine") qb = qb.eq("owner_id", userId);
    else qb = qb.eq("is_public", true);
    if (catFilter !== "all") qb = qb.eq("category", catFilter);
    const { data, error: e } = await qb;
    if (e) setError(e.message);
    else setFiles((data ?? []) as FileRow[]);
    setLoading(false);
  }, [supabase, view, catFilter, userId]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!title.trim()) {
      setError("Add a heading first, then choose your file.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("That file is over 500 MB — please pick a smaller file.");
      return;
    }
    setUploading(true);
    setError(null);
    setProgressNote("Uploading…");
    try {
      const safeName = f.name.replace(/[^\w.\-]+/g, "_").slice(-80) || "file";
      const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("shared-files")
        .upload(path, f, { contentType: f.type || "application/octet-stream", upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("shared-files").getPublicUrl(path);
      const cat = category || inferCategory(f.name, f.type || "");
      const { error: insErr } = await supabase.from("shared_files").insert({
        owner_id: userId,
        title: title.trim(),
        caption: caption.trim() || null,
        description: description.trim() || null,
        category: cat,
        file_url: pub.publicUrl,
        file_name: f.name,
        file_size: f.size,
        file_mime: f.type || null,
        is_public: visibility === "public"
      });
      if (insErr) throw insErr;
      setProgressNote(visibility === "public" ? "✓ Published." : "✓ Saved privately.");
      setTitle("");
      setCaption("");
      setDescription("");
      setCategory("");
      await loadFiles();
    } catch (err: any) {
      setError(err?.message ?? "Upload failed.");
      setProgressNote(null);
    } finally {
      setUploading(false);
    }
  }

  async function download(f: FileRow) {
    try {
      await supabase.rpc("increment_file_download", { p_id: f.id });
    } catch {
      // best-effort counter
    }
    // Force a download via Supabase's ?download param (sets Content-Disposition).
    const sep = f.file_url.includes("?") ? "&" : "?";
    const href = `${f.file_url}${sep}download=${encodeURIComponent(f.file_name || f.title)}`;
    const a = document.createElement("a");
    a.href = href;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return files;
    return files.filter(
      (f) =>
        f.title.toLowerCase().includes(term) ||
        (f.caption ?? "").toLowerCase().includes(term) ||
        (f.description ?? "").toLowerCase().includes(term) ||
        (f.file_name ?? "").toLowerCase().includes(term)
    );
  }, [files, search]);

  return (
    <div className="space-y-5">
      <section className="surface-glass tint-purple p-5">
        <h1 className="font-display text-xl font-semibold">📂 Files &amp; Apps</h1>
        <p className="mt-1 text-sm text-white/60">
          Share PDFs, eBooks, documents, software &amp; apps. Add a heading, caption,
          description and category, choose public or private — others can read or
          download &amp; install.
        </p>
      </section>

      {/* Composer */}
      <section className="surface-glass p-4">
        <p className="text-sm font-medium text-white">⬆️ Share a file</p>

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

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Heading (required)"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 outline-none focus:border-neon-purple/60"
          >
            <option value="">Category (auto-detect)…</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption (short)"
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Description — what is it, how to use/install, version, etc."
          className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
        />

        <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !title.trim()}
            className="rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2 text-sm font-medium text-white transition hover:bg-neon-purple/30 disabled:opacity-50"
            title={title.trim() ? "Choose a file (up to 500 MB)" : "Add a heading first"}
          >
            {uploading ? "Uploading…" : "📎 Choose & upload file"}
          </button>
          <span className="text-[11px] text-white/40">Up to 500 MB · any file type</span>
          {progressNote && <span className="text-[11px] text-neon-mint">{progressNote}</span>}
        </div>
        {error && <p className="mt-2 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{error}</p>}

        <ContentDisclaimer scope="files" className="mt-3" />
      </section>

      {/* Browser */}
      <section className="surface-glass p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setView("public")}
              className={
                "rounded-lg px-3 py-1.5 transition " +
                (view === "public" ? "bg-neon-purple/25 text-white" : "text-white/65 hover:bg-white/10")
              }
            >
              All files
            </button>
            <button
              type="button"
              onClick={() => setView("mine")}
              className={
                "rounded-lg px-3 py-1.5 transition " +
                (view === "mine" ? "bg-neon-purple/25 text-white" : "text-white/65 hover:bg-white/10")
              }
            >
              My files
            </button>
          </div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white/85 outline-none focus:border-neon-purple/60"
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search files…"
          className="mb-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
        />

        {loading ? (
          <p className="px-1 py-6 text-center text-sm text-white/50">
            <span className="mr-2 animate-pulseDot">●</span>Loading files…
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-white/50">
            {view === "mine" ? "You haven't shared any files yet." : "No files yet — be the first to share."}
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((f) => {
              const isPdf = (f.category || "").toLowerCase().includes("pdf") || (f.file_mime || "").includes("pdf");
              const open = openId === f.id;
              return (
                <li key={f.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10 text-xl">
                      {catIcon(f.category, f.file_mime)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-white">{f.title}</span>
                        {f.category && (
                          <span className="rounded-md bg-neon-purple/15 px-1.5 py-0.5 text-[10px] text-neon-purple">
                            {f.category}
                          </span>
                        )}
                        {!f.is_public && (
                          <span className="rounded-md bg-neon-amber/15 px-1.5 py-0.5 text-[10px] text-neon-amber">
                            🔒 Private
                          </span>
                        )}
                      </div>
                      {f.caption && <p className="truncate text-[12px] text-white/60">{f.caption}</p>}
                      <p className="mt-0.5 text-[11px] text-white/40">
                        {[
                          f.file_name,
                          fmtSize(f.file_size),
                          `${f.download_count} downloads`,
                          f.author_display_name || f.author_username || "someone"
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {f.description && (
                        <>
                          {open && (
                            <p className="mt-1 whitespace-pre-wrap text-[12px] text-white/70">{f.description}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => setOpenId(open ? null : f.id)}
                            className="mt-1 text-[11px] text-neon-blue hover:underline"
                          >
                            {open ? "Hide details" : "Details"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void download(f)}
                      className="rounded-lg border border-neon-purple/40 bg-neon-purple/15 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-neon-purple/25"
                    >
                      ⬇ Download
                    </button>
                    {isPdf && (
                      <a
                        href={f.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] text-white/85 hover:bg-white/10"
                      >
                        📖 Read
                      </a>
                    )}
                    <a
                      href={f.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] text-white/70 hover:bg-white/10"
                    >
                      Open ↗
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[10px] leading-relaxed text-white/35">
          Files are uploaded by users. Scan anything you download before opening, and
          only run software you trust.
        </p>
      </section>
    </div>
  );
}
