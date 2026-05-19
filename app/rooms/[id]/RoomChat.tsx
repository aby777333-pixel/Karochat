"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

type MessageRow = {
  id: string;
  room_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  sender_username: string | null;
  sender_display_name: string | null;
  sender_is_guest?: boolean | null;
};

type RawMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
};

export function RoomChat({
  roomId,
  currentUserId,
  currentUsername,
  currentDisplayName,
  initialMessages
}: {
  roomId: string;
  currentUserId: string;
  currentUsername: string;
  currentDisplayName: string;
  initialMessages: MessageRow[];
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlineCount, setOnlineCount] = useState(1);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileCache = useRef<Map<string, { username: string; display_name: string }>>(
    new Map()
  );

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
          const m = payload.new as RawMessage;
          const profile = await fetchProfile(m.sender_id);
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [
              ...prev,
              {
                id: m.id,
                room_id: m.room_id,
                sender_id: m.sender_id,
                content: m.content,
                image_url: m.image_url,
                created_at: m.created_at,
                sender_username: profile.username,
                sender_display_name: profile.display_name
              }
            ];
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, roomId, fetchProfile]);

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

  async function sendText() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const { error: insertErr } = await supabase
      .from("messages")
      .insert({ sender_id: currentUserId, room_id: roomId, content: text });
    setSending(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    setDraft("");
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
      image_url: pub.publicUrl
    });
    setUploading(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    setDraft("");
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
  }

  function pickFile() {
    fileInputRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void sendImage(file);
    e.target.value = "";
  }

  return (
    <section className="surface-glass mt-3 flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2 text-xs text-white/50">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-neon-blue opacity-60 animate-pulseDot" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-blue shadow-glow-blue" />
          </span>
          <span>{onlineCount} here now</span>
        </div>
        <span className="font-mono uppercase tracking-widest">realtime</span>
      </div>

      <div ref={scrollerRef} className="scroll-thin flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="mx-auto mt-10 max-w-sm text-center text-sm text-white/40">
            It&apos;s quiet here. Say hi.
          </p>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === currentUserId;
          const prev = messages[i - 1];
          const showAuthor = !prev || prev.sender_id !== m.sender_id;
          return (
            <div
              key={m.id}
              className={clsx(
                "flex animate-rise flex-col",
                mine ? "items-end" : "items-start"
              )}
            >
              {showAuthor && !mine && (
                <p className="mb-1 ml-2 text-[11px] text-white/40">
                  {m.sender_display_name ?? m.sender_username ?? "Someone"}{" "}
                  <span className="text-white/25">
                    @{m.sender_username ?? "anon"}
                  </span>
                  {m.sender_is_guest && (
                    <span className="ml-1 rounded-sm bg-white/10 px-1 text-[9px] uppercase tracking-widest text-white/50">
                      guest
                    </span>
                  )}
                </p>
              )}
              {m.image_url ? (
                <a
                  href={m.image_url}
                  target="_blank"
                  rel="noreferrer"
                  className={clsx(
                    "block overflow-hidden rounded-2xl border border-white/10",
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
              ) : null}
              {m.content && (
                <div
                  className={clsx(
                    "max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                    m.image_url && "mt-1",
                    mine
                      ? "rounded-br-sm bg-neon-blue text-ink-900"
                      : "rounded-bl-sm border border-white/10 bg-white/5 text-white"
                  )}
                >
                  {m.content}
                </div>
              )}
              <p className="mt-1 px-1 text-[10px] text-white/30">
                {formatTime(m.created_at)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/5 p-3">
        {error && <p className="mb-2 text-xs text-neon-red">{error}</p>}
        {uploading && (
          <p className="mb-2 text-xs text-white/50">
            <span className="mr-2 inline-block animate-pulseDot">●</span>Uploading image…
          </p>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={pickFile}
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
          Enter to send · Shift+Enter for newline · 📎 or paste to share images
        </p>
      </div>
    </section>
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
