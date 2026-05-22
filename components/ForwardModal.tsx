"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * ForwardModal — Wave 18.
 *
 * Pick one of the caller's rooms (excluding the source room) and forward
 * the selected message into it via the forward_message RPC.
 */
type Room = {
  id: string;
  name: string;
  is_dm: boolean | null;
  is_saved: boolean | null;
};

type SourceMessage = {
  id: string;
  room_id: string;
  type: string;
  content: string | null;
  image_url?: string | null;
  audio_url?: string | null;
};

export function ForwardModal({
  source,
  currentUserId,
  onClose
}: {
  source: SourceMessage;
  currentUserId: string;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("room_members")
        .select("room_id, rooms!inner(id, name, is_dm, is_saved)")
        .eq("user_id", currentUserId);
      const flat: Room[] = ((data as any[]) ?? [])
        .map((row) => row.rooms as Room)
        .filter((r): r is Room => !!r && r.id !== source.room_id);
      // Stable, alphabetical by name.
      flat.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
      setRooms(flat);
    })();
  }, [supabase, source.room_id, currentUserId]);

  const list = rooms.filter((r) => {
    if (!search.trim()) return true;
    return (r.name ?? "").toLowerCase().includes(search.trim().toLowerCase());
  });

  async function forwardTo(roomId: string, roomName: string) {
    setSending(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("forward_message", {
      p_message_id: source.id,
      p_dest_room_id: roomId
    });
    setSending(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setDone(roomName);
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
        className="surface-glass tint-blue my-auto w-[min(460px,94vw)] p-5"
      >
        <div className="flex items-center justify-between">
          <p className="font-display text-base font-semibold text-white">
            ↗ Forward message
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
        <p className="mt-2 max-h-20 overflow-y-auto rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[12px] italic text-white/55">
          {source.content
            ? `"${source.content.slice(0, 160)}${source.content.length > 160 ? "…" : ""}"`
            : source.audio_url
            ? "🎙 voice message"
            : source.image_url
            ? "📷 image"
            : "(message)"}
        </p>

        {done ? (
          <>
            <p className="mt-3 text-sm text-white/85">
              Forwarded to{" "}
              <span className="font-medium text-neon-blue">{done}</span>.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDone(null)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
              >
                Forward elsewhere
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-neon-blue px-4 py-1.5 text-xs font-medium text-ink-900 hover:bg-neon-blue/90"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter your rooms…"
              autoFocus
              className="mt-3 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs outline-none placeholder:text-white/30 focus:border-neon-blue/50"
            />
            {error && (
              <p className="mt-2 rounded-md border border-neon-red/40 bg-neon-red/10 px-2 py-1 text-[11px] text-neon-red">
                {error}
              </p>
            )}
            <ul className="mt-2 max-h-64 space-y-0.5 overflow-y-auto">
              {list.length === 0 ? (
                <li className="px-2 py-3 text-center text-[11px] text-white/40">
                  No matching rooms.
                </li>
              ) : (
                list.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => void forwardTo(r.id, r.name)}
                      className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-left text-xs text-white/85 hover:bg-white/10 disabled:opacity-50"
                    >
                      <span className="truncate">
                        {r.is_saved ? "💾 " : r.is_dm ? "💬 " : "# "}
                        {r.name}
                      </span>
                      <span className="text-[10px] text-white/40">
                        {sending ? "…" : "→"}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
