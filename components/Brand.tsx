import clsx from "clsx";

/**
 * Karochat brand mark — the colourful firework / flower burst (red, navy &
 * amber petals around a pixel-bloom centre). Square, transparent PNG rendered
 * with object-contain so it never distorts inside the square sizing classes
 * callers pass in (e.g. `h-7 w-7`, `h-9 w-9`). Default size matches the old
 * inline mark so every existing call site keeps the same footprint.
 */
export function Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/flower-logo.png"
      alt="Karochat"
      width={200}
      height={200}
      decoding="async"
      className={clsx("h-7 w-7 object-contain", className)}
    />
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
