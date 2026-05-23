"use client";

// Karochat — Books upload flow (v9 Phase 2).
//
// 3 steps:
//   1. file pick → cover (optional, falls back to text cover server-side)
//   2. metadata (title / author / language / genres / pages / age / visibility)
//   3. license declaration — required; 'none of the above' blocks upload
//
// On submit: hashes the file (SHA-256 client-side; stored as
// perceptual_hash for now — true PDF-text perceptual hashing comes in a
// later phase), uploads to books-files bucket under <user-id>/, uploads
// the cover (if any) to book-covers, then calls register_book_upload
// which routes to status='live' for PD / author_uploaded or
// 'pending_review' for the other license types.

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LicenseType =
  | "public_domain"
  | "creative_commons"
  | "author_uploaded"
  | "author_permission"
  | "fair_use"
  | "none";

const LICENSE_OPTIONS: {
  value: LicenseType;
  label: string;
  description: string;
  blocking?: boolean;
}[] = [
  {
    value: "public_domain",
    label: "Public domain",
    description:
      "Pre-1929 in the US, or otherwise out of copyright in your country. Goes live immediately."
  },
  {
    value: "creative_commons",
    label: "Creative Commons",
    description:
      "Author released under a CC license (you supply the code, e.g. CC-BY-SA-4.0). Reviewed within 6 hours."
  },
  {
    value: "author_uploaded",
    label: "I am the author",
    description:
      "You wrote this. Goes live immediately. Your profile gets a 📝 Author badge if verified."
  },
  {
    value: "author_permission",
    label: "Author gave me permission",
    description:
      "You have written permission to host this. Upload the permission letter / screenshot as evidence. Reviewed within 6 hours."
  },
  {
    value: "fair_use",
    label: "Educational use under fair-use",
    description:
      "Excerpt / classroom use. Removed immediately if the rightsholder objects. Reviewed."
  },
  {
    value: "none",
    label: "None of the above",
    description:
      "Karochat doesn't host pirated copyrighted material — it gets the platform shut down and hurts authors. If this is your own writing, pick \"I am the author\" instead.",
    blocking: true
  }
];

const FORMAT_FROM_MIME: Record<string, "pdf" | "epub" | "mobi"> = {
  "application/pdf": "pdf",
  "application/epub+zip": "epub",
  "application/x-mobipocket-ebook": "mobi"
};

const FORMAT_FROM_EXT: Record<string, "pdf" | "epub" | "mobi"> = {
  pdf: "pdf",
  epub: "epub",
  mobi: "mobi"
};

const COMMON_LANGUAGES = [
  ["en", "English"],
  ["hi", "Hindi"],
  ["ta", "Tamil"],
  ["te", "Telugu"],
  ["ml", "Malayalam"],
  ["kn", "Kannada"],
  ["bn", "Bengali"],
  ["mr", "Marathi"],
  ["gu", "Gujarati"],
  ["pa", "Punjabi"],
  ["ur", "Urdu"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["pt", "Portuguese"],
  ["ar", "Arabic"],
  ["zh", "Chinese"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["ru", "Russian"]
];

function sanitizeName(name: string): string {
  const clean = name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 80);
  return clean.length > 0 ? clean : "upload";
}

async function sha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  const bytes = Array.from(new Uint8Array(hash));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function UploadFlow({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [language, setLanguage] = useState("en");
  const [genres, setGenres] = useState("");
  const [pageCount, setPageCount] = useState<number | "">("");
  const [age, setAge] = useState<"all" | "13plus" | "16plus" | "18plus">("all");
  const [visibility, setVisibility] = useState<"public" | "listed_private" | "private">("public");
  const [license, setLicense] = useState<LicenseType | "">("");
  const [ccCode, setCcCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function pickFile(f: File | null) {
    setErr(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > 100 * 1024 * 1024) {
      setErr(`That file is ${Math.round(f.size / (1024 * 1024))} MB — the limit is 100 MB.`);
      return;
    }
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    const formatOk =
      f.type in FORMAT_FROM_MIME || ext in FORMAT_FROM_EXT;
    if (!formatOk) {
      setErr("Pick a PDF, EPUB, or MOBI file.");
      return;
    }
    setFile(f);
    if (!title) {
      // Suggest a title from the filename minus extension.
      setTitle(f.name.replace(/\.(pdf|epub|mobi)$/i, ""));
    }
  }

  function pickCover(f: File | null) {
    setErr(null);
    if (!f) {
      setCover(null);
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setErr("Cover must be under 5 MB.");
      return;
    }
    if (!/^image\//.test(f.type)) {
      setErr("Cover must be an image (PNG, JPG, WebP).");
      return;
    }
    setCover(f);
  }

  function next() {
    setErr(null);
    if (step === 1) {
      if (!file) {
        setErr("Pick a book file to continue.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!title.trim()) {
        setErr("Title is required.");
        return;
      }
      setStep(3);
    }
  }

  function back() {
    setErr(null);
    setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));
  }

  async function submit() {
    if (!file) return;
    if (!license || license === "none") {
      setErr("Pick a valid license — see why on the right.");
      return;
    }
    if (license === "creative_commons" && !ccCode.trim()) {
      setErr("Add the CC license code (e.g. CC-BY-SA-4.0).");
      return;
    }
    setBusy("hash");
    setErr(null);
    try {
      const hash = await sha256(file);
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
      const format =
        FORMAT_FROM_MIME[file.type] ?? FORMAT_FROM_EXT[ext] ?? "pdf";

      setBusy("upload-file");
      const filePath = `${currentUserId}/${Date.now()}-${sanitizeName(file.name)}`;
      const { error: fileErr } = await supabase.storage
        .from("books-files")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "application/pdf"
        });
      if (fileErr) throw new Error(`File upload failed: ${fileErr.message}`);

      let coverUrl: string | null = null;
      if (cover) {
        setBusy("upload-cover");
        const coverPath = `${currentUserId}/${Date.now()}-${sanitizeName(cover.name)}`;
        const { error: coverErr } = await supabase.storage
          .from("book-covers")
          .upload(coverPath, cover, {
            cacheControl: "3600",
            upsert: false,
            contentType: cover.type
          });
        if (coverErr) {
          throw new Error(`Cover upload failed: ${coverErr.message}`);
        }
        const { data: coverPublic } = supabase.storage
          .from("book-covers")
          .getPublicUrl(coverPath);
        coverUrl = coverPublic?.publicUrl ?? null;
      }

      setBusy("register");
      const genresArr = genres
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8);
      const { data: bookId, error: rpcErr } = await supabase.rpc(
        "register_book_upload",
        {
          p_title: title.trim(),
          p_author: author.trim() || null,
          p_language: language,
          p_file_url: filePath,
          p_file_size_bytes: file.size,
          p_format: format,
          p_cover_url: coverUrl,
          p_isbn: null,
          p_page_count: typeof pageCount === "number" ? pageCount : null,
          p_word_count: null,
          p_license_type: license,
          p_license_metadata: license === "creative_commons" ? { code: ccCode } : {},
          p_cc_license_code: license === "creative_commons" ? ccCode.trim() : null,
          p_genres: genresArr,
          p_syllabus_codes: [],
          p_age_suitability: age,
          p_visibility: visibility,
          p_perceptual_hash: hash
        }
      );
      if (rpcErr) throw new Error(rpcErr.message);
      if (!bookId) throw new Error("register_book_upload returned no id");

      router.push(`/books/${bookId}`);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="surface-glass mt-6 grid grid-cols-1 gap-5 p-6 xl:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        <Steps step={step} />

        {step === 1 && (
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-white/50">
                Book file (PDF / EPUB / MOBI, up to 100 MB)
              </label>
              <input
                type="file"
                accept=".pdf,.epub,.mobi,application/pdf,application/epub+zip,application/x-mobipocket-ebook"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-white/80"
              />
              {file && (
                <p className="mt-1 text-[11px] text-white/55">
                  {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              )}
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-white/50">
                Cover image (optional, 5 MB max)
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => pickCover(e.target.files?.[0] ?? null)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-white/80"
              />
              {cover && (
                <p className="mt-1 text-[11px] text-white/55">
                  {cover.name} · {Math.round(cover.size / 1024)} KB
                </p>
              )}
              <p className="mt-1 text-[11px] text-white/35">
                No cover? We&apos;ll generate a minimalist text cover from the title.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Title (required)">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 200))}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
              />
            </Field>
            <Field label="Author">
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value.slice(0, 120))}
                placeholder="e.g. Jane Austen"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-mint/40"
              />
            </Field>
            <Field label="Language">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-mint/40"
              >
                {COMMON_LANGUAGES.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label} ({code})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Page count (optional)">
              <input
                type="number"
                min={1}
                value={pageCount}
                onChange={(e) =>
                  setPageCount(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
              />
            </Field>
            <Field label="Genres (comma-separated, up to 8)">
              <input
                value={genres}
                onChange={(e) => setGenres(e.target.value.slice(0, 240))}
                placeholder="e.g. fiction, philosophy, indian-literature"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-mint/40"
              />
            </Field>
            <Field label="Age suitability">
              <select
                value={age}
                onChange={(e) => setAge(e.target.value as any)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-mint/40"
              >
                <option value="all">All ages</option>
                <option value="13plus">13+</option>
                <option value="16plus">16+</option>
                <option value="18plus">18+ (Adult only)</option>
              </select>
            </Field>
            <Field label="Visibility" wide>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["public", "🌍 Public — anyone can find + read"],
                    ["listed_private", "🔗 Listed-private — link only"],
                    ["private", "🕶️ Private — only you"]
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    className={clsx(
                      "rounded-xl border px-3 py-1.5 text-xs",
                      visibility === v
                        ? "border-neon-mint/60 bg-neon-mint/15 text-neon-mint"
                        : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="mt-5 space-y-2">
            {LICENSE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLicense(opt.value)}
                className={clsx(
                  "block w-full rounded-xl border px-3 py-3 text-left text-sm transition",
                  license === opt.value
                    ? opt.blocking
                      ? "border-neon-red/60 bg-neon-red/10"
                      : "border-neon-mint/60 bg-neon-mint/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                )}
              >
                <p className="font-medium text-white">{opt.label}</p>
                <p className="mt-1 text-[12px] text-white/65">{opt.description}</p>
              </button>
            ))}
            {license === "creative_commons" && (
              <div>
                <label className="mt-2 block text-[11px] uppercase tracking-widest text-white/50">
                  CC license code
                </label>
                <input
                  value={ccCode}
                  onChange={(e) => setCcCode(e.target.value.slice(0, 40))}
                  placeholder="e.g. CC-BY-SA-4.0"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
                />
              </div>
            )}
          </div>
        )}

        {err && (
          <p className="mt-4 rounded-xl border border-neon-red/40 bg-neon-red/10 p-3 text-sm text-neon-red">
            {err}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {step > 1 && (
            <button
              type="button"
              onClick={back}
              disabled={!!busy}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10 disabled:opacity-60"
            >
              ← Back
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              disabled={!!busy}
              className="rounded-xl bg-neon-mint px-4 py-2 text-sm font-medium text-ink-900 hover:bg-neon-mint/90 disabled:opacity-60"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!!busy || !license || license === "none"}
              className="rounded-xl bg-neon-mint px-4 py-2 text-sm font-medium text-ink-900 hover:bg-neon-mint/90 disabled:opacity-60"
            >
              {busy === "hash"
                ? "Hashing…"
                : busy === "upload-file"
                ? "Uploading book…"
                : busy === "upload-cover"
                ? "Uploading cover…"
                : busy === "register"
                ? "Finalizing…"
                : "Upload book"}
            </button>
          )}
        </div>
      </div>

      <aside className="surface-glass tint-mint p-5 text-[12px] leading-relaxed text-white/80">
        <p className="font-display text-sm font-semibold text-white">
          The license rules in 5 lines
        </p>
        <ul className="mt-2 space-y-1.5">
          <li><strong className="text-neon-mint">Public domain</strong> + <strong className="text-neon-mint">I am the author</strong> → live instantly.</li>
          <li><strong className="text-neon-mint">Creative Commons</strong> → reviewed within 6h.</li>
          <li><strong className="text-neon-mint">Author permission</strong> + <strong className="text-neon-mint">Fair use</strong> → reviewed; removed if rightsholder objects.</li>
          <li><strong className="text-neon-red">None of the above</strong> blocks the upload.</li>
          <li>3 valid copyright complaints = permanent upload ban.</li>
        </ul>
        <p className="mt-3 text-[11px] text-white/55">
          False declarations are caught by DMCA notices we&apos;ll receive
          directly. Don&apos;t risk your account.
        </p>
      </aside>
    </section>
  );
}

function Steps({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["File", "Metadata", "License"];
  return (
    <ol className="flex items-center gap-2 text-[11px]">
      {labels.map((l, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const active = n === step;
        const done = n < step;
        return (
          <li
            key={l}
            className={clsx(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1",
              active
                ? "border-neon-mint/60 bg-neon-mint/10 text-neon-mint"
                : done
                ? "border-white/15 bg-white/5 text-white/70"
                : "border-white/10 bg-white/3 text-white/40"
            )}
          >
            <span className="font-mono">{n}</span>
            <span>{l}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Field({
  label,
  children,
  wide
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="block text-[11px] uppercase tracking-widest text-white/50">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
