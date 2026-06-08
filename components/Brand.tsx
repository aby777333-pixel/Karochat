import clsx from "clsx";

/**
 * Karochat brand mark — the speech-bubble-headed figure, painted in the
 * purple→magenta brand gradient. Square, transparent PNG (object-contain so
 * it never distorts inside the square sizing classes callers pass in).
 */
export function Logo({ className }: { className?: string }) {
  // New mark (Wave 22): a speech bubble cradling a heart, in the brand
  // purple→magenta gradient. Crisp inline SVG so it stays sharp at any size.
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label="Karochat"
      xmlns="http://www.w3.org/2000/svg"
      className={clsx("h-7 w-7", className)}
    >
      <defs>
        <linearGradient
          id="karoLogoGrad"
          x1="6"
          y1="4"
          x2="42"
          y2="42"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#9B30B5" />
          <stop offset="0.5" stopColor="#C42A95" />
          <stop offset="1" stopColor="#E0218A" />
        </linearGradient>
      </defs>
      {/* chat bubble with a bottom-left tail */}
      <path
        d="M16 6H32A12 12 0 0 1 44 18V24A12 12 0 0 1 32 36H22L14 44L18 36H16A12 12 0 0 1 4 24V18A12 12 0 0 1 16 6Z"
        fill="url(#karoLogoGrad)"
      />
      {/* heart */}
      <path
        d="M24 29.5c-7-5-11-8.6-11-12.6 0-2.7 2.1-4.9 4.9-4.9 1.8 0 3.5 1 6.1 3.7 2.6-2.7 4.3-3.7 6.1-3.7 2.8 0 4.9 2.2 4.9 4.9 0 4-4 7.6-11 12.6z"
        fill="#fff"
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
