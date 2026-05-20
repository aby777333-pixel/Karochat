"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  async function onClick() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }
  return (
    <button
      onClick={onClick}
      aria-label="Sign out"
      title="Sign out"
      className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
    >
      <span aria-hidden>⏏</span>
      <span className="hidden md:inline">Sign out</span>
    </button>
  );
}
