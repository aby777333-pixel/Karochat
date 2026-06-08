"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";
import {
  COUNTRY_CODES,
  DEFAULT_COUNTRY_VALUE,
  dialOf,
  isValidEmail,
  isValidPhone,
  localPhone,
  stripLeadingCode,
  valueForIso
} from "@/lib/countryCodes";

const EMAIL_KEY = "karochat:last-email";
const PHONE_KEY = "karochat:last-phone";
const COUNTRY_KEY = "karochat:last-country";

// Deterministic password derived from the email so a returning user with the
// same email logs back into the SAME account (data intact) without a code or
// link. Note: this is email-keyed access by design (the operator's choice for
// frictionless onboarding) — add real verification before a wide launch.
async function derivePassword(email: string): Promise<string> {
  const data = new TextEncoder().encode("karochat:v1:" + email);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(buf);
  let bin = "";
  bytes.forEach((x) => {
    bin += String.fromCharCode(x);
  });
  const b64 = btoa(bin).replace(/[^a-zA-Z0-9]/g, "");
  return "Kc1!" + b64.slice(0, 36);
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState(DEFAULT_COUNTRY_VALUE);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [guestPending, startGuest] = useTransition();

  // Magic-link OTP fallback (for returning users who want their old account
  // back on a new device). Instant email+phone access is the primary path.
  const [otp, setOtp] = useState("");
  const [otpStatus, setOtpStatus] = useState<"idle" | "verifying">("idle");
  const [adminOtp, setAdminOtp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedE = window.localStorage.getItem(EMAIL_KEY);
      if (savedE && /\S+@\S+\.\S+/.test(savedE)) setEmail(savedE);
      const savedP = window.localStorage.getItem(PHONE_KEY);
      if (savedP) setPhone(stripLeadingCode(savedP));
      const savedC = window.localStorage.getItem(COUNTRY_KEY);
      if (savedC && savedC.includes(":")) setCountry(savedC);
    } catch {
      /* ignore */
    }
  }, []);

  // Auto-select the dial code from the visitor's country (GeoIP).
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "error") {
      const detail = params.get("detail");
      setStatus("error");
      setErrorMsg(
        detail
          ? `Sign-in didn't complete: ${decodeURIComponent(detail)}.`
          : "Sign-in didn't complete on this device. Enter the 6-digit code from the email instead."
      );
    }
  }, []);

  function remember(addr: string, ph: string) {
    try {
      window.localStorage.setItem(EMAIL_KEY, addr);
      window.localStorage.setItem(PHONE_KEY, ph);
      window.localStorage.setItem(COUNTRY_KEY, country);
    } catch {
      /* ignore */
    }
  }

  // PRIMARY — instant access. Creates a session immediately (no magic link /
  // code) and records the contact details, which flips the account to full
  // access via register_contact().
  async function onInstant(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    const dial = dialOf(country);
    const local = localPhone(phone, dial); // local digits only — no dup of the code
    const fullPhone = `${dial} ${local}`.trim();
    if (!isValidEmail(addr)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (!isValidPhone(local)) {
      setErrorMsg("Please enter a valid phone number.");
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    const supabase = createSupabaseBrowserClient();
    const loginEmail = addr.toLowerCase();
    const pw = await derivePassword(loginEmail);

    // 1) Create / repair + CONFIRM the account SERVER-SIDE first (service role,
    //    no email is ever sent → no email rate limits). This must run before
    //    any signInWithPassword, otherwise an unconfirmed account would make
    //    Supabase try to (re)send a confirmation email and hit the limit.
    const fn = await supabase.functions.invoke("instant-auth", {
      body: { email: loginEmail, phone: fullPhone, password: pw }
    });
    const res: any = fn.data;
    // Admin accounts must verify with an email code (no instant access).
    if (res?.code === "admin_otp") {
      setAdminOtp(true);
      await sendLink(); // emails a 6-digit code + shows the OTP screen
      setBusy(false);
      return;
    }
    if (fn.error || !res || !res.ok) {
      setBusy(false);
      if (res?.code === "bad_email") setErrorMsg("Please enter a valid email address.");
      else if (res?.code === "bad_phone") setErrorMsg("Please enter a valid phone number.");
      else if (res?.code === "blocked") setErrorMsg("Access from your network has been blocked.");
      else setErrorMsg("Couldn't sign you in right now. Please try again.");
      return;
    }

    // 2) Account is ready (confirmed, no email) → sign in. Same email next
    //    time signs back into the same account with all data intact.
    const si = await supabase.auth.signInWithPassword({ email: loginEmail, password: pw });
    setBusy(false);
    if (!si.error && si.data?.session) {
      remember(addr, local);
      router.replace("/rooms");
      router.refresh();
      return;
    }
    setErrorMsg(si.error?.message ?? "Couldn't sign you in. Please try again.");
  }

  // SECONDARY — email a magic link + 6-digit code (returning users).
  async function sendLink() {
    const addr = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
      setErrorMsg("Enter your email first.");
      return;
    }
    setStatus("sending");
    setErrorMsg(null);
    const supabase = createSupabaseBrowserClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (typeof window !== "undefined" ? window.location.origin : "");
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: `${siteUrl}/auth/callback`, shouldCreateUser: true }
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("sent");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = otp.replace(/\D/g, "");
    if (!email || cleaned.length < 6) {
      setErrorMsg("Enter the 6-digit code from your email.");
      return;
    }
    setOtpStatus("verifying");
    setErrorMsg(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: cleaned,
      type: "email"
    });
    setOtpStatus("idle");
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    router.replace("/rooms");
    router.refresh();
  }

  function continueAsGuest() {
    setErrorMsg(null);
    startGuest(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        setStatus("error");
        setErrorMsg(
          error.message.includes("disabled")
            ? "Guest sign-in isn't enabled on the server yet. Ask the operator to enable Anonymous Sign-Ins in Supabase Auth settings."
            : error.message
        );
        return;
      }
      router.replace("/terms");
      router.refresh();
    });
  }

  // ---- Magic-link "sent" screen (OTP entry) -------------------------------
  if (status === "sent") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
          <p className="font-medium text-white">
            {adminOtp ? "🛠 Admin verification required" : "Check your email."}
          </p>
          {adminOtp && (
            <p className="mb-1 mt-0.5 text-[11px] text-neon-purple">
              Admin accounts can&apos;t use instant access — enter the code we emailed.
            </p>
          )}
          <p className="mt-1 text-white/60">
            We sent a magic link <em>and</em> a 6-digit code to{" "}
            <span className="text-white">{email}</span>. Click the link on this
            device, <em>or</em> enter the code below — it works from any device.
          </p>
          <button
            className="mt-3 text-xs text-neon-blue hover:underline"
            onClick={() => {
              setStatus("idle");
              setOtp("");
            }}
          >
            ← Back
          </button>
        </div>

        <form onSubmit={verifyOtp} className="space-y-2">
          <label className="block text-xs uppercase tracking-widest text-white/50">
            Paste the 6-digit code
          </label>
          <div className="flex gap-2">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center font-mono text-lg tracking-[0.4em] text-white outline-none focus:border-neon-blue/60"
            />
            <Button type="submit" disabled={otpStatus === "verifying" || otp.length < 6}>
              {otpStatus === "verifying" ? "Verifying…" : "Verify"}
            </Button>
          </div>
          {errorMsg && <p className="text-xs text-neon-red">{errorMsg}</p>}
        </form>

        <DividerOr />
        <GuestButton pending={guestPending} onClick={continueAsGuest} />
      </div>
    );
  }

  // ---- Primary: instant email + phone -------------------------------------
  return (
    <div className="space-y-4">
      <form onSubmit={onInstant} className="space-y-3">
        <label className="block text-xs uppercase tracking-widest text-white/50">
          Email
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition focus:border-neon-blue/60 focus:bg-black/40"
        />
        <label className="block text-xs uppercase tracking-widest text-white/50">
          Phone
        </label>
        <div className="flex gap-2">
          <select
            aria-label="Country code"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-[6.5rem] shrink-0 rounded-xl border border-white/10 bg-black/30 px-2 py-3 text-sm text-white outline-none transition focus:border-neon-blue/60"
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
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition focus:border-neon-blue/60 focus:bg-black/40"
          />
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Getting you in…" : "Get instant access →"}
        </Button>
        {errorMsg && <p className="text-xs text-neon-red">{errorMsg}</p>}
        <p className="text-[11px] leading-relaxed text-white/45">
          Enter your email &amp; phone for <span className="text-white/70">full access</span> —
          no verification, no waiting. We use them to keep Karochat safe and to
          reach you if needed.
        </p>
      </form>

      <DividerOr />

      <GuestButton pending={guestPending} onClick={continueAsGuest} />
      <p className="text-center text-[11px] text-white/40">
        Guests can browse the <span className="text-white/70">Lobby</span> only. Add
        your email &amp; phone any time for full access.
      </p>

      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={() => void sendLink()}
          disabled={status === "sending"}
          className="text-[11px] text-white/40 underline-offset-2 hover:text-white/70 hover:underline disabled:opacity-50"
        >
          {status === "sending"
            ? "Sending…"
            : "Returning user? Email me a sign-in link instead"}
        </button>
      </div>

      <p className="text-[11px] text-white/40">
        By continuing you&apos;ll be asked to accept the{" "}
        <a href="/legal/terms" className="underline hover:text-white">Terms</a>,{" "}
        <a href="/legal/community" className="underline hover:text-white">Community Guidelines</a>, and{" "}
        <a href="/legal/privacy" className="underline hover:text-white">Privacy Notice</a>.
      </p>
    </div>
  );
}

function DividerOr() {
  return (
    <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/30">
      <span className="h-px flex-1 bg-white/10" />
      or
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}

function GuestButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 transition hover:bg-white/10 disabled:opacity-50"
    >
      {pending ? "One moment…" : "Continue as guest (Lobby only) →"}
    </button>
  );
}
