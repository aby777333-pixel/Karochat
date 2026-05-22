"use client";

/**
 * MessageSearchBar — Wave 18.
 *
 * Slim search bar that filters the visible message list by substring.
 * No server call — operates over the locally cached messages array.
 */
export function MessageSearchBar({
  query,
  onQuery,
  onClose,
  resultCount
}: {
  query: string;
  onQuery: (q: string) => void;
  onClose: () => void;
  resultCount: number;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-white/5 bg-black/20 px-3 py-1.5">
      <span aria-hidden className="text-white/40">🔎</span>
      <input
        autoFocus
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search this room…"
        aria-label="Search messages"
        className="flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none placeholder:text-white/30 focus:border-neon-blue/50"
      />
      {query && (
        <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-white/55">
          {resultCount} {resultCount === 1 ? "match" : "matches"}
        </span>
      )}
      <button
        type="button"
        onClick={onClose}
        className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/60 hover:bg-white/10"
        aria-label="Close search"
      >
        ✕
      </button>
    </div>
  );
}
