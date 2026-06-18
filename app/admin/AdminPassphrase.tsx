"use client";

// Karochat — owner-portal control to rotate the admin sign-in passphrase.
// Calls set_admin_instant_secret() (admin-gated SECURITY DEFINER RPC). The
// passphrase is what admin emails must supply for instant access, so it's not
// derivable from the email — see project_auth_model.

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AdminPassphrase() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const next = value.trim();
    if (next.length < 6) {
      setErr("Passphrase must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("set_admin_instant_secret", { p_new: next });
      if (error) throw error;
      setNote("✓ Admin passphrase updated. Use it on your next admin sign-in.");
      setValue("");
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't update the passphrase.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-glass mt-3 p-4">
      <p className="font-display text-[15px] font-semibold text-white">🔑 Admin passphrase</p>
      <p className="mt-0.5 text-[12px] text-white/55">
        Required for admin instant access — keep it secret and not guessable from your email.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="password"
          autoComplete="new-password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
          }}
          placeholder="New passphrase (min 6 chars)"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-neon-purple/60"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="shrink-0 rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neon-purple/30 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Update"}
        </button>
      </div>
      {note && <p className="mt-2 text-[12px] text-neon-mint">{note}</p>}
      {err && <p className="mt-2 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{err}</p>}
    </section>
  );
}
