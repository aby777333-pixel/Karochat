"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Logo, Wordmark } from "@/components/Brand";
import { Button } from "@/components/Button";

/**
 * Shown when someone opens a request-to-join group they're not a member of.
 * Open groups never reach here (they auto-join). Requesting calls the same
 * join_public_room RPC, which files a pending request for request-policy rooms.
 */
export function GroupJoinGate({
  roomId,
  name,
  description,
  avatarUrl,
  status
}: {
  roomId: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  status: "pending" | "rejected" | null;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [state, setState] = useState<"pending" | "rejected" | null>(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("join_public_room", { p_room_id: roomId });
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    setState("pending");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-3 py-6">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/rooms" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <Link
          href="/rooms"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
        >
          ← Rooms
        </Link>
      </header>

      <section className="surface-glass mt-6 flex flex-col items-center p-6 text-center">
        <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-white/10 text-2xl">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            "🔒"
          )}
        </span>
        <h1 className="mt-3 font-display text-xl font-semibold">{name}</h1>
        {description && <p className="mt-1 text-sm text-white/60">{description}</p>}

        <div className="mt-5 w-full">
          {state === "pending" ? (
            <div className="rounded-xl border border-neon-mint/30 bg-neon-mint/5 px-4 py-4 text-sm text-neon-mint">
              ✓ Request sent — an admin will review it. You’ll be able to enter
              once you’re approved.
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm text-white/55">
                This is a request-to-join group. Send a request and an admin will
                let you in.
              </p>
              {state === "rejected" && (
                <p className="mb-3 text-xs text-neon-red">
                  Your previous request wasn’t approved. You can ask again.
                </p>
              )}
              {error && (
                <p className="mb-3 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{error}</p>
              )}
              <Button onClick={() => void request()} disabled={busy} className="w-full">
                {busy ? "Sending…" : "Request to join"}
              </Button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
