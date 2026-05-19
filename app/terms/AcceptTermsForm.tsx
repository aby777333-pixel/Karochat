"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

const TERMS_VERSION = 1;

export function AcceptTermsForm() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!checked || pending) return;
    setError(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Session expired. Please sign in again.");
        return;
      }
      const { error: upd } = await supabase
        .from("profiles")
        .update({
          terms_accepted_at: new Date().toISOString(),
          terms_version: TERMS_VERSION
        })
        .eq("id", user.id);
      if (upd) {
        setError(upd.message);
        return;
      }
      router.replace("/rooms");
      router.refresh();
    });
  }

  return (
    <div className="mt-6 space-y-3">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-neon-blue"
        />
        <span className="text-white/80">
          I have read and accept the{" "}
          <a href="/legal/terms" target="_blank" className="text-neon-blue underline">
            Terms of Use
          </a>
          ,{" "}
          <a href="/legal/community" target="_blank" className="text-neon-blue underline">
            Community Guidelines
          </a>
          , and{" "}
          <a href="/legal/privacy" target="_blank" className="text-neon-blue underline">
            Privacy Notice
          </a>
          . I am old enough to use this Service in my country.
        </span>
      </label>

      {error && <p className="text-xs text-neon-red">{error}</p>}

      <Button onClick={submit} disabled={!checked || pending} className="w-full">
        {pending ? "Saving…" : "Enter Karochat →"}
      </Button>
    </div>
  );
}
