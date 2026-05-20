"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Squad = {
  id: string;
  name: string;
  subject: string | null;
  level: string | null;
  syllabus?: string | null;
  description?: string | null;
  member_count: number;
  max_members: number;
  visibility?: string;
  owner_profile_id?: string;
};

export function SquadsClient({
  currentUserId,
  mine,
  listed
}: {
  currentUserId: string;
  mine: Squad[];
  listed: Squad[];
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "listed_private">("private");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setErr(null);
    try {
      const { data, error } = await supabase.rpc("create_study_squad", {
        p_name: name.trim(),
        p_subject: subject || null,
        p_level: level || null,
        p_syllabus: null,
        p_description: description.trim() || null,
        p_visibility: visibility
      });
      if (error) throw error;
      if (data) router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Could not create squad.");
    } finally {
      setBusy(false);
    }
  }

  async function join(squadId: string) {
    await supabase.rpc("join_study_squad", { p_squad_id: squadId });
    router.refresh();
  }

  return (
    <>
      {/* My squads */}
      <section className="mt-5">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          My squads
        </p>
        {mine.length === 0 ? (
          <p className="mt-2 text-sm text-white/55">
            You aren&apos;t in any squad yet. Create one below or join a listed one.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {mine.map((s) => (
              <li key={s.id} className="surface-glass p-3">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-base text-white">{s.name}</span>
                  <span className="text-[10px] uppercase tracking-widest text-white/40">
                    {s.member_count}/{s.max_members}
                  </span>
                </p>
                <p className="text-[11px] text-white/45">
                  {[s.subject, s.level, s.visibility].filter(Boolean).join(" · ")}
                </p>
                {s.description && (
                  <p className="mt-1 text-[12px] text-white/65">{s.description}</p>
                )}
                {s.owner_profile_id === currentUserId && (
                  <span className="mt-1 inline-block rounded-sm bg-neon-purple/15 px-1 text-[9px] uppercase tracking-widest text-neon-purple">
                    owner
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Create squad */}
      <section className="surface-glass mt-6 p-5">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          + Create a squad
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 80))}
          placeholder="Name your squad…"
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
        />
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value.slice(0, 40))}
            placeholder="Subject (e.g. calculus)"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
          />
          <input
            value={level}
            onChange={(e) => setLevel(e.target.value.slice(0, 40))}
            placeholder="Level (e.g. undergrad-yr2, class-12)"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
          />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 280))}
          placeholder="What's the squad for?"
          rows={2}
          className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setVisibility("private")}
            className={clsx(
              "rounded-md border px-2 py-1 text-xs",
              visibility === "private"
                ? "border-neon-mint/60 bg-neon-mint/15 text-neon-mint"
                : "border-white/10 bg-white/5 text-white/65"
            )}
          >
            🔒 Private (invite-only)
          </button>
          <button
            type="button"
            onClick={() => setVisibility("listed_private")}
            className={clsx(
              "rounded-md border px-2 py-1 text-xs",
              visibility === "listed_private"
                ? "border-neon-mint/60 bg-neon-mint/15 text-neon-mint"
                : "border-white/10 bg-white/5 text-white/65"
            )}
          >
            🔗 Listed (others can request to join)
          </button>
        </div>
        {err && <p className="mt-2 text-xs text-neon-red">{err}</p>}
        <button
          type="button"
          onClick={() => void create()}
          disabled={!name.trim() || busy}
          className="mt-3 rounded-xl bg-neon-mint px-3 py-1.5 text-sm font-medium text-ink-900 hover:bg-neon-mint/90 disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create squad"}
        </button>
      </section>

      {/* Listed squads */}
      <section className="mt-6">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          Discover listed squads
        </p>
        {listed.length === 0 ? (
          <p className="mt-2 text-sm text-white/55">
            No listed squads yet. Be the first to list one.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {listed.map((s) => (
              <li key={s.id} className="surface-glass p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-base text-white">{s.name}</span>
                  <span className="text-[10px] uppercase tracking-widest text-white/40">
                    {s.member_count}/{s.max_members}
                  </span>
                </div>
                <p className="text-[11px] text-white/45">
                  {[s.subject, s.level].filter(Boolean).join(" · ")}
                </p>
                {s.description && (
                  <p className="mt-1 text-[12px] text-white/65">{s.description}</p>
                )}
                <button
                  type="button"
                  onClick={() => void join(s.id)}
                  className="mt-2 rounded-md bg-neon-blue px-2 py-1 text-[11px] font-medium text-ink-900 hover:bg-neon-blue/90"
                >
                  Request to join
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
