"use client";

// Karochat — guest access notice + in-place upgrade (Wave 22).
// Shows ONLY for guests. Explains that guests are limited to the Lobby and
// lets them unlock full access instantly by adding email + phone (no
// verification) via register_contact(). Renders null for full-access users.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { COUNTRY_CODES, DEFAULT_COUNTRY_VALUE, dialOf, isValidEmail, isValidPhone, localPhone, valueForIso } from "@/lib/countryCodes";

export function GuestAccessCard() {
  const router = useRouter();
  const [isGuest, setIsGuest] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState(DEFAULT_COUNTRY_VALUE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromUpgradeRedirect, setFromUpgradeRedirect] = useState(false);

  useEffect(() => {
    let alive = true;
    const supabase = createSupabaseBrowserClient();
    void (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!alive || !user) {
        if (alive) setIsGuest(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("is_guest")
        .eq("id", user.id)
        .maybeSingle();
      if (alive) setIsGuest(!!data?.is_guest);
    })();
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get("upgrade") === "1") setFromUpgradeRedirect(true);
    } catch {
      /* ignore */
    }
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await fetch("/api/geo");
        const j = await r.json();
        const v = valueForIso(j?.country);
        if (alive && v) setCountry(v);
      } catch {
        /* keep default */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    const dial = dialOf(country);
    const local = localPhone(phone, dial);
    const fullPhone = `${dial} ${local}`.trim();
    if (!isValidEmail(addr)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!isValidPhone(local)) {
      setError("Please enter a valid phone number.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: rpcErr } = await supabase.rpc("register_contact", {
      p_email: addr,
      p_phone: fullPhone
    });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setIsGuest(false);
    router.refresh();
  }

  if (isGuest !== true) return null;

  return (
    <section className="surface-glass tint-amber p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-2xl">👋</span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-white">
            {fromUpgradeRedirect ? "That's a full-access feature" : "You're browsing as a guest"}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-white/75">
            Guests can hang out here in the <span className="text-white">Lobby</span>. Add your
            email &amp; phone to unlock <span className="text-white">full access</span> — every
            room, DMs, voice &amp; video calls, posting, and more. It&apos;s instant: no
            verification, no waiting.
          </p>
        </div>
      </div>

      <form onSubmit={unlock} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-neon-amber/60"
        />
        <div className="flex gap-2">
          <select
            aria-label="Country code"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-[6rem] shrink-0 rounded-xl border border-white/10 bg-black/30 px-2 py-2.5 text-sm text-white outline-none focus:border-neon-amber/60"
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.iso} value={`${c.iso}:${c.dial}`}>
                {c.flag} {c.dial}
              </option>
            ))}
          </select>
          <input
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-neon-amber/60"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-neon-amber px-4 py-2.5 text-sm font-semibold text-ink-900 transition hover:bg-neon-amber/90 active:scale-95 disabled:opacity-50"
        >
          {busy ? "Unlocking…" : "Unlock full access"}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-neon-red">{error}</p>}
    </section>
  );
}
