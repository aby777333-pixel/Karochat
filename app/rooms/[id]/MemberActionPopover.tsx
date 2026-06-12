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
  canModerate = false,
  onClose,
  onNavigate,
  align = "left"
}: {
  target: MemberPopoverTarget;
  roomId: string;
  roomInviteCode: string | null;
  /** Caller is the room owner / admin / moderator — show kick/ban actions. */
  canModerate?: boolean;
  onClose: () => void;
  onNavigate: (roomId: string) => void;
  align?: "left" | "right";
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<
    null | "dm" | "vault" | "invite-here" | "load-rooms" | "invite-to" | "vibe" | "friend" | "remove" | "ban" | "call-audio" | "call-video" | "block" | "mute" | "role"
  >(null);
  const [iBlocked, setIBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [invitableRooms, setInvitableRooms] = useState<InvitableRoom[] | null>(null);
  const [vibes, setVibes] = useState<{
    kindness: number;
    realness: number;
    quality: number;
  } | null>(null);
  const [vouchCount, setVouchCount] = useState<number | null>(null);
  const [friendState, setFriendState] = useState<
    "none" | "pending_out" | "pending_in" | "friends" | "self" | null
  >(null);
  // Moderation extras (v9): the target's role + mute state, and whether the
  // caller is the room owner (only owners assign moderators).
  const [targetRole, setTargetRole] = useState<string | null>(null);
  const [targetMutedUntil, setTargetMutedUntil] = useState<string | null>(null);
  const [iAmOwner, setIAmOwner] = useState(false);

  useEffect(() => {
    if (!canModerate) return;
    let cancelled = false;
    (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      const [targetResp, mineResp] = await Promise.all([
        supabase
          .from("room_members")
          .select("role, muted_until")
          .eq("room_id", roomId)
          .eq("user_id", target.user_id)
          .maybeSingle(),
        user
          ? supabase
              .from("room_members")
              .select("role")
              .eq("room_id", roomId)
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null })
      ]);
      if (cancelled) return;
      setTargetRole((targetResp.data as any)?.role ?? null);
      setTargetMutedUntil((targetResp.data as any)?.muted_until ?? null);
      setIAmOwner(((mineResp.data as any)?.role ?? null) === "owner");
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, canModerate, roomId, target.user_id]);

  const targetIsMuted =
    !!targetMutedUntil && new Date(targetMutedUntil).getTime() > Date.now();

  async function muteFor(minutes: number) {
    setBusy("mute");
    setError(null);
    setNotice(null);
    const { error: e } = await supabase.rpc("mute_room_member", {
      p_room_id: roomId,
      p_user_id: target.user_id,
      p_minutes: minutes
    });
    setBusy(null);
    if (e) {
      setError(e.message);
      return;
    }
    setTargetMutedUntil(new Date(Date.now() + minutes * 60000).toISOString());
    setNotice(`Muted for ${minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}.`);
  }

  async function unmute() {
    setBusy("mute");
    setError(null);
    setNotice(null);
    const { error: e } = await supabase.rpc("unmute_room_member", {
      p_room_id: roomId,
      p_user_id: target.user_id
    });
    setBusy(null);
    if (e) {
      setError(e.message);
      return;
    }
    setTargetMutedUntil(null);
    setNotice("Unmuted.");
  }

  async function toggleModerator() {
    const makeMod = targetRole !== "moderator";
    setBusy("role");
    setError(null);
    setNotice(null);
    const { error: e } = await supabase.rpc("set_room_member_role", {
      p_room_id: roomId,
      p_user_id: target.user_id,
      p_role: makeMod ? "moderator" : "member"
    });
    setBusy(null);
    if (e) {
      setError(e.message);
      return;
    }
    setTargetRole(makeMod ? "moderator" : "member");
    setNotice(makeMod ? "Now a moderator. 🛡" : "Moderator role removed.");
  }

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

  // Fetch current vibe totals + vouch count for this target so we can render
  // both inline.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [vibesResp, vouchesResp] = await Promise.all([
        supabase
          .from("profile_vibes_view")
          .select("vibe_kindness, vibe_realness, vibe_quality")
          .eq("profile_id", target.user_id)
          .maybeSingle(),
        supabase
          .from("vouches_received_view")
          .select("id", { count: "exact", head: true })
          .eq("vouched_id", target.user_id)
      ]);
      if (cancelled) return;
      setVibes({
        kindness: Number(vibesResp.data?.vibe_kindness ?? 0),
        realness: Number(vibesResp.data?.vibe_realness ?? 0),
        quality: Number(vibesResp.data?.vibe_quality ?? 0)
      });
      setVouchCount(vouchesResp.count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, target.user_id]);

  async function giveVouch() {
    setError(null);
    setNotice(null);
    const note = prompt(
      `Vouch for ${target.display_name ?? "@" + (target.username ?? "anon")} in one sentence (≤240 chars). They'll see this on their profile.`
    );
    if (note == null) return;
    const trimmed = note.trim();
    if (!trimmed) {
      setError("A vouch needs a note.");
      return;
    }
    setBusy("vibe");
    const { error: rpcErr } = await supabase.rpc("give_vouch", {
      p_vouched_id: target.user_id,
      p_note: trimmed
    });
    setBusy(null);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setVouchCount((c) => (c ?? 0) + 1);
    setNotice("Vouched.");
  }

  // Friendship state — render the right CTA depending on it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("friendship_status", {
        p_other_user_id: target.user_id
      });
      if (!cancelled) {
        setFriendState((data as any) ?? "none");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, target.user_id]);

  async function requestFriend() {
    setBusy("friend");
    setError(null);
    setNotice(null);
    const { data, error: rpcErr } = await supabase.rpc("request_friend", {
      p_target_user_id: target.user_id
    });
    setBusy(null);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    const status = (data as string) ?? "pending";
    if (status === "accepted") {
      setFriendState("friends");
      setNotice("You're friends now.");
    } else {
      setFriendState("pending_out");
      setNotice("Friend request sent.");
    }
  }

  async function acceptFriend() {
    setBusy("friend");
    setError(null);
    setNotice(null);
    const { error: rpcErr } = await supabase.rpc("accept_friend", {
      p_requester_user_id: target.user_id
    });
    setBusy(null);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setFriendState("friends");
    setNotice("Friend request accepted.");
  }

  async function declineFriend() {
    setBusy("friend");
    setError(null);
    setNotice(null);
    const { error: rpcErr } = await supabase.rpc("decline_friend", {
      p_requester_user_id: target.user_id
    });
    setBusy(null);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setFriendState("none");
    setNotice("Request declined.");
  }

  async function removeFriend() {
    if (!confirm("Remove this friend?")) return;
    setBusy("friend");
    setError(null);
    setNotice(null);
    const { error: rpcErr } = await supabase.rpc("remove_friend", {
      p_other_user_id: target.user_id
    });
    setBusy(null);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setFriendState("none");
    setNotice("Removed.");
  }

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

  async function removeFromRoom(ban: boolean) {
    const verb = ban ? "remove and ban" : "remove";
    const display = target.display_name ?? `@${target.username ?? "anon"}`;
    if (!confirm(`${verb.charAt(0).toUpperCase() + verb.slice(1)} ${display}?`)) return;
    setBusy(ban ? "ban" : "remove");
    setError(null);
    setNotice(null);
    const reason = ban ? prompt("Reason for ban? (optional, shown to admins)") : null;
    const { error: rpcErr } = await supabase.rpc("remove_room_member", {
      p_room_id: roomId,
      p_user_id: target.user_id,
      p_ban: ban,
      p_reason: reason ?? null
    });
    setBusy(null);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setNotice(ban ? "Banned." : "Removed.");
    // Also try to kick them from any active LiveKit call in this room.
    try {
      await fetch("/api/livekit/end", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId, targetUserId: target.user_id })
      });
    } catch {
      // best-effort; their room ban is the source of truth.
    }
  }

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase.rpc("block_status", { p_target: target.user_id });
      if (alive && data && typeof data === "object") setIBlocked(!!(data as any).i_blocked);
    })();
    return () => {
      alive = false;
    };
  }, [supabase, target.user_id]);

  async function toggleBlock() {
    setBusy("block");
    setError(null);
    if (iBlocked) {
      const { error: e } = await supabase.rpc("unblock_user", { p_target: target.user_id });
      setBusy(null);
      if (e) {
        setError(e.message);
        return;
      }
      setIBlocked(false);
      setNotice("Unblocked.");
      return;
    }
    if (!confirm(`Block @${target.username ?? "this user"}? They won't be able to message you.`)) {
      setBusy(null);
      return;
    }
    const { error: e } = await supabase.rpc("block_user", { p_target: target.user_id });
    setBusy(null);
    if (e) {
      setError(e.message);
      return;
    }
    setIBlocked(true);
    setNotice("Blocked. They can no longer message you.");
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

  // Wave 19.14 — start a call straight from the popover. radar_request_call
  // gets/creates the DM exactly like get_or_create_dm did AND inserts the
  // radar 'call' ping, whose existing 0068 trigger rings the callee with a
  // "📞 wants to call" push + realtime notification. Then hard-navigate with
  // ?call=audio|video so the room page can auto-open the call panel on mount.
  async function startCall(mode: "audio" | "video") {
    setBusy(mode === "audio" ? "call-audio" : "call-video");
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("radar_request_call", {
      p_to: target.user_id
    });
    setBusy(null);
    if (rpcErr || !data) {
      setError(rpcErr?.message ?? "Could not start the call.");
      return;
    }
    if (typeof window !== "undefined") {
      window.location.href = `/rooms/${data}?call=${mode}`;
    }
  }

  async function openVaultDM() {
    setBusy("vault");
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("create_vault_dm", {
      p_other: target.user_id
    });
    setBusy(null);
    if (rpcErr || !data) {
      setError(rpcErr?.message ?? "Could not open vault.");
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
        onClick={() => void openVaultDM()}
        disabled={busy !== null}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neon-purple hover:bg-neon-purple/10 disabled:opacity-50"
        title="End-to-end encrypted DM"
      >
        <span aria-hidden>🔐</span>
        <span>{busy === "vault" ? "Opening…" : "Open vault (E2EE)"}</span>
      </button>

      <button
        type="button"
        onClick={() => void toggleBlock()}
        disabled={busy !== null}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neon-red hover:bg-neon-red/10 disabled:opacity-50"
        title={iBlocked ? "Unblock this person" : "Block this person from messaging you"}
      >
        <span aria-hidden>🚫</span>
        <span>
          {busy === "block" ? "…" : iBlocked ? "Unblock" : "Block"}
        </span>
      </button>

      <div className="my-1 grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => void startCall("audio")}
          disabled={busy !== null}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-neon-blue/40 bg-neon-blue/10 px-2 py-1.5 text-xs text-neon-blue hover:bg-neon-blue/20 disabled:opacity-50"
          title="Voice call this user (opens or creates a DM)"
        >
          <span aria-hidden>📞</span>
          <span>{busy === "call-audio" ? "Calling…" : "Voice call"}</span>
        </button>
        <button
          type="button"
          onClick={() => void startCall("video")}
          disabled={busy !== null}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-neon-purple/40 bg-neon-purple/10 px-2 py-1.5 text-xs text-neon-purple hover:bg-neon-purple/20 disabled:opacity-50"
          title="Video call this user (opens or creates a DM)"
        >
          <span aria-hidden>📹</span>
          <span>{busy === "call-video" ? "Calling…" : "Video call"}</span>
        </button>
      </div>

      {friendState === "none" && (
        <button
          type="button"
          onClick={() => void requestFriend()}
          disabled={busy !== null}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/85 hover:bg-white/10 disabled:opacity-50"
        >
          <span aria-hidden>🤝</span>
          <span>{busy === "friend" ? "Sending…" : "Add friend"}</span>
        </button>
      )}
      {friendState === "pending_out" && (
        <button
          type="button"
          onClick={() => void removeFriend()}
          disabled={busy !== null}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/60 hover:bg-white/10 disabled:opacity-50"
          title="Cancel friend request"
        >
          <span aria-hidden>⏳</span>
          <span>Friend request sent · tap to cancel</span>
        </button>
      )}
      {friendState === "pending_in" && (
        <div className="flex w-full items-center gap-1 px-1 py-1">
          <button
            type="button"
            onClick={() => void acceptFriend()}
            disabled={busy !== null}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-neon-mint/15 px-2 py-1.5 text-xs text-neon-mint hover:bg-neon-mint/25 disabled:opacity-50"
          >
            <span aria-hidden>✅</span>
            <span>Accept</span>
          </button>
          <button
            type="button"
            onClick={() => void declineFriend()}
            disabled={busy !== null}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"
          >
            <span aria-hidden>✕</span>
            <span>Decline</span>
          </button>
        </div>
      )}
      {friendState === "friends" && (
        <button
          type="button"
          onClick={() => void removeFriend()}
          disabled={busy !== null}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neon-mint hover:bg-white/10 disabled:opacity-50"
          title="Remove friend"
        >
          <span aria-hidden>✓</span>
          <span>Friends · tap to remove</span>
        </button>
      )}

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
        <div className="flex items-center justify-between px-2 pb-1">
          <p className="text-[10px] uppercase tracking-widest text-white/40">
            Vibe (1/day each)
          </p>
          <a
            href={`/u/${target.username ?? ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-white/45 hover:text-white"
            title="Open public profile"
          >
            profile →
          </a>
        </div>
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
        <button
          type="button"
          onClick={() => void giveVouch()}
          disabled={busy !== null}
          className="mt-1.5 flex w-full items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50"
        >
          <span aria-hidden>🪪</span>
          <span className="flex-1 text-left">
            Vouch with a note · 5/month
          </span>
          {vouchCount !== null && (
            <span className="font-mono text-[10px] text-white/45">
              {vouchCount}
            </span>
          )}
        </button>
      </div>

      {canModerate && (
        <div className="mt-2 border-t border-neon-red/20 pt-2">
          <p className="px-2 pb-1 text-[9px] uppercase tracking-widest text-neon-red/70">
            Moderation
          </p>
          <button
            type="button"
            onClick={() => void removeFromRoom(false)}
            disabled={busy !== null}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neon-amber hover:bg-neon-amber/10 disabled:opacity-50"
            title="Remove from this room (they can rejoin)"
          >
            <span aria-hidden>🚪</span>
            <span>{busy === "remove" ? "Removing…" : "Remove from room"}</span>
          </button>
          <button
            type="button"
            onClick={() => void removeFromRoom(true)}
            disabled={busy !== null}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neon-red hover:bg-neon-red/10 disabled:opacity-50"
            title="Remove and ban — they can't rejoin until you unban them"
          >
            <span aria-hidden>⛔</span>
            <span>{busy === "ban" ? "Banning…" : "Ban from room"}</span>
          </button>
          {targetIsMuted ? (
            <button
              type="button"
              onClick={() => void unmute()}
              disabled={busy !== null}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neon-mint hover:bg-neon-mint/10 disabled:opacity-50"
              title="Let them speak again"
            >
              <span aria-hidden>🔊</span>
              <span>{busy === "mute" ? "Working…" : "Unmute"}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1">
              <span className="flex items-center gap-1.5 text-sm text-neon-amber">
                <span aria-hidden>🔇</span> Mute
              </span>
              <span className="ml-auto flex gap-1">
                {[
                  { label: "10m", mins: 10 },
                  { label: "1h", mins: 60 },
                  { label: "24h", mins: 1440 }
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => void muteFor(o.mins)}
                    disabled={busy !== null}
                    className="rounded-md border border-neon-amber/30 bg-neon-amber/10 px-2 py-0.5 text-[11px] text-neon-amber hover:bg-neon-amber/20 disabled:opacity-50"
                    title={`Mute for ${o.label} — they can read but not send`}
                  >
                    {o.label}
                  </button>
                ))}
              </span>
            </div>
          )}
          {iAmOwner && (
            <button
              type="button"
              onClick={() => void toggleModerator()}
              disabled={busy !== null}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neon-blue hover:bg-neon-blue/10 disabled:opacity-50"
              title={
                targetRole === "moderator"
                  ? "Take away moderator powers"
                  : "Moderators can remove, ban, and mute plain members"
              }
            >
              <span aria-hidden>🛡</span>
              <span>
                {busy === "role"
                  ? "Working…"
                  : targetRole === "moderator"
                    ? "Remove moderator"
                    : "Make moderator"}
              </span>
            </button>
          )}
        </div>
      )}

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
