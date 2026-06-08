"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type NotifyMessage = {
  id: string;
  sender_id: string;
  sender_display_name: string | null;
  sender_username: string | null;
  content: string | null;
  image_url: string | null;
  type: "text" | "image" | "nudge" | "system" | "poll" | "voice" | "file";
  created_at: string;
};

// Stable noop for SSR — Notification is undefined on the server.
const SUPPORTED = typeof window !== "undefined" && "Notification" in window;

export function useBrowserNotificationsPermission() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    SUPPORTED ? Notification.permission : "unsupported"
  );

  const request = useCallback(async () => {
    if (!SUPPORTED) return "unsupported" as const;
    const p = await Notification.requestPermission();
    setPerm(p);
    return p;
  }, []);

  return { perm, request, supported: SUPPORTED };
}

/**
 * Fire a browser notification when a new message arrives in this room *and*
 * the tab isn't focused — so people get pinged when they're not actively here.
 */
export function useNotifyOnNewMessage(
  message: NotifyMessage | null,
  ctx: { roomName: string; roomId: string; currentUserId: string }
) {
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!SUPPORTED) return;
    if (!message) return;
    if (Notification.permission !== "granted") return;
    if (message.sender_id === ctx.currentUserId) return;
    if (seen.current.has(message.id)) return;
    seen.current.add(message.id);

    const tabActive =
      typeof document !== "undefined" && document.visibilityState === "visible";
    if (tabActive && document.hasFocus()) return;

    const author = message.sender_display_name ?? message.sender_username ?? "Someone";
    const title =
      message.type === "nudge"
        ? `⚡ ${author} sent a nudge`
        : `${author} · ${ctx.roomName}`;
    const body =
      message.type === "nudge"
        ? ""
        : message.type === "voice"
        ? "🎙 Voice message"
        : message.type === "file" && !message.content
        ? "📎 Sent a file"
        : message.image_url && !message.content
        ? "📷 Sent an image"
        : (message.content ?? "").slice(0, 140);

    try {
      const n = new Notification(title, {
        body,
        icon: "/icon.svg",
        badge: "/icon.svg",
        tag: `karochat-${ctx.roomId}`
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
      setTimeout(() => n.close(), 8000);
    } catch (err) {
      // Some browsers throw if not in a user gesture context; ignore.
      console.warn("[karochat] notification failed:", err);
    }
  }, [message, ctx.roomName, ctx.roomId, ctx.currentUserId]);
}
