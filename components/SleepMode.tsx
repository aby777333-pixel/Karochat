"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "karochat:sleep-dismissed";
const OPTOUT_KEY = "karochat:sleep-optout";

/**
 * v5 AD5 — Sleep mode. After 23:00 local time, dim the UI and offer a single
 * gentle nudge to step away. Off-switchable for the session OR permanently.
 *
 * Brand positioning: "Karochat is the only chat app that wants you to sleep."
 */
export function SleepMode() {
  const [active, setActive] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [permanentOptOut, setPermanentOptOut] = useState(false);

  useEffect(() => {
    function check() {
      try {
        if (window.localStorage.getItem(OPTOUT_KEY) === "1") {
          setPermanentOptOut(true);
          setActive(false);
          setShowToast(false);
          return;
        }
      } catch {
        // ignore
      }
      const hour = new Date().getHours();
      const sleeping = hour >= 23 || hour < 6;
      setActive(sleeping);
      if (sleeping) {
        let dismissedTodayKey = "";
        try {
          const today = new Date().toISOString().slice(0, 10);
          dismissedTodayKey = `${DISMISS_KEY}:${today}`;
          if (window.sessionStorage.getItem(dismissedTodayKey) !== "1") {
            setShowToast(true);
          }
        } catch {
          // ignore
        }
      } else {
        setShowToast(false);
      }
    }
    check();
    const id = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  function dismissToday() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      window.sessionStorage.setItem(`${DISMISS_KEY}:${today}`, "1");
    } catch {
      // ignore
    }
    setShowToast(false);
  }

  function turnOff() {
    try {
      window.localStorage.setItem(OPTOUT_KEY, "1");
    } catch {
      // ignore
    }
    setPermanentOptOut(true);
    setActive(false);
    setShowToast(false);
  }

  if (permanentOptOut) return null;
  if (!active) return null;

  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          html { transition: filter 1.2s ease; }
        }
        html.karochat-sleep body { filter: brightness(0.78) saturate(0.9); }
      `}</style>
      <SleepFilterHook />
      {showToast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3">
          <div className="surface-glass tint-purple pointer-events-auto flex max-w-md flex-col gap-2 px-4 py-3 shadow-glow-blue">
            <p className="text-sm text-white">
              🌙 It&apos;s late. Karochat just dimmed itself a little — that&apos;s the
              app trying to be a good roommate.
            </p>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={turnOff}
                className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60 hover:bg-white/10"
              >
                Turn off
              </button>
              <button
                type="button"
                onClick={dismissToday}
                className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/10"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SleepFilterHook() {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("karochat-sleep");
    return () => html.classList.remove("karochat-sleep");
  }, []);
  return null;
}
