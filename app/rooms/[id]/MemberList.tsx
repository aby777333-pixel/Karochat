"use client";

import { useEffect, useMemo, useState } from "react";
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

export function MemberList({
  roomId,
  initial,
  currentUserId
}: {
  roomId: string;
  initial: Member[];
  currentUserId: string;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [members, setMembers] = useState<Member[]>(initial);

  // Refresh on profile updates (presence, status text) for anyone in this room.
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
          // membership changed — refresh the list
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
        {sorted.map((m) => (
          <li
            key={m.user_id}
            className={clsx(
              "flex items-start gap-2.5 px-3 py-2",
              m.user_id === currentUserId && "bg-white/[0.03]"
            )}
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
          </li>
        ))}
      </ul>
    </aside>
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
  // deterministic gradient by first char code
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
