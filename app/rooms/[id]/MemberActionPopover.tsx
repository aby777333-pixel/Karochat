"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type InvitableRoom = { id: string; name: string; visibility: string };

const VIS_GLYPH: Record<string, string> = {
  public: "🌍",
  listed: "🔒",
  unlisted: "🔗",
  secret: "🕶️"
};

export type MemberPopoverTarget = {
  user_id: string;
  username: string | null;
  display_name: string | null;
};

/**
 * Floating popover with three actions for a target user:
 * 1. Send private message → get_or_create_dm → navigate
 * 2. Copy invite link for the current room (mints a code if owner + missing)
 * 3. Invite to another room I own (submenu of my_invitable_rooms_for)
 *
 * Owns its own outside-click + Escape handling. Renders inline; the caller
 * decides where in the DOM to mount it (absolutely positioned within a
 * relatively-positioned parent works best).
 */
export function MemberActionPopover({
  target,
  roomId,
  roomInviteCode,
  onClose,
  onNavigate,
  align = "left"
}: {
  target: MemberPopoverTarget;
  roomId: string;
  roomInviteCode: string | null;
  onClose: () => void;
  onNavigate: (roomId: string) => void;
  align?: "left" | "right";
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<
    null | "dm" | "invite-here" | "load-rooms" | "invite-to" | "vibe"
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [invitableRooms, setInvitableRooms] = useState<InvitableRoom[] | null>(null);
  const [vibes, setVibes] = useState<{
    kindness: number;
    realness: number;
    quality: number;
  } | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Fetch current vibe totals for this target so we can render counts.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profile_vibes_view")
        .select("vibe_kindness, vibe_realness, vibe_quality")
        .eq("profile_id", target.user_id)
        .maybeSingle();
      if (!cancelled) {
        setVibes({
          kindness: Number(data?.vibe_kindness ?? 0),
          realness: Number(data?.vibe_realness ?? 0),
          quality: Number(data?.vibe_quality ?? 0)
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, target.user_id]);

  async function giveVibe(dim: "kindness" | "realness" | "quality") {
    setBusy("vibe");
    setError(null);
    setNotice(null);
    const { data, error: rpcErr } = await supabase.rpc("give_vibe", {
      p_ratee_id: target.user_id,
      p_dimension: dim
    });
    setBusy(null);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setVibes((prev) =>
      prev ? { ...prev, [dim]: Number(data ?? prev[dim] + 1) } : prev
    );
    setNotice(`+1 ${dim}.`);
  }

  async function sendDM() {
    setBusy("dm");
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("get_or_create_dm", {
      p_target_user_id: target.user_id
    });
    setBusy(null);
    if (rpcErr || !data) {
      setError(rpcErr?.message ?? "Could not start DM.");
      return;
    }
    onNavigate(data as string);
  }

  async function inviteToThisRoom() {
    setBusy("invite-here");
    setError(null);
    let code = roomInviteCode;
    if (!code) {
      const { data, error: rpcErr } = await supabase.rpc("regenerate_invite_code", {
        p_room_id: roomId
      });
      if (rpcErr || !data) {
        setBusy(null);
        setError(rpcErr?.message ?? "Could not generate invite code.");
        return;
      }
      code = data as string;
    }
    const link = `${window.location.origin}/rooms/${roomId}?invite=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Invite link copied — paste it to share.");
    } catch {
      setNotice(`Invite code: ${code}`);
    }
    setBusy(null);
  }

  async function loadInvitableRooms() {
    setBusy("load-rooms");
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("my_invitable_rooms_for", {
      p_target_user_id: target.user_id
    });
    setBusy(null);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setInvitableRooms((data ?? []) as InvitableRoom[]);
    setShowRoomPicker(true);
  }

  async function inviteToOtherRoom(otherRoomId: string) {
    setBusy("invite-to");
    setError(null);
    const { error: rpcErr } = await supabase.rpc("invite_user_to_room", {
      p_room_id: otherRoomId,
      p_target_user_id: target.user_id
    });
    setBusy(null);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setNotice("Added to that room.");
    setInvitableRooms((prev) => (prev ?? []).filter((r) => r.id !== otherRoomId));
  }

  const targetName = target.display_name ?? target.username ?? "this user";
  const alignClasses =
    align === "right"
      ? "right-0"
      : "left-0";

  return (
    <div
      ref={ref}
      role="menu"
      className={`absolute z-30 mt-1 w-64 rounded-xl border border-white/10 bg-ink-800/95 p-2 shadow-xl backdrop-blur ${alignClasses}`}
    >
      <div className="flex items-center justify-between gap-2 px-2 pb-1.5">
        <p className="truncate text-[10px] uppercase tracking-widest text-white/40">
          {targetName}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close (Esc)"
          className="rounded-md border border-white/10 bg-white/5 px-1.5 text-[10px] text-white/60 hover:bg-white/10"
        >
          ✕
        </button>
      </div>

      <button
        type="button"
        onClick={() => void sendDM()}
        disabled={busy !== null}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/85 hover:bg-white/10 disabled:opacity-50"
      >
        <span aria-hidden>💬</span>
        <span>{busy === "dm" ? "Opening…" : "Send private message"}</span>
      </button>

      <button
        type="button"
        onClick={() => void inviteToThisRoom()}
        disabled={busy !== null}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/85 hover:bg-white/10 disabled:opacity-50"
      >
        <span aria-hidden>🔗</span>
        <span>{busy === "invite-here" ? "Copying…" : "Copy invite link (this room)"}</span>
      </button>

      <button
        type="button"
        onClick={() => {
          if (showRoomPicker) setShowRoomPicker(false);
          else void loadInvitableRooms();
        }}
        disabled={busy !== null}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/85 hover:bg-white/10 disabled:opacity-50"
      >
        <span aria-hidden>➕</span>
        <span>{busy === "load-rooms" ? "Loading…" : "Invite to another room"}</span>
        <span className="ml-auto text-white/40">{showRoomPicker ? "▾" : "▸"}</span>
      </button>

      {showRoomPicker && invitableRooms && (
        <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-1">
          {invitableRooms.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-white/50">
              You don&apos;t own any other rooms they aren&apos;t already in.
            </p>
          ) : (
            invitableRooms.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => void inviteToOtherRoom(r.id)}
                disabled={busy !== null}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-white/85 hover:bg-white/10 disabled:opacity-50"
              >
                <span aria-hidden>{VIS_GLYPH[r.visibility] ?? "🌍"}</span>
                <span className="truncate">{r.name}</span>
              </button>
            ))
          )}
        </div>
      )}

      <div className="mt-2 border-t border-white/5 pt-2">
        <p className="px-2 pb-1 text-[10px] uppercase tracking-widest text-white/40">
          Vibe (1/day each)
        </p>
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              { dim: "kindness", emoji: "🌷", label: "kind"  },
              { dim: "realness", emoji: "✨", label: "real"  },
              { dim: "quality",  emoji: "🎯", label: "quality" }
            ] as const
          ).map((d) => (
            <button
              key={d.dim}
              type="button"
              onClick={() => void giveVibe(d.dim)}
              disabled={busy !== null}
              className="flex flex-col items-center rounded-md border border-white/10 bg-white/5 px-1 py-1 text-[10px] text-white/80 hover:bg-white/10 disabled:opacity-50"
            >
              <span aria-hidden className="text-sm">{d.emoji}</span>
              <span className="capitalize">{d.label}</span>
              <span className="font-mono text-[10px] text-white/40">
                {vibes ? vibes[d.dim] : "·"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-1.5 rounded-md bg-neon-red/10 px-2 py-1 text-[11px] text-neon-red">
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="mt-1.5 rounded-md bg-neon-mint/10 px-2 py-1 text-[11px] text-neon-mint">
          {notice}
        </p>
      )}
    </div>
  );
}
