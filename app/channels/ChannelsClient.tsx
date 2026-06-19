"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

export type ChannelRow = {
  id: string;
  owner_profile_id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  subscriber_count: number;
  created_at: string;
  owner_username: string | null;
  owner_display_name: string | null;
  is_owner: boolean;
  is_subscribed: boolean;
};

export function ChannelsClient({
  currentUserId,
  initialChannels
}: {
  currentUserId: string;
  initialChannels: ChannelRow[];
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [channels, setChannels] = useState<ChannelRow[]>(initialChannels);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleSub(c: ChannelRow) {
    if (c.is_owner) return;
    const was = c.is_subscribed;
    setChannels((prev) =>
      prev.map((x) =>
        x.id === c.id
          ? { ...x, is_subscribed: !was, subscriber_count: Math.max(0, x.subscriber_count + (was ? -1 : 1)) }
          : x
      )
    );
    const { error: e } = was
      ? await supabase
          .from("broadcast_channel_subscriptions")
          .delete()
          .eq("channel_id", c.id)
          .eq("subscriber_profile_id", currentUserId)
      : await supabase
          .from("broadcast_channel_subscriptions")
          .insert({ channel_id: c.id, subscriber_profile_id: currentUserId });
    if (e) {
      setChannels((prev) =>
        prev.map((x) =>
          x.id === c.id ? { ...x, is_subscribed: was, subscriber_count: c.subscriber_count } : x
        )
      );
    }
  }

  async function create() {
    if (busy) return;
    const n = name.trim();
    if (!n) return setError("Give your channel a name.");
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase
      .from("broadcast_channels")
      .insert({ owner_profile_id: currentUserId, name: n, description: description.trim() || null })
      .select("id")
      .single();
    if (e || !data) {
      setError(e?.message ?? "Couldn't create the channel.");
      setBusy(false);
      return;
    }
    router.push(`/channels/${data.id}`);
  }

  return (
    <div className="space-y-3">
      <Button onClick={() => setCreating((v) => !v)} className="w-full">
        ＋ Create a channel
      </Button>

      {creating && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Channel name"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/60"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="What's it about? (optional)"
            className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/60"
          />
          {error && <p className="rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{error}</p>}
          <Button onClick={() => void create()} disabled={busy} className="w-full">
            {busy ? "Creating…" : "Create"}
          </Button>
        </div>
      )}

      {channels.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-8 text-center text-sm text-white/50">
          No channels yet. Create the first one.
        </p>
      ) : (
        <ul className="space-y-2">
          {channels.map((c) => {
            const owner = c.owner_display_name ?? c.owner_username ?? "anon";
            return (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3"
              >
                <Link href={`/channels/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/10 text-lg">
                    {c.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      "📣"
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-white">
                      {c.name}
                      {c.is_owner && (
                        <span className="ml-1.5 rounded bg-white/10 px-1 text-[9px] uppercase tracking-widest text-white/60">
                          yours
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-white/40">
                      @{c.owner_username ?? "anon"} · {c.subscriber_count} subscriber
                      {c.subscriber_count === 1 ? "" : "s"}
                    </span>
                  </span>
                </Link>
                {!c.is_owner && (
                  <button
                    onClick={() => void toggleSub(c)}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs transition ${
                      c.is_subscribed
                        ? "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                        : "border-neon-blue/50 bg-neon-blue/10 text-neon-blue hover:bg-neon-blue/20"
                    }`}
                  >
                    {c.is_subscribed ? "Subscribed" : "Subscribe"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
