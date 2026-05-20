"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Per-route error boundary for /rooms/[id]. Catches any unhandled exception
 * from the server render or client interactions and shows a friendly page
 * instead of the bare "Application error: server-side exception" white
 * screen. Includes the digest for triage and a back-to-lobby escape.
 */
export default function RoomError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[rooms/[id]] error boundary caught", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-5 py-8 text-center">
      <div className="surface-glass tint-pink p-6">
        <p className="font-display text-xl font-semibold text-white">
          This room couldn&apos;t load.
        </p>
        <p className="mt-2 text-sm text-white/65">
          Something went wrong on our side. Try the lobby and pick another
          room — or come back in a moment, we may have fixed it.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[10px] text-white/35">
            id: {error.digest}
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Try again
          </button>
          <Link
            href="/rooms"
            className="flex-1 rounded-lg bg-neon-blue px-3 py-2 text-sm font-medium text-ink-900 shadow-glow-blue hover:bg-neon-blue/90"
          >
            ← Lobby
          </Link>
        </div>
      </div>
    </main>
  );
}
