import clsx from "clsx";

/**
 * Karochat brand mark — the speech-bubble-headed figure, painted in the
 * purple→magenta brand gradient. Square, transparent PNG (object-contain so
 * it never distorts inside the square sizing classes callers pass in).
 */
export function Logo({ className }: { className?: string }) {
  // New mark (Wave 22): a triumphant figure with raised arms (purple→indigo
  // body) beneath a glowing orange→pink head — open, human, uplifting.
  // Crisp inline SVG, sharp at any size.
  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label="Karochat"
      xmlns="http://www.w3.org/2000/svg"
      className={clsx("h-7 w-7", className)}
    >
      <defs>
        <linearGradient id="karoBody" x1="0" y1="70" x2="0" y2="196" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9A4FB5" />
          <stop offset="1" stopColor="#2E2A8C" />
        </linearGradient>
        <linearGradient id="karoHead" x1="0" y1="18" x2="0" y2="66" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FBB04C" />
          <stop offset="1" stopColor="#EE3C8B" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="42" r="24" fill="url(#karoHead)" />
      <path
        d="M24 84 L86 132 L100 194 L114 132 L176 84 L100 118 Z"
        fill="url(#karoBody)"
      />
    </svg>
  );
}

/**
 * Wordmark — "karo" in soft platinum, "chat" in the brand gradient
 * (purple→magenta, matched to the new logo mark).
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex select-none items-baseline font-display text-2xl font-semibold tracking-tight",
        className
      )}
    >
      <span className="text-white/90">karo</span>
      <span className="bg-gradient-to-r from-[#9B30B5] via-[#C42A95] to-[#E0218A] bg-clip-text text-transparent">
        chat
      </span>
    </span>
  );
}

export const SLOGAN =
  "Meet your mate, chat, make friends, accept, adapt, share and care, live and let live, be happy because life is too short, and the future is uncertain.";
