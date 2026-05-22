"use client";

import { useState } from "react";
import clsx from "clsx";

/**
 * PinnedStrip — Wave 18.
 *
 * Compact strip at the top of the chat showing currently pinned messages.
 * Click a pinned message to scroll to it; unpin (owner/admin) inline.
 */
type Pinned = {
  id: string;
  content: string | null;
  audio_url?: string | null;
  image_url?: string | null;
  sender_id: string;
  sender_username?: string | null;
  sender_display_name?: string | null;
  pinned_at?: string | null;
  pinned_by?: string | null;
  type: string;
};

export function PinnedStrip({
  messages,
  currentUserId,
  isOwner,
  onJump,
  onUnpin
}: {
  messages: Pinned[];
  currentUserId: string;
  isOwner: boolean;
  onJump: (id: string) => void;
  onUnpin: (id: string) => void;
}) {
  const pinned = messages
    .filter((m) => m.pinned_at)
    .sort(
      (a, b) =>
        new Date(b.pinned_at as string).getTime() -
        new Date(a.pinned_at as string).getTime()
    );
  const [expanded, setExpanded] = useState(false);
  if (pinned.length === 0) return null;
  const head = pinned[0];
  if (!head) return null;
  return (
    <div className="border-b border-neon-blue/20 bg-neon-blue/5 px-3 py-1.5 text-[12px] text-white/80">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-neon-blue">📌</span>
        <button
          type="button"
          onClick={() => onJump(head.id)}
          className="min-w-0 flex-1 truncate text-left hover:underline"
          title={
            (head.content ?? head.image_url ?? "(media)")?.toString().slice(0, 220) ?? ""
          }
        >
          <span className="text-white/55">
            {head.sender_display_name ?? head.sender_username ?? "someone"}:
          </span>{" "}
          <span className="text-white/85">
            {head.content
              ? head.content.length > 110
                ? head.content.slice(0, 110) + "…"
                : head.content
              : head.audio_url
              ? "🎙 voice message"
              : head.image_url
              ? "📷 image"
              : "(message)"}
          </span>
        </button>
        {pinned.length > 1 && (
          <button
            type="button"
            onClick={() => setExpanded((s) => !s)}
            className={clsx(
              "rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/70 hover:bg-white/10",
              expanded && "border-neon-blue/60 bg-neon-blue/15 text-neon-blue"
            )}
            aria-expanded={expanded}
          >
            {expanded ? "Hide" : `+${pinned.length - 1} more`}
          </button>
        )}
        {(isOwner || head.sender_id === currentUserId) && (
          <button
            type="button"
            onClick={() => onUnpin(head.id)}
            className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/60 hover:bg-white/10 hover:text-white"
            title="Unpin"
          >
            ✕
          </button>
        )}
      </div>
      {expanded && pinned.length > 1 && (
        <ul className="mt-1 space-y-0.5 border-t border-white/5 pt-1">
          {pinned.slice(1, 6).map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="shrink-0 text-white/30">·</span>
              <button
                type="button"
                onClick={() => onJump(p.id)}
                className="min-w-0 flex-1 truncate text-left text-[11px] text-white/75 hover:underline"
              >
                <span className="text-white/50">
                  {p.sender_display_name ?? p.sender_username ?? "someone"}:
                </span>{" "}
                {p.content
                  ? p.content.length > 90
                    ? p.content.slice(0, 90) + "…"
                    : p.content
                  : p.audio_url
                  ? "🎙 voice"
                  : p.image_url
                  ? "📷 image"
                  : "(message)"}
              </button>
              {(isOwner || p.sender_id === currentUserId) && (
                <button
                  type="button"
                  onClick={() => onUnpin(p.id)}
                  className="rounded-md border border-white/10 bg-white/5 px-1 text-[10px] text-white/55 hover:bg-white/10"
                  title="Unpin"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
