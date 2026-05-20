"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PresenceDot } from "@/components/PresenceDot";

type Friend = {
  friend_id: string;
  username: string | null;
  display_name: string | null;
  is_guest: boolean | null;
  presence_state: string | null;
  status_text: string | null;
  status_emoji: string | null;
  mood: string | null;
  mood_expires_at: string | null;
  group_label: string;
  since: string;
};

type IncomingRequest = {
  requester_id: string;
  username: string | null;
  display_name: string | null;
  is_guest: boolean | null;
  presence_state: string | null;
  created_at: string;
};

const PRESENCE_ORDER: Record<string, number> = {
  online: 0,
  busy: 1,
  away: 2,
  invisible: 3,
  offline: 4
};

function moodActive(f: Friend) {
  if (!f.mood) return null;
  if (f.mood_expires_at && new Date(f.mood_expires_at) <= new Date()) return null;
  return f.mood;
}

export function FriendsAndRequests({ currentUserId }: { currentUserId: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initial load + realtime subscriptions for friendships.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [friendsResp, requestsResp] = await Promise.all([
        supabase.from("my_friends_view").select("*"),
        supabase.from("my_friend_requests_view").select("*")
      ]);
      if (cancelled) return;
      setFriends((friendsResp.data ?? []) as Friend[]);
      setRequests((requestsResp.data ?? []) as IncomingRequest[]);
    }
    void load();

    const channel = supabase
      .channel(`friendships:${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => {
          void load();
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, currentUserId]);

  async function accept(req: IncomingRequest) {
    setBusy(`accept:${req.requester_id}`);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("accept_friend", {
      p_requester_user_id: req.requester_id
    });
    setBusy(null);
    if (rpcErr) setError(rpcErr.message);
  }

  async function decline(req: IncomingRequest) {
    setBusy(`decline:${req.requester_id}`);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("decline_friend", {
      p_requester_user_id: req.requester_id
    });
    setBusy(null);
    if (rpcErr) setError(rpcErr.message);
  }

  async function openDM(friendId: string) {
    setBusy(`dm:${friendId}`);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("get_or_create_dm", {
      p_target_user_id: friendId
    });
    setBusy(null);
    if (rpcErr || !data) {
      setError(rpcErr?.message ?? "Could not open DM.");
      return;
    }
    router.push(`/rooms/${data}`);
    router.refresh();
  }

  async function removeFriend(friendId: string, name: string) {
    if (!confirm(`Remove ${name} from your friends?`)) return;
    setBusy(`remove:${friendId}`);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("remove_friend", {
      p_other_user_id: friendId
    });
    setBusy(null);
    if (rpcErr) setError(rpcErr.message);
  }

  async function renameGroup(friendId: string, currentLabel: string) {
    const next = prompt("Move to which group?", currentLabel);
    if (next == null) return;
    setBusy(`group:${friendId}`);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("set_friend_group", {
      p_other_user_id: friendId,
      p_group_label: next
    });
    setBusy(null);
    if (rpcErr) setError(rpcErr.message);
  }

  // Group friends by their label.
  const grouped = useMemo(() => {
    const map = new Map<string, Friend[]>();
    for (const f of friends ?? []) {
      const list = map.get(f.group_label) ?? [];
      list.push(f);
      map.set(f.group_label, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const ap = PRESENCE_ORDER[a.presence_state ?? "offline"] ?? 5;
        const bp = PRESENCE_ORDER[b.presence_state ?? "offline"] ?? 5;
        if (ap !== bp) return ap - bp;
        return (a.display_name ?? a.username ?? "").localeCompare(
          b.display_name ?? b.username ?? ""
        );
      });
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [friends]);

  const friendCount = friends?.length ?? 0;
  const onlineCount = (friends ?? []).filter(
    (f) => f.presence_state === "online"
  ).length;

  return (
    <div className="space-y-3">
      {requests.length > 0 && (
        <section className="surface-glass tint-mint p-4">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-neon-mint">
            Friend requests ({requests.length})
          </p>
          <ul className="space-y-1.5">
            {requests.map((r) => {
              const name = r.display_name ?? r.username ?? "Someone";
              const handle = r.username ?? "anon";
              const acceptBusy = busy === `accept:${r.requester_id}`;
              const declineBusy = busy === `decline:${r.requester_id}`;
              return (
                <li
                  key={r.requester_id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-2 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <PresenceDot state={r.presence_state ?? "offline"} pulse />
                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        <span className="text-white">{name}</span>
                        {r.is_guest && (
                          <span className="ml-1 rounded-sm bg-white/10 px-1 text-[9px] uppercase tracking-widest text-white/50">
                            guest
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[11px] text-white/40">@{handle}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void accept(r)}
                      disabled={acceptBusy || declineBusy}
                      className="rounded-lg bg-neon-mint/20 px-2 py-1 text-[11px] font-medium text-neon-mint hover:bg-neon-mint/30 disabled:opacity-50"
                    >
                      {acceptBusy ? "…" : "Accept"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void decline(r)}
                      disabled={acceptBusy || declineBusy}
                      aria-label="Decline"
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 disabled:opacity-50"
                    >
                      {declineBusy ? "…" : "✕"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {error && (
            <p className="mt-2 rounded-md bg-neon-red/10 px-2 py-1 text-[11px] text-neon-red">
              {error}
            </p>
          )}
        </section>
      )}

      <section className="surface-glass tint-mint p-5">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Friends</h2>
          <span className="text-xs text-white/40">
            {friends === null
              ? ""
              : friendCount === 0
              ? "0"
              : `${onlineCount}/${friendCount} online`}
          </span>
        </div>

        {friends === null ? (
          <p className="text-xs text-white/40">Loading…</p>
        ) : friendCount === 0 ? (
          <p className="text-sm text-white/55">
            No friends yet. Find someone in <span className="text-white">Find a person or room</span>,
            or tap a username in a chat and pick{" "}
            <span className="rounded-sm bg-white/10 px-1 text-xs">🤝 Add friend</span>.
          </p>
        ) : (
          <div className="space-y-3">
            {grouped.map(([label, list]) => (
              <div key={label}>
                <p className="mb-1 text-[10px] uppercase tracking-widest text-white/40">
                  {label} · {list.length}
                </p>
                <ul className="divide-y divide-white/5">
                  {list.map((f) => {
                    const name = f.display_name ?? f.username ?? "anon";
                    const handle = f.username ?? "anon";
                    const subtitle = f.status_text
                      ? `${f.status_emoji ?? ""} ${f.status_text}`
                      : `@${handle}`;
                    const mood = moodActive(f);
                    const dmBusy = busy === `dm:${f.friend_id}`;
                    return (
                      <li
                        key={f.friend_id}
                        className="group flex items-center justify-between gap-2 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => void openDM(f.friend_id)}
                          disabled={dmBusy}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-50"
                          title="Open private chat"
                        >
                          <PresenceDot
                            state={f.presence_state ?? "offline"}
                            pulse
                          />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 truncate text-sm">
                              <span className="truncate text-white">{name}</span>
                              {f.is_guest && (
                                <span className="rounded-sm bg-white/10 px-1 text-[9px] uppercase tracking-widest text-white/50">
                                  guest
                                </span>
                              )}
                              {mood && (
                                <span className="rounded-sm bg-neon-purple/15 px-1 text-[9px] uppercase tracking-widest text-neon-purple">
                                  {mood}
                                </span>
                              )}
                            </p>
                            <p className="truncate text-[11px] text-white/50">
                              {subtitle}
                            </p>
                          </div>
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void openDM(f.friend_id)}
                            disabled={dmBusy}
                            className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70 hover:bg-white/10 disabled:opacity-50"
                            title="Open chat"
                          >
                            {dmBusy ? "…" : "💬"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void renameGroup(f.friend_id, f.group_label)
                            }
                            disabled={busy === `group:${f.friend_id}`}
                            className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/55 hover:bg-white/10 disabled:opacity-50"
                            title="Move to group"
                          >
                            🗂
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeFriend(f.friend_id, name)}
                            disabled={busy === `remove:${f.friend_id}`}
                            className={clsx(
                              "rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/55 hover:border-neon-red/40 hover:bg-neon-red/10 hover:text-neon-red disabled:opacity-50"
                            )}
                            title="Remove friend"
                          >
                            ✕
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
        {error && friendCount > 0 && (
          <p className="mt-2 rounded-md bg-neon-red/10 px-2 py-1 text-[11px] text-neon-red">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
