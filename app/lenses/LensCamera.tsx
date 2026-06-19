"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

type Overlay = { emoji: string; anchor: "eyes" | "each_eye" | "crown" | "nose" | "fullface"; scale?: number };
type LensSpec = { filter?: string; overlays?: Overlay[] };

export type Lens = {
  slug: string;
  name: string;
  category: string | null;
  mediapipe_spec: LensSpec | null;
};
export type LensFriend = {
  friend_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_close: boolean;
};

const MP_VER = "0.10.18";
// MediaPipe FaceMesh landmark indices we anchor to.
const IDX = {
  leftEyeOuter: 33,
  leftEyeInner: 133,
  rightEyeInner: 362,
  rightEyeOuter: 263,
  noseTip: 1,
  foreheadTop: 10,
  chin: 152,
  cheekL: 234,
  cheekR: 454
};

type Pt = { x: number; y: number };

export function LensCamera({
  currentUserId,
  lenses,
  friends
}: {
  currentUserId: string;
  lenses: Lens[];
  friends: LensFriend[];
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lensRef = useRef<Lens | null>(null);

  const [status, setStatus] = useState<"starting" | "live" | "error">("starting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeSlug, setActiveSlug] = useState<string>("none");
  const [faceReady, setFaceReady] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null); // object URL
  const capturedBlobRef = useRef<Blob | null>(null);

  const activeLens = useMemo(
    () => (activeSlug === "none" ? null : lenses.find((l) => l.slug === activeSlug) ?? null),
    [activeSlug, lenses]
  );
  useEffect(() => {
    lensRef.current = activeLens;
  }, [activeLens]);

  // ---- Camera + MediaPipe setup ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play().catch(() => {});
        setStatus("live");

        // Face tracking is a best-effort enhancement — colour filters still
        // work if MediaPipe (or its CDN) is unavailable.
        try {
          const vision: any = await import(
            /* webpackIgnore: true */
            `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}/vision_bundle.mjs`
          );
          const fileset = await vision.FilesetResolver.forVisionTasks(
            `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}/wasm`
          );
          const lm = await vision.FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
            },
            runningMode: "VIDEO",
            numFaces: 1
          });
          if (!cancelled) landmarkerRef.current = lm;
        } catch {
          // overlays disabled; filters still apply
        }

        loop();
      } catch (e: any) {
        setStatus("error");
        setErrorMsg(
          e?.name === "NotAllowedError"
            ? "Camera permission denied — allow it to use lenses."
            : "Couldn't start the camera."
        );
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        landmarkerRef.current?.close?.();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Render loop ----
  const loop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    const w = video.videoWidth || 720;
    const h = video.videoHeight || 1280;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const lens = lensRef.current;
    const spec = lens?.mediapipe_spec ?? null;

    // Mirror everything (selfie). Landmark coords drawn under the same flip
    // stay aligned with the flipped video.
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.filter = spec?.filter || "none";
    ctx.drawImage(video, 0, 0, w, h);
    ctx.filter = "none";

    let lm: any = null;
    if (landmarkerRef.current && spec?.overlays?.length) {
      try {
        const res = landmarkerRef.current.detectForVideo(video, performance.now());
        lm = res?.faceLandmarks?.[0] ?? null;
      } catch {
        lm = null;
      }
    }
    if (lm) {
      if (!faceReady) setFaceReady(true);
      const P = (i: number): Pt => ({ x: lm[i].x * w, y: lm[i].y * h });
      drawOverlays(ctx, spec!.overlays!, P, w);
    }
    ctx.restore();

    rafRef.current = requestAnimationFrame(loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceReady]);

  function drawOverlays(
    ctx: CanvasRenderingContext2D,
    overlays: Overlay[],
    P: (i: number) => Pt,
    w: number
  ) {
    const leftEye = mid(P(IDX.leftEyeOuter), P(IDX.leftEyeInner));
    const rightEye = mid(P(IDX.rightEyeInner), P(IDX.rightEyeOuter));
    const eyeMid = mid(leftEye, rightEye);
    const eyeAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
    const faceW = dist(P(IDX.cheekL), P(IDX.cheekR));
    const faceH = dist(P(IDX.foreheadTop), P(IDX.chin));
    const nose = P(IDX.noseTip);
    const crown = { x: P(IDX.foreheadTop).x, y: P(IDX.foreheadTop).y - faceH * 0.42 };

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (const o of overlays) {
      const s = o.scale ?? 1;
      if (o.anchor === "eyes") {
        emojiAt(ctx, o.emoji, eyeMid, faceW * 0.95 * s, eyeAngle);
      } else if (o.anchor === "each_eye") {
        emojiAt(ctx, o.emoji, leftEye, faceW * 0.32 * s, eyeAngle);
        emojiAt(ctx, o.emoji, rightEye, faceW * 0.32 * s, eyeAngle);
      } else if (o.anchor === "crown") {
        emojiAt(ctx, o.emoji, crown, faceW * 0.7 * s, eyeAngle);
      } else if (o.anchor === "nose") {
        emojiAt(ctx, o.emoji, nose, faceW * 0.3 * s, eyeAngle);
      } else if (o.anchor === "fullface") {
        emojiAt(ctx, o.emoji, { x: eyeMid.x, y: nose.y }, faceW * 1.3 * s, eyeAngle);
      }
    }
  }

  function emojiAt(ctx: CanvasRenderingContext2D, emoji: string, at: Pt, size: number, angle: number) {
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(angle);
    ctx.font = `${Math.max(12, size)}px serif`;
    ctx.fillText(emoji, 0, 0);
    ctx.restore();
  }

  // ---- Capture ----
  function capture() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        capturedBlobRef.current = blob;
        setCaptured(URL.createObjectURL(blob));
      },
      "image/jpeg",
      0.9
    );
  }
  function retake() {
    if (captured) URL.revokeObjectURL(captured);
    setCaptured(null);
    capturedBlobRef.current = null;
  }

  const cats = useMemo(() => {
    const order = ["face", "festival", "color"];
    return [...lenses].sort(
      (a, b) => order.indexOf(a.category ?? "") - order.indexOf(b.category ?? "")
    );
  }, [lenses]);

  if (status === "error") {
    return (
      <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-8 text-center text-sm text-white/55">
        {errorMsg}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-black">
        {/* Hidden source video; canvas shows the lens output */}
        <video ref={videoRef} playsInline muted className="hidden" />
        <canvas ref={canvasRef} className="h-full w-full object-cover" />
        {status === "starting" && (
          <div className="absolute inset-0 grid place-items-center text-sm text-white/50">
            Starting camera…
          </div>
        )}
        {activeLens?.mediapipe_spec?.overlays?.length && !faceReady && status === "live" && (
          <p className="absolute inset-x-0 bottom-2 text-center text-[11px] text-white/60">
            Look at the camera so we can find your face…
          </p>
        )}

        {captured && (
          <div className="absolute inset-0 bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={captured} alt="captured" className="h-full w-full object-cover" />
          </div>
        )}
      </div>

      {!captured ? (
        <>
          {/* Lens picker */}
          <div className="scroll-thin flex gap-2 overflow-x-auto pb-1">
            <LensChip
              label="None"
              emoji="🚫"
              active={activeSlug === "none"}
              onClick={() => setActiveSlug("none")}
            />
            {cats.map((l) => (
              <LensChip
                key={l.slug}
                label={l.name}
                emoji={l.mediapipe_spec?.overlays?.[0]?.emoji ?? "🎨"}
                active={activeSlug === l.slug}
                onClick={() => setActiveSlug(l.slug)}
              />
            ))}
          </div>

          <Button onClick={capture} disabled={status !== "live"} className="w-full">
            📸 Capture
          </Button>
        </>
      ) : (
        <ShareCaptured
          blobRef={capturedBlobRef}
          currentUserId={currentUserId}
          friends={friends}
          onRetake={retake}
          onDone={() => {
            retake();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function LensChip({
  label,
  emoji,
  active,
  onClick
}: {
  label: string;
  emoji: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 flex-col items-center gap-1 rounded-xl border px-3 py-2 text-[11px] transition ${
        active
          ? "border-neon-blue/60 bg-neon-blue/10 text-white"
          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
      }`}
    >
      <span className="text-lg leading-none">{emoji}</span>
      {label}
    </button>
  );
}

// ---- Share the captured photo as a Story or a Snap ----
function ShareCaptured({
  blobRef,
  currentUserId,
  friends,
  onRetake,
  onDone
}: {
  blobRef: React.MutableRefObject<Blob | null>;
  currentUserId: string;
  friends: LensFriend[];
  onRetake: () => void;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<"choose" | "story" | "snap">("choose");
  const [audience, setAudience] = useState<"public" | "friends" | "close_friends">("public");
  const [recipient, setRecipient] = useState<LensFriend | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function uploadAndScan(): Promise<string> {
    const blob = blobRef.current;
    if (!blob) throw new Error("Nothing to share.");
    const path = `${currentUserId}/lens-${crypto.randomUUID()}.jpg`;
    setStatus("Uploading…");
    const up = await supabase.storage
      .from("chat-images")
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (up.error) throw up.error;
    const url = supabase.storage.from("chat-images").getPublicUrl(path).data.publicUrl;
    setStatus("Scanning…");
    const resp = await fetch("/api/scan/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicUrl: url, bucket: "chat-images", path })
    });
    const data = await resp.json().catch(() => ({}));
    if (data?.blocked) throw new Error("Photo flagged by our scanner — not shared.");
    return url;
  }

  async function postStory() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const url = await uploadAndScan();
      setStatus("Posting…");
      const { error: insErr } = await supabase.from("stories").insert({
        author_id: currentUserId,
        kind: "image",
        image_url: url,
        body: caption.trim() || null,
        audience_kind: audience
      });
      if (insErr) throw insErr;
      onDone();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't post.");
      setBusy(false);
      setStatus(null);
    }
  }

  async function sendSnap() {
    if (busy) return;
    if (!recipient) return setError("Pick a friend.");
    setBusy(true);
    setError(null);
    try {
      const url = await uploadAndScan();
      setStatus("Sending…");
      const { error: rpcErr } = await supabase.rpc("send_snap", {
        p_recipient: recipient.friend_id,
        p_media_url: url,
        p_media_kind: "photo",
        p_caption: caption.trim() || null,
        p_duration_ms: 5000
      });
      if (rpcErr) throw rpcErr;
      onDone();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't send.");
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div className="space-y-3">
      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        maxLength={200}
        placeholder="Add a caption (optional)"
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/60"
      />

      {mode === "choose" && (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setMode("story")} className="w-full">
            🟣 To Story
          </Button>
          <Button onClick={() => setMode("snap")} className="w-full">
            📸 As Snap
          </Button>
        </div>
      )}

      {mode === "story" && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            {(["public", "friends", "close_friends"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAudience(a)}
                className={`rounded-xl border px-2 py-2 text-xs transition ${
                  audience === a
                    ? "border-neon-mint/60 bg-neon-mint/10 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {a === "public" ? "🌐 Everyone" : a === "friends" ? "👥 Friends" : "💚 Close"}
              </button>
            ))}
          </div>
          <Button onClick={() => void postStory()} disabled={busy} className="w-full">
            {busy ? status ?? "…" : "Post to Story"}
          </Button>
        </div>
      )}

      {mode === "snap" && (
        <div className="space-y-2">
          {friends.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center text-xs text-white/50">
              Add friends to send snaps.
            </p>
          ) : (
            <select
              value={recipient?.friend_id ?? ""}
              onChange={(e) =>
                setRecipient(friends.find((f) => f.friend_id === e.target.value) ?? null)
              }
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-mint/60"
            >
              <option value="">Choose a friend…</option>
              {friends.map((f) => (
                <option key={f.friend_id} value={f.friend_id}>
                  {f.display_name ?? f.username ?? "anon"}
                </option>
              ))}
            </select>
          )}
          <Button onClick={() => void sendSnap()} disabled={busy || !recipient} className="w-full">
            {busy ? status ?? "…" : "Send snap"}
          </Button>
        </div>
      )}

      {error && <p className="rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={onRetake}
          disabled={busy}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10 disabled:opacity-50"
        >
          ↺ Retake
        </button>
        {mode !== "choose" && (
          <button
            onClick={() => setMode("choose")}
            disabled={busy}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10 disabled:opacity-50"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}

// ---- geometry helpers ----
function mid(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
