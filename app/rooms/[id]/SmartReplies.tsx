"use client";

import { useCallback, useEffect, useState } from "react";

export function SmartReplies({
  roomId,
  lastMessageId,
  hidden,
  onPick
}: {
  roomId: string;
  lastMessageId: string | null;
  hidden: boolean;
  onPick: (text: string) => void;
}) {
  const [replies, setReplies] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [unconfigured, setUnconfigured] = useState(false);

  const fetchReplies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/smart-replies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId })
      });
      if (res.status === 503) {
        setUnconfigured(true);
        setReplies(null);
        return;
      }
      if (!res.ok) {
        setReplies(null);
        return;
      }
      const json = await res.json();
      setReplies(Array.isArray(json.replies) ? json.replies : []);
    } catch {
      setReplies(null);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // Re-fetch when the latest message changes (i.e. a new message arrived from someone else).
  useEffect(() => {
    if (!lastMessageId || unconfigured) return;
    void fetchReplies();
  }, [lastMessageId, unconfigured, fetchReplies]);

  if (unconfigured || hidden) return null;
  if (!replies || replies.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-widest text-white/30">
        suggestions
      </span>
      {replies.map((r, i) => (
        <button
          key={`${i}-${r}`}
          type="button"
          onClick={() => onPick(r)}
          className="rounded-full border border-neon-blue/30 bg-neon-blue/10 px-2.5 py-1 text-xs text-white/85 transition hover:border-neon-blue/60 hover:bg-neon-blue/20"
        >
          {r}
        </button>
      ))}
      {loading && (
        <span className="text-[10px] text-white/30 animate-pulseDot">●</span>
      )}
    </div>
  );
}
