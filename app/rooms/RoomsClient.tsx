"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

export function RoomsClient() {
  return (
    <>
      <CreateRoomCard />
      <JoinByInviteCard />
    </>
  );
}

function CreateRoomCard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; code: string | null } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Pick a name.");
      return;
    }
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error: rpcErr } = await supabase
        .rpc("create_room", {
          p_name: name.trim(),
          p_description: description.trim() || null,
          p_is_public: isPublic
        })
        .single<{ id: string; invite_code: string | null }>();
      if (rpcErr || !data) {
        setError(rpcErr?.message ?? "Could not create room.");
        return;
      }
      setCreated({ id: data.id, code: data.invite_code });
      if (isPublic) {
        router.push(`/rooms/${data.id}`);
      }
    });
  }

  if (created && created.code) {
    return (
      <section className="surface-glass p-5">
        <h3 className="font-display text-base font-semibold">Private room created</h3>
        <p className="mt-1 text-xs text-white/60">
          Share this invite code with friends. They&apos;ll paste it under &quot;Have an
          invite?&quot; to join.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-lg tracking-widest">
          <span className="flex-1 select-all">{created.code}</span>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(created.code!)}
            className="rounded-md border border-white/10 px-2 py-1 text-[10px] uppercase tracking-widest text-white/70 hover:bg-white/10"
          >
            copy
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => router.push(`/rooms/${created.id}`)} className="flex-1">
            Enter room
          </Button>
          <button
            onClick={() => {
              setCreated(null);
              setName("");
              setDescription("");
            }}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/80 hover:bg-white/10"
          >
            New
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="surface-glass p-5">
      <h3 className="font-display text-base font-semibold">Create a room</h3>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Room name"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-neon-blue/60"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={240}
          placeholder="What's this room about? (optional)"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-neon-blue/60"
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsPublic(true)}
            className={`rounded-xl border px-3 py-2 text-xs transition ${
              isPublic
                ? "border-neon-blue/60 bg-neon-blue/10 text-white"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            🌍 Public
          </button>
          <button
            type="button"
            onClick={() => setIsPublic(false)}
            className={`rounded-xl border px-3 py-2 text-xs transition ${
              !isPublic
                ? "border-neon-purple/60 bg-neon-purple/10 text-white"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            🔒 Private
          </button>
        </div>
        <p className="text-[11px] text-white/40">
          {isPublic
            ? "Public: anyone can find this room and join."
            : "Private: only people with the invite code can join."}
        </p>
        {error && <p className="text-xs text-neon-red">{error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating…" : "Create room"}
        </Button>
      </form>
    </section>
  );
}

function JoinByInviteCard() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim()) {
      setError("Paste the code your friend sent you.");
      return;
    }
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error: rpcErr } = await supabase.rpc("join_room_by_invite", {
        p_code: code.trim()
      });
      if (rpcErr || !data) {
        setError(rpcErr?.message ?? "Invalid invite code.");
        return;
      }
      router.push(`/rooms/${data}`);
      router.refresh();
    });
  }

  return (
    <section className="surface-glass p-5">
      <h3 className="font-display text-base font-semibold">Have an invite?</h3>
      <p className="mt-1 text-xs text-white/60">
        Paste an 8-character code to join a private room.
      </p>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={8}
          placeholder="XXXXXXXX"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-center font-mono text-lg tracking-widest outline-none focus:border-neon-purple/60"
        />
        {error && <p className="text-xs text-neon-red">{error}</p>}
        <Button type="submit" variant="ghost" disabled={pending} className="w-full">
          {pending ? "Joining…" : "Join room"}
        </Button>
      </form>
    </section>
  );
}

export function JoinPublic({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function onClick() {
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("join_public_room", {
        p_room_id: roomId
      });
      if (error || !data) return;
      router.push(`/rooms/${roomId}`);
      router.refresh();
    });
  }
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="rounded-lg bg-neon-blue px-3 py-1.5 text-xs font-medium text-ink-900 shadow-glow-blue transition hover:bg-neon-blue/90 disabled:opacity-60"
    >
      {pending ? "…" : "Join"}
    </button>
  );
}
