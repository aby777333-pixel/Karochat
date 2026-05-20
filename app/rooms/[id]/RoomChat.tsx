"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";
import { PresenceDot } from "@/components/PresenceDot";
import { usePresenceHeartbeat } from "@/lib/usePresenceHeartbeat";
import { useNotifyOnNewMessage } from "@/lib/useBrowserNotifications";
import { SmartReplies } from "./SmartReplies";
import { MemberActionPopover } from "./MemberActionPopover";
import { QuoteCard } from "./QuoteCard";
import { Soundscape } from "./Soundscape";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const REACTION_PALETTE = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "🙌"];
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
  type: "text" | "image" | "nudge" | "system" | "poll";
  content: string | null;
  image_url: string | null;
  reply_to_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  reactions: Record<string, string[]> | null;
  intent: string | null;
  regretted_at: string | null;
  poll_data: PollData | null;
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
  initialMessages
}: {
  roomId: string;
  roomName: string;
  roomInviteCode?: string | null;
  currentUserId: string;
  currentUsername: string;
  currentDisplayName: string;
  currentPresence: "online" | "away" | "busy" | "invisible" | "offline";
  initialMessages: MessageRow[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
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
  const [fourLinesWarning, setFourLinesWarning] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [lastIncoming, setLastIncoming] = useState<MessageRow | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const profileCache = useRef<Map<string, { username: string; display_name: string }>>(new Map());

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
          const enriched: MessageRow = {
            ...m,
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
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, roomId, fetchProfile]);

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
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.([60, 30, 60, 30, 60]);
    }
    setTimeout(() => setShaking(false), 520);
    setTimeout(() => setPulse(false), 700);
  }

  async function sendText() {
    const text = draft.trim();
    if (!text || sending) return;

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
    const { error: insertErr } = await supabase.from("messages").insert({
      sender_id: currentUserId,
      room_id: roomId,
      content: text,
      reply_to_id: replyTo?.id ?? null,
      intent: intentChoice,
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
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Image is larger than 8 MB.");
      return;
    }
    setUploading(true);
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${currentUserId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("chat-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setError(`Upload failed: ${upErr.message}`);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("chat-images").getPublicUrl(path);
    const caption = draft.trim();
    const { error: insertErr } = await supabase.from("messages").insert({
      sender_id: currentUserId,
      room_id: roomId,
      content: caption || null,
      image_url: pub.publicUrl,
      reply_to_id: replyTo?.id ?? null,
      intent: intentChoice,
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
      className={clsx(
        "surface-glass tint-blue mt-3 flex flex-1 flex-col overflow-hidden transition-[filter,opacity] duration-700",
        shaking && "animate-nudgeShake",
        lightsOut && "[filter:brightness(0.55)_saturate(0.8)]"
      )}
    >
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2 text-xs text-white/50">
        <div className="flex items-center gap-2">
          <PresenceDot state="online" pulse />
          <span>{onlineCount} here now</span>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <Soundscape />
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

      <div
        ref={scrollerRef}
        className="scroll-thin relative flex-1 space-y-3 overflow-y-auto p-4"
      >
        {pulse && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neon-red/40 animate-nudgePulse" />
        )}
        {messages.length === 0 && (
          <p className="mx-auto mt-10 max-w-sm text-center text-sm text-white/40">
            It&apos;s quiet here. Say hi.
          </p>
        )}
        {messages.map((m, i) => (
          <MessageBubble
            key={m.id}
            m={m}
            prev={i > 0 ? messages[i - 1] : undefined}
            allMessages={messages}
            currentUserId={currentUserId}
            currentUsername={currentUsername}
            roomId={roomId}
            roomName={roomName}
            roomInviteCode={roomInviteCode ?? null}
            onAuthorNavigate={(roomDestId) => {
              router.push(`/rooms/${roomDestId}`);
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
            registerRef={(id, el) => {
              if (el) messageRefs.current.set(id, el);
              else messageRefs.current.delete(id);
            }}
          />
        ))}
      </div>

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
        <div className="relative flex items-end gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIntentMenuOpen((s) => !s)}
              aria-label="Set message intent"
              title={
                intentChoice
                  ? `Intent: ${INTENT_OPTIONS.find((i) => i.value === intentChoice)?.label ?? intentChoice}`
                  : "Tag this message with an intent"
              }
              className={clsx(
                "grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-sm transition",
                intentChoice
                  ? "border-neon-blue/60 bg-neon-blue/10 text-neon-blue"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              {intentChoice
                ? INTENT_OPTIONS.find((i) => i.value === intentChoice)?.emoji ?? "·"
                : "·"}
            </button>
            {intentMenuOpen && (
              <div className="absolute bottom-12 left-0 z-20 w-52 rounded-xl border border-white/10 bg-ink-800/95 p-1.5 shadow-xl backdrop-blur">
                <div className="flex items-center justify-between px-2 pb-1">
                  <p className="text-[10px] uppercase tracking-widest text-white/40">
                    Intent
                  </p>
                  <button
                    type="button"
                    onClick={() => setIntentMenuOpen(false)}
                    aria-label="Close"
                    title="Close"
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
                    onClick={() => {
                      setIntentChoice(null);
                      setIntentMenuOpen(false);
                    }}
                    className="mt-1 w-full rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/60 hover:bg-white/10"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Attach image"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="9" cy="9" r="1.5" />
              <path d="m21 15-5-5-9 9" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => void sendNudge()}
            aria-label="Send a nudge"
            title="Send a nudge (Ctrl+Shift+N)"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-neon-red/40 bg-neon-red/10 text-neon-red transition hover:bg-neon-red/20"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={onFile}
          />
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={`Say something, @${currentUsername}… (paste images too)`}
            rows={1}
            maxLength={2000}
            className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/60"
          />
          <Button onClick={() => void sendText()} disabled={sending || uploading || !draft.trim()}>
            {sending ? "…" : "Send"}
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-[10px] text-white/30">
          Enter to send · Shift+Enter for newline · 📎 share · ⚡ nudge · paste images ·{" "}
          <code className="rounded bg-white/5 px-1 text-white/40">
            /poll q | a | b
          </code>{" "}
          ·{" "}
          <code className="rounded bg-white/5 px-1 text-white/40">@karo …</code>
        </p>
      </div>

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
  onAuthorNavigate,
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
  onAuthorNavigate: (roomId: string) => void;
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
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);
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
          <button
            type="button"
            onClick={() => setShowAuthorMenu((s) => !s)}
            aria-haspopup="menu"
            aria-expanded={showAuthorMenu}
            title={`Open actions for @${m.sender_username ?? "anon"}`}
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
          {showAuthorMenu && (
            <MemberActionPopover
              target={{
                user_id: m.sender_id,
                username: m.sender_username,
                display_name: m.sender_display_name
              }}
              roomId={roomId}
              roomInviteCode={roomInviteCode}
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
        {/* Actions row */}
        {!isDeleted && !isEditing && (
          <div
            className={clsx(
              "pointer-events-none absolute -top-7 z-10 hidden gap-0.5 rounded-lg border border-white/10 bg-ink-800/95 px-1 py-0.5 shadow-lg backdrop-blur group-hover/bubble:flex group-hover/bubble:pointer-events-auto",
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
            {m.image_url && (
              <a
                href={m.image_url}
                target="_blank"
                rel="noreferrer"
                className={clsx(
                  "mb-1 block overflow-hidden rounded-2xl border border-white/10",
                  mine ? "rounded-br-sm" : "rounded-bl-sm"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.image_url}
                  alt={m.content ?? "shared image"}
                  className="max-h-80 w-auto max-w-[78vw] md:max-w-sm"
                  loading="lazy"
                />
              </a>
            )}
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
                  {m.content}
                  {m.edited_at && (
                    <span
                      className="ml-1.5 text-[10px]"
                      style={{ color: editedColor }}
                    >
                      (edited)
                    </span>
                  )}
                </div>
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

      <p className="mt-1 px-1 text-[10px] text-white/30">{formatTime(m.created_at)}</p>

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
