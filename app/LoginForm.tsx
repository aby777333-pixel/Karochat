"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

const EMAIL_KEY = "karochat:last-email";
const PHONE_KEY = "karochat:last-phone";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [guestPending, startGuest] = useTransition();

  // Magic-link OTP fallback (for returning users who want their old account
  // back on a new device). Instant email+phone access is the primary path.
  const [otp, setOtp] = useState("");
  const [otpStatus, setOtpStatus] = useState<"idle" | "verifying">("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedE = window.localStorage.getItem(EMAIL_KEY);
      if (savedE && /\S+@\S+\.\S+/.test(savedE)) setEmail(savedE);
      const savedP = window.localStorage.getItem(PHONE_KEY);
      if (savedP) setPhone(savedP);
    } catch {
      /* ignore */
    }
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
    const ph = phone.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
      setErrorMsg("Please enter a valid email.");
      return;
    }
    if (ph.replace(/\D/g, "").length < 7) {
      setErrorMsg("Please enter a valid phone number.");
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    const supabase = createSupabaseBrowserClient();
    const { error: authErr } = await supabase.auth.signInAnonymously();
    if (authErr) {
      setBusy(false);
      setStatus("error");
      setErrorMsg(
        authErr.message.includes("disabled")
          ? "Instant access isn't enabled on the server yet — enable Anonymous Sign-Ins in Supabase Auth."
          : authErr.message
      );
      return;
    }
    const { error: rpcErr } = await supabase.rpc("register_contact", {
      p_email: addr,
      p_phone: ph
    });
    setBusy(false);
    if (rpcErr) {
      setErrorMsg(rpcErr.message);
      return;
    }
    remember(addr, ph);
    router.replace("/terms");
    router.refresh();
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
          <p className="font-medium text-white">Check your email.</p>
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
        <input
          type="tel"
          required
          autoComplete="tel"
          inputMode="tel"
          placeholder="+91 98765 43210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition focus:border-neon-blue/60 focus:bg-black/40"
        />
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
