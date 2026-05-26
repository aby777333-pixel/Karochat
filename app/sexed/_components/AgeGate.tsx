"use client";

// Karochat — sex-ed age gate.
//
// Two roles in one component:
//   • If birth_year is not set, prompt the user to set it (4-digit year
//     picker, plain HTML number input). Calls set_birth_year RPC.
//   • If birth_year says 18+ but adult_attested_at is null, surface a
//     one-time "I'm 18+ and want adult content" attestation. Calls
//     attest_adult RPC.
//
// Both inline-card style (no modal) so they degrade gracefully without
// JS and don't block the rest of the page.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function BirthYearCard({ currentYear }: { currentYear: number }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [year, setYear] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!year || year < 1900 || year > currentYear) {
      setErr("Please enter a 4-digit birth year.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase.rpc("set_birth_year", { p_year: year });
      if (error) throw error;
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-glass tint-amber mt-4 p-5">
      <p className="text-[10px] uppercase tracking-widest text-neon-amber/80">
        🎂 One small detail
      </p>
      <h2 className="mt-1 font-display text-lg font-semibold text-white">
        Tell us your birth year
      </h2>
      <p className="mt-1 text-sm text-white/70">
        We use the year to show age-appropriate articles. We don&apos;t need
        your full date of birth, and we don&apos;t share this with anyone.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={1900}
          max={currentYear - 13}
          value={year}
          onChange={(e) =>
            setYear(e.target.value === "" ? "" : Number(e.target.value))
          }
          placeholder="e.g. 2008"
          className="w-32 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm outline-none placeholder:text-white/30 focus:border-neon-amber/40"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-neon-amber px-3 py-1.5 text-sm font-medium text-ink-900 hover:bg-neon-amber/90 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {err && (
          <span className="text-[12px] text-neon-red">{err}</span>
        )}
      </div>
    </section>
  );
}

export function AdultAttestCard() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function attest() {
    setErr(null);
    const { error } = await supabase.rpc("attest_adult");
    if (error) {
      setErr(error.message);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <section className="surface-glass tint-mint mt-4 p-5">
      <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
        🔓 Unlock adult content
      </p>
      <h2 className="mt-1 font-display text-lg font-semibold text-white">
        I&apos;m 18+ and want the full pleasure-positive library
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-white/75">
        Karochat treats the 18+ tier separately so the rest of the site
        stays age-appropriate. The 18+ tier includes explicit
        technique articles for vaginal, oral, anal, manual, lesbian/WLW,
        gay/MLM, trans-affirming sex, toys + lube, and kink/BDSM
        intro — all written as adult sex education, not adult media.
      </p>
      <p className="mt-2 text-[12px] text-white/55">
        By tapping below, you confirm you are 18 or older and choose to
        see adult content. You can&apos;t un-do this on this account, but
        you can change your privacy mode anytime in your menu.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={attest}
          disabled={pending}
          className="rounded-lg bg-neon-mint px-4 py-2 text-sm font-medium text-ink-900 hover:bg-neon-mint/90 disabled:opacity-60"
        >
          {pending ? "Unlocking…" : "I'm 18+ — show me everything"}
        </button>
        {err && (
          <span className="text-[12px] text-neon-red">{err}</span>
        )}
      </div>
    </section>
  );
}
