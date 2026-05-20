"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function RoomsLobbyError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[rooms lobby] error boundary caught", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-5 py-8 text-center">
      <div className="surface-glass tint-pink p-6">
        <p className="font-display text-xl font-semibold text-white">
          Couldn&apos;t load the lobby.
        </p>
        <p className="mt-2 text-sm text-white/65">
          We hit a snag fetching your rooms. Try again — usually a refresh
          settles it.
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
            href="/"
            className="flex-1 rounded-lg bg-neon-blue px-3 py-2 text-sm font-medium text-ink-900 shadow-glow-blue hover:bg-neon-blue/90"
          >
            ← Home
          </Link>
        </div>
      </div>
    </main>
  );
}
