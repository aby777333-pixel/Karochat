import clsx from "clsx";

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={clsx("h-7 w-7", className)} aria-hidden>
      <defs>
        <linearGradient id="kg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00B4FF" />
          <stop offset="100%" stopColor="#A371FF" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#kg)" />
      <path
        d="M20 18v28M20 32l14-14M20 32l16 14"
        stroke="#0A0A0A"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "bg-gradient-to-r from-neon-blue via-white to-neon-purple bg-clip-text font-display text-2xl font-semibold tracking-tight text-transparent",
        className
      )}
    >
      Karochat
    </span>
  );
}

export const SLOGAN =
  "Meet your mate, chat, make friends, accept, adapt, share and care, live and let live, be happy because life is too short, and the future is uncertain.";
