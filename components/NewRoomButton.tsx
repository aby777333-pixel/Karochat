"use client";

import Link from "next/link";

export function NewRoomButton({ from = "room" }: { from?: string }) {
  return (
    <Link
      href={`/rooms?create=1&from=${from}`}
      title="Create a new room"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-neon-mint/40 bg-neon-mint/10 text-neon-mint transition hover:bg-neon-mint/20"
      aria-label="Create a new room"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </Link>
  );
}
