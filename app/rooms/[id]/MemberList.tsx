"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PresenceDot } from "@/components/PresenceDot";

type Member = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  is_guest: boolean | null;
  presence_state: string | null;
  status_text: string | null;
  status_emoji: string | null;
  role: string | null;
};

type InvitableRoom = { id: string; name: string; visibility: string };

const VIS_GLYPH: Record<string, string> = {
  public: "🌍",
  listed: "🔒",
  unlisted: "🔗",
  secret: "🕶️"
};

export function MemberList({
  roomId,
  initial,
  currentUserId,
  roomInviteCode
}: {
  roomId: string;
  initial: Member[];
  currentUserId: string;
  roomInviteCode?: string | null;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>(initial);
  const [openFor, setOpenFor] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`room-profiles:${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          const p = payload.new as {
            id: string;
            presence_state: string;
            status_text: string | null;
            status_emoji: string | null;
            display_name: string;
            username: string;
            is_guest: boolean | null;
          };
          setMembers((prev) =>
            prev.map((m) =>
              m.user_id === p.id
                ? {
                    ...m,
                    presence_state: p.presence_state,
                    status_text: p.status_text,
                    status_emoji: p.status_emoji,
                    display_name: p.display_name,
                    username: p.username,
                    is_guest: p.is_guest
                  }
                : m
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        async () => {
          const { data } = await supabase
            .from("room_members_view")
            .select("*")
            .eq("room_id", roomId);
          if (data) setMembers(data as unknown as Member[]);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, roomId]);

  const sorted = useMemo(() => {
    const order: Record<string, number> = {
      online: 0, busy: 1, away: 2, invisible: 3, offline: 4
    };
    return [...members].sort((a, b) => {
      const ap = order[a.presence_state ?? "offline"] ?? 5;
      const bp = order[b.presence_state ?? "offline"] ?? 5;
      if (ap !== bp) return ap - bp;
      return (a.display_name ?? "").localeCompare(b.display_name ?? "");
    });
  }, [members]);

  return (
    <aside className="surface-glass mt-3 hidden h-full overflow-hidden md:flex md:w-72 md:flex-col">
      <div className="border-b border-white/5 px-4 py-2 text-xs text-white/50">
        <span className="font-mono uppercase tracking-widest">Members</span>
        <span className="ml-2 text-white/30">({members.length})</span>
      </div>
      <ul className="scroll-thin flex-1 overflow-y-auto py-1">
        {sorted.map((m) => {
          const isSelf = m.user_id === currentUserId;
          return (
            <li
              key={m.user_id}
              className={clsx(
                "relative",
                isSelf && "bg-white/[0.03]"
              )}
            >
              <button
                type="button"
                onClick={() => {
                  if (isSelf) return;
                  setOpenFor((cur) => (cur === m.user_id ? null : m.user_id));
                }}
                disabled={isSelf}
                className={clsx(
                  "flex w-full items-start gap-2.5 px-3 py-2 text-left transition",
                  !isSelf && "hover:bg-white/5"
                )}
                aria-haspopup="menu"
                aria-expanded={openFor === m.user_id}
              >
                <div className="relative shrink-0">
                  <Avatar name={m.display_name ?? m.username ?? "?"} />
                  <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-ink-800 p-0.5">
                    <PresenceDot state={m.presence_state} pulse />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="text-white">{m.display_name ?? m.username}</span>
                    {m.role === "owner" && (
                      <span className="ml-1 rounded-sm bg-neon-purple/20 px-1 text-[9px] uppercase tracking-widest text-neon-purple">
                        owner
                      </span>
                    )}
                    {m.is_guest && (
                      <span className="ml-1 rounded-sm bg-white/10 px-1 text-[9px] uppercase tracking-widest text-white/50">
                        guest
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[11px] text-white/40">
                    {m.status_emoji ? `${m.status_emoji} ` : ""}
                    {m.status_text || `@${m.username ?? "anon"}`}
                  </p>
                </div>
              </button>
              {openFor === m.user_id && !isSelf && (
                <MemberActionPopover
                  target={m}
                  roomId={roomId}
                  roomInviteCode={roomInviteCode ?? null}
                  onClose={() => setOpenFor(null)}
                  onNavigate={(roomDestId) => {
                    setOpenFor(null);
                    router.push(`/rooms/${roomDestId}`);
                    router.refresh();
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function MemberActionPopover({
  target,
  roomId,
  roomInviteCode,
  onClose,
  onNavigate
}: {
  target: Member;
  roomId: string;
  roomInviteCode: string | null;
  onClose: () => void;
  onNavigate: (roomId: string) => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<null | "dm" | "invite-here" | "load-rooms" | "invite-to">(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [invitableRooms, setInvitableRooms] = useState<InvitableRoom[] | null>(null);

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

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute left-2 right-2 top-full z-30 mt-1 rounded-xl border border-white/10 bg-ink-800/95 p-2 shadow-xl backdrop-blur"
    >
      <p className="px-2 pb-1.5 text-[10px] uppercase tracking-widest text-white/40">
        {targetName}
      </p>

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
        <span>
          {busy === "load-rooms" ? "Loading…" : "Invite to another room"}
        </span>
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

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = (name.charCodeAt(0) * 37) % 360;
  return (
    <div
      className="grid h-8 w-8 place-items-center rounded-full font-mono text-[11px] font-semibold text-ink-900"
      style={{
        background: `linear-gradient(135deg, hsl(${hue},80%,65%), hsl(${(hue + 60) % 360},80%,55%))`
      }}
    >
      {initials || "?"}
    </div>
  );
}
