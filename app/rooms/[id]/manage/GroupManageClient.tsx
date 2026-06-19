"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

export type ManageRoom = {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  join_policy: "open" | "request" | null;
  rules_markdown: string | null;
  owner_id: string | null;
};
export type JoinRequest = {
  request_id: string;
  requester_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};
export type GroupMember = {
  user_id: string;
  role: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

const MAX_IMG = 8 * 1024 * 1024;

export function GroupManageClient({
  currentUserId,
  isOwner,
  room,
  initialRequests,
  members
}: {
  currentUserId: string;
  isOwner: boolean;
  room: ManageRoom;
  initialRequests: JoinRequest[];
  members: GroupMember[];
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();

  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description ?? "");
  const [rules, setRules] = useState(room.rules_markdown ?? "");
  const [joinPolicy, setJoinPolicy] = useState<"open" | "request">(room.join_policy ?? "open");
  const [avatarUrl, setAvatarUrl] = useState(room.avatar_url);
  const [bannerUrl, setBannerUrl] = useState(room.banner_url);
  const [requests, setRequests] = useState<JoinRequest[]>(initialRequests);
  const [savingSettings, setSavingSettings] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyReq, setBusyReq] = useState<string | null>(null);
  const [transferTo, setTransferTo] = useState("");
  const [transferring, setTransferring] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  async function uploadImage(file: File, kind: "avatar" | "banner") {
    if (file.size > MAX_IMG) {
      setError("Image must be under 8 MB.");
      return;
    }
    setError(null);
    setNote(null);
    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
    const path = `${currentUserId}/group-${kind}-${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage
      .from("chat-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) {
      setError(up.error.message);
      return;
    }
    const url = supabase.storage.from("chat-images").getPublicUrl(path).data.publicUrl;
    const scan = await fetch("/api/scan/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicUrl: url, bucket: "chat-images", path })
    });
    const sd = await scan.json().catch(() => ({}));
    if (sd?.blocked) {
      setError("Image flagged by our scanner — not used.");
      return;
    }
    const col = kind === "avatar" ? "avatar_url" : "banner_url";
    const { error: e } = await supabase.from("rooms").update({ [col]: url }).eq("id", room.id);
    if (e) {
      setError(e.message);
      return;
    }
    if (kind === "avatar") setAvatarUrl(url);
    else setBannerUrl(url);
    setNote(`${kind === "avatar" ? "Avatar" : "Banner"} updated.`);
    router.refresh();
  }

  async function saveSettings() {
    if (savingSettings) return;
    setSavingSettings(true);
    setError(null);
    setNote(null);
    const { error: e } = await supabase
      .from("rooms")
      .update({
        name: name.trim() || room.name,
        description: description.trim() || null,
        rules_markdown: rules.trim() || null,
        join_policy: joinPolicy
      })
      .eq("id", room.id);
    setSavingSettings(false);
    if (e) {
      setError(e.message);
      return;
    }
    setNote("Group settings saved.");
    router.refresh();
  }

  async function decide(req: JoinRequest, approve: boolean) {
    if (busyReq) return;
    setBusyReq(req.request_id);
    const { error: e } = await supabase.rpc(approve ? "approve_join_request" : "reject_join_request", {
      p_request_id: req.request_id
    });
    setBusyReq(null);
    if (e) {
      setError(e.message);
      return;
    }
    setRequests((prev) => prev.filter((r) => r.request_id !== req.request_id));
  }

  async function transfer() {
    if (!transferTo || transferring) return;
    const member = members.find((m) => m.user_id === transferTo);
    if (!confirm(`Transfer ownership to ${member?.display_name ?? member?.username ?? "this member"}? You'll become an admin.`))
      return;
    setTransferring(true);
    setError(null);
    const { error: e } = await supabase.rpc("transfer_room_ownership", {
      p_room_id: room.id,
      p_new_owner: transferTo
    });
    setTransferring(false);
    if (e) {
      setError(e.message);
      return;
    }
    setNote("Ownership transferred.");
    router.push(`/rooms/${room.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {note && <p className="rounded-md bg-neon-mint/10 px-2 py-1 text-xs text-neon-mint">{note}</p>}
      {error && <p className="rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{error}</p>}

      {/* Join requests (owner + admins) */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-white/80">
          Join requests {requests.length > 0 && <span className="text-neon-mint">({requests.length})</span>}
        </h2>
        {requests.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-4 text-center text-xs text-white/45">
            No pending requests.
          </p>
        ) : (
          <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
            {requests.map((r) => {
              const nm = r.display_name ?? r.username ?? "anon";
              return (
                <li key={r.request_id} className="flex items-center gap-3 bg-white/[0.02] px-3 py-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10">
                    {r.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs">{nm.slice(0, 1).toUpperCase()}</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-white">{nm}</span>
                    <span className="block truncate text-[11px] text-white/40">@{r.username ?? "anon"}</span>
                  </span>
                  <button
                    onClick={() => void decide(r, true)}
                    disabled={busyReq === r.request_id}
                    className="rounded-lg border border-neon-mint/50 bg-neon-mint/15 px-2.5 py-1.5 text-xs text-neon-mint hover:bg-neon-mint/25 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => void decide(r, false)}
                    disabled={busyReq === r.request_id}
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/70 hover:bg-neon-red/10 hover:text-neon-red disabled:opacity-50"
                  >
                    Decline
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Settings — owner only (RLS restricts room updates to the owner) */}
      {isOwner && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white/80">Group settings</h2>

          {/* Banner + avatar */}
          <div className="overflow-hidden rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => bannerRef.current?.click()}
              className="relative block h-28 w-full bg-gradient-to-br from-neon-purple/30 via-neon-blue/25 to-neon-mint/25"
            >
              {bannerUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
              )}
              <span className="absolute bottom-1 right-2 rounded bg-black/50 px-2 py-0.5 text-[10px] text-white/80">
                change banner
              </span>
            </button>
            <div className="flex items-center gap-3 px-3 py-3">
              <button
                type="button"
                onClick={() => avatarRef.current?.click()}
                className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/10 text-xl"
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  "📣"
                )}
              </button>
              <span className="text-xs text-white/50">Tap the icon to set a group picture, the bar to set a banner.</span>
            </div>
          </div>
          <input
            ref={avatarRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && void uploadImage(e.target.files[0], "avatar")}
          />
          <input
            ref={bannerRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && void uploadImage(e.target.files[0], "banner")}
          />

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Group name"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-blue/60"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={240}
            rows={2}
            placeholder="Description"
            className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/60"
          />
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Group rules & guidelines (optional)"
            className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/60"
          />

          <div>
            <p className="mb-1.5 text-xs font-medium text-white/60">Who can join?</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setJoinPolicy("open")}
                className={`rounded-xl border px-3 py-2 text-xs transition ${
                  joinPolicy === "open"
                    ? "border-neon-mint/60 bg-neon-mint/10 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                🔓 Open — anyone joins
              </button>
              <button
                onClick={() => setJoinPolicy("request")}
                className={`rounded-xl border px-3 py-2 text-xs transition ${
                  joinPolicy === "request"
                    ? "border-neon-mint/60 bg-neon-mint/10 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                ✋ Request to join
              </button>
            </div>
          </div>

          <Button onClick={() => void saveSettings()} disabled={savingSettings} className="w-full">
            {savingSettings ? "Saving…" : "Save settings"}
          </Button>
        </section>
      )}

      {/* Ownership transfer — owner only */}
      {isOwner && members.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-white/80">Transfer ownership</h2>
          <p className="text-xs text-white/45">
            Hand the group to another member. You’ll stay on as an admin.
          </p>
          <div className="flex gap-2">
            <select
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-blue/60"
            >
              <option value="">Choose a member…</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name ?? m.username ?? "anon"}
                </option>
              ))}
            </select>
            <button
              onClick={() => void transfer()}
              disabled={!transferTo || transferring}
              className="shrink-0 rounded-xl border border-neon-red/40 bg-neon-red/10 px-3 py-2 text-sm text-neon-red hover:bg-neon-red/20 disabled:opacity-50"
            >
              {transferring ? "…" : "Transfer"}
            </button>
          </div>
        </section>
      )}

      <p className="text-[11px] text-white/35">
        Member roles, mute, kick &amp; ban are managed by tapping a member in the
        group’s member list.
      </p>
    </div>
  );
}
