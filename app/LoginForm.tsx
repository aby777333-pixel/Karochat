"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

const EMAIL_KEY = "karochat:last-email";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [remembered, setRemembered] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [guestPending, startGuest] = useTransition();

  // OTP fallback for cross-device login. Magic links carry a PKCE code that
  // requires the verifier cookie stored on the device where the link was
  // requested; when the user opens the link on a *different* device, the
  // verifier is missing and exchangeCodeForSession fails silently. The 6-digit
  // OTP works from any device because the token itself is the proof.
  const [otp, setOtp] = useState("");
  const [otpStatus, setOtpStatus] = useState<"idle" | "verifying">("idle");

  // Hydrate the last-used email from localStorage. We do this after mount so
  // SSR + first client render match.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(EMAIL_KEY);
      if (saved && /\S+@\S+\.\S+/.test(saved)) {
        setEmail(saved);
        setRemembered(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  // Surface the ?auth=error&detail=... we now emit from /auth/callback so the
  // user knows when their magic link actually failed (instead of looking like
  // a no-op redirect, which was the cross-device symptom).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const auth = params.get("auth");
    if (auth === "error") {
      const detail = params.get("detail");
      setStatus("error");
      setErrorMsg(
        detail
          ? `Sign-in didn't complete: ${decodeURIComponent(detail)}. Try the 6-digit code from the same email below — it works from any device.`
          : "Sign-in didn't complete on this device. If you clicked the email link from a different browser/computer than where you requested it, enter the 6-digit code from the email below instead."
      );
    }
  }, []);

  function rememberEmail(addr: string) {
    try {
      window.localStorage.setItem(EMAIL_KEY, addr);
      setRemembered(addr);
    } catch {
      // ignore
    }
  }

  function forgetEmail() {
    try {
      window.localStorage.removeItem(EMAIL_KEY);
    } catch {
      // ignore
    }
    setRemembered(null);
    setEmail("");
  }

  async function sendLink(addr: string) {
    setStatus("sending");
    setErrorMsg(null);

    const supabase = createSupabaseBrowserClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (typeof window !== "undefined" ? window.location.origin : "");

    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
        shouldCreateUser: true
      }
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    rememberEmail(addr);
    setStatus("sent");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    // If a password was provided, try password sign-in first. On any
    // failure (no password set on this account, wrong password, etc.)
    // we silently fall back to the magic-link flow so we never get
    // stuck — the user always has a path forward.
    if (password) {
      setPwSubmitting(true);
      setErrorMsg(null);
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      setPwSubmitting(false);
      if (!error) {
        rememberEmail(email);
        router.replace("/rooms");
        router.refresh();
        return;
      }
      // Common cases: "Invalid login credentials", "Email not confirmed".
      // Show the specific error but also offer the magic link.
      setErrorMsg(
        `${error.message}. We can email you a sign-in link instead — click "Send magic link" below.`
      );
      // Don't auto-send; let the user decide.
      return;
    }
    await sendLink(email);
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
      email,
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

  if (status === "sent") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
          <p className="font-medium text-white">Check your email.</p>
          <p className="mt-1 text-white/60">
            We sent a magic link <em>and</em> a 6-digit code to{" "}
            <span className="text-white">{email}</span>. Click the link on this
            device, <em>or</em> enter the code below — the code works from any
            device.
          </p>
          <button
            className="mt-3 text-xs text-neon-blue hover:underline"
            onClick={() => {
              setStatus("idle");
              setEmail("");
              setOtp("");
            }}
          >
            Use a different email
          </button>
        </div>

        <form onSubmit={verifyOtp} className="space-y-2">
          <label className="block text-xs uppercase tracking-widest text-white/50">
            Or paste the 6-digit code
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
            <Button
              type="submit"
              disabled={otpStatus === "verifying" || otp.length < 6}
            >
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

  return (
    <div className="space-y-4">
      {remembered && (
        <div className="rounded-xl border border-neon-blue/40 bg-neon-blue/10 p-3 text-xs">
          <p className="text-white/80">
            Welcome back.
          </p>
          <p className="mt-0.5 text-white/55">
            Last signed in as <span className="text-white">{remembered}</span>. Send
            a fresh link here, or switch accounts below.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={status === "sending"}
              onClick={() => void sendLink(remembered)}
              className="flex-1 rounded-md border border-neon-blue/60 bg-neon-blue/20 px-2 py-1.5 text-xs font-medium text-neon-blue hover:bg-neon-blue/30 disabled:opacity-50"
            >
              {status === "sending" ? "Sending…" : "Send link to this email"}
            </button>
            <button
              type="button"
              onClick={forgetEmail}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/65 hover:bg-white/10"
            >
              Switch
            </button>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-xs uppercase tracking-widest text-white/50">
          {remembered ? "Or use a different email" : "Email"}
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-white/30 outline-none ring-0 transition focus:border-neon-blue/60 focus:bg-black/40"
        />
        <label className="block text-xs uppercase tracking-widest text-white/50">
          Password (returning users)
        </label>
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Leave blank to get a magic link"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-white/30 outline-none ring-0 transition focus:border-neon-blue/60 focus:bg-black/40"
        />
        <Button
          type="submit"
          disabled={status === "sending" || pwSubmitting}
          className="w-full"
        >
          {pwSubmitting
            ? "Signing in…"
            : status === "sending"
            ? "Sending link…"
            : password
            ? "Log in"
            : "Send magic link"}
        </Button>
        {errorMsg && (
          <p className="text-xs text-neon-red">{errorMsg}</p>
        )}
        {!errorMsg && status === "error" && (
          <p className="text-xs text-neon-red">Something went wrong.</p>
        )}
        <p className="text-[11px] text-white/40">
          New here?{" "}
          <a href="/signup" className="text-neon-mint underline-offset-2 hover:underline">
            Create an account with a password
          </a>
          {" "}— faster sign-in next time.
        </p>
      </form>

      <DividerOr />

      <GuestButton pending={guestPending} onClick={continueAsGuest} />

      <p className="text-[11px] text-white/40">
        By continuing you&apos;ll be asked to accept the{" "}
        <a href="/legal/terms" className="underline hover:text-white">Terms</a>,{" "}
        <a href="/legal/community" className="underline hover:text-white">Community Guidelines</a>, and{" "}
        <a href="/legal/privacy" className="underline hover:text-white">Privacy Notice</a>.
      </p>
      <p className="text-[10px] text-white/30">
        Tip: the magic link works only on the device you requested it from.
        Switching computers? Use the 6-digit code in the same email — it works
        anywhere.
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
      {pending ? "One moment…" : "Continue as guest →"}
    </button>
  );
}
