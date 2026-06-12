"use client";

// Karochat — weekly availability editor for verified doctors (v9 Phase 4).
// Saves the whole week atomically via set_doctor_availability(jsonb).

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Slot = {
  day_of_week: number;
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
  timezone: string;
};

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC"
];

function hhmm(t: string): string {
  return t.slice(0, 5);
}

export function AvailabilityEditor({ initialSlots }: { initialSlots: Slot[] }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [slots, setSlots] = useState<Slot[]>(
    initialSlots.map((s) => ({
      ...s,
      start_time: hhmm(s.start_time),
      end_time: hhmm(s.end_time)
    }))
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function addSlot(day: number) {
    setSlots((prev) => [
      ...prev,
      {
        day_of_week: day,
        start_time: "18:00",
        end_time: "20:00",
        timezone: prev[0]?.timezone ?? "Asia/Kolkata"
      }
    ]);
    setMsg(null);
  }

  function updateSlot(idx: number, patch: Partial<Slot>) {
    setSlots((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    );
    setMsg(null);
  }

  function removeSlot(idx: number) {
    setSlots((prev) => prev.filter((_, i) => i !== idx));
    setMsg(null);
  }

  async function save() {
    for (const s of slots) {
      if (s.start_time >= s.end_time) {
        setErr(
          `${DAYS[s.day_of_week]}: start (${s.start_time}) must be before end (${s.end_time}).`
        );
        return;
      }
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    const { error } = await supabase.rpc("set_doctor_availability", {
      p_slots: slots
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setMsg("Saved — the directory shows your new hours.");
  }

  return (
    <section className="surface-glass min-w-0 space-y-4 p-5">
      {DAYS.map((dayName, day) => {
        const daySlots = slots
          .map((s, idx) => ({ s, idx }))
          .filter(({ s }) => s.day_of_week === day);
        return (
          <div key={day} className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-white/85">{dayName}</p>
              <button
                type="button"
                onClick={() => addSlot(day)}
                disabled={busy}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10"
              >
                + add window
              </button>
            </div>
            {daySlots.length === 0 ? (
              <p className="mt-1 text-[11px] text-white/35">Not available</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {daySlots.map(({ s, idx }) => (
                  <li
                    key={idx}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <input
                      type="time"
                      value={s.start_time}
                      onChange={(e) =>
                        updateSlot(idx, { start_time: e.target.value })
                      }
                      disabled={busy}
                      className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-neon-mint/40"
                    />
                    <span className="text-white/40">→</span>
                    <input
                      type="time"
                      value={s.end_time}
                      onChange={(e) =>
                        updateSlot(idx, { end_time: e.target.value })
                      }
                      disabled={busy}
                      className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-neon-mint/40"
                    />
                    <select
                      value={s.timezone}
                      onChange={(e) =>
                        updateSlot(idx, { timezone: e.target.value })
                      }
                      disabled={busy}
                      className="min-w-0 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[12px] text-white/75 outline-none focus:border-neon-mint/40"
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeSlot(idx)}
                      disabled={busy}
                      className="rounded-lg border border-neon-red/30 bg-neon-red/10 px-2 py-1.5 text-[11px] text-neon-red hover:bg-neon-red/20"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {err && (
        <p className="rounded-lg border border-neon-red/30 bg-neon-red/10 px-3 py-2 text-[12px] text-neon-red">
          {err}
        </p>
      )}
      {msg && (
        <p className="rounded-lg border border-neon-mint/30 bg-neon-mint/10 px-3 py-2 text-[12px] text-neon-mint">
          {msg}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="rounded-xl bg-neon-mint px-4 py-2 text-sm font-medium text-ink-900 hover:bg-neon-mint/90 disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save week"}
      </button>
    </section>
  );
}
