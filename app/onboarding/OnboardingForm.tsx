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
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!USERNAME_RE.test(username)) {
      setErr("3–20 chars, lowercase letters, numbers, or underscore.");
      return;
    }

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
        error: userErr
      } = await supabase.auth.getUser();
      if (userErr || !user) {
        setErr("Session expired. Please sign in again.");
        return;
      }
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        username,
        display_name: username
      });
      if (error) {
        if (error.code === "23505") {
          setErr("That username is taken. Try another.");
        } else {
          setErr(error.message);
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
        <label className="text-xs uppercase tracking-widest text-white/50">
          Username
        </label>
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

      {err && <p className="text-xs text-neon-red">{err}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Enter the lobby →"}
      </Button>
    </form>
  );
}
