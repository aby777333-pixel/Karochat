"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "confirm-sent" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setErrorMsg("Enter a valid email address.");
      setStatus("error");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("Password needs at least 8 characters.");
      setStatus("error");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("Passwords don't match.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    const supabase = createSupabaseBrowserClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (typeof window !== "undefined" ? window.location.origin : "");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback?next=/write`
      }
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    // If the project has email confirmations enabled, session will be null
    // and the user needs to click the link. If confirmations are off, we
    // already have a session and can go straight in.
    if (data.session) {
      router.replace("/rooms");
      router.refresh();
      return;
    }
    setStatus("confirm-sent");
  }

  if (status === "confirm-sent") {
    return (
      <div className="surface-glass mt-6 rounded-2xl border border-neon-mint/30 bg-neon-mint/5 p-5 text-sm">
        <p className="font-display text-base font-semibold text-white">
          📬 Check your email.
        </p>
        <p className="mt-1 text-white/75">
          We sent a confirmation link to{" "}
          <span className="text-white">{email}</span>. Click it on this
          device to finish setting up your account. Once confirmed, future
          logins use just your email + password — no more magic links.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3">
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
        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-neon-blue/60 focus:bg-black/40"
      />
      <label className="block text-xs uppercase tracking-widest text-white/50">
        Password (8+ characters)
      </label>
      <input
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-neon-blue/60 focus:bg-black/40"
      />
      <label className="block text-xs uppercase tracking-widest text-white/50">
        Confirm password
      </label>
      <input
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-neon-blue/60 focus:bg-black/40"
      />
      <Button
        type="submit"
        disabled={status === "submitting"}
        className="w-full"
      >
        {status === "submitting" ? "Creating account…" : "Create account"}
      </Button>
      {errorMsg && (
        <p className="text-xs text-neon-red">{errorMsg}</p>
      )}
    </form>
  );
}
