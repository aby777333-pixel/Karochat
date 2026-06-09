"use client";

import { useEffect, useRef, useState } from "react";

/**
 * VideoRecorder — record a short video clip in the chat composer.
 *
 * Uses MediaRecorder + getUserMedia (camera + mic). Captures up to 60 s, shows
 * a live preview while recording and a playback preview after. From the preview
 * the user can:
 *   • Post it straight into the chat, or
 *   • Post it to Shorts (choosing Public or Private).
 *
 * Mirrors VoiceRecorder's lifecycle so it's familiar + safe (always cleans up
 * the camera stream, never throws).
 */
const MAX_MS = 60_000;

type Status = "idle" | "permission" | "recording" | "preview" | "error";

export function VideoRecorder({
  onPostToChat,
  onPostToShort,
  onPostToBoth,
  onClose,
  busy = false
}: {
  onPostToChat: (blob: Blob, durationMs: number) => void;
  onPostToShort: (blob: Blob, isPublic: boolean) => void;
  onPostToBoth: (blob: Blob, durationMs: number, isPublic: boolean) => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [shortPublic, setShortPublic] = useState(true);
  const [posted, setPosted] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startRef = useRef(0);
  const blobRef = useRef<Blob | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);

  function cleanupStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    return () => {
      cleanupStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick the elapsed counter while recording; auto-stop at the cap.
  useEffect(() => {
    if (status !== "recording") return;
    const id = setInterval(() => {
      const t = Date.now() - startRef.current;
      setElapsedMs(t);
      if (t >= MAX_MS) stopRecording();
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function startRecording() {
    setError(null);
    setStatus("permission");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser can't access the camera.");
      }
      // Prefer the front camera, but fall back to ANY camera if a phone
      // rejects the facingMode constraint — so the camera reliably opens.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: true
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
      }
      streamRef.current = stream;
      // Show the live camera feed (must be set before we leave this tick).
      setStatus("recording");
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        liveVideoRef.current.play().catch(() => {});
      }
      const mime =
        MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ? "video/webm;codecs=vp8,opus"
        : MediaRecorder.isTypeSupported("video/webm") ? "video/webm"
        : MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4"
        : "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mr.mimeType || "video/webm"
        });
        chunksRef.current = [];
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setStatus("preview");
        cleanupStream();
      };
      mr.start();
      recorderRef.current = mr;
      startRef.current = Date.now();
      setElapsedMs(0);
      setStatus("recording");
    } catch (e: any) {
      cleanupStream();
      setError(e?.message ?? "camera/microphone unavailable");
      setStatus("error");
    }
  }

  function stopRecording() {
    const mr = recorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    recorderRef.current = null;
  }

  function discard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    setElapsedMs(0);
    setStatus("idle");
  }

  function postChat() {
    if (!blobRef.current || posted || busy) return;
    setPosted(true);
    onPostToChat(blobRef.current, elapsedMs);
  }

  function postShort() {
    if (!blobRef.current || posted || busy) return;
    setPosted(true);
    onPostToShort(blobRef.current, shortPublic);
  }

  function postBoth() {
    if (!blobRef.current || posted || busy) return;
    setPosted(true);
    onPostToBoth(blobRef.current, elapsedMs, shortPublic);
  }

  return (
    <div
      role="dialog"
      aria-label="Video recorder"
      className="absolute bottom-12 left-0 z-[60] w-[300px] rounded-xl border border-white/10 bg-ink-800/95 p-3 shadow-xl backdrop-blur"
    >
      <div className="flex items-center justify-between pb-1.5">
        <p className="text-[10px] uppercase tracking-widest text-neon-blue">
          🎥 Video clip
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close video recorder"
          className="rounded-md border border-white/10 bg-white/5 px-1.5 text-[10px] text-white/60 hover:bg-white/10"
        >
          ✕
        </button>
      </div>

      {error && (
        <p className="rounded-md border border-neon-red/40 bg-neon-red/10 px-2 py-1 text-[11px] text-neon-red">
          {error}
        </p>
      )}

      {status === "idle" && (
        <button
          type="button"
          onClick={() => void startRecording()}
          className="block w-full rounded-lg border border-neon-blue/50 bg-neon-blue/15 px-3 py-2 text-sm font-medium text-neon-blue hover:bg-neon-blue/25"
        >
          📹 Tap to record
        </button>
      )}

      {status === "permission" && (
        <p className="text-[11px] text-white/55">Waiting for camera permission…</p>
      )}

      {/* Live preview is always mounted while recording so the ref is set. */}
      <div className={status === "recording" ? "block" : "hidden"}>
        <video
          ref={liveVideoRef}
          autoPlay
          muted
          playsInline
          className="mb-2 max-h-[40vh] w-full rounded-lg bg-black"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={stopRecording}
            className="grid h-9 w-9 place-items-center rounded-full bg-neon-red text-white animate-pulseDot"
            aria-label="Stop recording"
            title="Stop"
          >
            ■
          </button>
          <p className="font-mono text-sm tabular-nums text-white">
            {(elapsedMs / 1000).toFixed(1)}s
          </p>
          <p className="ml-auto text-[10px] text-white/40">max 60s</p>
        </div>
      </div>

      {status === "preview" && previewUrl && (
        <>
          <video
            controls
            playsInline
            src={previewUrl}
            className="mb-1 max-h-[40vh] w-full rounded-lg bg-black"
            aria-label="Recorded video preview"
          />
          <p className="mb-2 text-[10px] text-white/50">
            {(elapsedMs / 1000).toFixed(1)}s
          </p>

          <button
            type="button"
            onClick={discard}
            disabled={busy || posted}
            className="mb-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50"
          >
            ↺ Re-record
          </button>

          <button
            type="button"
            onClick={postChat}
            disabled={busy || posted}
            className="mb-2 w-full rounded-lg bg-neon-blue px-3 py-2 text-xs font-semibold text-ink-900 hover:bg-neon-blue/90 disabled:opacity-50"
          >
            {busy || posted ? "Posting…" : "💬 Post to chat"}
          </button>

          <div className="rounded-lg border border-white/10 bg-black/30 p-2">
            <p className="mb-1.5 text-[10px] uppercase tracking-widest text-white/40">
              Or post to Shorts
            </p>
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setShortPublic(true)}
                aria-pressed={shortPublic}
                className={
                  "rounded-md border px-2 py-1 text-[11px] transition " +
                  (shortPublic
                    ? "border-neon-blue/60 bg-neon-blue/15 text-neon-blue"
                    : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10")
                }
              >
                🌍 Public
              </button>
              <button
                type="button"
                onClick={() => setShortPublic(false)}
                aria-pressed={!shortPublic}
                className={
                  "rounded-md border px-2 py-1 text-[11px] transition " +
                  (!shortPublic
                    ? "border-neon-blue/60 bg-neon-blue/15 text-neon-blue"
                    : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10")
                }
              >
                🔒 Private
              </button>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={postShort}
                disabled={busy || posted}
                className="w-full rounded-lg bg-neon-purple px-3 py-2 text-xs font-semibold text-white hover:bg-neon-purple/90 disabled:opacity-50"
              >
                {busy || posted ? "Posting…" : "🎬 Post to Shorts"}
              </button>
              <button
                type="button"
                onClick={postBoth}
                disabled={busy || posted}
                className="w-full rounded-lg bg-gradient-to-r from-neon-blue to-neon-purple px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy || posted ? "Posting…" : "💬🎬 Post to both"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
