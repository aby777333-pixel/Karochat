"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Top-level error boundary. Catches anything not caught by a deeper
 * /rooms/error.tsx or /rooms/[id]/error.tsx. Keeps the user out of the
 * default white "Application error" page.
 */
export default function RootError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root] error boundary caught", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-5 py-8 text-center">
      <div className="surface-glass tint-pink p-6">
        <p className="font-display text-xl font-semibold text-white">
          Something broke. Sorry.
        </p>
        <p className="mt-2 text-sm text-white/65">
          We hit an error rendering this page. Try refreshing, or come back
          to the home page.
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
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
