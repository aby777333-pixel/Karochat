"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";
import { toVideoEmbed } from "@/lib/videoEmbed";

const MAX_BYTES = 200 * 1024 * 1024;
const ACCEPT = "video/mp4,video/webm,video/quicktime,video/x-m4v,video/x-matroska";

export function VideoUpload({ currentUserId }: { currentUserId: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"file" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError("That file is over 200 MB. Trim it or pick a smaller export.");
      e.target.value = "";
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  }

  const linkEmbed = useMemo(
    () => (linkUrl.trim() ? toVideoEmbed(linkUrl.trim()) : null),
    [linkUrl]
  );

  async function submit() {
    if (uploading) return;
    if (!title.trim()) {
      setError("Give your video a title.");
      return;
    }
    setUploading(true);
    setError(null);
    setProgress(5);
    try {
      if (mode === "file") {
        if (!file) {
          setError("Pick a video file.");
          setUploading(false);
          return;
        }
        const ext = (file.name.split(".").pop() ?? "mp4").toLowerCase();
        const path = `${currentUserId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("videos")
          .upload(path, file, { contentType: file.type || "video/mp4", upsert: false });
        if (upErr) throw upErr;
        setProgress(75);
        const { data: pub } = supabase.storage.from("videos").getPublicUrl(path);
        const { error: insErr } = await supabase.from("videos").insert({
          author_id: currentUserId,
          kind: "upload",
          video_url: pub.publicUrl,
          title: title.trim(),
          description: description.trim() || null,
          is_public: isPublic
        });
        if (insErr) throw insErr;
      } else {
        const raw = linkUrl.trim();
        if (!raw) {
          setError("Paste a video link.");
          setUploading(false);
          return;
        }
        const href =
          raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
        const { error: insErr } = await supabase.from("videos").insert({
          author_id: currentUserId,
          kind: "link",
          external_url: href,
          embed_url: toVideoEmbed(href),
          title: title.trim(),
          description: description.trim() || null,
          is_public: isPublic
        });
        if (insErr) throw insErr;
      }
      setProgress(100);
      router.push("/videos");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't post the video.");
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <div className="space-y-4">
      {/* Mode picker */}
      <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setMode("file")}
          className={
            "rounded-lg px-3 py-1.5 transition " +
            (mode === "file" ? "bg-neon-blue/20 text-neon-blue" : "text-white/65 hover:bg-white/10")
          }
        >
          ⬆ Upload a file
        </button>
        <button
          type="button"
          onClick={() => setMode("link")}
          className={
            "rounded-lg px-3 py-1.5 transition " +
            (mode === "link" ? "bg-neon-blue/20 text-neon-blue" : "text-white/65 hover:bg-white/10")
          }
        >
          🔗 Paste a link
        </button>
      </div>

      {mode === "file" ? (
        !file ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-10 text-center text-white/60 transition hover:border-neon-blue/40 hover:bg-white/5"
          >
            <span aria-hidden className="text-3xl">🎞️</span>
            <span className="text-sm font-medium text-white/85">Pick a video</span>
            <span className="text-[11px] text-white/40">mp4 / webm / mov / mkv — up to 200 MB</span>
          </button>
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            {previewUrl && (
              <video
                src={previewUrl}
                controls
                playsInline
                className="mx-auto block max-h-[50vh] w-full rounded-lg bg-black"
              />
            )}
            <div className="mt-2 flex items-center justify-between text-xs text-white/55">
              <span className="truncate" title={file.name}>
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setFile(null);
                  setPreviewUrl(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/60 hover:bg-white/10"
              >
                change
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-2">
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Paste a YouTube / Vimeo / Dailymotion / video URL…"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/60"
          />
          {linkUrl.trim() && (
            <p className="text-[11px] text-white/45">
              {linkEmbed
                ? "✓ This link will play inline."
                : "This link will show as a button that opens the video site."}
            </p>
          )}
          {linkEmbed && (
            <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "16 / 9" }}>
              <iframe
                src={linkEmbed}
                title="Preview"
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={onFile}
      />

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        placeholder="Title"
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/60"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="Description (optional)"
        className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/60"
      />

      <fieldset className="space-y-1.5">
        <legend className="text-[10px] uppercase tracking-widest text-white/40">Visibility</legend>
        <label
          className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-xs transition ${
            isPublic ? "border-neon-blue/60 bg-neon-blue/10" : "border-white/10 bg-white/5 hover:bg-white/10"
          }`}
        >
          <input
            type="radio"
            name="vis"
            checked={isPublic}
            onChange={() => setIsPublic(true)}
            className="mt-0.5 accent-neon-blue"
          />
          <div>
            <div className="font-medium text-white">🌍 Public</div>
            <p className="mt-0.5 text-white/55">Anyone on Karochat can watch it in the Videos feed.</p>
          </div>
        </label>
        <label
          className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-xs transition ${
            !isPublic ? "border-neon-blue/60 bg-neon-blue/10" : "border-white/10 bg-white/5 hover:bg-white/10"
          }`}
        >
          <input
            type="radio"
            name="vis"
            checked={!isPublic}
            onChange={() => setIsPublic(false)}
            className="mt-0.5 accent-neon-blue"
          />
          <div>
            <div className="font-medium text-white">🔒 Private</div>
            <p className="mt-0.5 text-white/55">Only you can see it.</p>
          </div>
        </label>
      </fieldset>

      {uploading && progress > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-neon-blue transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && (
        <p className="rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{error}</p>
      )}

      <Button
        onClick={() => void submit()}
        disabled={uploading || (mode === "file" ? !file : !linkUrl.trim())}
        className="w-full"
      >
        {uploading ? "Posting…" : "Post video"}
      </Button>
    </div>
  );
}
