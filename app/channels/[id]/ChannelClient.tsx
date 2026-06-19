"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

export type ChannelInfo = {
  id: string;
  owner_profile_id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  subscriber_count: number;
  owner_username: string | null;
  owner_display_name: string | null;
  is_owner: boolean;
  is_subscribed: boolean;
};

export type ChannelMessage = {
  id: string;
  body_markdown: string | null;
  media_url: string | null;
  poll_data: { question?: string; options?: string[] } | null;
  created_at: string;
  reactions: Record<string, number>;
  my_reaction: string | null;
  poll_counts: number[] | null;
  my_vote: number | null;
};

const QUICK = ["👍", "❤️", "😂", "🔥", "😮", "🎉"];
const MAX_IMG = 8 * 1024 * 1024;

function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function ChannelClient({
  currentUserId,
  channel,
  initialMessages
}: {
  currentUserId: string;
  channel: ChannelInfo;
  initialMessages: ChannelMessage[];
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [subscribed, setSubscribed] = useState(channel.is_subscribed);
  const [subCount, setSubCount] = useState(channel.subscriber_count);
  const [messages, setMessages] = useState<ChannelMessage[]>(initialMessages);

  const canSee = channel.is_owner || subscribed;

  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc("list_channel_messages", { p_channel_id: channel.id });
    setMessages((data ?? []) as ChannelMessage[]);
  }, [supabase, channel.id]);

  async function toggleSub() {
    const was = subscribed;
    setSubscribed(!was);
    setSubCount((c) => Math.max(0, c + (was ? -1 : 1)));
    const { error } = was
      ? await supabase
          .from("broadcast_channel_subscriptions")
          .delete()
          .eq("channel_id", channel.id)
          .eq("subscriber_profile_id", currentUserId)
      : await supabase
          .from("broadcast_channel_subscriptions")
          .insert({ channel_id: channel.id, subscriber_profile_id: currentUserId });
    if (error) {
      setSubscribed(was);
      setSubCount(channel.subscriber_count);
      return;
    }
    if (!was) await refresh(); // just subscribed → load messages
    else setMessages([]);
    router.refresh();
  }

  async function react(m: ChannelMessage, emoji: string) {
    const mine = m.my_reaction;
    // Optimistic update.
    setMessages((prev) =>
      prev.map((x) => {
        if (x.id !== m.id) return x;
        const r = { ...x.reactions };
        if (mine) r[mine] = Math.max(0, (r[mine] ?? 1) - 1);
        const next = mine === emoji ? null : emoji;
        if (next) r[next] = (r[next] ?? 0) + 1;
        Object.keys(r).forEach((k) => (r[k] ?? 0) <= 0 && delete r[k]);
        return { ...x, reactions: r, my_reaction: next };
      })
    );
    await supabase.rpc("react_broadcast_message", { p_message_id: m.id, p_emoji: emoji });
  }

  async function vote(m: ChannelMessage, idx: number) {
    setMessages((prev) =>
      prev.map((x) => {
        if (x.id !== m.id || !x.poll_counts) return x;
        const counts = [...x.poll_counts];
        if (x.my_vote != null) counts[x.my_vote] = Math.max(0, counts[x.my_vote]! - 1);
        counts[idx] = (counts[idx] ?? 0) + 1;
        return { ...x, poll_counts: counts, my_vote: idx };
      })
    );
    await supabase.rpc("vote_broadcast_poll", { p_message_id: m.id, p_option_index: idx });
  }

  async function del(m: ChannelMessage) {
    if (!confirm("Delete this message?")) return;
    const { error } = await supabase.from("broadcast_messages").delete().eq("id", m.id);
    if (!error) setMessages((prev) => prev.filter((x) => x.id !== m.id));
  }

  const owner = channel.owner_display_name ?? channel.owner_username ?? "anon";

  return (
    <div className="space-y-4">
      {/* Channel header */}
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/10 text-xl">
          {channel.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={channel.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            "📣"
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-semibold">{channel.name}</h1>
          <p className="truncate text-[11px] text-white/40">
            @{channel.owner_username ?? "anon"} · {subCount} subscriber{subCount === 1 ? "" : "s"}
          </p>
        </div>
        {!channel.is_owner && (
          <button
            onClick={() => void toggleSub()}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs transition ${
              subscribed
                ? "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                : "border-neon-blue/50 bg-neon-blue/10 text-neon-blue hover:bg-neon-blue/20"
            }`}
          >
            {subscribed ? "Subscribed" : "Subscribe"}
          </button>
        )}
      </div>
      {channel.description && <p className="text-sm text-white/60">{channel.description}</p>}

      {channel.is_owner && <Composer channelId={channel.id} currentUserId={currentUserId} onPosted={refresh} />}

      {!canSee ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-8 text-center text-sm text-white/50">
          Subscribe to see what {owner} is sharing.
        </p>
      ) : messages.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-8 text-center text-sm text-white/50">
          {channel.is_owner ? "Post your first broadcast above." : "Nothing here yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => {
            const totalVotes = (m.poll_counts ?? []).reduce((a, b) => a + b, 0);
            return (
              <li key={m.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="mb-1 flex items-center justify-between text-[11px] text-white/40">
                  <span>{ago(m.created_at)}</span>
                  {channel.is_owner && (
                    <button onClick={() => void del(m)} className="hover:text-neon-red" aria-label="Delete">
                      🗑
                    </button>
                  )}
                </div>

                {m.body_markdown && <p className="whitespace-pre-wrap text-sm text-white/90">{m.body_markdown}</p>}

                {m.media_url && (
                  <div className="mt-2 overflow-hidden rounded-lg bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.media_url} alt="" className="max-h-[60vh] w-full object-contain" />
                  </div>
                )}

                {/* Poll */}
                {m.poll_data?.options && m.poll_counts && (
                  <div className="mt-2 space-y-1.5">
                    {m.poll_data.question && (
                      <p className="text-sm font-medium text-white">{m.poll_data.question}</p>
                    )}
                    {m.poll_data.options.map((opt, i) => {
                      const count = m.poll_counts![i] ?? 0;
                      const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
                      const mine = m.my_vote === i;
                      return (
                        <button
                          key={i}
                          onClick={() => void vote(m, i)}
                          className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition ${
                            mine ? "border-neon-mint/60" : "border-white/10 hover:border-white/25"
                          }`}
                        >
                          <span
                            className="absolute inset-y-0 left-0 bg-neon-blue/15"
                            style={{ width: `${pct}%` }}
                          />
                          <span className="relative flex justify-between">
                            <span className="text-white/90">
                              {mine ? "✓ " : ""}
                              {opt}
                            </span>
                            <span className="text-white/50">{pct}%</span>
                          </span>
                        </button>
                      );
                    })}
                    <p className="text-[11px] text-white/40">
                      {totalVotes} vote{totalVotes === 1 ? "" : "s"}
                    </p>
                  </div>
                )}

                {/* Reactions */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {Object.entries(m.reactions).map(([emoji, count]) => (
                    <button
                      key={emoji}
                      onClick={() => void react(m, emoji)}
                      className={`rounded-full border px-2 py-0.5 text-xs transition ${
                        m.my_reaction === emoji
                          ? "border-neon-blue/60 bg-neon-blue/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      {emoji} {count}
                    </button>
                  ))}
                  <ReactMenu onPick={(e) => void react(m, e)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ReactMenu({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/60 hover:bg-white/10"
        aria-label="React"
      >
        ＋
      </button>
      {open && (
        <span className="absolute bottom-7 left-0 z-10 flex gap-1 rounded-xl border border-white/10 bg-ink-800 p-1.5 shadow-lg">
          {QUICK.map((e) => (
            <button
              key={e}
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
              className="rounded-md px-1.5 py-0.5 text-lg hover:bg-white/10"
            >
              {e}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

function Composer({
  channelId,
  currentUserId,
  onPosted
}: {
  channelId: string;
  currentUserId: string;
  onPosted: () => void | Promise<void>;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pollMode, setPollMode] = useState(false);
  const [pollQ, setPollQ] = useState("");
  const [pollOpts, setPollOpts] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_IMG) {
      setError("Image must be under 8 MB.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function post() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const opts = pollOpts.map((o) => o.trim()).filter(Boolean);
      const hasPoll = pollMode && opts.length >= 2;
      if (!body.trim() && !file && !hasPoll) {
        throw new Error("Write something, add an image, or build a poll.");
      }
      let mediaUrl: string | null = null;
      if (file) {
        const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${currentUserId}/bcast-${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage
          .from("chat-images")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) throw up.error;
        mediaUrl = supabase.storage.from("chat-images").getPublicUrl(path).data.publicUrl;
        const scan = await fetch("/api/scan/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicUrl: mediaUrl, bucket: "chat-images", path })
        });
        const sd = await scan.json().catch(() => ({}));
        if (sd?.blocked) throw new Error("Image flagged by our scanner — not posted.");
      }
      const { error: insErr } = await supabase.from("broadcast_messages").insert({
        channel_id: channelId,
        body_markdown: body.trim() || null,
        media_url: mediaUrl,
        poll_data: hasPoll ? { question: pollQ.trim() || null, options: opts } : null
      });
      if (insErr) throw insErr;
      // reset
      setBody("");
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPollMode(false);
      setPollQ("");
      setPollOpts(["", ""]);
      await onPosted();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't post.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-neon-blue/20 bg-neon-blue/[0.04] p-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        rows={2}
        placeholder="Broadcast to your subscribers…"
        className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/60"
      />

      {previewUrl && (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="" className="max-h-40 rounded-lg" />
          <button
            onClick={() => {
              URL.revokeObjectURL(previewUrl);
              setFile(null);
              setPreviewUrl(null);
            }}
            className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-ink-900/90 text-[11px]"
          >
            ✕
          </button>
        </div>
      )}

      {pollMode && (
        <div className="space-y-1.5 rounded-lg border border-white/10 bg-black/20 p-2">
          <input
            value={pollQ}
            onChange={(e) => setPollQ(e.target.value)}
            maxLength={120}
            placeholder="Poll question (optional)"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none placeholder:text-white/30"
          />
          {pollOpts.map((o, i) => (
            <input
              key={i}
              value={o}
              onChange={(e) => setPollOpts((prev) => prev.map((x, n) => (n === i ? e.target.value : x)))}
              maxLength={60}
              placeholder={`Option ${i + 1}`}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none placeholder:text-white/30"
            />
          ))}
          {pollOpts.length < 5 && (
            <button
              onClick={() => setPollOpts((p) => [...p, ""])}
              className="text-xs text-neon-blue hover:underline"
            >
              + Add option
            </button>
          )}
        </div>
      )}

      {error && <p className="rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm hover:bg-white/10"
          aria-label="Add image"
        >
          🖼️
        </button>
        <button
          onClick={() => setPollMode((v) => !v)}
          className={`rounded-lg border px-2.5 py-1.5 text-sm ${
            pollMode ? "border-neon-blue/60 bg-neon-blue/10" : "border-white/10 bg-white/5 hover:bg-white/10"
          }`}
          aria-label="Poll"
        >
          📊
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
        <Button onClick={() => void post()} disabled={busy} className="ml-auto px-4 py-2 text-sm">
          {busy ? "Posting…" : "Broadcast"}
        </Button>
      </div>
    </div>
  );
}
