"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export function StoryUpload({ currentUserId }: { currentUserId: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"text" | "image">("text");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError("Image is over 8 MB.");
      e.target.value = "";
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setKind("image");
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
        const { error: insertErr } = await supabase.from("stories").insert({
          author_id: currentUserId,
          kind: "text",
          body: text
        });
        if (insertErr) throw insertErr;
      } else {
        if (!file) throw new Error("Pick an image first.");
        const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${currentUserId}/story-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("chat-images")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("chat-images").getPublicUrl(path);
        // CSAM scan gate — applies to story uploads too.
        const scanResp = await fetch("/api/scan/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicUrl: pub.publicUrl,
            bucket: "chat-images",
            path
          })
        });
        const scanData = await scanResp.json();
        if (scanData?.blocked) {
          throw new Error("Image flagged by our scanner — not uploaded.");
        }
        const { error: insertErr } = await supabase.from("stories").insert({
          author_id: currentUserId,
          kind: "image",
          image_url: pub.publicUrl,
          body: body.trim() || null
        });
        if (insertErr) throw insertErr;
      }
      router.push("/rooms");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not post.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => {
            setKind("text");
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setFile(null);
            setPreviewUrl(null);
          }}
          className={`rounded-xl border px-3 py-2 text-sm transition ${
            kind === "text"
              ? "border-neon-blue/60 bg-neon-blue/10"
              : "border-white/10 bg-white/5 hover:bg-white/10"
          }`}
        >
          📝 Text card
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`rounded-xl border px-3 py-2 text-sm transition ${
            kind === "image"
              ? "border-neon-blue/60 bg-neon-blue/10"
              : "border-white/10 bg-white/5 hover:bg-white/10"
          }`}
        >
          🖼️ Image
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={onFile}
      />

      {kind === "image" && previewUrl && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="story preview"
            className="mx-auto max-h-[50vh] w-auto rounded-lg"
          />
        </div>
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={280}
        rows={3}
        placeholder={kind === "text" ? "What's the moment? (≤ 280 chars)" : "Caption (optional)"}
        className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/60"
      />

      {error && (
        <p className="rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{error}</p>
      )}

      <Button onClick={() => void submit()} disabled={busy} className="w-full">
        {busy ? "Posting…" : "Post (auto-expires in 24h)"}
      </Button>
    </div>
  );
}
