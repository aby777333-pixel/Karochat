"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PRESENCE_LABEL, PresenceDot, type PresenceState } from "./PresenceDot";

const PRESETS: { label: string; emoji?: string; text: string }[] = [
  { label: "Available", text: "" },
  { label: "Coding", emoji: "💻", text: "Coding" },
  { label: "Listening", emoji: "🎧", text: "Listening to music" },
  { label: "In a meeting", emoji: "📞", text: "In a meeting" },
  { label: "On break", emoji: "☕", text: "Be right back" }
];

const STATES: PresenceState[] = ["online", "away", "busy", "invisible"];

const MOODS: { value: string; label: string; emoji: string }[] = [
  { value: "chatty",       label: "chatty",       emoji: "💬" },
  { value: "quiet",        label: "quiet",        emoji: "🤫" },
  { value: "flirty",       label: "flirty",       emoji: "😘" },
  { value: "focused",      label: "focused",      emoji: "🎯" },
  { value: "low",          label: "low",          emoji: "🌧️" },
  { value: "celebrating",  label: "celebrating",  emoji: "🎉" },
  { value: "lonely",       label: "lonely",       emoji: "🌒" },
  { value: "horny",        label: "horny",        emoji: "🔥" },
  { value: "processing",   label: "processing",   emoji: "🌀" }
];

const MOOD_EXPIRY_CHOICES = [
  { minutes: 60,        label: "1h"  },
  { minutes: 4 * 60,    label: "4h"  },
  { minutes: 12 * 60,   label: "12h" },
  { minutes: 24 * 60,   label: "24h" },
  { minutes: 0,         label: "Until I clear it" }
];

// Same set the manual Translate menu shows in RoomChat — keeps the two in
// sync so a user's "auto" pick matches what they could pick by hand.
const TRANSLATE_LANG_CHOICES: { code: string; label: string }[] = [
  { code: "",   label: "off"          },
  { code: "en", label: "English"      },
  { code: "hi", label: "हिन्दी"        },
  { code: "ta", label: "தமிழ்"        },
  { code: "te", label: "తెలుగు"       },
  { code: "kn", label: "ಕನ್ನಡ"        },
  { code: "ml", label: "മലയാളം"      },
  { code: "bn", label: "বাংলা"        },
  { code: "mr", label: "मराठी"        },
  { code: "gu", label: "ગુજરાતી"      },
  { code: "pa", label: "ਪੰਜਾਬੀ"      },
  { code: "or", label: "ଓଡ଼ିଆ"        },
  { code: "as", label: "অসমীয়া"      },
  { code: "ur", label: "اردو"         },
  { code: "es", label: "Español"      },
  { code: "fr", label: "Français"     },
  { code: "de", label: "Deutsch"      },
  { code: "pt", label: "Português"    },
  { code: "ar", label: "العربية"      },
  { code: "ja", label: "日本語"       },
  { code: "zh", label: "中文"         },
  { code: "ko", label: "한국어"       },
  { code: "ru", label: "Русский"      }
];

export function StatusPicker({
  currentState,
  currentText,
  currentEmoji,
  currentMood,
  currentMoodExpiresAt,
  currentTravelCity,
  currentTravelUntil,
  currentBioDrop,
  currentAutoTranslate,
  displayName
}: {
  currentState: PresenceState | string;
  currentText: string | null;
  currentEmoji: string | null;
  currentMood?: string | null;
  currentMoodExpiresAt?: string | null;
  currentTravelCity?: string | null;
  currentTravelUntil?: string | null;
  currentBioDrop?: string | null;
  currentAutoTranslate?: string | null;
  displayName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PresenceState>(
    (STATES.includes(currentState as PresenceState) ? currentState : "online") as PresenceState
  );
  const [emoji, setEmoji] = useState(currentEmoji ?? "");
  const [text, setText] = useState(currentText ?? "");
  const [mood, setMood] = useState<string | null>(currentMood ?? null);
  const [moodExpiryMinutes, setMoodExpiryMinutes] = useState<number>(240);
  const [travelCity, setTravelCity] = useState<string>(currentTravelCity ?? "");
  const [travelDays, setTravelDays] = useState<number>(7);
  const [bio, setBio] = useState<string>(currentBioDrop ?? "");
  const [autoTranslate, setAutoTranslate] = useState<string>(
    (currentAutoTranslate ?? "").toLowerCase()
  );
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const travelActive =
    !!currentTravelCity &&
    (!currentTravelUntil || new Date(currentTravelUntil) > new Date());

  const moodPreset = MOODS.find((m) => m.value === mood);
  const moodActive =
    !!currentMood &&
    (!currentMoodExpiresAt || new Date(currentMoodExpiresAt) > new Date());

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function save() {
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      await supabase.rpc("touch_presence", { p_state: state });
      await supabase.rpc("set_status", {
        p_text: text || null,
        p_emoji: emoji || null,
        p_expires_at: null
      });
      await supabase.rpc("set_mood", {
        p_mood: mood,
        p_expires_in_minutes: mood ? moodExpiryMinutes : 0
      });
      const cleanCity = travelCity.trim();
      const until =
        cleanCity && travelDays > 0
          ? new Date(Date.now() + travelDays * 24 * 60 * 60 * 1000).toISOString()
          : null;
      await supabase.rpc("set_travel", {
        p_city: cleanCity || null,
        p_until_iso: until
      });
      const cleanBio = bio.trim();
      await supabase.rpc("set_bio_drop", {
        p_bio: cleanBio.length ? cleanBio : null
      });
      await supabase.rpc("set_auto_translate", {
        p_lang: autoTranslate ? autoTranslate : null
      });
      setOpen(false);
      router.refresh();
    });
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setEmoji(p.emoji ?? "");
    setText(p.text);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <PresenceDot state={state} pulse />
        <span className="hidden md:inline">
          {currentEmoji} {currentText || PRESENCE_LABEL[state]}
          {moodActive && (
            <span className="ml-1.5 rounded-sm bg-neon-purple/20 px-1 text-[10px] uppercase tracking-widest text-neon-purple">
              {MOODS.find((mm) => mm.value === currentMood)?.emoji ?? ""} {currentMood}
            </span>
          )}
          {travelActive && (
            <span className="ml-1.5 rounded-sm bg-neon-amber/20 px-1 text-[10px] uppercase tracking-widest text-neon-amber">
              🧳 {currentTravelCity}
            </span>
          )}
        </span>
        <span className="md:hidden">{displayName}</span>
      </button>

      {open && (
        <div className="surface-glass fixed inset-x-3 top-24 z-30 mx-auto max-h-[70vh] w-auto max-w-[340px] overflow-y-auto p-3 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mx-0 sm:mt-2 sm:max-h-none sm:w-72 sm:max-w-none sm:overflow-visible">
          <p className="text-xs uppercase tracking-widest text-white/40">Presence</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {STATES.map((s) => (
              <button
                key={s}
                onClick={() => setState(s)}
                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition ${
                  state === s
                    ? "border-neon-blue/60 bg-neon-blue/10 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                <PresenceDot state={s} />
                <span>{PRESENCE_LABEL[s]}</span>
              </button>
            ))}
          </div>

          <p className="mt-4 text-xs uppercase tracking-widest text-white/40">Status text</p>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-2">
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
              placeholder="😀"
              className="w-9 bg-transparent py-2 text-center text-sm outline-none"
            />
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 80))}
              placeholder="What's on your mind?"
              className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-white/30"
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/10"
              >
                {p.emoji ? `${p.emoji} ` : ""}{p.label}
              </button>
            ))}
          </div>

          <p className="mt-4 text-xs uppercase tracking-widest text-white/40">Mood</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {MOODS.map((m) => {
              const active = mood === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(active ? null : m.value)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg border px-1.5 py-1.5 text-[11px] transition ${
                    active
                      ? "border-neon-purple/60 bg-neon-purple/15 text-white"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  <span aria-hidden className="text-base">{m.emoji}</span>
                  <span className="capitalize">{m.label}</span>
                </button>
              );
            })}
          </div>
          {mood && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-white/55">
              <span>Expires in</span>
              <select
                value={moodExpiryMinutes}
                onChange={(e) => setMoodExpiryMinutes(Number(e.target.value))}
                className="flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none focus:border-neon-purple/60"
              >
                {MOOD_EXPIRY_CHOICES.map((c) => (
                  <option key={c.minutes} value={c.minutes}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <p className="mt-4 text-xs uppercase tracking-widest text-white/40">
            Travel mode
          </p>
          <p className="mt-1 text-[11px] text-white/45">
            Show up in a city&apos;s rooms while you&apos;re visiting.
          </p>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-2">
            <span aria-hidden className="text-white/40">🧳</span>
            <input
              value={travelCity}
              onChange={(e) => setTravelCity(e.target.value.slice(0, 60))}
              placeholder="visiting Chennai…"
              className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-white/30"
            />
            {travelCity && (
              <button
                type="button"
                onClick={() => setTravelCity("")}
                aria-label="Clear travel city"
                className="text-xs text-white/40 hover:text-white/70"
              >
                ✕
              </button>
            )}
          </div>
          {travelCity && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-white/55">
              <span>For</span>
              <select
                value={travelDays}
                onChange={(e) => setTravelDays(Number(e.target.value))}
                className="flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none focus:border-neon-amber/60"
              >
                <option value={1}>1 day</option>
                <option value={3}>3 days</option>
                <option value={7}>a week</option>
                <option value={14}>2 weeks</option>
                <option value={30}>a month</option>
                <option value={0}>until I clear it</option>
              </select>
            </div>
          )}

          <p className="mt-4 text-xs uppercase tracking-widest text-white/40">
            Bio drop
          </p>
          <p className="mt-1 text-[11px] text-white/45">
            One paragraph (280 chars) shown on your <code className="font-mono">/u/</code> page.
            No real names required.
          </p>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 280))}
            placeholder="who you are right now, in a sentence…"
            rows={2}
            className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-mint/40"
          />
          <p className="mt-0.5 text-right text-[10px] text-white/35">
            {bio.length}/280
          </p>

          <p className="mt-3 text-xs uppercase tracking-widest text-white/40">
            Auto-translate messages
          </p>
          <p className="mt-1 text-[11px] text-white/45">
            Render foreign-script messages in your language. Off by default.
          </p>
          <select
            value={autoTranslate}
            onChange={(e) => setAutoTranslate(e.target.value)}
            className="mt-2 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs outline-none focus:border-neon-amber/40"
          >
            {TRANSLATE_LANG_CHOICES.map((l) => (
              <option key={l.code || "off"} value={l.code}>
                {l.code ? `${l.code} · ${l.label}` : "off"}
              </option>
            ))}
          </select>

          <div className="mt-3 flex gap-2">
            <button
              onClick={save}
              disabled={pending}
              className="flex-1 rounded-lg bg-neon-blue px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-neon-blue/90 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
