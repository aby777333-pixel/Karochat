"use client";

// Karochat — lobby Direct-messages list with Open + Delete (Wave 22).
// Delete removes the caller's membership of the DM room (the same mechanism
// as leaving a room) and drops the row from the list immediately.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type DMRow = {
  id: string;
  partner_username: string | null;
  partner_display_name: string | null;
  partner_presence: string | null;
};

export function DMListClient({
  dms: initial,
  currentUserId
}: {
  dms: DMRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [dms, setDms] = useState<DMRow[]>(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function remove(d: DMRow) {
    const name = d.partner_display_name ?? d.partner_username ?? "this chat";
    if (
      !confirm(`Delete your chat with ${name}? It'll disappear from your list.`)
    )
      return;
    setPendingId(d.id);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", d.id)
      .eq("user_id", currentUserId);
    setPendingId(null);
    if (error) {
      alert(`Could not delete: ${error.message}`);
      return;
    }
    // Disappear immediately, then refresh server data in the background.
    setDms((prev) => prev.filter((x) => x.id !== d.id));
    startTransition(() => router.refresh());
  }

  if (dms.length === 0) {
    return <p className="text-sm text-white/40">No direct messages.</p>;
  }

  return (
    <ul className="divide-y divide-white/5">
      {dms.map((d) => {
        const name = d.partner_display_name ?? d.partner_username ?? "Unknown";
        const handle = d.partner_username ?? "anon";
        const presenceColor =
          d.partner_presence === "online"
            ? "bg-neon-mint"
            : d.partner_presence === "busy"
            ? "bg-neon-red"
            : d.partner_presence === "away"
            ? "bg-neon-amber"
            : "bg-white/30";
        const busy = pendingId === d.id;
        return (
          <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${presenceColor}`} aria-hidden />
              <p className="truncate font-medium text-white">{name}</p>
              <span className="truncate text-xs text-white/40">@{handle}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => void remove(d)}
                disabled={busy}
                aria-label={`Delete chat with ${name}`}
                title="Delete this chat"
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/65 transition hover:border-neon-red/40 hover:bg-neon-red/10 hover:text-neon-red disabled:opacity-50"
              >
                {busy ? (
                  "…"
                ) : (
                  <>
                    <span aria-hidden>🗑</span>
                    <span className="ml-1 hidden md:inline">Delete</span>
                  </>
                )}
              </button>
              <Link
                href={`/rooms/${d.id}`}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                Open →
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
