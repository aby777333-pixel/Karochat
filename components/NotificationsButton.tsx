"use client";

import { useBrowserNotificationsPermission } from "@/lib/useBrowserNotifications";

export function NotificationsButton() {
  const { perm, request, supported } = useBrowserNotificationsPermission();

  if (!supported) return null;
  if (perm === "granted") return null;

  const icon = perm === "denied" ? "🔕" : "🔔";
  const text = perm === "denied" ? "blocked" : "enable pings";

  return (
    <button
      type="button"
      onClick={() => void request()}
      disabled={perm === "denied"}
      aria-label={perm === "denied" ? "Notifications blocked" : "Enable notifications"}
      title={
        perm === "denied"
          ? "You blocked notifications. Re-enable in the site settings."
          : "Get a browser notification when someone messages you while this tab isn't focused."
      }
      className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
    >
      <span aria-hidden>{icon}</span>
      <span className="hidden md:inline">{text}</span>
    </button>
  );
}
