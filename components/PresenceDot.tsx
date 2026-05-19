import clsx from "clsx";

export type PresenceState = "online" | "away" | "busy" | "invisible" | "offline";

const COLORS: Record<PresenceState, string> = {
  online: "bg-neon-blue shadow-[0_0_8px_rgba(0,180,255,0.6)]",
  away: "bg-neon-amber",
  busy: "bg-neon-red shadow-[0_0_8px_rgba(255,45,85,0.5)]",
  invisible: "bg-white/30 border border-white/40",
  offline: "bg-white/20"
};

export function PresenceDot({
  state,
  pulse,
  className
}: {
  state: PresenceState | string | null | undefined;
  pulse?: boolean;
  className?: string;
}) {
  const s = (state && state in COLORS ? state : "offline") as PresenceState;
  return (
    <span className={clsx("relative inline-flex h-2 w-2 shrink-0", className)} aria-label={`presence: ${s}`}>
      {pulse && s === "online" && (
        <span className="absolute inline-flex h-full w-full rounded-full bg-neon-blue opacity-60 animate-pulseDot" />
      )}
      <span className={clsx("relative inline-flex h-2 w-2 rounded-full", COLORS[s])} />
    </span>
  );
}

export const PRESENCE_LABEL: Record<PresenceState, string> = {
  online: "Online",
  away: "Away",
  busy: "Busy — don't ping me",
  invisible: "Invisible",
  offline: "Offline"
};
