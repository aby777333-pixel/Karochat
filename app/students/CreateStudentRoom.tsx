"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

type Visibility = "public" | "unlisted";

const VIS_OPTIONS: { value: Visibility; label: string; icon: string; description: string }[] = [
  {
    value: "public",
    icon: "🌍",
    label: "Open",
    description: "Anyone in the Students area can find and join."
  },
  {
    value: "unlisted",
    icon: "🔗",
    label: "Private (invite link only)",
    description: "Hidden from the lobby. Share the 8-char code with friends."
  }
];

/**
 * Create a new student room and tag it with category='students'. Used by
 * StudentsHome lobbies + rooms tabs. After creation we redirect into the
 * room so the user can immediately invite people / start a call /
 * whiteboard.
 */
export function CreateStudentRoom({ hint }: { hint?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
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
          p_visibility: visibility
        })
        .single<{ id: string; invite_code: string | null; visibility: Visibility }>();
      if (rpcErr || !data) {
        setError(rpcErr?.message ?? "Could not create room.");
        return;
      }
      // Tag this room under the Students area so StudentRoomsBrowser picks
      // it up. The creator owns the row so the rooms_update_owner RLS
      // policy allows the update.
      const { error: tagErr } = await supabase
        .from("rooms")
        .update({
          category_slug: "students",
          subcategory_slug: "student-rooms"
        })
        .eq("id", data.id);
      if (tagErr) {
        console.warn("[create-student-room] could not tag category", tagErr);
      }
      setCreated({ id: data.id, code: data.invite_code });
      if (data.visibility === "public") {
        router.push(`/rooms/${data.id}`);
      }
    });
  }

  if (created && created.code) {
    return (
      <section className="surface-glass tint-mint p-5">
        <h3 className="font-display text-base font-semibold">Student room created</h3>
        <p className="mt-1 text-xs text-white/60">
          Share this invite code with the people you want in. Open the room
          and the 📞 button starts a voice/video call; the 🖼️ button opens
          the shared whiteboard.
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
    <section className="surface-glass tint-purple p-5">
      <h3 className="font-display text-base font-semibold">
        Create a student room
      </h3>
      <p className="mt-1 text-xs text-white/60">
        {hint ??
          "Same chat, voice, video, screen-share, and whiteboard as any Karochat room — filed under Students for easy discovery."}
      </p>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Room name (e.g. JEE Physics Doubt Clearing)"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-neon-purple/60"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={240}
          placeholder="What's this room about? (optional)"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-neon-purple/60"
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
                  ? "border-neon-purple/60 bg-neon-purple/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <input
                type="radio"
                name="student-visibility"
                value={opt.value}
                checked={visibility === opt.value}
                onChange={() => setVisibility(opt.value)}
                className="mt-0.5 accent-neon-purple"
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
          {pending ? "Creating…" : "Create student room"}
        </Button>
      </form>
    </section>
  );
}
