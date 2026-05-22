import clsx from "clsx";

/**
 * Karochat brand mark (Wave 19.9). Smiling chat-bubble face — eyes that
 * sparkle, a wide friendly grin, and the tail dot. Painted in the
 * cyan→indigo→violet gradient.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={clsx("h-7 w-7", className)}
      role="img"
      aria-label="Karochat"
    >
      <defs>
        <linearGradient id="kchat-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3FB6FF" />
          <stop offset="55%" stopColor="#3F7BFF" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>

      {/* Speech-bubble cradle with a soft kink at the bottom — the tail. */}
      <path
        d="M32 6
           a26 26 0 1 1 -18.7 44.2
           c-2.4 -.4 -4.1 .9 -5.3 2.5
           c.6 -2.4 .9 -4.6 .2 -5.8
           A26 26 0 0 1 32 6 Z"
        fill="none"
        stroke="url(#kchat-grad)"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />

      {/* Two sparkly eyes — filled gradient circles with a white catch-light. */}
      <circle cx="23" cy="26" r="3.6" fill="url(#kchat-grad)" />
      <circle cx="41" cy="26" r="3.6" fill="url(#kchat-grad)" />
      <circle cx="21.6" cy="24.6" r="1.1" fill="#ffffff" opacity="0.9" />
      <circle cx="39.6" cy="24.6" r="1.1" fill="#ffffff" opacity="0.9" />

      {/* Wide friendly smile + dimples at the ends. */}
      <path
        d="M19 35 q13 13 26 0"
        fill="none"
        stroke="url(#kchat-grad)"
        strokeWidth="3.8"
        strokeLinecap="round"
      />
      <circle cx="19" cy="35" r="1.6" fill="url(#kchat-grad)" opacity="0.85" />
      <circle cx="45" cy="35" r="1.6" fill="url(#kchat-grad)" opacity="0.85" />

      {/* Tail-end dot accent */}
      <circle cx="47" cy="50" r="2.6" fill="url(#kchat-grad)" />
    </svg>
  );
}

/**
 * Wordmark — "karo" in soft platinum, "chat" in the brand gradient.
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
      <span className="bg-gradient-to-r from-[#3FB6FF] via-[#3F7BFF] to-[#8B5CF6] bg-clip-text text-transparent">
        chat
      </span>
    </span>
  );
}

export const SLOGAN =
  "Meet your mate, chat, make friends, accept, adapt, share and care, live and let live, be happy because life is too short, and the future is uncertain.";
