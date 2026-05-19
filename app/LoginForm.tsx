"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [guestPending, startGuest] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    setErrorMsg(null);

    const supabase = createSupabaseBrowserClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (typeof window !== "undefined" ? window.location.origin : "");

    const { error } = await supabase.auth.signInWithOtp({
      email,
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
    setStatus("sent");
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
            this device.
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
      <form onSubmit={onSubmit} className="space-y-3">
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
