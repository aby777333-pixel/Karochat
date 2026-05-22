"use client";

/**
 * TypingIndicator — Wave 18.
 *
 * Shows the names of peers actively typing in the room. Uses the realtime
 * broadcast channel (`room-typing:<id>`) plumbing in RoomChat.
 */
export function TypingIndicator({ users }: { users: string[] }) {
  if (users.length === 0) {
    // Reserve a thin row so the layout doesn't jump when someone starts typing.
    return <div className="h-4" aria-hidden />;
  }
  const names =
    users.length === 1
      ? `${users[0]} is typing`
      : users.length === 2
      ? `${users[0]} and ${users[1]} are typing`
      : `${users[0]}, ${users[1]} and ${users.length - 2} more are typing`;
  return (
    <div className="flex items-center gap-2 border-t border-white/5 bg-black/15 px-4 py-1 text-[11px] text-white/55">
      <span className="flex gap-0.5" aria-hidden>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/55 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/55 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/55" />
      </span>
      <span className="truncate">{names}…</span>
    </div>
  );
}
