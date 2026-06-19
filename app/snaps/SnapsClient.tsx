"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

export type InboxSnap = {
  snap_id: string;
  sender_id: string;
  sender_username: string | null;
  sender_display_name: string | null;
  sender_avatar_url: string | null;
  media_kind: "photo" | "video";
  has_caption: boolean;
  created_at: string;
  viewed_at: string | null;
};

export type SentSnap = {
  snap_id: string;
  recipient_id: string;
  recipient_username: string | null;
  recipient_display_name: string | null;
  recipient_avatar_url: string | null;
  media_kind: "photo" | "video";
  created_at: string;
  viewed_at: string | null;
  replayed_at: string | null;
  screenshotted_at: string | null;
  expires_at: string;
};

export type SnapFriend = {
  friend_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_close: boolean;
};

type ViewPayload = {
  media_url: string;
  media_kind: "photo" | "video";
  caption: string | null;
  duration_ms: number;
  was_replay: boolean;
};

function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Avatar({ url, name, size = 9 }: { url: string | null; name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-white/10"
      style={{ height: `${size * 4}px`, width: `${size * 4}px` }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs">{name.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
}

export function SnapsClient({
  currentUserId,
  initialInbox,
  initialSent,
  friends
}: {
  currentUserId: string;
  initialInbox: InboxSnap[];
  initialSent: SentSnap[];
  friends: SnapFriend[];
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [inbox, setInbox] = useState<InboxSnap[]>(initialInbox);
  const [sent] = useState<SentSnap[]>(initialSent);
  const [composing, setComposing] = useState(false);
  const [viewing, setViewing] = useState<InboxSnap | null>(null);

  // Realtime: new snaps land in the inbox without a reload.
  useEffect(() => {
    const ch = supabase
      .channel("snaps-inbox")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "snaps",
          filter: `recipient_profile_id=eq.${currentUserId}`
        },
        () => router.refresh()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase, currentUserId, router]);

  const unopened = inbox.filter((s) => !s.viewed_at).length;

  // After a snap is viewed: first view → mark opened (replay available);
  // replay → drop it from the inbox entirely.
  const onViewed = useCallback((snapId: string, wasReplay: boolean) => {
    setInbox((prev) =>
      wasReplay
        ? prev.filter((s) => s.snap_id !== snapId)
        : prev.map((s) =>
            s.snap_id === snapId ? { ...s, viewed_at: new Date().toISOString() } : s
          )
    );
  }, []);

  const onConsumed = useCallback((snapId: string) => {
    setInbox((prev) => prev.filter((s) => s.snap_id !== snapId));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 rounded-xl border border-white/10 bg-white/5 p-1 text-sm">
          <button
            onClick={() => setTab("inbox")}
            className={`flex-1 rounded-lg px-3 py-1.5 transition ${
              tab === "inbox" ? "bg-neon-blue/15 text-white" : "text-white/60 hover:text-white"
            }`}
          >
            Inbox{unopened > 0 ? ` (${unopened})` : ""}
          </button>
          <button
            onClick={() => setTab("sent")}
            className={`flex-1 rounded-lg px-3 py-1.5 transition ${
              tab === "sent" ? "bg-neon-blue/15 text-white" : "text-white/60 hover:text-white"
            }`}
          >
            Sent
          </button>
        </div>
        <Button onClick={() => setComposing(true)} className="shrink-0 px-3 py-2 text-sm">
          ＋ Snap
        </Button>
      </div>

      {tab === "inbox" ? (
        inbox.length === 0 ? (
          <Empty text="No snaps right now. When a friend sends one, it lands here." />
        ) : (
          <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
            {inbox.map((s) => {
              const name = s.sender_display_name ?? s.sender_username ?? "anon";
              const opened = !!s.viewed_at;
              return (
                <li key={s.snap_id}>
                  <button
                    onClick={() => setViewing(s)}
                    className="flex w-full items-center gap-3 bg-white/[0.02] px-3 py-3 text-left hover:bg-white/[0.05]"
                  >
                    <Avatar url={s.sender_avatar_url} name={name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">{name}</p>
                      <p className="text-[11px] text-white/45">
                        {opened ? "Opened · tap to replay once" : "New snap · tap to open"} ·{" "}
                        {ago(s.created_at)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-lg ${opened ? "opacity-40" : "text-neon-mint"}`}
                      aria-hidden
                    >
                      {s.media_kind === "video" ? "🎬" : "📸"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : sent.length === 0 ? (
        <Empty text="You haven't sent any snaps yet." />
      ) : (
        <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
          {sent.map((s) => {
            const name = s.recipient_display_name ?? s.recipient_username ?? "anon";
            const status = s.screenshotted_at
              ? "📸 Screenshotted"
              : s.replayed_at
                ? "Replayed"
                : s.viewed_at
                  ? "Opened"
                  : new Date(s.expires_at).getTime() < Date.now()
                    ? "Expired unopened"
                    : "Delivered";
            const statusColor = s.screenshotted_at
              ? "text-neon-red"
              : s.viewed_at
                ? "text-neon-mint"
                : "text-white/45";
            return (
              <li key={s.snap_id} className="flex items-center gap-3 bg-white/[0.02] px-3 py-3">
                <Avatar url={s.recipient_avatar_url} name={name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{name}</p>
                  <p className={`text-[11px] ${statusColor}`}>
                    {status} · {ago(s.created_at)}
                  </p>
                </div>
                <span className="shrink-0 text-sm opacity-50" aria-hidden>
                  {s.media_kind === "video" ? "🎬" : "📸"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {composing && (
        <SendSnap
          friends={friends}
          currentUserId={currentUserId}
          onClose={() => setComposing(false)}
          onSent={() => {
            setComposing(false);
            router.refresh();
          }}
        />
      )}

      {viewing && (
        <SnapViewer
          snap={viewing}
          onViewed={onViewed}
          onConsumed={onConsumed}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-8 text-center text-sm text-white/50">
      {text}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Send flow
// ---------------------------------------------------------------------------
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const PHOTO_TIMERS = [3, 5, 10] as const;

function capturePoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;
    const done = (b: Blob | null) => {
      URL.revokeObjectURL(url);
      resolve(b);
    };
    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(0.2, (video.duration || 1) / 2);
      } catch {
        done(null);
      }
    };
    video.onseeked = () => {
      try {
        const c = document.createElement("canvas");
        c.width = video.videoWidth || 720;
        c.height = video.videoHeight || 1280;
        const ctx = c.getContext("2d");
        if (!ctx) return done(null);
        ctx.drawImage(video, 0, 0, c.width, c.height);
        c.toBlob((b) => done(b), "image/jpeg", 0.82);
      } catch {
        done(null);
      }
    };
    video.onerror = () => done(null);
  });
}

function SendSnap({
  friends,
  currentUserId,
  onClose,
  onSent
}: {
  friends: SnapFriend[];
  currentUserId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [recipient, setRecipient] = useState<SnapFriend | null>(null);
  const [q, setQ] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [mediaKind, setMediaKind] = useState<"photo" | "video">("photo");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [seconds, setSeconds] = useState<number>(5);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return friends;
    return friends.filter((f) =>
      `${f.display_name ?? ""} ${f.username ?? ""}`.toLowerCase().includes(n)
    );
  }, [friends, q]);

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_IMAGE_BYTES) return setError("Image is over 8 MB.");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setMediaKind("photo");
    setPreviewUrl(URL.createObjectURL(f));
  }
  function pickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_VIDEO_BYTES) return setError("Video is over 50 MB.");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setMediaKind("video");
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function scanOrThrow(publicUrl: string, bucket: string, path: string) {
    const resp = await fetch("/api/scan/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicUrl, bucket, path })
    });
    const data = await resp.json().catch(() => ({}));
    if (data?.blocked) throw new Error("Media flagged by our scanner — not sent.");
  }

  async function send() {
    if (busy) return;
    if (!recipient) return setError("Pick a friend first.");
    if (!file) return setError("Add a photo or video.");
    setBusy(true);
    setError(null);
    try {
      const stem = `${currentUserId}/snap-${crypto.randomUUID()}`;
      let mediaUrl: string;
      if (mediaKind === "photo") {
        setStatus("Uploading…");
        const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${stem}.${ext}`;
        const up = await supabase.storage
          .from("chat-images")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) throw up.error;
        mediaUrl = supabase.storage.from("chat-images").getPublicUrl(path).data.publicUrl;
        setStatus("Scanning…");
        await scanOrThrow(mediaUrl, "chat-images", path);
      } else {
        setStatus("Reading video…");
        const poster = await capturePoster(file);
        if (!poster) throw new Error("Couldn't read that video.");
        const posterPath = `${stem}.jpg`;
        const posterUrl = (
          await supabase.storage
            .from("chat-images")
            .upload(posterPath, poster, { contentType: "image/jpeg", upsert: false })
        ).error
          ? (() => {
              throw new Error("Upload failed.");
            })()
          : supabase.storage.from("chat-images").getPublicUrl(posterPath).data.publicUrl;
        setStatus("Scanning…");
        await scanOrThrow(posterUrl, "chat-images", posterPath);
        setStatus("Uploading video…");
        const ext = (file.name.split(".").pop() ?? "mp4").toLowerCase();
        const path = `${stem}.${ext}`;
        const up = await supabase.storage
          .from("videos")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) throw up.error;
        mediaUrl = supabase.storage.from("videos").getPublicUrl(path).data.publicUrl;
      }

      setStatus("Sending…");
      const { error: rpcErr } = await supabase.rpc("send_snap", {
        p_recipient: recipient.friend_id,
        p_media_url: mediaUrl,
        p_media_kind: mediaKind,
        p_caption: caption.trim() || null,
        p_duration_ms: mediaKind === "photo" ? seconds * 1000 : 30000
      });
      if (rpcErr) throw rpcErr;
      onSent();
    } catch (e: any) {
      setError(e?.message ?? "Could not send.");
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-3 backdrop-blur sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-ink-800 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Send a snap</h2>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-white/60 hover:bg-white/10 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Recipient */}
        {recipient ? (
          <div className="flex items-center gap-3 rounded-xl border border-neon-mint/30 bg-neon-mint/5 px-3 py-2">
            <Avatar
              url={recipient.avatar_url}
              name={recipient.display_name ?? recipient.username ?? "anon"}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-white">
                {recipient.display_name ?? recipient.username}
              </p>
              <p className="text-[11px] text-white/45">@{recipient.username}</p>
            </div>
            <button
              onClick={() => setRecipient(null)}
              className="text-xs text-white/50 hover:text-white"
            >
              Change
            </button>
          </div>
        ) : friends.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center text-xs text-white/50">
            Add friends first — snaps only go to friends.
          </p>
        ) : (
          <div className="space-y-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="To which friend?"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-mint/60"
            />
            <ul className="max-h-40 divide-y divide-white/5 overflow-y-auto rounded-xl border border-white/10">
              {filtered.map((f) => {
                const name = f.display_name ?? f.username ?? "anon";
                return (
                  <li key={f.friend_id}>
                    <button
                      onClick={() => setRecipient(f)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5"
                    >
                      <Avatar url={f.avatar_url} name={name} size={8} />
                      <span className="min-w-0 flex-1 truncate text-sm text-white">{name}</span>
                      {f.is_close && <span className="text-xs">💚</span>}
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="px-3 py-4 text-center text-xs text-white/40">No matches.</li>
              )}
            </ul>
          </div>
        )}

        {/* Media */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => imageRef.current?.click()}
            className={`rounded-xl border px-3 py-2 text-sm transition ${
              file && mediaKind === "photo"
                ? "border-neon-blue/60 bg-neon-blue/10"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            📸 Photo
          </button>
          <button
            onClick={() => videoRef.current?.click()}
            className={`rounded-xl border px-3 py-2 text-sm transition ${
              file && mediaKind === "video"
                ? "border-neon-blue/60 bg-neon-blue/10"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            🎬 Video
          </button>
        </div>
        <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
        <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={pickVideo} />

        {previewUrl && (
          <div className="rounded-xl border border-white/10 bg-black/30 p-2">
            {mediaKind === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className="mx-auto max-h-[36vh] w-auto rounded-lg" />
            ) : (
              <video src={previewUrl} controls playsInline className="mx-auto max-h-[36vh] w-auto rounded-lg" />
            )}
          </div>
        )}

        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={200}
          placeholder="Add a caption (optional)"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/60"
        />

        {mediaKind === "photo" && (
          <div className="flex items-center gap-2 text-xs text-white/55">
            <span>Show for</span>
            {PHOTO_TIMERS.map((t) => (
              <button
                key={t}
                onClick={() => setSeconds(t)}
                className={`rounded-lg border px-2.5 py-1 transition ${
                  seconds === t
                    ? "border-neon-blue/60 bg-neon-blue/10 text-white"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                {t}s
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{error}</p>
        )}

        <Button onClick={() => void send()} disabled={busy} className="w-full">
          {busy ? status ?? "Sending…" : "Send snap"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View-once viewer
// ---------------------------------------------------------------------------
function SnapViewer({
  snap,
  onViewed,
  onConsumed,
  onClose
}: {
  snap: InboxSnap;
  onViewed: (snapId: string, wasReplay: boolean) => void;
  onConsumed: (snapId: string) => void;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [payload, setPayload] = useState<ViewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [shotNoted, setShotNoted] = useState(false);
  const loadedRef = useRef(false);

  // Load (and consume one view) exactly once.
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      const { data, error: rpcErr } = await supabase.rpc("view_snap", {
        p_snap_id: snap.snap_id
      });
      if (rpcErr) {
        setError(rpcErr.message);
        onConsumed(snap.snap_id);
        return;
      }
      const row = (Array.isArray(data) ? data[0] : data) as ViewPayload | undefined;
      if (!row) {
        setError("This snap is no longer available.");
        onConsumed(snap.snap_id);
        return;
      }
      setPayload(row);
      onViewed(snap.snap_id, row.was_replay);
    })();
  }, [supabase, snap.snap_id, onViewed, onConsumed]);

  // Best-effort screenshot detection → tell the sender. (Web can't reliably
  // catch every screenshot; we flag PrintScreen and the page being hidden.)
  useEffect(() => {
    if (!payload) return;
    function flag() {
      if (shotNoted) return;
      setShotNoted(true);
      void supabase.rpc("mark_snap_screenshotted", { p_snap_id: snap.snap_id });
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "PrintScreen" || (e.metaKey && e.shiftKey)) flag();
    }
    function onVis() {
      if (document.visibilityState === "hidden") flag();
    }
    window.addEventListener("keyup", onKey);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keyup", onKey);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [payload, supabase, snap.snap_id, shotNoted]);

  // Photo countdown → auto-close.
  useEffect(() => {
    if (!payload || payload.media_kind !== "photo") return;
    const dur = payload.duration_ms || 5000;
    const start = Date.now();
    const t = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / dur);
      setProgress(p);
      if (p >= 1) {
        clearInterval(t);
        onClose();
      }
    }, 50);
    return () => clearInterval(t);
  }, [payload, onClose]);

  // Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black p-3"
      onClick={onClose}
    >
      <div className="relative flex h-full w-full max-w-md flex-col gap-2 py-2" onClick={(e) => e.stopPropagation()}>
        {payload?.media_kind === "photo" && (
          <span className="h-0.5 overflow-hidden rounded-full bg-white/20">
            <span className="block h-full bg-white" style={{ width: `${progress * 100}%` }} />
          </span>
        )}

        <div className="flex items-center justify-between px-1 text-xs text-white/70">
          <span className="truncate">
            {snap.sender_display_name ?? snap.sender_username ?? "Someone"}
            {payload?.was_replay && <span className="ml-1.5 text-white/40">· replay</span>}
          </span>
          <button
            onClick={onClose}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-ink-800">
          {error ? (
            <div className="grid h-full place-items-center px-6 text-center text-sm text-white/60">
              {error}
            </div>
          ) : !payload ? (
            <div className="grid h-full place-items-center text-sm text-white/40">Opening…</div>
          ) : payload.media_kind === "video" ? (
            <video
              src={payload.media_url}
              autoPlay
              playsInline
              onEnded={onClose}
              className="h-full w-full bg-black object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={payload.media_url} alt="" className="h-full w-full bg-black object-contain" />
          )}

          {payload?.caption && (
            <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-center text-sm text-white">
              {payload.caption}
            </p>
          )}
        </div>

        {shotNoted && (
          <p className="text-center text-[11px] text-neon-red/80">
            Screenshot detected — the sender was notified.
          </p>
        )}
      </div>
    </div>
  );
}
