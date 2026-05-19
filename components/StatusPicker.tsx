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

export function StatusPicker({
  currentState,
  currentText,
  currentEmoji,
  displayName
}: {
  currentState: PresenceState | string;
  currentText: string | null;
  currentEmoji: string | null;
  displayName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PresenceState>(
    (STATES.includes(currentState as PresenceState) ? currentState : "online") as PresenceState
  );
  const [emoji, setEmoji] = useState(currentEmoji ?? "");
  const [text, setText] = useState(currentText ?? "");
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

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
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <PresenceDot state={state} pulse />
        <span className="hidden md:inline">{currentEmoji} {currentText || PRESENCE_LABEL[state]}</span>
        <span className="md:hidden">{displayName}</span>
      </button>

      {open && (
        <div className="surface-glass absolute right-0 top-full z-30 mt-2 w-72 p-3 shadow-xl">
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
