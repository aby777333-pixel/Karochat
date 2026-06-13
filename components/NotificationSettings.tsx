"use client";

// Karochat — user-controlled notification settings.
//
// One place for people to turn on background (lock-screen) notifications for
// calls & messages, and to toggle sound + vibration. Everything degrades
// gracefully: if the browser doesn't support a capability, that control is
// hidden or shown as unavailable. No external state — sound/vibration live in
// localStorage (lib/sounds), push lives in web_push_subscriptions via the RPC.

import { useEffect, useState } from "react";
import {
  soundEnabled,
  setSoundEnabled,
  vibrateEnabled,
  setVibrateEnabled,
  playChime,
  vibrate
} from "@/lib/sounds";
import { usePushSubscribe } from "@/lib/usePushSubscribe";

type Perm = "default" | "granted" | "denied" | "unsupported";

export function NotificationSettings() {
  const { subscribe } = usePushSubscribe();
  const [perm, setPerm] = useState<Perm>("default");
  const [sound, setSound] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [hasVibrate, setHasVibrate] = useState(true);

  useEffect(() => {
    setSound(soundEnabled());
    setHaptics(vibrateEnabled());
    setHasVibrate(typeof navigator !== "undefined" && "vibrate" in navigator);
    if (typeof Notification === "undefined") setPerm("unsupported");
    else setPerm(Notification.permission as Perm);
  }, []);

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      setNote("This browser doesn't support notifications.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const res = await Notification.requestPermission();
      setPerm(res as Perm);
      if (res === "granted") {
        const sub = await subscribe();
        setNote(
          sub.ok
            ? "Notifications on. You'll be pinged for calls & messages — even when Karochat is closed."
            : "Notifications on for this tab. Background push couldn't register on this device, but in-app alerts still work."
        );
      } else if (res === "denied") {
        setNote(
          "Notifications are blocked. Enable them for this site in your browser settings, then try again."
        );
      }
    } catch {
      setNote("Couldn't enable notifications. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-glass tint-mint p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Notifications</h2>
        <span className="text-xs text-white/40">Calls · messages · alerts</span>
      </div>

      <p className="mb-3 text-xs text-white/55">
        Get a pop-up, sound and vibration when someone calls or messages you —
        works while Karochat is open, and on your lock screen when it&apos;s closed.
      </p>

      {/* Background notifications (push permission) */}
      <div className="mb-3 rounded-xl border border-white/10 bg-black/20 p-3">
        {perm === "granted" ? (
          <p className="flex items-center gap-2 text-sm text-neon-mint">
            <span aria-hidden>✓</span> Background notifications are on.
          </p>
        ) : perm === "unsupported" ? (
          <p className="text-sm text-white/55">
            This browser doesn&apos;t support background notifications. In-app
            alerts still work while Karochat is open.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-white/75">
              Turn on calls &amp; messages when the app is closed.
            </p>
            <button
              type="button"
              onClick={enableNotifications}
              disabled={busy}
              className="rounded-lg border border-neon-mint/40 bg-neon-mint/10 px-3 py-1.5 text-sm font-medium text-neon-mint transition hover:bg-neon-mint/20 disabled:opacity-50"
            >
              {busy ? "Enabling…" : "Enable notifications"}
            </button>
          </div>
        )}
      </div>

      {/* Sound + vibration toggles */}
      <div className="space-y-2">
        <ToggleRow
          label="Sound"
          hint="Chime for messages, ring for calls"
          on={sound}
          onChange={(v) => {
            setSound(v);
            setSoundEnabled(v);
            if (v) playChime();
          }}
        />
        {hasVibrate && (
          <ToggleRow
            label="Vibration"
            hint="Haptic buzz on alerts"
            on={haptics}
            onChange={(v) => {
              setHaptics(v);
              setVibrateEnabled(v);
              if (v) vibrate([80, 40, 80]);
            }}
          />
        )}
      </div>

      {note && (
        <p className="mt-3 rounded-md bg-white/5 px-2 py-1.5 text-[12px] text-white/70">
          {note}
        </p>
      )}
    </section>
  );
}

function ToggleRow({
  label,
  hint,
  on,
  onChange
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left transition hover:bg-white/5"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-white">{label}</span>
        <span className="block text-[11px] text-white/50">{hint}</span>
      </span>
      <span
        aria-hidden
        className={
          "relative h-6 w-11 shrink-0 rounded-full transition " +
          (on ? "bg-neon-mint/70" : "bg-white/15")
        }
      >
        <span
          className={
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all " +
            (on ? "left-[22px]" : "left-0.5")
          }
        />
      </span>
    </button>
  );
}
