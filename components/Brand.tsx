import clsx from "clsx";

/**
 * Karochat brand mark — the speech-bubble-headed figure, painted in the
 * purple→magenta brand gradient. Square, transparent PNG (object-contain so
 * it never distorts inside the square sizing classes callers pass in).
 */
export function Logo({ className }: { className?: string }) {
  // New mark (Wave 22): two people talking — heads with a small speech bubble
  // (dots) between them — a universally readable "conversation" symbol in the
  // brand purple→magenta gradient. Crisp inline SVG, sharp at any size.
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label="Karochat — two people talking"
      xmlns="http://www.w3.org/2000/svg"
      className={clsx("h-7 w-7", className)}
    >
      <defs>
        <linearGradient
          id="karoLogoGrad"
          x1="6"
          y1="4"
          x2="42"
          y2="44"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#9B30B5" />
          <stop offset="0.5" stopColor="#C42A95" />
          <stop offset="1" stopColor="#E0218A" />
        </linearGradient>
      </defs>
      <g fill="url(#karoLogoGrad)">
        {/* person on the right, slightly behind */}
        <g opacity="0.6">
          <circle cx="31" cy="17" r="6" />
          <path d="M22 43c0-9.4 4-12.5 9-12.5s9 3.1 9 12.5z" />
        </g>
        {/* person on the left, in front */}
        <circle cx="18" cy="18" r="6.6" />
        <path d="M7 43c0-9.7 4.4-12.9 11-12.9S29 33.3 29 43z" />
      </g>
      {/* speech bubble between them (talking) */}
      <path
        d="M22.5 3.4H26.5A3 3 0 0 1 29.5 6.4V7.6A3 3 0 0 1 26.5 10.6H25.4L24 13l-1.1-2.4H22.5A3 3 0 0 1 19.5 7.6V6.4A3 3 0 0 1 22.5 3.4Z"
        fill="#fff"
      />
      <g fill="url(#karoLogoGrad)">
        <circle cx="22.6" cy="7" r="0.9" />
        <circle cx="24.5" cy="7" r="0.9" />
        <circle cx="26.4" cy="7" r="0.9" />
      </g>
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
