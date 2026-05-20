"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPT = "video/mp4,video/webm,video/quicktime,video/x-m4v";

export function ShortUpload({ currentUserId }: { currentUserId: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError("That file is over 50 MB. Trim it or pick a smaller export.");
      e.target.value = "";
      return;
    }
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function submit() {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    setProgress(5);
    try {
      const ext = (file.name.split(".").pop() ?? "mp4").toLowerCase();
      const path = `${currentUserId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("shorts")
        .upload(path, file, {
          contentType: file.type || "video/mp4",
          upsert: false
        });
      if (upErr) throw upErr;
      setProgress(75);

      const { data: pub } = supabase.storage.from("shorts").getPublicUrl(path);
      const videoUrl = pub.publicUrl;

      const { error: insertErr } = await supabase.from("shorts").insert({
        author_id: currentUserId,
        video_url: videoUrl,
        caption: caption.trim() || null,
        is_public: isPublic
      });
      if (insertErr) throw insertErr;
      setProgress(100);
      router.push("/shorts");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Upload failed.");
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <div className="space-y-4">
      {!file ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-10 text-center text-white/60 transition hover:border-neon-blue/40 hover:bg-white/5"
        >
          <span aria-hidden className="text-3xl">🎬</span>
          <span className="text-sm font-medium text-white/85">Pick a video</span>
          <span className="text-[11px] text-white/40">
            up to 50 MB · mp4 / webm / mov
          </span>
        </button>
      ) : (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          {previewUrl && (
            <video
              src={previewUrl}
              controls
              playsInline
              muted
              className="mx-auto block max-h-[60vh] w-full rounded-lg bg-black"
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
      )}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={onFile}
      />

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        maxLength={300}
        rows={3}
        placeholder="Caption (optional)"
        className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/60"
      />

      <fieldset className="space-y-1.5">
        <legend className="text-[10px] uppercase tracking-widest text-white/40">
          Visibility
        </legend>
        <label
          className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-xs transition ${
            isPublic
              ? "border-neon-blue/60 bg-neon-blue/10"
              : "border-white/10 bg-white/5 hover:bg-white/10"
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
            <p className="mt-0.5 text-white/55">
              Anyone on Karochat can see it in the Shorts feed.
            </p>
          </div>
        </label>
        <label
          className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-xs transition ${
            !isPublic
              ? "border-neon-blue/60 bg-neon-blue/10"
              : "border-white/10 bg-white/5 hover:bg-white/10"
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
            <p className="mt-0.5 text-white/55">
              Only you can see it. Useful for drafts or personal archive.
            </p>
          </div>
        </label>
      </fieldset>

      {uploading && progress > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-neon-blue transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {error && (
        <p className="rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">
          {error}
        </p>
      )}

      <Button
        onClick={() => void submit()}
        disabled={!file || uploading}
        className="w-full"
      >
        {uploading ? "Uploading…" : "Post"}
      </Button>
    </div>
  );
}
