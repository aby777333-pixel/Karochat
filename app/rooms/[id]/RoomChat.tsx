"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import dynamic from "next/dynamic";

// CallPanel is route-scoped and imports LiveKit — load it lazily so the
// room's first paint isn't blocked, and so the CallWidget (which lives in
// /components/) doesn't have to know about route-relative paths.
const CallPanel = dynamic(() => import("./CallPanel").then((m) => m.CallPanel), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">
      <p className="rounded-xl border border-white/10 bg-ink-800/95 px-4 py-3 text-sm text-white/80">
        <span className="mr-2 inline-block animate-pulseDot">●</span>
        Loading call…
      </p>
    </div>
  )
});
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";
import { PresenceDot } from "@/components/PresenceDot";
import { usePresenceHeartbeat } from "@/lib/usePresenceHeartbeat";
import { useNotifyOnNewMessage } from "@/lib/useBrowserNotifications";
import { SmartReplies } from "./SmartReplies";
import { MemberActionPopover } from "./MemberActionPopover";
import { QuoteCard } from "./QuoteCard";
import { Soundscape } from "./Soundscape";
import { ConferenceTools } from "./ConferenceTools";
import { ChatResizer, EdgeHandles } from "@/components/ChatResizer";
import { playBuzz } from "@/lib/sounds";
import { StickerPicker } from "@/components/StickerPicker";
import { LinesPicker } from "@/components/LinesPicker";
import { EmojiPicker } from "@/components/EmojiPicker";
import { GifPicker } from "@/components/GifPicker";
import { MentionMenu } from "@/components/MentionMenu";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { KaraokeStudio } from "@/components/KaraokeStudio";
import { VideoRecorder } from "@/components/VideoRecorder";
import { flagCategory, flagWarning, reportFlag, type FlagCategory } from "@/lib/flaggedTerms";
import { PinnedStrip } from "@/components/PinnedStrip";
import { MessageSearchBar } from "@/components/MessageSearchBar";
import { ForwardModal } from "@/components/ForwardModal";
import { TypingIndicator } from "@/components/TypingIndicator";
import { CallWidget } from "@/components/CallWidget";
import { ringRoom } from "@/lib/ringRoom";
import { MediaEmbed, detectMedia } from "@/components/MediaEmbed";
import { ROOM_THEMES } from "@/components/RoomThemePicker";
import { useResizableHeight } from "@/lib/useResizableHeight";
import {
  decryptFromVault,
  encryptForVault,
  getVaultKeyForPeer
} from "@/lib/vaultCrypto";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_SOURCE_BYTES = 50 * 1024 * 1024; // pre-compression cap (images get compressed)
const MAX_FILE_BYTES = 500 * 1024 * 1024; // chat-files bucket cap (raised in 0111)
// Videos at or under this play inline; larger ones send as a drive-like
// download card instead of streaming a huge clip into the chat.
const INLINE_VIDEO_MAX = 40 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const REACTION_PALETTE = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "🙌"];

// File types that gzip meaningfully (everything else is already compressed —
// jpg/png/mp4/zip/pdf/office — so we upload those as-is).
const GZIP_RE = /^(text\/|application\/(json|xml|javascript|sql|x-sh|x-yaml|rtf)|image\/svg)/;

// ---------------------------------------------------------------------------
// File-sharing helpers (Wave 22). All browser-native; degrade gracefully.
// ---------------------------------------------------------------------------
function humanSize(bytes?: number | null): string {
  if (!bytes && bytes !== 0) return "";
  const u = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

function fileGlyph(mime?: string | null, name?: string | null): string {
  const m = (mime ?? "").toLowerCase();
  const ext = (name ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (m.startsWith("video/")) return "🎬";
  if (m.startsWith("audio/")) return "🎵";
  if (m === "application/pdf" || ext === "pdf") return "📕";
  if (m.includes("zip") || ["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "🗜️";
  if (m.includes("sheet") || ["xls", "xlsx", "csv"].includes(ext)) return "📊";
  if (m.includes("word") || ["doc", "docx"].includes(ext)) return "📝";
  if (m.includes("presentation") || ["ppt", "pptx"].includes(ext)) return "📽️";
  if (m.startsWith("text/") || ["txt", "md", "json", "xml"].includes(ext)) return "📄";
  return "📎";
}

function loadImageEl(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

// Downscale + re-encode large photos to webp before upload. Returns the
// original file untouched on any failure or when it wouldn't help.
async function compressImageFile(file: File): Promise<File> {
  if (file.type === "image/gif") return file; // keep animation
  if (!/image\/(jpeg|png|webp)/.test(file.type)) return file;
  try {
    const img = await loadImageEl(file);
    const maxDim = 1600;
    const big = Math.max(img.width, img.height);
    if (big <= maxDim && file.size < 600 * 1024) return file;
    const scale = Math.min(1, maxDim / big);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/webp", 0.82)
    );
    if (!blob || blob.size >= file.size) return file;
    const base = file.name.replace(/\.\w+$/, "") || "image";
    return new File([blob], `${base}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}

async function gzipBlob(blob: Blob): Promise<Blob | null> {
  try {
    const CS = (window as any).CompressionStream;
    if (!CS) return null;
    const stream = blob.stream().pipeThrough(new CS("gzip"));
    return await new Response(stream).blob();
  } catch {
    return null;
  }
}

async function downloadMaybeCompressed(
  url: string,
  name: string,
  mime: string | null | undefined,
  compressed: boolean
) {
  try {
    const resp = await fetch(url);
    let blob: Blob;
    if (compressed && (window as any).DecompressionStream && resp.body) {
      const stream = resp.body.pipeThrough(
        new (window as any).DecompressionStream("gzip")
      );
      const buf = await new Response(stream).arrayBuffer();
      blob = new Blob([buf], { type: mime || "application/octet-stream" });
    } else {
      blob = await resp.blob();
    }
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = name || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
  } catch {
    // Fallback: just open the raw object in a new tab.
    window.open(url, "_blank", "noopener");
  }
}

function FileCard({
  message,
  mine
}: {
  message: MessageRow;
  mine: boolean;
}) {
  const name = message.file_name ?? "file";

  // Video clips recorded in the composer are carried as file messages; show
  // small ones inline with a player. Large videos fall through to the download
  // card below (a drive-like link) rather than streaming a huge file inline.
  if (message.file_mime?.startsWith("video/") && (message.file_size ?? 0) <= INLINE_VIDEO_MAX) {
    return (
      <div
        className={clsx(
          "mb-1 overflow-hidden rounded-2xl border border-white/10 bg-black",
          mine ? "rounded-br-sm" : "rounded-bl-sm"
        )}
      >
        <video
          controls
          controlsList="nodownload noplaybackrate"
          playsInline
          preload="metadata"
          src={message.file_url!}
          className="block max-h-80 w-auto max-w-[78vw] bg-black md:max-w-sm"
          aria-label="Video clip"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() =>
        void downloadMaybeCompressed(
          message.file_url!,
          name,
          message.file_mime,
          !!message.file_compressed
        )
      }
      className={clsx(
        "mb-1 flex max-w-[80vw] items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-left transition hover:bg-white/10 md:max-w-sm",
        mine ? "rounded-br-sm" : "rounded-bl-sm"
      )}
      title={`Download ${name}`}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neon-blue/15 text-xl">
        {fileGlyph(message.file_mime, name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-white">{name}</span>
        <span className="block text-[11px] text-white/50">
          {humanSize(message.file_size)}
          {message.file_compressed ? " · compressed" : ""} · tap to download
        </span>
      </span>
      <span aria-hidden className="shrink-0 text-white/50">⬇</span>
    </button>
  );
}
const EDIT_WINDOW_MS = 15 * 60 * 1000;

const INTENT_OPTIONS: { value: string; label: string; emoji: string }[] = [
  { value: "thinking",  label: "thinking out loud", emoji: "🤔" },
  { value: "work",      label: "work",              emoji: "💼" },
  { value: "care",      label: "care",              emoji: "❤️" },
  { value: "horny",     label: "horny",             emoji: "🔥" },
  { value: "urgent",    label: "urgent",            emoji: "🆘" },
  { value: "late_night",label: "late night",        emoji: "🌙" },
  { value: "decision",  label: "decision needed",   emoji: "🎯" }
];

const TRANSLATE_LANGS = [
  "English", "Hindi", "Tamil", "Telugu", "Malayalam", "Kannada",
  "Marathi", "Bengali", "Gujarati", "Punjabi", "Odia",
  "Spanish", "Portuguese", "French", "German", "Japanese", "Korean", "Mandarin", "Arabic"
];

// v7 — narrow keyword patterns that trigger the one-time soft warning popup
// from the People's Charter. Deliberately narrow: "kill all X", "bomb the
// school", explicit recruitment to known terrorist orgs, "ethnic cleansing".
// NOT vibes-based; NOT AI; NOT a content filter. Just a heads-up that says
// "you're being seen" once per session, then never again.
const FOUR_LINES_PATTERNS: RegExp[] = [
  /\b(kill|murder|behead|gas|hang)\s+(all|every|the|those)\s+\w+/i,
  /\b(bomb|blow\s*up|attack|shoot\s*up)\s+(the\s+)?(school|mosque|temple|church|synagogue|station|airport|government|parliament|capitol|embassy|hospital|mall)/i,
  /\b(join|recruit|fund|support)\s+(isis|isil|daesh|al[\s-]?qaeda|nazi|hamas|hezbollah|boko\s*haram|taliban|kkk|aryan\s*brotherhood)\b/i,
  /\b(genocide|exterminate|wipe\s+out|cleanse)\s+(the|all|every)\b/i,
  /\beth?nic\s+cleansing\b/i,
  /\bgas\s+the\s+\w+/i,
  /\bhitler\s+was\s+right\b/i
];

function matchesFourLines(text: string): boolean {
  return FOUR_LINES_PATTERNS.some((re) => re.test(text));
}

// Stable per-user hue so each speaker gets a recognisable bubble colour.
// djb2-ish hash → 0..359. Same seed = same colour everywhere.
function userHue(seed: string | null | undefined): number {
  if (!seed) return 220;
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

type PollOption = { text: string; votes: string[] };
type PollData = { question: string; options: PollOption[] };

type MessageRow = {
  id: string;
  room_id: string;
  sender_id: string;
  type: "text" | "image" | "nudge" | "system" | "poll" | "voice" | "file";
  content: string | null;
  image_url: string | null;
  audio_url?: string | null;
  duration_ms?: number | null;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_mime?: string | null;
  file_compressed?: boolean | null;
  reply_to_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  reactions: Record<string, string[]> | null;
  intent: string | null;
  regretted_at: string | null;
  poll_data: PollData | null;
  pinned_at?: string | null;
  pinned_by?: string | null;
  expires_at?: string | null;
  vanish?: boolean | null;
  mentions?: string[] | null;
  forwarded_from_id?: string | null;
  created_at: string;
  sender_username: string | null;
  sender_display_name: string | null;
  sender_is_guest?: boolean | null;
  sender_presence_state?: string | null;
};

export function RoomChat({
  roomId,
  roomName,
  roomInviteCode,
  currentUserId,
  currentUsername,
  currentDisplayName,
  currentPresence,
  currentAutoTranslate,
  isVault,
  vaultPeerId,
  parentRoomId,
  recordingStartedAt,
  isOwner,
  isDm,
  isSaved,
  roomTheme,
  initialCall,
  initialVanishMode,
  initialMessages
}: {
  roomId: string;
  roomName: string;
  roomInviteCode?: string | null;
  currentUserId: string;
  currentUsername: string;
  currentDisplayName: string;
  currentPresence: "online" | "away" | "busy" | "invisible" | "offline";
  currentAutoTranslate?: string | null;
  isVault?: boolean;
  vaultPeerId?: string | null;
  parentRoomId?: string | null;
  recordingStartedAt?: string | null;
  isOwner?: boolean;
  isDm?: boolean;
  isSaved?: boolean;
  roomTheme?: string | null;
  initialCall?: "audio" | "video" | null;
  initialVanishMode?: boolean;
  initialMessages: MessageRow[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);

  // Wave 18 / 19 — resizable chat height + width (per-user, persisted).
  const resizerKey = `karochat:resize:${currentUserId}`;
  const {
    px: chatPx,
    wPx: chatWPx,
    preset: chatPreset,
    beginDrag,
    reset: resetSize,
    compact: compactSize,
    full: fullSize
  } = useResizableHeight(resizerKey);

  // On phones, ignore the persisted desktop chat width — a width saved while
  // resizing on desktop would otherwise force the chat wider than the
  // viewport and break the mobile layout. Height stays as-is.
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const effectiveWPx = isNarrow ? null : chatWPx;

  // Wave 18 — composer extras + search + forwarding + voice + TTL.
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [forwardSource, setForwardSource] = useState<MessageRow | null>(null);
  const [widgetCallMode, setWidgetCallMode] = useState<"audio" | "video" | null>(
    initialCall ?? null
  );

  // Wave 19.14 — if the room was opened with ?call=audio|video (started
  // from a member popover elsewhere in the app), open the call panel
  // automatically and strip the query so a refresh doesn't re-trigger it.
  useEffect(() => {
    if (!initialCall) return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("call")) {
      url.searchParams.delete("call");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showLines, setShowLines] = useState(false);
  const [showKaraoke, setShowKaraoke] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [mentionState, setMentionState] = useState<{
    query: string;
    open: boolean;
  }>({ query: "", open: false });
  const [disappearTtlSec, setDisappearTtlSec] = useState<number | null>(null);
  const [ttlMenuOpen, setTtlMenuOpen] = useState(false);
  // Phase 6.4 — vanish mode (DM-only, seen-then-gone). Mutual flag persisted on
  // the room; live toggle sync rides a broadcast channel. Kept in a ref so the
  // send paths read the latest value without re-binding their callbacks.
  const [vanishMode, setVanishMode] = useState(!!initialVanishMode);
  const vanishModeRef = useRef(vanishMode);
  useEffect(() => {
    vanishModeRef.current = vanishMode;
  }, [vanishMode]);
  const [typingUsers, setTypingUsers] = useState<Map<string, { name: string; at: number }>>(
    () => new Map()
  );
  const [reads, setReads] = useState<Map<string, { message_id: string | null; at: string }>>(
    () => new Map()
  );
  const [now, setNow] = useState<number>(() => Date.now());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);

  const draftStorageKey = `karochat:draft:${currentUserId}:${roomId}`;
  const [draft, setDraft] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(draftStorageKey) ?? "";
    } catch {
      return "";
    }
  });
  const [intentChoice, setIntentChoice] = useState<string | null>(null);

  // Persist the draft so users can refresh or hop between rooms without
  // losing what they were typing. Cleared on successful send below.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (draft) window.localStorage.setItem(draftStorageKey, draft);
      else window.localStorage.removeItem(draftStorageKey);
    } catch {
      // localStorage can be disabled — ignore.
    }
  }, [draft, draftStorageKey]);
  const [intentMenuOpen, setIntentMenuOpen] = useState(false);
  const [lightsOut, setLightsOut] = useState(false);
  // Call & video tool strips (ConferenceTools + CallWidget) collapse behind
  // a toggle at the top of the window. They are hidden with CSS, NOT
  // unmounted, so captions/consent/breakout state survives collapsing.
  // Defaults: open on desktop, collapsed on phones; last choice remembered.
  const [callToolsOpen, setCallToolsOpen] = useState(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(
        `karochat:calltools:${currentUserId}`
      );
      if (saved !== null) setCallToolsOpen(saved === "1");
      else setCallToolsOpen(window.matchMedia("(min-width: 768px)").matches);
    } catch {
      // localStorage can be disabled — stay collapsed.
    }
  }, [currentUserId]);
  function toggleCallTools() {
    setCallToolsOpen((s) => {
      try {
        window.localStorage.setItem(
          `karochat:calltools:${currentUserId}`,
          s ? "0" : "1"
        );
      } catch {
        // ignore
      }
      return !s;
    });
  }
  const [fourLinesWarning, setFourLinesWarning] = useState<string | null>(null);
  const [flaggedCat, setFlaggedCat] = useState<FlagCategory | null>(null);
  const [threadParentId, setThreadParentId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<
    | { kind: "message"; id: string; preview: string }
    | { kind: "user"; id: string; preview: string }
    | null
  >(null);
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [lastIncoming, setLastIncoming] = useState<MessageRow | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileAnyInputRef = useRef<HTMLInputElement>(null);
  const dictateRef = useRef<any>(null);
  useEffect(() => {
    return () => {
      try {
        dictateRef.current?.stop?.();
      } catch {
        /* ignore */
      }
    };
  }, []);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const profileCache = useRef<Map<string, { username: string; display_name: string }>>(new Map());
  const vaultKeyRef = useRef<CryptoKey | null>(null);
  const [vaultReady, setVaultReady] = useState(false);

  // For vault rooms, derive (or fetch) the shared AES-GCM key once on mount.
  useEffect(() => {
    if (!isVault || !vaultPeerId) return;
    let cancelled = false;
    (async () => {
      try {
        const k = await getVaultKeyForPeer(supabase, vaultPeerId, currentUserId);
        if (cancelled) return;
        if (k) {
          vaultKeyRef.current = k;
          setVaultReady(true);
          // Bulk-decrypt the initial set now that we have the key.
          setMessages((prev) =>
            prev.map((m) => ({ ...m, content: m.content })) // touch — actual decrypt happens in render
          );
          // Pre-warm: decrypt all initial messages' contents in place.
          const decoded = await Promise.all(
            initialMessages.map(async (m) => {
              if (!m.content) return m;
              try {
                return { ...m, content: await decryptFromVault(m.content, k) };
              } catch {
                return m;
              }
            })
          );
          if (!cancelled) setMessages(decoded);
        }
      } catch (e) {
        console.warn("[vault] key derivation failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isVault, vaultPeerId, currentUserId, supabase, initialMessages]);

  usePresenceHeartbeat(supabase, currentPresence);
  useNotifyOnNewMessage(lastIncoming, { roomName, roomId, currentUserId });

  useEffect(() => {
    for (const m of initialMessages) {
      if (m.sender_username) {
        profileCache.current.set(m.sender_id, {
          username: m.sender_username,
          display_name: m.sender_display_name ?? m.sender_username
        });
      }
    }
    profileCache.current.set(currentUserId, {
      username: currentUsername,
      display_name: currentDisplayName
    });
  }, [initialMessages, currentUserId, currentUsername, currentDisplayName]);

  const fetchProfile = useCallback(
    async (userId: string) => {
      if (profileCache.current.has(userId)) return profileCache.current.get(userId)!;
      const { data } = await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", userId)
        .maybeSingle();
      const p = {
        username: data?.username ?? "someone",
        display_name: data?.display_name ?? "Someone"
      };
      profileCache.current.set(userId, p);
      return p;
    },
    [supabase]
  );

  // Catch-up refetch — heals any gap left by a dropped realtime socket
  // (phone slept, laptop lid closed, network blip). Without this, a
  // device that missed INSERTs shows only its own optimistic messages
  // ("one side of the conversation") until a manual reload. Runs when
  // the channel (re)subscribes, the tab becomes visible again, or the
  // browser comes back online — pulls the latest rows and merges any
  // missing ones (dedup by id, chronological order preserved). Vault
  // DMs are skipped: their content needs the vault-key decrypt path,
  // so they keep the original behavior.
  const catchUp = useCallback(async () => {
    if (isVault) return;
    const { data } = await supabase
      .from("messages_with_sender")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(80);
    if (!data || data.length === 0) return;
    const fresh = [...(data as MessageRow[])].reverse();
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const additions = fresh.filter((m) => !known.has(m.id));
      if (additions.length === 0) return prev;
      return [...prev, ...additions].sort((a, b) =>
        String(a.created_at).localeCompare(String(b.created_at))
      );
    });
  }, [supabase, roomId, isVault]);
  const catchUpRef = useRef(catchUp);
  useEffect(() => {
    catchUpRef.current = catchUp;
  }, [catchUp]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void catchUpRef.current();
    }
    function onOnline() {
      void catchUpRef.current();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    // Safety-net poll: even with the realtime socket silently dead (no
    // close event, so no rejoin — seen on phone browsers), the open room
    // converges within ~12s. No-ops (and skips re-render) when nothing
    // is missing, so the steady-state cost is one light SELECT.
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void catchUpRef.current();
    }, 12000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      clearInterval(poll);
    };
  }, []);

  // Realtime: INSERT + UPDATE on messages in this room.
  useEffect(() => {
    const channel = supabase
      .channel(`room-messages:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`
        },
        async (payload) => {
          const m = payload.new as Omit<MessageRow, "sender_username" | "sender_display_name">;
          const profile = await fetchProfile(m.sender_id);
          // Vault decryption — if the room is a vault DM and we have a key,
          // decrypt before showing.
          let content = m.content;
          if (isVault && vaultKeyRef.current && content) {
            try {
              content = await decryptFromVault(content, vaultKeyRef.current);
            } catch {
              // leave as ciphertext
            }
          }
          const enriched: MessageRow = {
            ...m,
            content,
            sender_username: profile.username,
            sender_display_name: profile.display_name
          } as MessageRow;
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, enriched];
          });
          if (m.sender_id !== currentUserId) {
            setLastIncoming(enriched);
          }
          if (m.type === "nudge") {
            triggerNudge();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          const m = payload.new as Omit<MessageRow, "sender_username" | "sender_display_name">;
          setMessages((prev) =>
            prev.map((x) =>
              x.id === m.id
                ? {
                    ...x,
                    content: m.content,
                    image_url: m.image_url,
                    reactions: m.reactions,
                    edited_at: m.edited_at,
                    deleted_at: m.deleted_at,
                    regretted_at: m.regretted_at,
                    poll_data: m.poll_data
                  }
                : x
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          // Hard deletes (e.g. vanish-mode purge) — drop the bubble live.
          const old = payload.old as { id?: string } | undefined;
          if (!old?.id) return;
          setMessages((prev) => prev.filter((x) => x.id !== old.id));
        }
      )
      .subscribe((status) => {
        // Fires on the initial join AND on every automatic rejoin after a
        // disconnect — both are exactly when we may have missed rows.
        if (status === "SUBSCRIBED") void catchUpRef.current();
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, roomId, fetchProfile]);

  // ── Vanish mode (Phase 6.4) ────────────────────────────────────────────
  // Broadcast channel keeps both DM clients' toggle state in sync (rooms isn't
  // in the realtime publication, so we don't get a postgres_changes event).
  const vanishChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (!isDm) return;
    const ch = supabase.channel(`room-vanish:${roomId}`);
    ch.on("broadcast", { event: "vanish" }, (msg) => {
      setVanishMode(!!(msg.payload as { on?: boolean } | undefined)?.on);
    }).subscribe();
    vanishChanRef.current = ch;
    return () => {
      vanishChanRef.current = null;
      void supabase.removeChannel(ch);
    };
  }, [supabase, roomId, isDm]);

  const toggleVanish = useCallback(async () => {
    const next = !vanishModeRef.current;
    setVanishMode(next);
    const { error } = await supabase.rpc("set_vanish_mode", {
      p_room_id: roomId,
      p_on: next
    });
    if (error) {
      setVanishMode(!next);
      return;
    }
    vanishChanRef.current?.send({
      type: "broadcast",
      event: "vanish",
      payload: { on: next }
    });
  }, [supabase, roomId]);

  // When we leave/hide/close a DM, hard-delete the vanish messages we received
  // (seen-then-gone). No-ops when there are none, so it's safe to run on every
  // exit. The delete propagates to the sender via the realtime DELETE handler.
  useEffect(() => {
    if (!isDm) return;
    const purge = () => {
      void supabase.rpc("purge_seen_vanish_messages", { p_room_id: roomId });
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") purge();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", purge);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", purge);
      purge();
    };
  }, [supabase, roomId, isDm]);

  // Realtime presence channel: room-scoped “here right now” count.
  const [onlineCount, setOnlineCount] = useState(1);
  useEffect(() => {
    const presence = supabase.channel(`room-presence:${roomId}`, {
      config: { presence: { key: currentUserId } }
    });
    presence
      .on("presence", { event: "sync" }, () => {
        const state = presence.presenceState();
        setOnlineCount(Object.keys(state).length || 1);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presence.track({
            user_id: currentUserId,
            username: currentUsername,
            online_at: new Date().toISOString()
          });
        }
      });
    return () => {
      void supabase.removeChannel(presence);
    };
  }, [supabase, roomId, currentUserId, currentUsername]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function triggerNudge() {
    setShaking(true);
    setPulse(true);
    playBuzz();
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.([60, 30, 60, 30, 60]);
    }
    setTimeout(() => setShaking(false), 520);
    setTimeout(() => setPulse(false), 700);
  }

  // ===== Wave 18 — typing + reads realtime =====================================
  useEffect(() => {
    const ch = supabase.channel(`room-typing:${roomId}`, {
      config: { broadcast: { self: false } }
    });
    ch.on("broadcast", { event: "typing" }, (msg: any) => {
      const userId = msg?.payload?.user_id as string | undefined;
      const name = (msg?.payload?.name as string | undefined) ?? "someone";
      if (!userId || userId === currentUserId) return;
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.set(userId, { name, at: Date.now() });
        return next;
      });
    });
    ch.subscribe();
    typingChannelRef.current = ch;
    return () => {
      typingChannelRef.current = null;
      void supabase.removeChannel(ch);
    };
  }, [supabase, roomId, currentUserId]);

  // Expire stale typers every 2s.
  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - 4500;
      setTypingUsers((prev) => {
        let mutated = false;
        const next = new Map(prev);
        for (const [k, v] of next) {
          if (v.at < cutoff) {
            next.delete(k);
            mutated = true;
          }
        }
        return mutated ? next : prev;
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // Hide expired (disappearing) messages — drives via a 5s tick.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  // Read receipts — subscribe to message_reads changes for this room.
  useEffect(() => {
    const ch = supabase
      .channel(`room-reads:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reads",
          filter: `room_id=eq.${roomId}`
        },
        (payload: any) => {
          const row = (payload.new ?? payload.old) as
            | { user_id: string; last_read_message_id: string | null; last_read_at: string }
            | undefined;
          if (!row?.user_id) return;
          setReads((prev) => {
            const next = new Map(prev);
            next.set(row.user_id, {
              message_id: row.last_read_message_id ?? null,
              at: row.last_read_at
            });
            return next;
          });
        }
      )
      .subscribe();
    // Initial fetch.
    void (async () => {
      const { data } = await supabase
        .from("message_reads")
        .select("user_id, last_read_message_id, last_read_at")
        .eq("room_id", roomId);
      if (!data) return;
      setReads((prev) => {
        const next = new Map(prev);
        for (const r of data as any[]) {
          next.set(r.user_id, { message_id: r.last_read_message_id, at: r.last_read_at });
        }
        return next;
      });
    })();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase, roomId]);

  // Debounced mark-as-read when we have new messages and the tab is visible.
  useEffect(() => {
    if (messages.length === 0) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    const last = messages[messages.length - 1];
    if (!last) return;
    const t = setTimeout(() => {
      void supabase.rpc("mark_room_read", {
        p_room_id: roomId,
        p_message_id: last.id
      });
    }, 800);
    return () => clearTimeout(t);
  }, [supabase, roomId, messages.length]);

  function broadcastTyping() {
    const ch = typingChannelRef.current;
    if (!ch) return;
    const t = Date.now();
    // throttle to once / 2s
    if (t - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = t;
    void ch.send({
      type: "broadcast",
      event: "typing",
      payload: {
        user_id: currentUserId,
        name: currentDisplayName ?? currentUsername ?? "someone"
      }
    });
  }

  // ===== Wave 18 — visible message filter (TTL + search) =======================
  const visibleMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return messages.filter((m) => {
      // Hide self-destructed messages.
      if (m.expires_at) {
        const t = new Date(m.expires_at).getTime();
        if (Number.isFinite(t) && t <= now && m.sender_id !== currentUserId) {
          return false;
        }
      }
      if (!q) return true;
      const hay = (m.content ?? "").toLowerCase();
      return hay.includes(q);
    });
  }, [messages, searchQuery, now, currentUserId]);

  const pinnedMessages = useMemo(
    () => messages.filter((m) => m.pinned_at && !m.deleted_at),
    [messages]
  );

  // Other readers who've already seen a given message (read receipts).
  function readersFor(messageId: string): string[] {
    const out: string[] = [];
    const targetTime = (() => {
      const m = messages.find((x) => x.id === messageId);
      return m ? new Date(m.created_at).getTime() : 0;
    })();
    for (const [uid, info] of reads) {
      if (uid === currentUserId) continue;
      const t = new Date(info.at).getTime();
      if (t >= targetTime) out.push(uid);
    }
    return out;
  }

  // ===== Wave 18 — pin / unpin / forward / send voice ==========================
  async function pinMessage(messageId: string) {
    const { error: rpcErr } = await supabase.rpc("pin_message", {
      p_message_id: messageId
    });
    if (rpcErr) setError(rpcErr.message);
  }
  async function unpinMessage(messageId: string) {
    const { error: rpcErr } = await supabase.rpc("unpin_message", {
      p_message_id: messageId
    });
    if (rpcErr) setError(rpcErr.message);
  }

  async function sendVoice(blob: Blob, durationMs: number) {
    if (!blob) return;
    setUploading(true);
    setError(null);
    const ext =
      blob.type.includes("ogg") ? "ogg"
      : blob.type.includes("mp4") ? "m4a"
      : blob.type.includes("mpeg") ? "mp3"
      : "webm";
    const path = `${currentUserId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("voice-notes")
      .upload(path, blob, { contentType: blob.type || "audio/webm", upsert: false });
    if (upErr) {
      setError(`Voice upload failed: ${upErr.message}`);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("voice-notes").getPublicUrl(path);
    const expiresAt = disappearTtlSec
      ? new Date(Date.now() + disappearTtlSec * 1000).toISOString()
      : null;
    const { error: insertErr } = await supabase.from("messages").insert({
      sender_id: currentUserId,
      room_id: roomId,
      content: null,
      audio_url: pub.publicUrl,
      duration_ms: Math.round(durationMs),
      reply_to_id: replyTo?.id ?? null,
      intent: intentChoice,
      expires_at: expiresAt,
      type: "voice"
    });
    setUploading(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    setReplyTo(null);
    setIntentChoice(null);
    setShowVoice(false);
  }

  // Post a recorded video clip into the chat. Carried as a "file" message
  // (video mime) so it reuses the whole existing attachment pipeline; the
  // FileCard renders video mimes inline with a <video> player.
  async function sendVideoToChat(blob: Blob, durationMs: number, caption: string) {
    if (!blob) return;
    if (blob.size > MAX_FILE_BYTES) {
      setError("That clip is over 50 MB — record a shorter one.");
      setShowVideo(false);
      return;
    }
    setUploading(true);
    setError(null);
    // Strip any ";codecs=…" suffix MediaRecorder adds so the content-type is a
    // clean base mime the storage bucket accepts.
    const baseMime = (blob.type || "video/webm").split(";")[0] || "video/webm";
    const ext = baseMime.includes("mp4") ? "mp4" : "webm";
    const path = `${currentUserId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("chat-files")
      .upload(path, blob, { contentType: baseMime, upsert: false });
    if (upErr) {
      setError(`Video upload failed: ${upErr.message}`);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("chat-files").getPublicUrl(path);
    const expiresAt = disappearTtlSec
      ? new Date(Date.now() + disappearTtlSec * 1000).toISOString()
      : null;
    const { error: insertErr } = await supabase.from("messages").insert({
      sender_id: currentUserId,
      room_id: roomId,
      content: caption || null,
      file_url: pub.publicUrl,
      file_name: `video-clip.${ext}`,
      file_size: blob.size,
      file_mime: baseMime,
      duration_ms: Math.round(durationMs),
      reply_to_id: replyTo?.id ?? null,
      intent: intentChoice,
      expires_at: expiresAt,
      type: "file"
    });
    setUploading(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    setReplyTo(null);
    setIntentChoice(null);
    setShowVideo(false);
  }

  // Post a recorded video clip to Shorts (public or private) — same storage +
  // table the /shorts/new uploader uses.
  async function postVideoToShort(blob: Blob, isPublic: boolean, caption: string) {
    if (!blob) return;
    if (blob.size > 50 * 1024 * 1024) {
      setError("That clip is over 50 MB — record a shorter one.");
      setShowVideo(false);
      return;
    }
    setUploading(true);
    setError(null);
    const baseMime = (blob.type || "video/webm").split(";")[0] || "video/webm";
    const ext = baseMime.includes("mp4") ? "mp4" : "webm";
    const path = `${currentUserId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("shorts")
      .upload(path, blob, { contentType: baseMime, upsert: false });
    if (upErr) {
      setError(`Short upload failed: ${upErr.message}`);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("shorts").getPublicUrl(path);
    const { error: insertErr } = await supabase.from("shorts").insert({
      author_id: currentUserId,
      video_url: pub.publicUrl,
      caption: caption || null,
      is_public: isPublic
    });
    setUploading(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    setShowVideo(false);
    setNotice(
      isPublic
        ? "✓ Posted to Shorts (public) — find it in the Shorts feed."
        : "✓ Posted to Shorts (private) — only you can see it."
    );
  }

  // Post a recorded clip to BOTH the chat and Shorts in one go.
  async function postVideoToBoth(
    blob: Blob,
    durationMs: number,
    isPublic: boolean,
    caption: string
  ) {
    if (!blob) return;
    if (blob.size > MAX_FILE_BYTES) {
      setError("That clip is over 50 MB — record a shorter one.");
      setShowVideo(false);
      return;
    }
    setUploading(true);
    setError(null);
    const baseMime = (blob.type || "video/webm").split(";")[0] || "video/webm";
    const ext = baseMime.includes("mp4") ? "mp4" : "webm";
    const expiresAt = disappearTtlSec
      ? new Date(Date.now() + disappearTtlSec * 1000).toISOString()
      : null;

    // 1) Chat — upload to chat-files + post a file (video) message.
    const chatPath = `${currentUserId}/${crypto.randomUUID()}.${ext}`;
    const up1 = await supabase.storage
      .from("chat-files")
      .upload(chatPath, blob, { contentType: baseMime, upsert: false });
    if (up1.error) {
      setError(`Video upload failed: ${up1.error.message}`);
      setUploading(false);
      return;
    }
    const pub1 = supabase.storage.from("chat-files").getPublicUrl(chatPath).data;
    const ins1 = await supabase.from("messages").insert({
      sender_id: currentUserId,
      room_id: roomId,
      content: caption || null,
      file_url: pub1.publicUrl,
      file_name: `video-clip.${ext}`,
      file_size: blob.size,
      file_mime: baseMime,
      duration_ms: Math.round(durationMs),
      reply_to_id: replyTo?.id ?? null,
      intent: intentChoice,
      expires_at: expiresAt,
      type: "file"
    });
    if (ins1.error) {
      setError(ins1.error.message);
      setUploading(false);
      return;
    }

    // 2) Shorts — upload to shorts bucket + insert.
    const shortPath = `${currentUserId}/${crypto.randomUUID()}.${ext}`;
    const up2 = await supabase.storage
      .from("shorts")
      .upload(shortPath, blob, { contentType: baseMime, upsert: false });
    if (up2.error) {
      setError(`Posted to chat, but Short upload failed: ${up2.error.message}`);
      setUploading(false);
      setShowVideo(false);
      return;
    }
    const pub2 = supabase.storage.from("shorts").getPublicUrl(shortPath).data;
    const ins2 = await supabase.from("shorts").insert({
      author_id: currentUserId,
      video_url: pub2.publicUrl,
      caption: caption || null,
      is_public: isPublic
    });
    setUploading(false);
    if (ins2.error) {
      setError(`Posted to chat, but Short save failed: ${ins2.error.message}`);
      setShowVideo(false);
      return;
    }
    setReplyTo(null);
    setIntentChoice(null);
    setShowVideo(false);
    setNotice(
      isPublic
        ? "✓ Posted to chat and Shorts (public)."
        : "✓ Posted to chat and Shorts (private — only you see the Short)."
    );
  }

  function insertAtCursor(text: string) {
    const ta = textareaRef.current;
    if (!ta) {
      setDraft((d) => d + text);
      return;
    }
    const start = ta.selectionStart ?? draft.length;
    const end = ta.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + text + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = start + text.length;
      ta.setSelectionRange(cursor, cursor);
    });
  }

  function onDraftChange(value: string) {
    setDraft(value);
    broadcastTyping();
    // Detect @ mention trigger.
    const ta = textareaRef.current;
    const cursor = ta?.selectionStart ?? value.length;
    const upto = value.slice(0, cursor);
    const at = upto.lastIndexOf("@");
    if (at >= 0) {
      const tail = upto.slice(at + 1);
      // Mention is active if there's no space between @ and the cursor and it's
      // 0–18 chars long (username max).
      if (/^[a-zA-Z0-9_]{0,18}$/.test(tail)) {
        setMentionState({ query: tail, open: true });
        return;
      }
    }
    setMentionState({ query: "", open: false });
  }

  function applyMention(username: string) {
    const ta = textareaRef.current;
    const cursor = ta?.selectionStart ?? draft.length;
    const upto = draft.slice(0, cursor);
    const at = upto.lastIndexOf("@");
    if (at < 0) {
      setMentionState({ query: "", open: false });
      return;
    }
    const after = draft.slice(cursor);
    const next = draft.slice(0, at) + "@" + username + " " + after;
    setDraft(next);
    setMentionState({ query: "", open: false });
    requestAnimationFrame(() => {
      ta?.focus();
      const newCursor = at + 1 + username.length + 1;
      ta?.setSelectionRange(newCursor, newCursor);
    });
  }

  async function sendText() {
    const text = draft.trim();
    if (!text || sending) return;

    // Hard line — sexual content about minors / terrorism. BLOCK the send,
    // warn sternly, and log the attempt with the offender's IP (/api/flag).
    const flagged = flagCategory(text);
    if (flagged) {
      reportFlag(flagged, text, roomId);
      setFlaggedCat(flagged);
      return;
    }

    // v7 People's Charter — soft 4-lines warning. One-time per session.
    // Never blocks. Just signals "you're being seen" if the narrow keyword
    // pattern matches explicit calls for violence / terrorism / organized
    // hate. After "Carry on" the message sends normally.
    try {
      const acked = window.sessionStorage.getItem("karochat:4lines-acked") === "1";
      if (!acked && matchesFourLines(text)) {
        setFourLinesWarning(text);
        return;
      }
    } catch {
      // sessionStorage can be disabled — fall through to normal send.
    }

    // /poll question | option 1 | option 2 | ... → publish as a poll message.
    if (text.toLowerCase().startsWith("/poll ")) {
      const rest = text.slice("/poll ".length);
      const parts = rest.split("|").map((p) => p.trim()).filter(Boolean);
      if (parts.length < 3) {
        setError("Use /poll question | option 1 | option 2 (add more options after).");
        return;
      }
      const question = parts[0]!;
      const options = parts.slice(1, 9).map((text) => ({ text, votes: [] as string[] }));
      setSending(true);
      setError(null);
      const { error: insertErr } = await supabase.from("messages").insert({
        sender_id: currentUserId,
        room_id: roomId,
        content: question,
        reply_to_id: replyTo?.id ?? null,
        intent: intentChoice,
        type: "poll",
        poll_data: { question, options } as any
      });
      setSending(false);
      if (insertErr) {
        setError(insertErr.message);
        return;
      }
      setDraft("");
      setReplyTo(null);
      setIntentChoice(null);
      return;
    }

    setSending(true);
    setError(null);
    // Vault encryption: if this is a vault DM with a derived key, replace
    // the plaintext content with ciphertext before the DB ever sees it.
    let outgoing = text;
    if (isVault && vaultKeyRef.current) {
      try {
        outgoing = await encryptForVault(text, vaultKeyRef.current);
      } catch (e) {
        console.warn("[vault] encrypt failed, sending plaintext", e);
      }
    }
    const expiresAt = disappearTtlSec
      ? new Date(Date.now() + disappearTtlSec * 1000).toISOString()
      : null;
    // Parse @mentions (a..z, 0..9, _) — strip @karo since it's the AI summon.
    const mentionMatches = Array.from(text.matchAll(/@([a-zA-Z0-9_]{1,18})/g))
      .map((m) => m[1])
      .filter((u): u is string => !!u && u.toLowerCase() !== "karo");
    const { error: insertErr } = await supabase.from("messages").insert({
      sender_id: currentUserId,
      room_id: roomId,
      content: outgoing,
      reply_to_id: replyTo?.id ?? null,
      intent: intentChoice,
      expires_at: expiresAt,
      mentions: mentionMatches.length ? mentionMatches : [],
      type: "text"
    });
    setSending(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    setDraft("");
    setReplyTo(null);
    setIntentChoice(null);
    // Echo the sent message via fetch-and-merge rather than waiting on the
    // realtime websocket — if the socket is unhealthy (common on phones),
    // the message previously never appeared in the sender's own window.
    void catchUpRef.current();

    // @karo summons the AI co-pilot. Fire-and-forget: the response is
    // inserted as a type='system' message with intent='karo'.
    if (/^@karo\b/i.test(text)) {
      void summonKaro(text);
    }
  }

  async function summonKaro(prompt: string) {
    try {
      const res = await fetch("/api/ai/karo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, prompt })
      });
      const data = await res.json();
      if (!res.ok || !data?.reply) {
        const { error: insertErr } = await supabase.from("messages").insert({
          sender_id: currentUserId,
          room_id: roomId,
          content: "Karo couldn't answer that just now.",
          type: "system",
          intent: "karo"
        });
        if (insertErr) console.warn("[karo] failed to post fallback:", insertErr);
        return;
      }
      const { error: insertErr } = await supabase.from("messages").insert({
        sender_id: currentUserId,
        room_id: roomId,
        content: String(data.reply),
        type: "system",
        intent: "karo"
      });
      if (insertErr) console.warn("[karo] failed to post reply:", insertErr);
    } catch (err) {
      console.warn("[karo] threw", err);
    }
  }

  async function castPollVote(messageId: string, optionIndex: number) {
    setError(null);
    // Optimistic toggle: clear caller from all options, set on the chosen one
    // (or none if same option clicked again to un-vote).
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId || !msg.poll_data) return msg;
        const currentIndex = msg.poll_data.options.findIndex((o) =>
          o.votes.includes(currentUserId)
        );
        const target = currentIndex === optionIndex ? -1 : optionIndex;
        const newOptions = msg.poll_data.options.map((o, i) => ({
          ...o,
          votes:
            i === target
              ? Array.from(new Set([...o.votes, currentUserId]))
              : o.votes.filter((v) => v !== currentUserId)
        }));
        return { ...msg, poll_data: { ...msg.poll_data, options: newOptions } };
      })
    );
    const current = messages.find((m) => m.id === messageId);
    const currentIndex =
      current?.poll_data?.options.findIndex((o) => o.votes.includes(currentUserId)) ?? -1;
    const target = currentIndex === optionIndex ? -1 : optionIndex;
    const { error: rpcErr } = await supabase.rpc("cast_poll_vote", {
      p_message_id: messageId,
      p_option_index: target
    });
    if (rpcErr) setError(rpcErr.message);
  }

  async function sendImage(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Only PNG, JPEG, WEBP, or GIF images.");
      return;
    }
    if (file.size > MAX_IMAGE_SOURCE_BYTES) {
      setError("Image is larger than 25 MB.");
      return;
    }
    setUploading(true);
    setError(null);
    // Compress big photos client-side (downscale + webp) before upload.
    const upload = await compressImageFile(file);
    if (upload.size > MAX_IMAGE_BYTES) {
      setError("Image is still over 8 MB after compression — try a smaller one.");
      setUploading(false);
      return;
    }
    const ext = upload.type === "image/webp"
      ? "webp"
      : (upload.name.split(".").pop()?.toLowerCase() ?? "jpg");
    const path = `${currentUserId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("chat-images")
      .upload(path, upload, { contentType: upload.type, upsert: false });
    if (upErr) {
      setError(`Upload failed: ${upErr.message}`);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("chat-images").getPublicUrl(path);
    // CSAM scan gate — every image goes through /api/scan/image before being
    // referenced as a message. If the scanner blocks, the route also deletes
    // the uploaded object and auto-files a report.
    try {
      const r = await fetch("/api/scan/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicUrl: pub.publicUrl,
          bucket: "chat-images",
          path
        })
      });
      const j = await r.json();
      if (j?.blocked) {
        setError("This image can't be uploaded. It was flagged by our scanner.");
        setUploading(false);
        return;
      }
    } catch (e) {
      // If the scan service is down, fail closed: don't insert the message.
      setError("Image scan unavailable — try again in a moment.");
      setUploading(false);
      return;
    }
    const caption = draft.trim();
    // Uploaded pics auto-vanish after 24h by default (or sooner if a
    // disappearing-timer is set). Keeps the chat from accumulating old photos.
    const imageExpiresAt = disappearTtlSec
      ? new Date(Date.now() + disappearTtlSec * 1000).toISOString()
      : new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const { error: insertErr } = await supabase.from("messages").insert({
      sender_id: currentUserId,
      room_id: roomId,
      content: caption || null,
      image_url: pub.publicUrl,
      reply_to_id: replyTo?.id ?? null,
      intent: intentChoice,
      expires_at: imageExpiresAt,
      type: "image"
    });
    setUploading(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    setDraft("");
    setReplyTo(null);
    setIntentChoice(null);
  }

  async function sendFile(file: File) {
    // Images go through the image path (compression + scan + inline render).
    if (ACCEPTED_TYPES.includes(file.type)) {
      void sendImage(file);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("File is larger than 500 MB.");
      return;
    }
    setUploading(true);
    setError(null);
    // Compress big, compressible files (text / json / svg / etc.) with gzip.
    let blob: Blob = file;
    let compressed = false;
    if (file.size > 256 * 1024 && GZIP_RE.test(file.type)) {
      const gz = await gzipBlob(file);
      if (gz && gz.size < file.size * 0.92) {
        blob = gz;
        compressed = true;
      }
    }
    const safeName = file.name || "file";
    const path = `${currentUserId}/${crypto.randomUUID()}${compressed ? ".gz" : ""}`;
    const { error: upErr } = await supabase.storage
      .from("chat-files")
      .upload(path, blob, {
        contentType: compressed
          ? "application/gzip"
          : file.type || "application/octet-stream",
        upsert: false
      });
    if (upErr) {
      setError(`Upload failed: ${upErr.message}`);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("chat-files").getPublicUrl(path);
    const caption = draft.trim();
    const expiresAt = disappearTtlSec
      ? new Date(Date.now() + disappearTtlSec * 1000).toISOString()
      : null;
    const { error: insertErr } = await supabase.from("messages").insert({
      sender_id: currentUserId,
      room_id: roomId,
      content: caption || null,
      file_url: pub.publicUrl,
      file_name: safeName,
      file_size: file.size,
      file_mime: file.type || null,
      file_compressed: compressed,
      reply_to_id: replyTo?.id ?? null,
      intent: intentChoice,
      expires_at: expiresAt,
      type: "file"
    });
    setUploading(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    setDraft("");
    setReplyTo(null);
    setIntentChoice(null);
  }

  // Voice typing — dictate straight into the composer with the Web Speech API.
  function toggleDictation() {
    if (dictating) {
      try {
        dictateRef.current?.stop?.();
      } catch {
        /* ignore */
      }
      return;
    }
    const W = window as any;
    const Rec = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Rec) {
      setError("Voice typing isn't supported in this browser.");
      return;
    }
    try {
      const rec = new Rec();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = (typeof navigator !== "undefined" && navigator.language) || "en-US";
      rec.onresult = (e: any) => {
        let final = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript;
        }
        const text = final.trim();
        if (text) insertAtCursor(text + " ");
      };
      rec.onerror = () => setDictating(false);
      rec.onend = () => {
        setDictating(false);
        dictateRef.current = null;
      };
      dictateRef.current = rec;
      rec.start();
      setDictating(true);
    } catch {
      setDictating(false);
      setError("Couldn't start voice typing.");
    }
  }

  function onFileAny(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void sendFile(file);
    e.target.value = "";
  }

  async function sendNudge() {
    setError(null);
    const { error: rpcErr } = await supabase.rpc("send_nudge", { p_room_id: roomId });
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const r = { ...(m.reactions ?? {}) };
        const arr = r[emoji] ? [...r[emoji]!] : [];
        const idx = arr.indexOf(currentUserId);
        if (idx >= 0) arr.splice(idx, 1);
        else arr.push(currentUserId);
        if (arr.length === 0) delete r[emoji];
        else r[emoji] = arr;
        return { ...m, reactions: r };
      })
    );
    const { error: rpcErr } = await supabase.rpc("toggle_reaction", {
      p_message_id: messageId,
      p_emoji: emoji
    });
    if (rpcErr) setError(rpcErr.message);
  }

  async function saveEdit() {
    if (!editing) return;
    const original = messages.find((m) => m.id === editing.id);
    if (!original) return;
    const newContent = editing.content.trim();
    if (!newContent) return;
    const history = [
      ...(Array.isArray((original as any).edited_history)
        ? (original as any).edited_history
        : []),
      { at: new Date().toISOString(), content: original.content }
    ];
    const { error: updErr } = await supabase
      .from("messages")
      .update({
        content: newContent,
        edited_at: new Date().toISOString(),
        edited_history: history
      })
      .eq("id", editing.id);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    setEditing(null);
  }

  async function softDelete(messageId: string) {
    if (!confirm("Delete this message? Everyone will see it as removed.")) return;
    const { error: updErr } = await supabase
      .from("messages")
      .update({
        deleted_at: new Date().toISOString(),
        content: null,
        image_url: null
      })
      .eq("id", messageId);
    if (updErr) setError(updErr.message);
  }

  async function markRegretted(messageId: string) {
    if (
      !confirm(
        "Mark this message as regretted? Everyone will see a note that you'd phrase it differently — the original stays visible."
      )
    )
      return;
    const { error: updErr } = await supabase
      .from("messages")
      .update({ regretted_at: new Date().toISOString() })
      .eq("id", messageId);
    if (updErr) setError(updErr.message);
  }

  function jumpToMessage(id: string) {
    const el = messageRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-neon-blue/60");
      setTimeout(() => el.classList.remove("ring-2", "ring-neon-blue/60"), 1500);
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files);
    const img = files.find((f) => ACCEPTED_TYPES.includes(f.type));
    if (img) {
      e.preventDefault();
      void sendImage(img);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendText();
    }
    if (e.key === "Escape" && replyTo) setReplyTo(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void sendImage(file);
    e.target.value = "";
  }

  return (
    <section
      ref={sectionRef}
      className={clsx(
        // Note: overflow-visible (not overflow-hidden) so composer
        // popovers (emoji/gif/voice/mention/ttl) can extend above the
        // section bounds without being clipped. Internal scroller has
        // its own overflow-y-auto.
        "surface-glass tint-blue relative mt-3 flex min-h-0 min-w-0 flex-col overflow-visible transition-[filter,opacity] duration-700",
        // When no explicit height lock is set, fill the available space.
        chatPx === null && "flex-1",
        shaking && "animate-nudgeShake",
        lightsOut && "[filter:brightness(0.55)_saturate(0.8)]"
      )}
      style={
        chatPx !== null || effectiveWPx !== null
          ? {
              ...(chatPx !== null
                ? { height: chatPx, flex: "0 0 auto" }
                : {}),
              ...(effectiveWPx !== null
                ? { width: effectiveWPx, flexBasis: "auto", flexGrow: 0 }
                : {})
            }
          : undefined
      }
    >
      {/* Wave 19 — invisible drag strips on each edge for Yahoo-IM style
         resize from any side. Sit ABOVE everything else inside the
         section but BELOW composer popovers (z-20 vs picker z-60). */}
      <EdgeHandles
        targetRef={sectionRef}
        px={chatPx}
        wPx={effectiveWPx}
        onBeginDrag={beginDrag}
      />

      {/* Wave 19.5 — room theme paint. Sits behind everything inside the
         section, never blocks input. Owner picks via RoomThemePicker. */}
      {(() => {
        const t = ROOM_THEMES.find((x) => x.value === roomTheme);
        if (!t || t.value === "default") return null;
        return (
          <div
            aria-hidden
            className={clsx(
              "pointer-events-none absolute inset-0 bg-gradient-to-br",
              t.gradient
            )}
          />
        );
      })()}

      {/* Expand/collapse for the call & video strips below. Replaces the old
         visible top resize grip — the invisible EdgeHandles strip on the top
         edge still lets users drag-resize from up here. While a recording is
         live the strips are forced visible so the indicator can't be hidden. */}
      {!isSaved && (
        <button
          type="button"
          onClick={toggleCallTools}
          aria-expanded={callToolsOpen || !!recordingStartedAt}
          aria-controls="call-tool-strips"
          className={clsx(
            "flex w-full items-center justify-center gap-2 rounded-t-2xl border-b px-3 py-1.5 text-[10px] uppercase tracking-widest transition",
            callToolsOpen || !!recordingStartedAt
              ? "border-white/5 bg-white/[0.03] text-white/55 hover:bg-white/[0.06] hover:text-white/85"
              : "border-neon-red/30 bg-neon-red/[0.07] text-white/75 hover:bg-neon-red/[0.12] hover:text-white"
          )}
        >
          {callToolsOpen || !!recordingStartedAt ? (
            <>▲ Hide call &amp; video tools</>
          ) : (
            <>
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-red opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-red" />
              </span>
              📞 Expand for audio &amp; video calls ▼
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-red opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-red" />
              </span>
            </>
          )}
        </button>
      )}

      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2 text-xs text-white/50">
        <div className="flex items-center gap-2">
          <PresenceDot state="online" pulse />
          <span>{onlineCount} here now</span>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <Soundscape />
          <button
            type="button"
            onClick={() => setSearchOpen((s) => !s)}
            aria-pressed={searchOpen}
            aria-label="Search messages"
            title="Search messages in this room"
            className={clsx(
              "rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-widest transition",
              searchOpen
                ? "border-neon-blue/40 bg-neon-blue/10 text-neon-blue"
                : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
            )}
          >
            🔎 search
          </button>
          <button
            type="button"
            onClick={() => setLightsOut((s) => !s)}
            aria-pressed={lightsOut}
            title={
              lightsOut
                ? "Turn the lights back on"
                : "Lights out — slow, intimate mode for this session"
            }
            aria-label="Toggle lights-out mode"
            className={clsx(
              "rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-widest transition",
              lightsOut
                ? "border-neon-amber/40 bg-neon-amber/10 text-neon-amber"
                : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
            )}
          >
            {lightsOut ? "🕯 lights out" : "🕯 lights"}
          </button>
          <span className="hidden font-mono uppercase tracking-widest sm:inline">realtime</span>
        </div>
      </div>

      {/* CSS-hidden (never unmounted) when collapsed so captions, consent,
          and breakout state inside survive toggling. Recording in progress
          forces the strips visible. */}
      <div
        id="call-tool-strips"
        className={
          callToolsOpen || !!recordingStartedAt ? undefined : "hidden"
        }
      >
        <ConferenceTools
          roomId={roomId}
          isOwner={!!isOwner}
          isDm={!!isDm}
          isSaved={!!isSaved}
          recordingStartedAt={recordingStartedAt ?? null}
        />

        {/* Hide the widget while the call panel is mounted in this room so
            the user doesn't see duplicate "Voice & Video" controls. */}
        {!isSaved && !widgetCallMode && (
          <CallWidget
            roomId={roomId}
            roomName={roomName}
            onlineCount={onlineCount}
            onStart={(mode) => {
              setWidgetCallMode(mode);
              // Ring the other member(s) so calls actually "ping" them —
              // in-app (open) + Web Push (closed). No-op / capped for big rooms.
              void ringRoom(roomId, mode);
            }}
          />
        )}
      </div>

      {isVault && (
        <div className="flex items-center gap-2 border-b border-neon-purple/20 bg-neon-purple/5 px-4 py-1.5 text-[11px] text-neon-purple">
          <span aria-hidden>🔐</span>
          <span>
            Vault DM · {vaultReady
              ? "messages end-to-end encrypted"
              : "waiting for the other side to publish a key…"}
          </span>
        </div>
      )}

      {recordingStartedAt && (
        <div className="flex items-center gap-2 border-b border-neon-red/30 bg-neon-red/10 px-4 py-1.5 text-[11px] text-neon-red">
          <span aria-hidden className="animate-pulseDot">●</span>
          <span>
            This room is being recorded. Started at {new Date(recordingStartedAt).toLocaleTimeString()}.
          </span>
        </div>
      )}

      {parentRoomId && (
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-1.5 text-[11px] text-white/55">
          <span aria-hidden>🪟</span>
          <span>
            Breakout room ·{" "}
            <Link href={`/rooms/${parentRoomId}`} className="underline hover:text-white">
              return to parent
            </Link>
          </span>
        </div>
      )}

      <PinnedStrip
        messages={messages}
        currentUserId={currentUserId}
        isOwner={!!isOwner}
        onJump={(id) => jumpToMessage(id)}
        onUnpin={(id) => void unpinMessage(id)}
      />

      {searchOpen && (
        <MessageSearchBar
          query={searchQuery}
          onQuery={setSearchQuery}
          onClose={() => {
            setSearchOpen(false);
            setSearchQuery("");
          }}
          resultCount={visibleMessages.filter((m) =>
            searchQuery
              ? (m.content ?? "").toLowerCase().includes(searchQuery.toLowerCase())
              : false
          ).length}
        />
      )}

      <div
        ref={scrollerRef}
        className="scroll-thin relative flex-1 space-y-3 overflow-y-auto p-4 min-h-0"
      >
        {pulse && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neon-red/40 animate-nudgePulse" />
        )}
        {visibleMessages.length === 0 && messages.length === 0 && (
          <p className="mx-auto mt-10 max-w-sm text-center text-sm text-white/40">
            It&apos;s quiet here. Say hi.
          </p>
        )}
        {visibleMessages.length === 0 && messages.length > 0 && searchQuery && (
          <p className="mx-auto mt-10 max-w-sm text-center text-sm text-white/40">
            No matches for &ldquo;{searchQuery}&rdquo;.
          </p>
        )}
        {visibleMessages.map((m, i) => (
          <MessageBubble
            key={m.id}
            m={m}
            prev={i > 0 ? visibleMessages[i - 1] : undefined}
            allMessages={messages}
            currentUserId={currentUserId}
            currentUsername={currentUsername}
            roomId={roomId}
            roomName={roomName}
            roomInviteCode={roomInviteCode ?? null}
            highlight={
              searchQuery.trim().length > 0 ? searchQuery.trim() : null
            }
            readers={readersFor(m.id)}
            now={now}
            onAuthorNavigate={(roomDestId) => {
              router.push(`/rooms/${roomDestId}`);
              router.refresh();
            }}
            onOpenDm={async (targetId) => {
              if (!targetId || targetId === currentUserId) return;
              const { data, error: dmErr } = await supabase.rpc("get_or_create_dm", {
                p_target_user_id: targetId
              });
              if (dmErr || !data) {
                setError(dmErr?.message ?? "Couldn't open chat.");
                return;
              }
              router.push(`/rooms/${data as string}`);
              router.refresh();
            }}
            isEditing={editing?.id === m.id}
            editingDraft={editing?.id === m.id ? editing.content : null}
            onEditDraft={(content) => setEditing((s) => (s ? { ...s, content } : s))}
            onStartEdit={(msg) =>
              setEditing({ id: msg.id, content: msg.content ?? "" })
            }
            onCancelEdit={() => setEditing(null)}
            onSaveEdit={saveEdit}
            onDelete={softDelete}
            onRegret={markRegretted}
            onPollVote={castPollVote}
            onReply={(msg) => setReplyTo(msg)}
            onReact={toggleReaction}
            onJump={jumpToMessage}
            onOpenThread={(id) => setThreadParentId(id)}
            onReport={(t) => setReportTarget(t)}
            onPin={(id) => void pinMessage(id)}
            onUnpin={(id) => void unpinMessage(id)}
            onForward={(msg) => setForwardSource(msg)}
            isOwner={!!isOwner}
            autoTranslate={currentAutoTranslate ?? null}
            registerRef={(id, el) => {
              if (el) messageRefs.current.set(id, el);
              else messageRefs.current.delete(id);
            }}
          />
        ))}
      </div>

      <TypingIndicator
        users={Array.from(typingUsers.values()).map((v) => v.name)}
      />

      <ChatResizer
        targetRef={sectionRef}
        px={chatPx}
        wPx={chatWPx}
        preset={chatPreset}
        onBeginDrag={beginDrag}
        onCompact={compactSize}
        onReset={resetSize}
        onFull={fullSize}
      />

      <div className="border-t border-white/5 p-3">
        <SmartReplies
          roomId={roomId}
          lastMessageId={
            (() => {
              for (let i = messages.length - 1; i >= 0; i--) {
                const m = messages[i];
                if (!m) continue;
                if (m.sender_id !== currentUserId && m.type !== "nudge" && !m.deleted_at) {
                  return m.id;
                }
              }
              return null;
            })()
          }
          hidden={draft.trim().length > 0 || !!editing}
          onPick={(text) => setDraft(text)}
        />
        {error && <p className="mb-2 text-xs text-neon-red">{error}</p>}
        {notice && <p className="mb-2 text-xs text-neon-mint">{notice}</p>}
        {uploading && (
          <p className="mb-2 text-xs text-white/50">
            <span className="mr-2 inline-block animate-pulseDot">●</span>Uploading image…
          </p>
        )}
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
            <span className="text-neon-blue">↪</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-white/60">
                Replying to{" "}
                <span className="text-white">
                  {replyTo.sender_display_name ?? replyTo.sender_username ?? "someone"}
                </span>
              </p>
              <p className="truncate text-white/40">
                {replyTo.deleted_at
                  ? "deleted message"
                  : replyTo.image_url && !replyTo.content
                  ? "📷 image"
                  : replyTo.content ?? "…"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="rounded-md border border-white/10 px-2 py-0.5 text-white/60 hover:bg-white/10"
              aria-label="Cancel reply"
            >
              ✕
            </button>
          </div>
        )}
        <div className="relative flex flex-col gap-2">
          {/* Vanish-mode banner (DM only). */}
          {isDm && vanishMode && (
            <div className="flex items-center gap-2 rounded-lg border border-neon-purple/40 bg-neon-purple/10 px-3 py-1.5 text-[11px] text-neon-purple">
              <span aria-hidden>🫥</span>
              <span>
                Vanish mode is on — messages disappear once seen and the chat is closed.
              </span>
              <button
                type="button"
                onClick={() => void toggleVanish()}
                className="ml-auto rounded-md border border-neon-purple/40 px-2 py-0.5 hover:bg-neon-purple/20"
              >
                Turn off
              </button>
            </div>
          )}
          {/* Row 1 — action buttons ("left tags"). */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => setToolsOpen(true)}
            aria-label="Open tools"
            title="Tools — photos, files, voice, video, snaps, lenses & more"
            className="grid h-9 w-9 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-xl border border-neon-blue/40 bg-neon-blue/10 text-neon-blue transition hover:bg-neon-blue/20"
          >
            🧰
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Attach image"
            className="grid h-9 w-9 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="9" cy="9" r="1.5" />
              <path d="m21 15-5-5-9 9" />
            </svg>
          </button>
          <input
            ref={fileAnyInputRef}
            type="file"
            className="hidden"
            onChange={onFileAny}
          />
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowEmoji((s) => !s);
                setShowGif(false);
                setShowVoice(false);
                setShowStickers(false);
                setShowLines(false);
                setTtlMenuOpen(false);
              }}
              aria-label="Insert emoji"
              title="Insert emoji"
              className="grid h-9 w-9 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              😊
            </button>
            {showEmoji && (
              <EmojiPicker
                onPick={(e) => {
                  insertAtCursor(e);
                  setShowEmoji(false);
                }}
                onClose={() => setShowEmoji(false)}
              />
            )}
          </div>
          <KaraokeStudio
            open={showKaraoke}
            onClose={() => setShowKaraoke(false)}
            roomName={roomName}
            roomId={roomId}
            userId={currentUserId}
            userName={currentDisplayName || currentUsername}
          />
          {/* Vanish mode — DM only. Seen-then-gone (distinct from the ⏳ timer). */}
          {isDm && (
            <button
              type="button"
              onClick={() => void toggleVanish()}
              aria-pressed={vanishMode}
              aria-label="Vanish mode"
              title={
                vanishMode
                  ? "Vanish mode on — new messages disappear once seen"
                  : "Turn on vanish mode (seen-then-gone)"
              }
              className={clsx(
                "grid h-9 w-9 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-xl border transition",
                vanishMode
                  ? "border-neon-purple/60 bg-neon-purple/20 text-neon-purple"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              {vanishMode ? "🫥" : "👻"}
            </button>
          )}
          {mentionState.open && (
            <MentionMenu
              roomId={roomId}
              query={mentionState.query}
              currentUserId={currentUserId}
              onPick={(username) => applyMention(username)}
              onClose={() => setMentionState({ query: "", open: false })}
            />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={onFile}
          />
          </div>
          {/* Tools sheet — a labeled grid of every composer tool (with names),
              the mobile-friendly way to reach them. Each tile fires the same
              handler the toolbar icon does, so nothing is duplicated in logic. */}
          {toolsOpen && (
            <div
              className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur sm:items-center sm:p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setToolsOpen(false);
              }}
            >
              <div className="w-full max-w-md rounded-t-2xl border border-white/10 bg-ink-800 p-4 pb-6 sm:rounded-2xl">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display text-base font-semibold">Tools</h3>
                  <button
                    type="button"
                    onClick={() => setToolsOpen(false)}
                    className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-white/60 hover:bg-white/10"
                    aria-label="Close tools"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { icon: "🖼️", label: "Photo", run: () => fileInputRef.current?.click() },
                    { icon: "📎", label: "File", run: () => fileAnyInputRef.current?.click() },
                    { icon: "🎥", label: "Video", run: () => setShowVideo(true) },
                    { icon: "🎙️", label: "Voice note", run: () => setShowVoice(true) },
                    { icon: "📸", label: "Snap", run: () => router.push("/snaps") },
                    { icon: "🤳", label: "Lens", run: () => router.push("/lenses") },
                    { icon: "😊", label: "Emoji", run: () => setShowEmoji(true) },
                    { icon: "GIF", label: "GIF", run: () => setShowGif(true) },
                    { icon: "🧩", label: "Stickers", run: () => setShowStickers(true) },
                    { icon: "💘", label: "Lines", run: () => setShowLines(true) },
                    { icon: "🎤", label: "Karaoke", run: () => setShowKaraoke(true) },
                    { icon: "⚡", label: "Nudge", run: () => void sendNudge() },
                    { icon: "🗣️", label: "Voice type", run: () => toggleDictation() },
                    { icon: "⏳", label: "Disappear", run: () => setTtlMenuOpen(true) },
                    { icon: "🏷️", label: "Intent", run: () => setIntentMenuOpen(true) }
                  ].map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => {
                        setToolsOpen(false);
                        t.run();
                      }}
                      className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-3 text-[11px] text-white/80 transition hover:bg-white/10 hover:text-white"
                    >
                      <span aria-hidden className="text-xl leading-none">{t.icon}</span>
                      <span className="text-center leading-tight">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Composer popups — opened from the 🧰 Tools sheet. Rendered at the
              composer root (not tied to a toolbar button) so they always sit
              on-screen. One shows at a time. */}
          <div className="relative">
            {showGif && (
              <GifPicker
                onPick={(url) => {
                  void supabase.from("messages").insert({
                    sender_id: currentUserId,
                    room_id: roomId,
                    content: null,
                    image_url: url,
                    reply_to_id: replyTo?.id ?? null,
                    intent: intentChoice,
                    type: "image"
                  }).then(({ error: err }) => {
                    if (err) setError(err.message);
                    else { setReplyTo(null); setIntentChoice(null); }
                  });
                  setShowGif(false);
                }}
                onClose={() => setShowGif(false)}
              />
            )}
            {showStickers && (
              <StickerPicker
                onPickImage={(url) => {
                  void supabase.from("messages").insert({
                    sender_id: currentUserId,
                    room_id: roomId,
                    content: null,
                    image_url: url + "#sticker",
                    reply_to_id: replyTo?.id ?? null,
                    intent: intentChoice,
                    type: "image"
                  }).then(({ error: err }) => {
                    if (err) setError(err.message);
                    else { setReplyTo(null); setIntentChoice(null); void catchUpRef.current(); }
                  });
                  setShowStickers(false);
                }}
                onPick={(s) => { insertAtCursor(s); setShowStickers(false); }}
                onClose={() => setShowStickers(false)}
              />
            )}
            {showLines && (
              <LinesPicker
                onPick={(line) => { insertAtCursor(line); setShowLines(false); }}
                onClose={() => setShowLines(false)}
              />
            )}
            {showVoice && (
              <VoiceRecorder
                onSend={(blob, ms) => void sendVoice(blob, ms)}
                onClose={() => setShowVoice(false)}
              />
            )}
            {showVideo && (
              <VideoRecorder
                onPostToChat={(blob, ms, cap) => void sendVideoToChat(blob, ms, cap)}
                onPostToShort={(blob, isPublic, cap) => void postVideoToShort(blob, isPublic, cap)}
                onPostToBoth={(blob, ms, isPublic, cap) => void postVideoToBoth(blob, ms, isPublic, cap)}
                onClose={() => setShowVideo(false)}
                busy={uploading}
              />
            )}
            {intentMenuOpen && (
              <div className="fixed inset-x-3 bottom-24 z-[60] mx-auto w-auto max-w-[300px] rounded-xl border border-white/10 bg-ink-800/95 p-1.5 shadow-xl backdrop-blur sm:absolute sm:inset-x-auto sm:bottom-12 sm:left-0 sm:mx-0 sm:w-52">
                <div className="flex items-center justify-between px-2 pb-1">
                  <p className="text-[10px] uppercase tracking-widest text-white/40">Intent</p>
                  <button
                    type="button"
                    onClick={() => setIntentMenuOpen(false)}
                    aria-label="Close"
                    className="rounded-md border border-white/10 bg-white/5 px-1.5 text-[10px] text-white/60 hover:bg-white/10"
                  >
                    ✕
                  </button>
                </div>
                {INTENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setIntentChoice((cur) => (cur === opt.value ? null : opt.value));
                      setIntentMenuOpen(false);
                    }}
                    className={clsx(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/10",
                      intentChoice === opt.value && "bg-neon-blue/10 text-neon-blue"
                    )}
                  >
                    <span aria-hidden>{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
                {intentChoice && (
                  <button
                    type="button"
                    onClick={() => { setIntentChoice(null); setIntentMenuOpen(false); }}
                    className="mt-1 w-full rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/60 hover:bg-white/10"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
            {ttlMenuOpen && (
              <div className="fixed inset-x-3 bottom-24 z-[60] mx-auto w-auto max-w-[260px] rounded-xl border border-white/10 bg-ink-800/95 p-1.5 shadow-xl backdrop-blur sm:absolute sm:inset-x-auto sm:bottom-12 sm:left-0 sm:mx-0 sm:w-44">
                <p className="px-2 pb-1 text-[10px] uppercase tracking-widest text-white/40">Disappear after</p>
                {[
                  { label: "Off", v: null },
                  { label: "30 seconds", v: 30 },
                  { label: "1 minute", v: 60 },
                  { label: "5 minutes", v: 300 },
                  { label: "1 hour", v: 3600 },
                  { label: "24 hours", v: 86400 },
                  { label: "7 days", v: 604800 }
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => { setDisappearTtlSec(opt.v); setTtlMenuOpen(false); }}
                    className={clsx(
                      "block w-full rounded-md px-2 py-1 text-left text-xs hover:bg-white/10",
                      disappearTtlSec === opt.v ? "bg-neon-amber/15 text-neon-amber" : "text-white/85"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Row 2 — the full-width message box + Send, under the tags. */}
          <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={`Say something, @${currentUsername}… (paste images too)`}
            rows={2}
            maxLength={2000}
            className="max-h-44 min-h-[52px] w-full flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/60"
          />
          <Button onClick={() => void sendText()} disabled={sending || uploading || !draft.trim()}>
            {sending ? "…" : "Send"}
          </Button>
          </div>
        </div>
        <p className="mt-1.5 hidden px-1 text-[10px] text-white/30 sm:block">
          Enter to send · Shift+Enter for newline · 📎 image · 📁 file · 🎤 voice-type · 🎙 voice note · 😊 emoji · GIF · ⏳ disappear ·{" "}
          <code className="rounded bg-white/5 px-1 text-white/40">
            /poll q | a | b
          </code>{" "}
          ·{" "}
          <code className="rounded bg-white/5 px-1 text-white/40">@karo …</code>
          {disappearTtlSec !== null && (
            <span className="ml-1 text-neon-amber">
              · this message disappears after {formatTtl(disappearTtlSec)}
            </span>
          )}
        </p>
      </div>

      {threadParentId && (
        <ThreadPanel
          parentId={threadParentId}
          messages={messages}
          currentUserId={currentUserId}
          roomId={roomId}
          onClose={() => setThreadParentId(null)}
        />
      )}

      {reportTarget && (
        <ReportModal
          target={reportTarget}
          onClose={() => setReportTarget(null)}
        />
      )}

      {forwardSource && (
        <ForwardModal
          source={forwardSource}
          currentUserId={currentUserId}
          onClose={() => setForwardSource(null)}
        />
      )}

      {widgetCallMode && (
        <CallPanel
          roomId={roomId}
          roomName={roomName}
          mode={widgetCallMode}
          isOwner={!!isOwner}
          inviteCode={roomInviteCode ?? null}
          onClose={() => setWidgetCallMode(null)}
        />
      )}

      {flaggedCat !== null && (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFlaggedCat(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="surface-glass my-auto w-[min(460px,94vw)] border border-neon-red/50 bg-neon-red/[0.08] p-5"
          >
            <p className="font-display text-base font-semibold text-neon-red">
              🚫 Blocked — hard line crossed
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/90">
              {flagWarning(flaggedCat)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/55">
              If this was a mistake or you were discussing this for support /
              awareness, edit your message and send again. See the{" "}
              <Link href="/charter" className="underline hover:text-white">
                People&apos;s Charter
              </Link>
              .
            </p>
            <button
              type="button"
              onClick={() => setFlaggedCat(null)}
              className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 hover:bg-white/10"
            >
              I understand
            </button>
          </div>
        </div>
      )}

      {fourLinesWarning !== null && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFourLinesWarning(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="surface-glass tint-amber my-auto w-[min(440px,94vw)] p-5"
          >
            <p className="font-display text-base font-semibold text-white">
              Heads up.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/85">
              Karochat doesn&apos;t moderate vibes, but calls for violence,
              terrorism, and organized hate are one of our{" "}
              <Link href="/charter" className="underline hover:text-white">
                four lines
              </Link>
              . If you mean it, this gets reported and you&apos;ll be banned.
              If you didn&apos;t mean it that way, you&apos;re fine. Carry on.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setFourLinesWarning(null)}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    window.sessionStorage.setItem("karochat:4lines-acked", "1");
                  } catch {
                    // ignore
                  }
                  setFourLinesWarning(null);
                  void sendText();
                }}
                className="flex-1 rounded-lg bg-neon-amber/90 px-3 py-2 text-sm font-medium text-ink-900 hover:bg-neon-amber"
              >
                Carry on
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function MessageBubble({
  m,
  prev,
  allMessages,
  currentUserId,
  currentUsername,
  roomId,
  roomName,
  roomInviteCode,
  highlight,
  readers,
  now,
  isOwner,
  onAuthorNavigate,
  onOpenDm,
  isEditing,
  editingDraft,
  onEditDraft,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onRegret,
  onPollVote,
  onReply,
  onReact,
  onJump,
  onOpenThread,
  onReport,
  onPin,
  onUnpin,
  onForward,
  autoTranslate,
  registerRef
}: {
  m: MessageRow;
  prev?: MessageRow;
  allMessages: MessageRow[];
  currentUserId: string;
  currentUsername: string;
  roomId: string;
  roomName: string;
  roomInviteCode: string | null;
  highlight: string | null;
  readers: string[];
  now: number;
  isOwner: boolean;
  onAuthorNavigate: (roomId: string) => void;
  onOpenDm: (targetId: string) => void;
  isEditing: boolean;
  editingDraft: string | null;
  onEditDraft: (content: string) => void;
  onStartEdit: (m: MessageRow) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onRegret: (id: string) => void | Promise<void>;
  onPollVote: (id: string, optionIndex: number) => void | Promise<void>;
  onReply: (m: MessageRow) => void;
  onReact: (id: string, emoji: string) => void | Promise<void>;
  onJump: (id: string) => void;
  onOpenThread: (parentId: string) => void;
  onReport: (
    t:
      | { kind: "message"; id: string; preview: string }
      | { kind: "user"; id: string; preview: string }
  ) => void;
  onPin: (id: string) => void;
  onUnpin: (id: string) => void;
  onForward: (m: MessageRow) => void;
  autoTranslate: string | null;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);
  // On touch devices there's no hover, so the action bar (delete/edit/react…)
  // was unreachable. A tap on the bubble toggles it open on mobile.
  const [showActions, setShowActions] = useState(false);
  const [showAuthorMenu, setShowAuthorMenu] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState<{ lang: string; text: string } | null>(null);
  const [translateError, setTranslateError] = useState<string | null>(null);

  async function runTranslate(target: string) {
    if (!m.content) return;
    setTranslating(true);
    setTranslateError(null);
    try {
      const r = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: m.content, target })
      });
      const data = await r.json();
      if (!r.ok || !data?.translated) {
        setTranslateError(data?.error ?? "Could not translate.");
      } else {
        setTranslation({ lang: target, text: String(data.translated) });
      }
    } catch (e: any) {
      setTranslateError(e?.message ?? "Network error.");
    } finally {
      setTranslating(false);
      setShowTranslate(false);
    }
  }

  // Polylingual auto-translate (Wave 15). If the viewer set
  // `auto_translate_to`, kick off a background translation for foreign
  // messages on first render. Skips: own messages, empty text, short pings,
  // already-translated, or messages that look like they're already mostly in
  // the target script (rough heuristic — the /api route handles "same
  // language → return as-is").
  useEffect(() => {
    if (!autoTranslate) return;
    if (!m.content) return;
    if (m.sender_id === currentUserId) return;
    if (translation || translateError || translating) return;
    if (m.content.trim().length < 4) return;
    let cancelled = false;
    (async () => {
      try {
        setTranslating(true);
        const r = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: m.content, target: autoTranslate })
        });
        if (cancelled) return;
        const data = await r.json();
        if (!r.ok || !data?.translated) {
          // Silent fail on auto — no error chip cluttering every message.
          return;
        }
        // If the translation is identical to source, it was already in target
        // — skip rendering the duplicate "→ xx" panel.
        const same =
          String(data.translated).trim().toLowerCase() ===
          (m.content ?? "").trim().toLowerCase();
        if (!same) {
          setTranslation({ lang: autoTranslate, text: String(data.translated) });
        }
      } catch {
        // ignore — silent on auto path
      } finally {
        if (!cancelled) setTranslating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // We only want this to fire once per message id × target lang combo.
  }, [m.id, autoTranslate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Karo: AI-generated system reply, rendered as a centered card.
  if (m.type === "system" && m.intent === "karo") {
    return (
      <div
        ref={(el) => registerRef(m.id, el)}
        className="flex animate-rise justify-center"
      >
        <div className="w-full max-w-md rounded-2xl border border-neon-mint/35 bg-neon-mint/5 px-3.5 py-2.5 shadow-sm">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-neon-mint">
            <span aria-hidden>✨</span> Karo
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/90">
            {m.content}
          </p>
        </div>
      </div>
    );
  }

  // Nudge: render as a centered system pill.
  if (m.type === "nudge") {
    return (
      <div className="flex animate-rise justify-center">
        <span className="rounded-full border border-neon-red/40 bg-neon-red/10 px-3 py-1 text-xs text-neon-red">
          ⚡ {m.sender_display_name ?? m.sender_username ?? "Someone"} sent a nudge
        </span>
      </div>
    );
  }

  // Poll: centered card with voteable options.
  if (m.type === "poll" && m.poll_data) {
    const data = m.poll_data;
    const totalVotes = data.options.reduce((acc, o) => acc + o.votes.length, 0);
    const myChoice = data.options.findIndex((o) => o.votes.includes(currentUserId));
    return (
      <div
        ref={(el) => registerRef(m.id, el)}
        className="flex animate-rise justify-center"
      >
        <div className="w-full max-w-md rounded-2xl border border-neon-purple/30 bg-white/5 p-3.5 shadow-sm">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] uppercase tracking-widest text-neon-purple">
              📊 Poll · {m.sender_display_name ?? m.sender_username ?? "someone"}
            </p>
            <p className="text-[10px] text-white/40">
              {totalVotes} vote{totalVotes === 1 ? "" : "s"}
            </p>
          </div>
          <p className="mt-1.5 text-sm font-medium text-white">{data.question}</p>
          <ul className="mt-2 space-y-1.5">
            {data.options.map((opt, i) => {
              const count = opt.votes.length;
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              const isMine = myChoice === i;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => void onPollVote(m.id, i)}
                    aria-pressed={isMine}
                    className={clsx(
                      "relative w-full overflow-hidden rounded-lg border px-3 py-1.5 text-left text-sm transition",
                      isMine
                        ? "border-neon-purple/60 bg-neon-purple/15 text-white"
                        : "border-white/10 bg-black/20 text-white/85 hover:bg-white/10"
                    )}
                  >
                    <span
                      aria-hidden
                      className={clsx(
                        "absolute inset-y-0 left-0 transition-[width]",
                        isMine ? "bg-neon-purple/25" : "bg-white/10"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                    <span className="relative flex items-center justify-between gap-2">
                      <span className="truncate">{opt.text}</span>
                      <span className="shrink-0 font-mono text-[11px] text-white/60">
                        {count} · {pct}%
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[10px] text-white/30">
            Tap an option to vote · tap again to clear · everyone sees who voted what.
          </p>
        </div>
      </div>
    );
  }

  const mine = m.sender_id === currentUserId;
  const showAuthor = !prev || prev.sender_id !== m.sender_id || prev.type === "nudge";
  const replyTarget = m.reply_to_id ? allMessages.find((x) => x.id === m.reply_to_id) : null;
  const isDeleted = !!m.deleted_at;
  const canEdit =
    mine && !isDeleted && Date.now() - new Date(m.created_at).getTime() < EDIT_WINDOW_MS;

  // Per-user bubble colour — sender_username is the most stable visible seed;
  // fall back to sender_id (a UUID) so the colour is still deterministic.
  const bubbleHue = userHue(m.sender_username ?? m.sender_id);
  const bubbleStyle: React.CSSProperties = mine
    ? {
        background: `hsl(${bubbleHue}, 72%, 58%)`,
        color: "rgb(10 10 12)",
        borderColor: `hsl(${bubbleHue}, 80%, 70%)`
      }
    : {
        background: `hsl(${bubbleHue}, 48%, 18%)`,
        color: "rgb(245 245 247)",
        borderColor: `hsl(${bubbleHue}, 65%, 42%)`
      };
  const editedColor = mine ? "rgba(10,10,12,0.6)" : "rgba(245,245,247,0.5)";

  return (
    <div
      ref={(el) => registerRef(m.id, el)}
      className={clsx("group flex animate-rise flex-col", mine ? "items-end" : "items-start")}
    >
      {showAuthor && !mine && (
        <div className="relative mb-1 ml-2">
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onOpenDm(m.sender_id)}
              title={`Message ${m.sender_display_name ?? m.sender_username ?? "this person"}`}
              className="flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[11px] text-white/40 hover:bg-white/5 hover:text-white/70"
            >
              <PresenceDot state={m.sender_presence_state ?? "offline"} pulse />
              <span className="text-white/70">
                {m.sender_display_name ?? m.sender_username ?? "Someone"}
              </span>
              <span className="text-white/25">@{m.sender_username ?? "anon"}</span>
              {m.sender_is_guest && (
                <span className="rounded-sm bg-white/10 px-1 text-[9px] uppercase tracking-widest text-white/50">
                  guest
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowAuthorMenu((s) => !s)}
              aria-haspopup="menu"
              aria-expanded={showAuthorMenu}
              title={`More actions for @${m.sender_username ?? "anon"}`}
              className="rounded-md px-1 py-0.5 text-[11px] text-white/30 hover:bg-white/5 hover:text-white/70"
            >
              ⋯
            </button>
          </span>
          {showAuthorMenu && (
            <MemberActionPopover
              target={{
                user_id: m.sender_id,
                username: m.sender_username,
                display_name: m.sender_display_name
              }}
              roomId={roomId}
              roomInviteCode={roomInviteCode}
              canModerate={isOwner && m.sender_id !== currentUserId}
              onClose={() => setShowAuthorMenu(false)}
              onNavigate={(dest) => {
                setShowAuthorMenu(false);
                onAuthorNavigate(dest);
              }}
              align="left"
            />
          )}
        </div>
      )}

      {replyTarget && (
        <button
          onClick={() => onJump(replyTarget.id)}
          className={clsx(
            "mb-1 max-w-[78%] truncate rounded-lg border-l-2 px-2 py-1 text-left text-[11px]",
            mine
              ? "border-neon-blue/60 bg-white/5 text-white/60"
              : "border-white/30 bg-white/5 text-white/60"
          )}
        >
          ↪{" "}
          <span className="text-white/80">
            {replyTarget.sender_display_name ?? replyTarget.sender_username ?? "someone"}
          </span>
          : {replyTarget.deleted_at
            ? "deleted message"
            : replyTarget.image_url && !replyTarget.content
            ? "📷 image"
            : replyTarget.content?.slice(0, 80) ?? "…"}
        </button>
      )}

      <div
        className={clsx(
          "group/bubble relative w-fit max-w-[78%] min-w-0",
          mine ? "self-end" : "self-start"
        )}
      >
        {/* Mobile actions toggle — no hover on touch, so a tap reveals the bar.
            Hidden on sm+ where hover handles it. */}
        {!isDeleted && !isEditing && (
          <button
            type="button"
            onClick={() => setShowActions((s) => !s)}
            aria-label="Message actions"
            className={clsx(
              "absolute -top-3 z-20 grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-ink-800/95 text-[11px] text-white/70 shadow sm:hidden",
              mine ? "right-0" : "left-0"
            )}
          >
            ⋯
          </button>
        )}
        {/* Actions row — shown on hover (desktop) or after a tap (mobile). */}
        {!isDeleted && !isEditing && (
          <div
            className={clsx(
              "absolute -top-7 z-10 gap-0.5 rounded-lg border border-white/10 bg-ink-800/95 px-1 py-0.5 shadow-lg backdrop-blur",
              "pointer-events-none hidden group-hover/bubble:flex group-hover/bubble:pointer-events-auto",
              showActions && "!flex !pointer-events-auto",
              mine ? "right-0" : "left-0"
            )}
          >
            <button
              onClick={() => setShowReactionPicker((s) => !s)}
              className="rounded px-1.5 py-0.5 text-xs hover:bg-white/10"
              aria-label="React"
              title="React"
            >
              😊
            </button>
            <button
              onClick={() => onReply(m)}
              className="rounded px-1.5 py-0.5 text-xs hover:bg-white/10"
              aria-label="Reply"
              title="Reply"
            >
              ↪
            </button>
            <button
              onClick={() => onOpenThread(m.reply_to_id ?? m.id)}
              className="rounded px-1.5 py-0.5 text-xs hover:bg-white/10"
              aria-label="Open thread"
              title="Open thread"
            >
              🧵
            </button>
            {m.content && (
              <button
                onClick={() => setShowTranslate((s) => !s)}
                className="rounded px-1.5 py-0.5 text-xs hover:bg-white/10"
                aria-label="Translate"
                title="Translate"
              >
                🌐
              </button>
            )}
            {m.content && (
              <button
                onClick={() => setShowShareCard(true)}
                className="rounded px-1.5 py-0.5 text-xs hover:bg-white/10"
                aria-label="Share as card"
                title="Share as card"
              >
                📤
              </button>
            )}
            <button
              onClick={() => onForward(m)}
              className="rounded px-1.5 py-0.5 text-xs hover:bg-white/10"
              aria-label="Forward to another room"
              title="Forward to another room"
            >
              ↗
            </button>
            {(mine || isOwner) && (
              <button
                onClick={() => (m.pinned_at ? onUnpin(m.id) : onPin(m.id))}
                className="rounded px-1.5 py-0.5 text-xs hover:bg-white/10"
                aria-label={m.pinned_at ? "Unpin" : "Pin"}
                title={m.pinned_at ? "Unpin message" : "Pin message to top"}
              >
                {m.pinned_at ? "📍" : "📌"}
              </button>
            )}
            {canEdit && m.content && (
              <button
                onClick={() => onStartEdit(m)}
                className="rounded px-1.5 py-0.5 text-xs hover:bg-white/10"
                aria-label="Edit"
                title="Edit"
              >
                ✎
              </button>
            )}
            {mine && !m.regretted_at && (
              <button
                onClick={() => void onRegret(m.id)}
                className="rounded px-1.5 py-0.5 text-xs hover:bg-white/10"
                aria-label="Mark as regretted"
                title="I wish I'd phrased this differently"
              >
                😔
              </button>
            )}
            {!mine && (
              <button
                onClick={() =>
                  onReport({
                    kind: "message",
                    id: m.id,
                    preview: (m.content ?? "").slice(0, 80) || "(image / media)"
                  })
                }
                className="rounded px-1.5 py-0.5 text-xs text-neon-red/80 hover:bg-neon-red/10 hover:text-neon-red"
                aria-label="Report"
                title="Report"
              >
                🚩
              </button>
            )}
            {mine && (
              <button
                onClick={() => onDelete(m.id)}
                className="rounded px-1.5 py-0.5 text-xs text-neon-red hover:bg-neon-red/10"
                aria-label="Delete"
                title="Delete"
              >
                🗑
              </button>
            )}
          </div>
        )}

        {showReactionPicker && !isDeleted && (
          <div
            className={clsx(
              "absolute -top-12 z-20 flex items-center gap-1 rounded-full border border-white/10 bg-ink-800/95 px-2 py-1 shadow-lg backdrop-blur",
              mine ? "right-0" : "left-0"
            )}
          >
            {REACTION_PALETTE.map((e) => (
              <button
                key={e}
                onClick={() => {
                  void onReact(m.id, e);
                  setShowReactionPicker(false);
                }}
                className="rounded p-1 text-base hover:bg-white/10"
                aria-label={`React ${e}`}
              >
                {e}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowReactionPicker(false)}
              aria-label="Close reaction picker"
              title="Close"
              className="ml-1 rounded-full border border-white/10 bg-white/5 px-1.5 text-[10px] text-white/60 hover:bg-white/10"
            >
              ✕
            </button>
          </div>
        )}

        {showTranslate && !isDeleted && m.content && (
          <div
            className={clsx(
              "absolute -top-12 z-20 max-h-44 w-44 overflow-y-auto rounded-xl border border-white/10 bg-ink-800/95 p-1.5 shadow-lg backdrop-blur",
              mine ? "right-0" : "left-0"
            )}
          >
            <div className="flex items-center justify-between px-1.5 pb-1">
              <p className="text-[10px] uppercase tracking-widest text-white/40">
                Translate to
              </p>
              <button
                type="button"
                onClick={() => setShowTranslate(false)}
                aria-label="Close translate picker"
                title="Close"
                className="rounded-md border border-white/10 bg-white/5 px-1.5 text-[10px] text-white/60 hover:bg-white/10"
              >
                ✕
              </button>
            </div>
            {TRANSLATE_LANGS.map((lang) => (
              <button
                key={lang}
                onClick={() => void runTranslate(lang)}
                className="block w-full rounded-md px-1.5 py-1 text-left text-xs text-white/85 hover:bg-white/10"
              >
                {lang}
              </button>
            ))}
          </div>
        )}

        {isDeleted ? (
          <p
            className={clsx(
              "rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs italic text-white/40",
              mine ? "rounded-br-sm" : "rounded-bl-sm"
            )}
          >
            this message was deleted
          </p>
        ) : isEditing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={editingDraft ?? ""}
              onChange={(e) => onEditDraft(e.target.value)}
              maxLength={2000}
              rows={2}
              className="min-w-[260px] rounded-xl border border-neon-blue/60 bg-black/40 px-3 py-2 text-sm outline-none"
              autoFocus
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={onCancelEdit}
                className="rounded border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => void onSaveEdit()}
                className="rounded bg-neon-blue px-2 py-1 text-ink-900 hover:bg-neon-blue/90"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            {m.audio_url && (
              <div
                className={clsx(
                  "mb-1 rounded-2xl border border-neon-purple/30 bg-neon-purple/10 px-2.5 py-1.5",
                  mine ? "rounded-br-sm" : "rounded-bl-sm"
                )}
              >
                <audio
                  controls
                  controlsList="nodownload noplaybackrate"
                  src={m.audio_url}
                  preload="metadata"
                  className="h-9 w-full max-w-[260px]"
                  aria-label="Voice message"
                />
                {m.duration_ms ? (
                  <p className="mt-0.5 text-[10px] text-white/55">
                    🎙 voice · {(Math.round(m.duration_ms / 100) / 10).toFixed(1)}s
                  </p>
                ) : (
                  <p className="mt-0.5 text-[10px] text-white/55">🎙 voice message</p>
                )}
              </div>
            )}
            {m.image_url &&
              (() => {
                // Stickers (tagged with an inert #sticker fragment at send
                // time) render compact and borderless; photos/GIFs keep the
                // original full-size bubble.
                const isSticker = m.image_url.includes("#sticker");
                return (
                  <a
                    href={m.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className={clsx(
                      "mb-1 block overflow-hidden",
                      !isSticker && "rounded-2xl border border-white/10",
                      !isSticker && (mine ? "rounded-br-sm" : "rounded-bl-sm")
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.image_url}
                      alt={m.content ?? (isSticker ? "sticker" : "shared image")}
                      className={
                        isSticker
                          ? "h-24 w-auto max-w-[45vw] object-contain sm:h-28"
                          : "max-h-80 w-auto max-w-[78vw] md:max-w-sm"
                      }
                      loading="lazy"
                    />
                  </a>
                );
              })()}
            {m.file_url && <FileCard message={m} mine={mine} />}
            {m.content && (
              <>
                <div
                  className={clsx(
                    "whitespace-pre-wrap break-words rounded-2xl border px-3.5 py-2 text-sm shadow-sm",
                    mine ? "rounded-br-sm" : "rounded-bl-sm"
                  )}
                  style={bubbleStyle}
                >
                  {m.intent && (() => {
                    const opt = INTENT_OPTIONS.find((i) => i.value === m.intent);
                    return (
                      <span
                        className={clsx(
                          "mr-1.5 inline-block rounded-sm px-1 text-[10px] uppercase tracking-widest",
                          mine ? "bg-ink-900/15 text-ink-900/80" : "bg-white/10 text-white/60"
                        )}
                        title={`Intent: ${opt?.label ?? m.intent}`}
                      >
                        {opt?.emoji ?? "·"} {opt?.label ?? m.intent}
                      </span>
                    );
                  })()}
                  {highlight ? highlightText(m.content, highlight) : m.content}
                  {m.edited_at && (
                    <span
                      className="ml-1.5 text-[10px]"
                      style={{ color: editedColor }}
                    >
                      (edited)
                    </span>
                  )}
                </div>
                {(() => {
                  // Wave 19.5 — auto-embed YouTube / Spotify URLs.
                  const media = detectMedia(m.content);
                  return media ? <MediaEmbed media={media} /> : null;
                })()}
                {m.regretted_at && (
                  <p
                    className={clsx(
                      "mt-1 rounded-xl border border-dashed border-neon-amber/40 bg-neon-amber/5 px-3 py-1 text-[11px] italic",
                      mine ? "self-end text-neon-amber/90" : "text-neon-amber/90"
                    )}
                  >
                    😔 the sender wishes they'd phrased this differently
                  </p>
                )}
                {(translating || translation || translateError) && (
                  <div
                    className={clsx(
                      "mt-1 whitespace-pre-wrap break-words rounded-xl border border-dashed px-3 py-1.5 text-[12px]",
                      mine
                        ? "border-neon-blue/40 bg-neon-blue/5 text-white/80"
                        : "border-white/20 bg-white/[0.03] text-white/80"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] uppercase tracking-widest text-white/40">
                        {translating
                          ? "Translating…"
                          : translation
                          ? `→ ${translation.lang}`
                          : "Translate"}
                      </span>
                      {(translation || translateError) && (
                        <button
                          onClick={() => {
                            setTranslation(null);
                            setTranslateError(null);
                          }}
                          className="text-[10px] text-white/40 hover:text-white/70"
                          aria-label="Dismiss translation"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {translation && <p className="mt-0.5">{translation.text}</p>}
                    {translateError && (
                      <p className="mt-0.5 text-neon-red">{translateError}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {!isDeleted && m.reactions && Object.keys(m.reactions).length > 0 && (
        <div className={clsx("mt-1 flex flex-wrap gap-1", mine ? "justify-end" : "")}>
          {Object.entries(m.reactions).map(([emoji, ids]) => {
            const minePicked = ids.includes(currentUserId);
            return (
              <button
                key={emoji}
                onClick={() => onReact(m.id, emoji)}
                className={clsx(
                  "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition",
                  minePicked
                    ? "border-neon-blue/60 bg-neon-blue/15 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                )}
                aria-pressed={minePicked}
              >
                <span>{emoji}</span>
                <span className="text-[10px]">{ids.length}</span>
              </button>
            );
          })}
        </div>
      )}

      <p className={clsx(
        "mt-1 flex flex-wrap items-center gap-1.5 px-1 text-[10px] text-white/30",
        mine ? "justify-end" : "justify-start"
      )}>
        <span>{formatTime(m.created_at)}</span>
        {m.pinned_at && (
          <span
            className="rounded-sm bg-neon-blue/15 px-1 text-neon-blue"
            title="Pinned in this room"
          >
            📌 pinned
          </span>
        )}
        {m.forwarded_from_id && (
          <span className="rounded-sm bg-white/5 px-1 text-white/50" title="Forwarded">
            ↗ forwarded
          </span>
        )}
        {m.expires_at && (() => {
          const remaining = new Date(m.expires_at).getTime() - now;
          if (remaining <= 0) return null;
          const secs = Math.max(1, Math.round(remaining / 1000));
          return (
            <span
              className="rounded-sm bg-neon-amber/15 px-1 text-neon-amber"
              title="Self-destructs"
            >
              ⏳ {formatTtl(secs)}
            </span>
          );
        })()}
        {mine && readers.length > 0 && (
          <span
            className="rounded-sm bg-white/5 px-1 text-white/55"
            title={`Seen by ${readers.length} other ${
              readers.length === 1 ? "person" : "people"
            }`}
          >
            ✓✓ {readers.length}
          </span>
        )}
      </p>

      {showShareCard && m.content && !isDeleted && (
        <QuoteCard
          authorName={m.sender_display_name ?? m.sender_username ?? "Someone"}
          authorHandle={m.sender_username ?? "anon"}
          content={m.content}
          roomName={roomName}
          createdAt={m.created_at}
          onClose={() => setShowShareCard(false)}
        />
      )}
    </div>
  );
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatTtl(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(content: string | null, needle: string): React.ReactNode {
  if (!content) return content;
  const trimmed = needle.trim();
  if (!trimmed) return content;
  try {
    const re = new RegExp(`(${escapeRegex(trimmed)})`, "ig");
    const parts = content.split(re);
    return parts.map((part, i) =>
      part.toLowerCase() === trimmed.toLowerCase() ? (
        <mark
          key={i}
          className="rounded-sm bg-neon-amber/40 px-0.5 text-current"
        >
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  } catch {
    return content;
  }
}

// ---------------------------------------------------------------------------
// ThreadPanel (Wave 15) — side panel showing every reply to a parent message.
// Uses existing reply_to_id chain. Replies posted from here re-use the
// messages insert path; realtime broadcasts pick them up in the main feed.
// ---------------------------------------------------------------------------
function ThreadPanel({
  parentId,
  messages,
  currentUserId,
  roomId,
  onClose
}: {
  parentId: string;
  messages: MessageRow[];
  currentUserId: string;
  roomId: string;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const parent = messages.find((m) => m.id === parentId) ?? null;
  // A "thread" = the parent message + every message replying to it.
  // (We keep it one level deep — Slack-style — to avoid recursion overload.)
  const replies = messages.filter((m) => m.reply_to_id === parentId);

  async function postReply() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setErr(null);
    const { error } = await supabase.from("messages").insert({
      sender_id: currentUserId,
      room_id: roomId,
      content: text,
      reply_to_id: parentId,
      type: "text"
    });
    setSending(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setDraft("");
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-label="Thread"
        className="surface-glass flex h-full w-full max-w-md flex-col border-l border-white/10"
      >
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-xs uppercase tracking-widest text-white/55">
            🧵 Thread · {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close thread"
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {parent ? (
            <div className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2">
              <p className="text-[11px] text-white/45">
                {parent.sender_display_name ??
                  parent.sender_username ??
                  "someone"}{" "}
                <span className="text-white/30">·</span>{" "}
                <span className="text-white/30">{formatTime(parent.created_at)}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-white/90">
                {parent.deleted_at
                  ? "this message was deleted"
                  : parent.content ?? "(image / media)"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-white/50">Parent message not in view.</p>
          )}

          {replies.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-3 text-center text-xs text-white/40">
              No replies yet. Start the thread.
            </p>
          ) : (
            replies.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2"
              >
                <p className="text-[11px] text-white/45">
                  {r.sender_display_name ?? r.sender_username ?? "someone"}{" "}
                  <span className="text-white/30">·</span>{" "}
                  <span className="text-white/30">{formatTime(r.created_at)}</span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-white/90">
                  {r.deleted_at
                    ? "this message was deleted"
                    : r.content ?? "(image / media)"}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-white/10 p-3">
          {err && <p className="mb-2 text-xs text-neon-red">{err}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void postReply();
                }
              }}
              placeholder="Reply in thread…"
              rows={2}
              className="flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/50"
            />
            <button
              type="button"
              onClick={() => void postReply()}
              disabled={!draft.trim() || sending}
              className="rounded-xl bg-neon-blue px-3 py-2 text-sm font-medium text-ink-900 hover:bg-neon-blue/90 disabled:opacity-50"
            >
              {sending ? "…" : "Send"}
            </button>
          </div>
          <p className="mt-1 text-[10px] text-white/35">
            Replies post to the main room too — threads just give them a quiet
            home.
          </p>
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReportModal (Wave 15) — minimal report flow. Category-picker + optional
// note. Calls create_report RPC which auto-prioritises minor/ncii to 100.
// ---------------------------------------------------------------------------
const REPORT_CATEGORIES: { value: string; label: string; hint: string }[] = [
  { value: "minor",    label: "A minor is involved",      hint: "Anyone under 18, anywhere in the world." },
  { value: "ncii",     label: "Non-consensual intimate",  hint: "Sexual imagery shared without consent." },
  { value: "doxxing",  label: "Doxxing / private info",   hint: "Real-name / address / phone exposed." },
  { value: "violence", label: "Threat or call to violence", hint: "Specific threat or organized incitement." },
  { value: "hate",     label: "Organized hate",           hint: "Recruitment to hate groups / dehumanizing." },
  { value: "spam",     label: "Spam or scam",             hint: "Mass-posting / phishing / impersonation." },
  { value: "other",    label: "Something else",           hint: "Tell us in the note." }
];

function ReportModal({
  target,
  onClose
}: {
  target:
    | { kind: "message"; id: string; preview: string }
    | { kind: "user"; id: string; preview: string };
  onClose: () => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [category, setCategory] = useState<string>("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!category || sending) return;
    setSending(true);
    setErr(null);
    const { error } = await supabase.rpc("create_report", {
      p_target_kind: target.kind,
      p_target_id: target.id,
      p_category: category,
      p_body: body.trim() || null
    });
    setSending(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setDone(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="surface-glass tint-red my-auto w-[min(480px,94vw)] p-5"
      >
        <div className="flex items-center justify-between">
          <p className="font-display text-base font-semibold text-white">
            🚩 Report this {target.kind}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {done ? (
          <>
            <p className="mt-3 text-sm text-white/85">
              Got it. Reports involving minors or NCII jump our queue
              immediately. Thank you for keeping Karochat safe.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-neon-blue px-4 py-2 text-sm font-medium text-ink-900 hover:bg-neon-blue/90"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            {target.preview && (
              <p className="mt-2 max-h-20 overflow-y-auto rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[12px] italic text-white/55">
                &ldquo;{target.preview}&rdquo;
              </p>
            )}

            <p className="mt-3 text-[11px] uppercase tracking-widest text-white/40">
              What&apos;s wrong?
            </p>
            <div className="mt-2 space-y-1.5">
              {REPORT_CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <button
                    type="button"
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className={clsx(
                      "block w-full rounded-lg border px-3 py-2 text-left transition",
                      active
                        ? "border-neon-red/60 bg-neon-red/10 text-white"
                        : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                    )}
                  >
                    <p className="text-sm">{c.label}</p>
                    <p className="text-[11px] text-white/45">{c.hint}</p>
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-[11px] uppercase tracking-widest text-white/40">
              Add context (optional)
            </p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 1000))}
              rows={3}
              placeholder="Anything else our reviewers should know…"
              className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-red/40"
            />
            <p className="mt-0.5 text-right text-[10px] text-white/35">
              {body.length}/1000
            </p>

            {err && <p className="mt-2 text-xs text-neon-red">{err}</p>}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!category || sending}
                className="flex-1 rounded-lg bg-neon-red px-3 py-2 text-sm font-medium text-white hover:bg-neon-red/90 disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
