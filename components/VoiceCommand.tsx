"use client";

// Karochat — hands-free voice commands (Wave 21).
//
// A global, tap-to-talk voice assistant available across every module.
//   • Mounted once in the root layout.
//   • Triggered by:
//       - the center FAB in the mobile bottom nav (window event "karo:voice")
//       - a small floating mic button on desktop (md+)
//   • Uses the Web Speech API (already used elsewhere for live captions).
//   • Parses simple intents and navigates / acts, with spoken confirmation.
//
// Everything is purely additive and degrades gracefully: if the browser has
// no SpeechRecognition, the overlay explains it and offers the menu instead.
// Nothing here can throw into the rest of the app.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Intent = {
  /** keywords that must appear (any one) for this intent to match */
  keys: string[];
  /** spoken + shown confirmation */
  say: string;
  /** what to do */
  run: (router: ReturnType<typeof useRouter>) => void;
};

// Order matters — first match wins, so put more specific phrases first.
const INTENTS: Intent[] = [
  { keys: ["meet now", "meet someone", "random", "spontane"], say: "Finding someone to meet.", run: (r) => r.push("/meet/now") },
  { keys: ["handshake", "bump"], say: "Opening handshake.", run: (r) => r.push("/handshake") },
  { keys: ["new room", "create room", "make a room", "start a room"], say: "Let's create a room.", run: (r) => r.push("/rooms?create=1") },
  { keys: ["books", "library"], say: "Opening books.", run: (r) => r.push("/books") },
  { keys: ["sex ed", "sexed", "sex education"], say: "Opening sex ed.", run: (r) => r.push("/sexed") },
  { keys: ["read", "publications", "essays"], say: "Opening reads.", run: (r) => r.push("/read") },
  { keys: ["write", "compose", "new post", "draft"], say: "Opening your writing.", run: (r) => r.push("/write") },
  { keys: ["shorts", "videos", "watch", "reels"], say: "Opening shorts.", run: (r) => r.push("/shorts") },
  { keys: ["charter", "rules", "guidelines"], say: "Opening the charter.", run: (r) => r.push("/charter") },
  { keys: ["home", "lobby", "rooms", "main"], say: "Going home.", run: (r) => r.push("/rooms") },
  { keys: ["back", "go back", "previous"], say: "Going back.", run: () => { if (typeof window !== "undefined") window.history.back(); } },
  { keys: ["refresh", "reload"], say: "Refreshing.", run: (r) => r.refresh() }
];

const HINTS = [
  "“Open books”",
  "“Meet now”",
  "“New room”",
  "“Shorts”",
  "“Go home”"
];

function speak(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = 1;
    u.volume = 1;
    synth.speak(u);
  } catch {
    /* ignore */
  }
}

function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

export function VoiceCommand() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState<string>("");
  const [supported, setSupported] = useState(true);
  const recRef = useRef<any>(null);
  const matchedRef = useRef(false);

  const handle = useCallback(
    (text: string) => {
      const t = text.toLowerCase().trim();
      if (!t) return;
      const intent = INTENTS.find((i) => i.keys.some((k) => t.includes(k)));
      if (intent) {
        matchedRef.current = true;
        setStatus(intent.say);
        speak(intent.say);
        haptic(18);
        // Small delay so the user sees the confirmation before we navigate.
        setTimeout(() => {
          try {
            intent.run(router);
          } catch {
            /* ignore */
          }
          setOpen(false);
        }, 550);
      } else {
        setStatus(`I didn't catch a command in “${text}”. Try one of the examples.`);
        speak("Sorry, I didn't catch that.");
      }
    },
    [router]
  );

  const stop = useCallback(() => {
    try {
      recRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const W = window as any;
    const Rec = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Rec) {
      setSupported(false);
      setStatus("Voice isn't supported in this browser — use the menu below.");
      return;
    }
    setSupported(true);
    setTranscript("");
    setStatus("Listening…");
    matchedRef.current = false;
    try {
      const rec = new Rec();
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = (typeof navigator !== "undefined" && navigator.language) || "en-US";
      rec.onresult = (e: any) => {
        let interim = "";
        let final = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const txt = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += txt;
          else interim += txt;
        }
        setTranscript((final || interim).trim());
        if (final) handle(final);
      };
      rec.onerror = (e: any) => {
        const err = e?.error ?? "error";
        if (err === "not-allowed" || err === "service-not-allowed") {
          setStatus("Microphone permission is blocked. Enable it in your browser settings.");
        } else if (err === "no-speech") {
          setStatus("Didn't hear anything. Tap the mic and try again.");
        } else {
          setStatus("Voice error — try again.");
        }
        setListening(false);
      };
      rec.onend = () => {
        setListening(false);
        setStatus((s) => (matchedRef.current ? s : s === "Listening…" ? "Tap the mic to try again." : s));
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
      haptic(10);
    } catch {
      setStatus("Couldn't start voice — try again.");
      setListening(false);
    }
  }, [handle]);

  // Open + auto-start when the FAB (or anything) fires the global event.
  useEffect(() => {
    const onTrigger = () => {
      setOpen(true);
    };
    window.addEventListener("karo:voice", onTrigger);
    return () => window.removeEventListener("karo:voice", onTrigger);
  }, []);

  // When the overlay opens, kick off listening automatically.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => start(), 150);
      return () => clearTimeout(t);
    }
    // closing — make sure recognition + speech are stopped
    stop();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    setTranscript("");
    setStatus("");
    return;
  }, [open, start, stop]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Desktop floating mic (hidden on mobile — the bottom-nav FAB covers it). */}
      <button
        type="button"
        onClick={() => {
          haptic();
          setOpen(true);
        }}
        aria-label="Voice commands"
        title="Voice commands"
        className="fixed bottom-6 right-6 z-40 hidden h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-neon-purple to-neon-blue text-xl text-white shadow-glow-blue transition hover:scale-105 active:scale-95 md:flex"
      >
        🎤
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Voice command"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="surface-glass tint-purple w-[min(440px,96vw)] p-6 text-center animate-rise">
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-semibold text-white">Voice command</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 flex flex-col items-center">
              <button
                type="button"
                onClick={() => (listening ? stop() : start())}
                aria-label={listening ? "Stop listening" : "Start listening"}
                className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-neon-purple via-neon-red to-neon-blue text-4xl text-white shadow-glow-blue transition active:scale-95"
              >
                {listening && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-neon-purple/40" aria-hidden />
                )}
                <span className="relative">{listening ? "🎙️" : "🎤"}</span>
              </button>

              <p className="mt-4 min-h-[1.5rem] text-sm font-medium text-white/90">
                {status || "Tap the mic and speak"}
              </p>
              {transcript && (
                <p className="mt-1 text-xs italic text-white/55">“{transcript}”</p>
              )}
            </div>

            {!supported ? (
              <p className="mt-4 text-xs text-white/50">
                Your browser can&apos;t do voice recognition. Use the bottom menu to navigate.
              </p>
            ) : (
              <div className="mt-5">
                <p className="text-[10px] uppercase tracking-widest text-white/40">Try saying</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {HINTS.map((h) => (
                    <span
                      key={h}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
