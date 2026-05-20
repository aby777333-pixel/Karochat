"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SavedRoomButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error: rpcErr } = await supabase.rpc("get_or_create_saved_room");
      if (rpcErr || !data) {
        setError(rpcErr?.message ?? "Could not open Saved.");
        return;
      }
      router.push(`/rooms/${data}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={open}
        disabled={pending}
        title="Your private notes & saved messages"
        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-neon-blue/30 hover:bg-white/10 disabled:opacity-60"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden className="text-base">💾</span>
          <span className="flex flex-col">
            <span className="font-medium text-white">Saved</span>
            <span className="text-[11px] text-white/50">
              Your private notes — only you can see them.
            </span>
          </span>
        </span>
        <span className="text-xs text-white/60">{pending ? "…" : "Open →"}</span>
      </button>
      {error && <p className="text-[11px] text-neon-red">{error}</p>}
    </div>
  );
}
