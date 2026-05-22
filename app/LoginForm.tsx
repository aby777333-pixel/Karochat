"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

const EMAIL_KEY = "karochat:last-email";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [remembered, setRemembered] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [guestPending, startGuest] = useTransition();

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
    await sendLink(email);
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
            We sent a magic link to <span className="text-white">{email}</span>. Open it on
            this device — you&apos;ll stay signed in after that, so next time you visit
            we&apos;ll drop you straight in the lobby.
          </p>
          <button
            className="mt-3 text-xs text-neon-blue hover:underline"
            onClick={() => {
              setStatus("idle");
              setEmail("");
            }}
          >
            Use a different email
          </button>
        </div>
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
        <Button type="submit" disabled={status === "sending"} className="w-full">
          {status === "sending" ? "Sending link…" : "Send magic link"}
        </Button>
        {status === "error" && (
          <p className="text-xs text-neon-red">{errorMsg ?? "Something went wrong."}</p>
        )}
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
        Tip: clicking the magic link once keeps you signed in on this device for ~7 days.
        Return visits drop you in the lobby without another link.
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
