"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime,video/x-m4v";

type Kind = "text" | "image" | "video";
type Audience = "public" | "friends" | "close_friends";

const AUDIENCES: { key: Audience; label: string; emoji: string; hint: string }[] = [
  { key: "public", label: "Everyone", emoji: "🌐", hint: "Anyone on Karochat can see this." },
  { key: "friends", label: "Friends", emoji: "👥", hint: "Only your accepted friends." },
  { key: "close_friends", label: "Close Friends", emoji: "💚", hint: "Only people on your Close Friends list." }
];

// Grab the first visible frame of a video as a JPEG poster — used both as the
// story thumbnail and as the surface we run the CSAM scan over (we must scan
// every uploaded video per the platform's safety rules).
function capturePoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;
    const cleanup = () => URL.revokeObjectURL(url);
    const fail = () => {
      cleanup();
      resolve(null);
    };
    video.onloadeddata = () => {
      // Seek slightly in so we don't grab a black leading frame.
      try {
        video.currentTime = Math.min(0.2, (video.duration || 1) / 2);
      } catch {
        fail();
      }
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 720;
        canvas.height = video.videoHeight || 1280;
        const ctx = canvas.getContext("2d");
        if (!ctx) return fail();
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (b) => {
            cleanup();
            resolve(b);
          },
          "image/jpeg",
          0.82
        );
      } catch {
        fail();
      }
    };
    video.onerror = fail;
  });
}

export function StoryUpload({ currentUserId }: { currentUserId: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>("text");
  const [audience, setAudience] = useState<Audience>("public");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resetFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_IMAGE_BYTES) {
      setError("Image is over 8 MB.");
      e.target.value = "";
      return;
    }
    resetFile();
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setKind("image");
  }

  function onPickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_VIDEO_BYTES) {
      setError("Video is over 50 MB — trim it and try again.");
      e.target.value = "";
      return;
    }
    resetFile();
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setKind("video");
  }

  // Upload a blob to a bucket and return its public URL.
  async function uploadTo(bucket: string, path: string, blob: Blob, contentType: string) {
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { contentType, upsert: false });
    if (upErr) throw upErr;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  // Run an already-uploaded image through the CSAM scanner. Throws if blocked.
  async function scanOrThrow(publicUrl: string, bucket: string, path: string) {
    const resp = await fetch("/api/scan/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicUrl, bucket, path })
    });
    const data = await resp.json().catch(() => ({}));
    if (data?.blocked) throw new Error("Media flagged by our scanner — not uploaded.");
  }

  async function submit() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (kind === "text") {
        const text = body.trim();
        if (!text) throw new Error("Type something first.");
        if (text.length > 280) throw new Error("Keep it under 280 characters.");
        const { error: insErr } = await supabase.from("stories").insert({
          author_id: currentUserId,
          kind: "text",
          body: text,
          audience_kind: audience
        });
        if (insErr) throw insErr;
      } else if (kind === "image") {
        if (!file) throw new Error("Pick an image first.");
        const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${currentUserId}/story-${crypto.randomUUID()}.${ext}`;
        setStatus("Uploading…");
        const publicUrl = await uploadTo("chat-images", path, file, file.type);
        setStatus("Scanning…");
        await scanOrThrow(publicUrl, "chat-images", path);
        const { error: insErr } = await supabase.from("stories").insert({
          author_id: currentUserId,
          kind: "image",
          image_url: publicUrl,
          body: body.trim() || null,
          audience_kind: audience
        });
        if (insErr) throw insErr;
      } else {
        if (!file) throw new Error("Pick a video first.");
        // Poster frame first — we scan it, and a missing poster means we
        // couldn't read the video, so we refuse rather than ship unscanned.
        setStatus("Reading video…");
        const poster = await capturePoster(file);
        if (!poster) throw new Error("Couldn't read that video — try a different file.");
        const stem = `${currentUserId}/story-${crypto.randomUUID()}`;
        setStatus("Scanning…");
        const posterPath = `${stem}.jpg`;
        const posterUrl = await uploadTo("chat-images", posterPath, poster, "image/jpeg");
        await scanOrThrow(posterUrl, "chat-images", posterPath);
        setStatus("Uploading video…");
        const ext = (file.name.split(".").pop() ?? "mp4").toLowerCase();
        const videoPath = `${stem}.${ext}`;
        const videoUrl = await uploadTo("videos", videoPath, file, file.type);
        const { error: insErr } = await supabase.from("stories").insert({
          author_id: currentUserId,
          kind: "video",
          media_url: videoUrl,
          poster_url: posterUrl,
          body: body.trim() || null,
          audience_kind: audience
        });
        if (insErr) throw insErr;
      }
      router.push("/rooms");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not post.");
      setBusy(false);
      setStatus(null);
    }
  }

  const activeAudience = AUDIENCES.find((a) => a.key === audience)!;

  return (
    <div className="space-y-4">
      {/* Kind picker */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => {
            setKind("text");
            resetFile();
          }}
          className={`rounded-xl border px-3 py-2 text-sm transition ${
            kind === "text"
              ? "border-neon-blue/60 bg-neon-blue/10"
              : "border-white/10 bg-white/5 hover:bg-white/10"
          }`}
        >
          📝 Text
        </button>
        <button
          type="button"
          onClick={() => imageRef.current?.click()}
          className={`rounded-xl border px-3 py-2 text-sm transition ${
            kind === "image"
              ? "border-neon-blue/60 bg-neon-blue/10"
              : "border-white/10 bg-white/5 hover:bg-white/10"
          }`}
        >
          🖼️ Image
        </button>
        <button
          type="button"
          onClick={() => videoRef.current?.click()}
          className={`rounded-xl border px-3 py-2 text-sm transition ${
            kind === "video"
              ? "border-neon-blue/60 bg-neon-blue/10"
              : "border-white/10 bg-white/5 hover:bg-white/10"
          }`}
        >
          🎬 Video
        </button>
      </div>
      <input ref={imageRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={onPickImage} />
      <input ref={videoRef} type="file" accept={VIDEO_ACCEPT} className="hidden" onChange={onPickVideo} />

      {/* Media preview */}
      {kind === "image" && previewUrl && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="story preview" className="mx-auto max-h-[50vh] w-auto rounded-lg" />
        </div>
      )}
      {kind === "video" && previewUrl && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-2">
          <video src={previewUrl} controls playsInline className="mx-auto max-h-[50vh] w-auto rounded-lg" />
        </div>
      )}

      {/* Caption / text body */}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={280}
        rows={3}
        placeholder={kind === "text" ? "What's the moment? (≤ 280 chars)" : "Caption (optional)"}
        className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/60"
      />

      {/* Audience picker */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-white/60">Who can see this?</span>
          <Link href="/close-friends" className="text-[11px] text-neon-mint hover:underline">
            Edit close friends →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {AUDIENCES.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setAudience(a.key)}
              className={`rounded-xl border px-2 py-2 text-xs transition ${
                audience === a.key
                  ? "border-neon-mint/60 bg-neon-mint/10 text-white"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              <span aria-hidden className="mr-1">{a.emoji}</span>
              {a.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-white/40">{activeAudience.hint}</p>
      </div>

      {error && (
        <p className="rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{error}</p>
      )}

      <Button onClick={() => void submit()} disabled={busy} className="w-full">
        {busy ? status ?? "Posting…" : "Post (auto-expires in 24h)"}
      </Button>
    </div>
  );
}
