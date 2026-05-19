"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function sanitizeUsername(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
}

export function OnboardingForm({ defaultUsername }: { defaultUsername: string }) {
  const router = useRouter();
  const [username, setUsername] = useState(sanitizeUsername(defaultUsername));
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setHint(null);

    if (!USERNAME_RE.test(username)) {
      setErr("Pick a username: 3–20 chars, lowercase letters, numbers, or underscore.");
      return;
    }

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
        error: userErr
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        setErr("Your session expired. Please sign in again.");
        setHint(userErr?.message ?? "no user");
        // give them a fresh start
        setTimeout(() => router.replace("/"), 1200);
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, username, display_name: username }, { onConflict: "id" });

      if (error) {
        console.error("[onboarding] upsert error", error);
        if (error.code === "23505") {
          setErr("That username is taken. Try another.");
        } else if (error.code === "42703") {
          setErr("Your Supabase database is behind on migrations.");
          setHint(
            "Run supabase/migrations/0004_phase4_5_features.sql in the SQL editor, then try again."
          );
        } else {
          setErr(error.message);
          setHint(`code: ${error.code ?? "—"} · details: ${error.details ?? "none"}`);
        }
        return;
      }

      router.replace("/terms");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="text-xs uppercase tracking-widest text-white/50">Username</label>
        <div className="mt-2 flex items-center rounded-xl border border-white/10 bg-black/30 px-3 focus-within:border-neon-blue/60">
          <span className="text-white/40">@</span>
          <input
            value={username}
            onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
            maxLength={20}
            placeholder="yourhandle"
            autoFocus
            className="w-full bg-transparent px-2 py-3 text-sm outline-none"
          />
        </div>
        <p className="mt-1.5 text-[11px] text-white/40">3–20 chars, a–z 0–9 _</p>
      </div>

      {err && (
        <div className="rounded-xl border border-neon-red/40 bg-neon-red/10 p-3 text-sm">
          <p className="font-medium text-neon-red">{err}</p>
          {hint && <p className="mt-1 text-[11px] text-white/60">{hint}</p>}
        </div>
      )}

      <Button type="submit" disabled={pending || username.length < 3} className="w-full">
        {pending ? "Saving…" : "Enter the lobby →"}
      </Button>
    </form>
  );
}
