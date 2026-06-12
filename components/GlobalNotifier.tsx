"use client";

// Karochat — app-wide real-time notifier.
//
// Mounted once in the root layout. Subscribes to message INSERTs
// (Supabase realtime honours RLS, so each user only receives rows from
// rooms they can see) and raises a prominent, clickable alert when:
//   • a direct message arrives          (any page except that DM)
//   • someone @mentions you             (any room, any page)
//   • a nudge lands in one of your DMs
//
// Alert = in-app toast card (tap → open the conversation) + browser
// Notification when the tab is hidden + sound + vibration. Events for
// the room the user is currently reading are left to RoomChat's own
// handlers (shake, inline notification) — no double-firing.

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { playBuzz, playChime } from "@/lib/sounds";

type IncomingMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  type: string;
  mentions: string[] | null;
};

type Toast = {
  key: string;
  roomId: string;
  title: string;
  body: string;
  emoji: string;
};

const MAX_TOASTS = 3;

export function GlobalNotifier() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const meRef = useRef<{ id: string; username: string | null } | null>(null);
  const dmRoomsRef = useRef<Set<string>>(new Set());
  const seenRef = useRef<Set<string>>(new Set());
  const profileCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let alive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function senderName(senderId: string): Promise<string> {
      const cached = profileCacheRef.current.get(senderId);
      if (cached) return cached;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", senderId)
        .maybeSingle();
      const name = data?.display_name ?? data?.username ?? "Someone";
      profileCacheRef.current.set(senderId, name);
      return name;
    }

    function pushToast(t: Toast) {
      setToasts((prev) => [t, ...prev].slice(0, MAX_TOASTS));
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.key !== t.key));
      }, 7000);
    }

    async function handle(m: IncomingMessage) {
      const me = meRef.current;
      if (!me || m.sender_id === me.id) return;
      if (m.type === "system") return;
      if (seenRef.current.has(m.id)) return;
      seenRef.current.add(m.id);
      if (seenRef.current.size > 500) seenRef.current.clear();

      const isDm = dmRoomsRef.current.has(m.room_id);
      const mentioned =
        !!me.username &&
        Array.isArray(m.mentions) &&
        m.mentions.some(
          (u) => u.toLowerCase() === me.username!.toLowerCase()
        );

      // Only DMs, mentions, and DM nudges are global-worthy; busy public
      // rooms would otherwise alert on every line of chatter.
      let kind: "dm" | "mention" | "nudge";
      if (m.type === "nudge" && isDm) kind = "nudge";
      else if (mentioned) kind = "mention";
      else if (isDm) kind = "dm";
      else return;

      // The open room handles its own effects (shake, inline pings).
      const viewingThatRoom =
        typeof window !== "undefined" &&
        window.location.pathname.includes(m.room_id);
      if (viewingThatRoom && document.visibilityState === "visible") return;

      const name = await senderName(m.sender_id);
      const preview =
        m.type === "voice"
          ? "🎙 Voice message"
          : m.image_url && !m.content
            ? "📷 Sent a photo"
            : (m.content ?? "").slice(0, 120);

      const emoji = kind === "nudge" ? "⚡" : kind === "mention" ? "🗣" : "💬";
      const title =
        kind === "nudge"
          ? `${name} sent a nudge`
          : kind === "mention"
            ? `${name} mentioned you`
            : name;
      const body = kind === "nudge" ? "Nudge!" : preview;

      // 1) In-app toast (clickable, prominent, never off-screen).
      pushToast({ key: m.id, roomId: m.room_id, title, body, emoji });

      // 2) Sound + vibration.
      if (kind === "nudge") playBuzz();
      else playChime();
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(kind === "nudge" ? [60, 30, 60, 30, 60] : [80, 40, 80]);
      }

      // 3) Browser notification when the tab is hidden/unfocused.
      try {
        if (
          "Notification" in window &&
          Notification.permission === "granted" &&
          (document.visibilityState !== "visible" || !document.hasFocus())
        ) {
          const n = new Notification(`${emoji} ${title}`, {
            body,
            icon: "/icon.svg",
            badge: "/icon.svg",
            tag: `karochat-global-${m.room_id}`
          });
          n.onclick = () => {
            window.focus();
            window.location.href = `/rooms/${m.room_id}`;
            n.close();
          };
          setTimeout(() => n.close(), 8000);
        }
      } catch {
        // notification construction can throw outside gestures; ignore
      }
    }

    void (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user || !alive) return;

      const [{ data: prof }, { data: dms }] = await Promise.all([
        supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("room_members")
          .select("room_id, rooms!inner(is_dm)")
          .eq("user_id", user.id)
          .eq("rooms.is_dm", true)
      ]);
      if (!alive) return;
      meRef.current = { id: user.id, username: prof?.username ?? null };
      dmRoomsRef.current = new Set(
        ((dms ?? []) as Array<{ room_id: string }>).map((r) => r.room_id)
      );

      channel = supabase
        .channel("global-notify")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            void handle(payload.new as IncomingMessage);
          }
        )
        // New DMs created after mount (e.g. someone opens a DM with you).
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "room_members",
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const roomId = (payload.new as { room_id?: string }).room_id;
            if (!roomId) return;
            void supabase
              .from("rooms")
              .select("is_dm")
              .eq("id", roomId)
              .maybeSingle()
              .then(({ data }) => {
                if (data?.is_dm) dmRoomsRef.current.add(roomId);
              });
          }
        )
        .subscribe();
    })();

    return () => {
      alive = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 top-3 z-[90] mx-auto flex w-auto max-w-[380px] flex-col gap-2 sm:left-auto sm:right-4 sm:mx-0 sm:w-[340px]">
      {toasts.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => {
            setToasts((prev) => prev.filter((x) => x.key !== t.key));
            window.location.href = `/rooms/${t.roomId}`;
          }}
          className="surface-glass pointer-events-auto flex min-w-0 items-start gap-2.5 p-3 text-left shadow-2xl transition hover:border-neon-blue/40"
        >
          <span className="mt-0.5 shrink-0 text-lg" aria-hidden>
            {t.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">
              {t.title}
            </span>
            {t.body && (
              <span className="block truncate text-[12px] text-white/65">
                {t.body}
              </span>
            )}
            <span className="mt-0.5 block text-[10px] uppercase tracking-widest text-neon-blue/80">
              Tap to open
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
