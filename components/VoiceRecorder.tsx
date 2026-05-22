"use client";

import { useEffect, useRef, useState } from "react";

/**
 * VoiceRecorder — Wave 18.
 *
 * Push-to-talk recorder using MediaRecorder. Captures up to 60 seconds.
 * Returns a Blob + duration when the user hits "Send".
 */
const MAX_MS = 60_000;

type Status = "idle" | "permission" | "recording" | "preview" | "error";

export function VoiceRecorder({
  onSend,
  onClose
}: {
  onSend: (blob: Blob, durationMs: number) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startRef = useRef(0);
  const blobRef = useRef<Blob | null>(null);

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

  // Tick the elapsed counter while recording.
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Prefer compact codecs when available.
      const mime =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4"
        : "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mr.mimeType || "audio/webm"
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
      setError(e?.message ?? "microphone unavailable");
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

  function send() {
    if (!blobRef.current) return;
    onSend(blobRef.current, elapsedMs);
  }

  return (
    <div
      role="dialog"
      aria-label="Voice recorder"
      className="absolute bottom-12 left-0 z-[60] w-[280px] rounded-xl border border-white/10 bg-ink-800/95 p-3 shadow-xl backdrop-blur"
    >
      <div className="flex items-center justify-between pb-1.5">
        <p className="text-[10px] uppercase tracking-widest text-neon-purple">
          🎙 Voice message
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close voice recorder"
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
          className="block w-full rounded-lg border border-neon-purple/50 bg-neon-purple/15 px-3 py-2 text-sm font-medium text-neon-purple hover:bg-neon-purple/25"
        >
          Tap to record
        </button>
      )}

      {status === "permission" && (
        <p className="text-[11px] text-white/55">Waiting for mic permission…</p>
      )}

      {status === "recording" && (
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
      )}

      {status === "preview" && previewUrl && (
        <>
          <audio
            controls
            src={previewUrl}
            className="mt-1 w-full"
            aria-label="Recorded voice preview"
          />
          <p className="mt-1 text-[10px] text-white/50">
            {(elapsedMs / 1000).toFixed(1)}s
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={discard}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
            >
              Re-record
            </button>
            <button
              type="button"
              onClick={send}
              className="flex-1 rounded-lg bg-neon-purple px-3 py-1.5 text-xs font-medium text-white hover:bg-neon-purple/90"
            >
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}
