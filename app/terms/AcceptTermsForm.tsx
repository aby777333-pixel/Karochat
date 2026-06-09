"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";

export function AcceptTermsForm() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!checked || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        // Same-origin POST → no CORS preflight; the server reads the session
        // cookie and updates the profile. Works on networks that block the
        // browser's cross-origin calls to supabase.co.
        const r = await fetch("/api/terms/accept", {
          method: "POST",
          credentials: "same-origin"
        });
        const j = await r.json().catch(() => null);
        if (!j?.ok) {
          setError(
            j?.code === "no_session"
              ? "Session expired. Please sign in again."
              : j?.detail ?? "Couldn't save right now. Please try again."
          );
          return;
        }
        router.replace(typeof j.redirect === "string" ? j.redirect : "/rooms");
        router.refresh();
      } catch {
        setError(
          "Couldn't reach the server. Check your connection and try again."
        );
      }
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
