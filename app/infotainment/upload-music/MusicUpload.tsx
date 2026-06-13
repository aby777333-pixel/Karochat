"use client";

// Karochat — music uploader. Mirrors the proven ShortUpload flow: upload the
// audio file into the per-user folder of the public `music` bucket, then insert
// a `tracks` row. Mobile-first; no popovers.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

const MAX_BYTES = 40 * 1024 * 1024;
const ACCEPT =
  "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/aac,audio/mp4,audio/x-m4a,audio/flac,.mp3,.wav,.m4a,.ogg,.flac,.aac";

export function MusicUpload({
  currentUserId,
  defaultArtist
}: {
  currentUserId: string;
  defaultArtist: string;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState(defaultArtist ?? "");
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError("That file is over 40 MB. Try a compressed MP3.");
      e.target.value = "";
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function submit() {
    if (!file || uploading) return;
    if (!title.trim()) {
      setError("Give your track a title.");
      return;
    }
    setUploading(true);
    setError(null);
    setProgress(5);
    try {
      const ext = (file.name.split(".").pop() ?? "mp3").toLowerCase();
      const path = `${currentUserId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("music")
        .upload(path, file, {
          contentType: file.type || "audio/mpeg",
          upsert: false
        });
      if (upErr) throw upErr;
      setProgress(75);

      const { data: pub } = supabase.storage.from("music").getPublicUrl(path);

      const { error: insertErr } = await supabase.from("tracks").insert({
        owner_id: currentUserId,
        audio_url: pub.publicUrl,
        title: title.trim(),
        artist: artist.trim() || null,
        is_public: isPublic
      });
      if (insertErr) throw insertErr;
      setProgress(100);
      router.push("/infotainment#mymusic");
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
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-10 text-center text-white/60 transition hover:border-neon-mint/40 hover:bg-white/5"
        >
          <span aria-hidden className="text-3xl">🎵</span>
          <span className="text-sm font-medium text-white/85">Pick an audio file</span>
          <span className="text-[11px] text-white/40">mp3 / wav / m4a / ogg / flac</span>
        </button>
      ) : (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          {previewUrl && (
            <audio src={previewUrl} controls className="w-full" />
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

      <div className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Track title"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-neon-mint/60"
        />
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          maxLength={120}
          placeholder="Artist (optional)"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-neon-mint/60"
        />
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-[10px] uppercase tracking-widest text-white/40">
          Visibility
        </legend>
        <label
          className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-xs transition ${
            isPublic
              ? "border-neon-mint/60 bg-neon-mint/10"
              : "border-white/10 bg-white/5 hover:bg-white/10"
          }`}
        >
          <input
            type="radio"
            name="vis"
            checked={isPublic}
            onChange={() => setIsPublic(true)}
            className="mt-0.5 accent-neon-mint"
          />
          <div>
            <div className="font-medium text-white">🌍 Public</div>
            <p className="mt-0.5 text-white/55">
              Anyone on Karochat can listen in Infotainment.
            </p>
          </div>
        </label>
        <label
          className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-xs transition ${
            !isPublic
              ? "border-neon-mint/60 bg-neon-mint/10"
              : "border-white/10 bg-white/5 hover:bg-white/10"
          }`}
        >
          <input
            type="radio"
            name="vis"
            checked={!isPublic}
            onChange={() => setIsPublic(false)}
            className="mt-0.5 accent-neon-mint"
          />
          <div>
            <div className="font-medium text-white">🔒 Private</div>
            <p className="mt-0.5 text-white/55">Only you can listen.</p>
          </div>
        </label>
      </fieldset>

      {uploading && progress > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-neon-mint transition-[width]"
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
        {uploading ? "Uploading…" : "Upload track"}
      </Button>
    </div>
  );
}
