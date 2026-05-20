"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

type Visibility = "public" | "listed" | "unlisted" | "secret";

const VIS_OPTIONS: { value: Visibility; label: string; description: string; icon: string }[] = [
  {
    value: "public",
    label: "Public",
    icon: "🌍",
    description: "Anyone can find this room in the lobby and join."
  },
  {
    value: "listed",
    label: "Listed",
    icon: "🔒",
    description: "Shows in the lobby with a lock — people request to join."
  },
  {
    value: "unlisted",
    label: "Unlisted",
    icon: "🔗",
    description: "Hidden from the lobby. Only the invite code lets people in."
  },
  {
    value: "secret",
    label: "Secret",
    icon: "🕶️",
    description: "Hidden everywhere. Joinable only via in-app invite."
  }
];

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
  const searchParams = useSearchParams();
  const focusOnLoad = searchParams.get("create") === "1";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; code: string | null } | null>(null);

  useEffect(() => {
    if (focusOnLoad) {
      const el = document.getElementById("create-room-name");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLInputElement | null)?.focus();
    }
  }, [focusOnLoad]);

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
          p_visibility: visibility
        })
        .single<{ id: string; invite_code: string | null; visibility: Visibility }>();
      if (rpcErr || !data) {
        setError(rpcErr?.message ?? "Could not create room.");
        return;
      }
      setCreated({ id: data.id, code: data.invite_code });
      // Public + listed: go straight into the room.
      // Unlisted + secret: stay on this card so the owner can copy the code.
      if (data.visibility === "public" || data.visibility === "listed") {
        router.push(`/rooms/${data.id}`);
      }
    });
  }

  if (created && created.code) {
    return (
      <section className="surface-glass tint-mint p-5">
        <h3 className="font-display text-base font-semibold">Room created</h3>
        <p className="mt-1 text-xs text-white/60">
          Share this invite code with the people you want in. They&apos;ll paste it
          under &quot;Have an invite?&quot; to join.
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
              setVisibility("public");
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
    <section className="surface-glass tint-blue p-5">
      <h3 className="font-display text-base font-semibold">Create a room</h3>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <input
          id="create-room-name"
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
        <fieldset className="space-y-1.5">
          <legend className="text-[10px] uppercase tracking-widest text-white/40">
            Visibility
          </legend>
          {VIS_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                visibility === opt.value
                  ? "border-neon-blue/60 bg-neon-blue/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <input
                type="radio"
                name="visibility"
                value={opt.value}
                checked={visibility === opt.value}
                onChange={() => setVisibility(opt.value)}
                className="mt-0.5 accent-neon-blue"
              />
              <div>
                <div className="font-medium text-white">
                  {opt.icon} {opt.label}
                </div>
                <p className="mt-0.5 text-white/55">{opt.description}</p>
              </div>
            </label>
          ))}
        </fieldset>
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
    <section className="surface-glass tint-purple p-5">
      <h3 className="font-display text-base font-semibold">Have an invite?</h3>
      <p className="mt-1 text-xs text-white/60">
        Paste an 8-character code to join an unlisted room.
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

export function JoinPublic({
  roomId,
  visibility
}: {
  roomId: string;
  visibility: "public" | "listed";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requested, setRequested] = useState(false);

  function onClick() {
    if (visibility === "listed") {
      // request flow lands in Phase B
      setRequested(true);
      return;
    }
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

  if (visibility === "listed") {
    return (
      <button
        onClick={onClick}
        disabled={requested}
        title={
          requested
            ? "Request-to-join flow lands next session — for now this is a placeholder."
            : "Request to join this private room"
        }
        className="rounded-lg border border-neon-amber/40 bg-neon-amber/10 px-3 py-1.5 text-xs font-medium text-neon-amber transition hover:bg-neon-amber/20 disabled:opacity-60"
      >
        {requested ? "Requested" : "Request"}
      </button>
    );
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
