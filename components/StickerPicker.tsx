"use client";

// Karochat — sticker picker (v2: real stickers).
//
// Primary mode: Tenor's sticker library (transparent animated stickers,
// same public-key API the GifPicker already uses). Picking one sends it
// as an ordinary image message — identical pipeline to GIFs, so no new
// send path. A "Text" tab keeps the kaomoji packs (also the offline
// fallback if Tenor is unreachable). Same viewport-clamp pattern as the
// other composer popovers.

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

const TENOR_KEY = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ"; // public web key, harmless
const TENOR_CLIENT = "karochat";

type Sticker = { id: string; url: string; preview: string; alt: string };

const STICKER_TABS = [
  ["hello", "👋 Hi"],
  ["love", "🥰 Love"],
  ["laugh", "😂 LOL"],
  ["dance", "💃 Dance"],
  ["hug", "🤗 Hug"],
  ["sad", "😢 Sad"],
  ["angry", "😤 Angry"],
  ["excited", "🎉 Hype"],
  ["good night", "😴 Night"],
  ["thank you", "🙏 Thanks"]
] as Array<[string, string]>;

const TEXT_PACKS: { name: string; stickers: string[] }[] = [
  {
    name: "Hugs",
    stickers: [
      "(づ｡◕‿‿◕｡)づ",
      "⊂(・﹏・⊂)",
      "(っ´▽｀)っ🫂",
      "(>^_^)>  <(^_^<)",
      "╰(*´︶`*)╯♡",
      "(っ◕‿◕)っ 💐",
      "🤗🤗🤗",
      "⊂((・▽・))⊃"
    ]
  },
  {
    name: "Love",
    stickers: [
      "(♡˙︶˙♡)",
      "( ˘ ³˘)♥",
      "♡( ◡‿◡ )",
      "(*≧♡≦*)",
      "💘💘💘",
      "ʕっ•ᴥ•ʔっ ♡",
      "(✿ ♥‿♥)",
      "💌💌💌",
      "🌹 for you 🌹"
    ]
  },
  {
    name: "Funny",
    stickers: [
      "( ͡° ͜ʖ ͡°)",
      "¯\\_(ツ)_/¯",
      "(╯°□°)╯︵ ┻━┻",
      "┬─┬ノ( º _ ºノ)",
      "(¬‿¬)",
      "ಠ_ಠ",
      "(☞ﾟヮﾟ)☞",
      "🤡🤡🤡",
      "💀💀💀",
      "ᕕ( ᐛ )ᕗ"
    ]
  },
  {
    name: "Sad",
    stickers: [
      "(T_T)",
      "( ;ω; )",
      "(;_;)",
      "🥺👉👈",
      "(╥_╥)",
      "(ノ_<。)",
      "🌧😔🌧"
    ]
  },
  {
    name: "Hype",
    stickers: [
      "\\(^o^)/ ✨",
      "ヽ(^▽^)ノ",
      "(ﾉ^ヮ^)ﾉ*:･ﾟ✧",
      "🎉🎊🥳🎊🎉",
      "LET'S GOOO 🚀🚀🚀",
      "(ง •_•)ง",
      "🏆 W 🏆"
    ]
  },
  {
    name: "Zen",
    stickers: [
      "🧘 breathe 🧘",
      "✨(￣▽￣)ノ✨",
      "🌙💤🌙",
      "(－.－)...zzz",
      "🌊 calm 🌊",
      "☕ chai? ☕",
      "ʕ•ᴥ•ʔ",
      "(=^･ω･^=)"
    ]
  }
];

export function StickerPicker({
  onPickImage,
  onPick,
  onClose
}: {
  /** Send a real (Tenor) sticker — goes out as an image message. */
  onPickImage: (url: string) => void;
  /** Insert a text/kaomoji sticker into the composer. */
  onPick: (sticker: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<string>("hello");
  const [textTab, setTextTab] = useState<string>(TEXT_PACKS[0]!.name);
  const [query, setQuery] = useState("");
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const textMode = tab === "__text__";

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [onClose]);

  // Sticker fetch — same Tenor v2 endpoint the GifPicker uses, with
  // searchfilter=sticker for transparent sticker results. Debounced.
  useEffect(() => {
    if (textMode) return;
    let cancelled = false;
    setLoading(true);
    const term = query.trim() || tab;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(term)}&key=${TENOR_KEY}&client_key=${TENOR_CLIENT}&limit=24&searchfilter=sticker&media_filter=gif,tinygif,gif_transparent,tinygif_transparent`
        );
        if (!res.ok) throw new Error(`tenor ${res.status}`);
        const json = await res.json();
        const parsed: Sticker[] = (json.results ?? [])
          .map((r: any) => {
            const mf = r.media_formats ?? {};
            const full =
              mf.gif_transparent?.url ?? mf.tinygif_transparent?.url ?? mf.gif?.url ?? mf.tinygif?.url;
            const preview =
              mf.tinygif_transparent?.url ?? mf.tinygif?.url ?? full;
            return full
              ? {
                  id: String(r.id),
                  url: full as string,
                  preview: preview as string,
                  alt: (r.content_description as string) ?? "sticker"
                }
              : null;
          })
          .filter(Boolean) as Sticker[];
        if (!cancelled) {
          setStickers(parsed);
          setFailed(parsed.length === 0);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setStickers([]);
          setFailed(true);
          setLoading(false);
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [tab, query, textMode]);

  const textStickers =
    TEXT_PACKS.find((p) => p.name === textTab)?.stickers ?? [];

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Sticker picker"
      className="fixed inset-x-3 bottom-28 z-[60] mx-auto w-auto max-w-[340px] rounded-xl border border-white/10 bg-ink-800/95 p-2 shadow-xl backdrop-blur sm:absolute sm:inset-x-auto sm:bottom-12 sm:left-0 sm:mx-0 sm:w-[320px] sm:max-w-none"
    >
      <div className="flex items-center gap-2 px-1 pb-1.5">
        {!textMode ? (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stickers…"
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none placeholder:text-white/30 focus:border-neon-purple/50"
          />
        ) : (
          <p className="flex-1 text-[10px] uppercase tracking-widest text-white/40">
            🧩 Text stickers
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sticker picker"
          className="shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 text-[10px] text-white/60 hover:bg-white/10"
        >
          ✕
        </button>
      </div>

      <div className="mb-1 flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STICKER_TABS.map(([term, label]) => (
          <button
            key={term}
            type="button"
            onClick={() => {
              setTab(term);
              setQuery("");
            }}
            className={clsx(
              "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] transition",
              tab === term && !textMode
                ? "bg-neon-purple/20 text-neon-purple"
                : "text-white/50 hover:bg-white/5 hover:text-white/85"
            )}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setTab("__text__")}
          className={clsx(
            "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] transition",
            textMode
              ? "bg-neon-mint/20 text-neon-mint"
              : "text-white/50 hover:bg-white/5 hover:text-white/85"
          )}
        >
          ✏️ Text
        </button>
      </div>

      {textMode ? (
        <>
          <div className="mb-1 flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TEXT_PACKS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setTextTab(p.name)}
                className={clsx(
                  "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] uppercase tracking-widest transition",
                  textTab === p.name
                    ? "bg-neon-mint/15 text-neon-mint"
                    : "text-white/45 hover:bg-white/5 hover:text-white/80"
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto pr-0.5">
            {textStickers.map((s, i) => (
              <button
                key={`${textTab}-${i}`}
                type="button"
                onClick={() => onPick(s)}
                className="truncate rounded-lg border border-white/5 bg-black/30 px-2 py-2.5 text-center text-sm hover:border-neon-mint/40 hover:bg-white/5"
                title="Insert text sticker"
              >
                {s}
              </button>
            ))}
          </div>
          <p className="px-1 pt-1.5 text-[9px] text-white/30">
            Tap to insert — edit or add words before sending.
          </p>
        </>
      ) : loading ? (
        <p className="px-2 py-4 text-center text-[11px] text-white/40">
          Loading stickers…
        </p>
      ) : failed ? (
        <p className="px-2 py-3 text-center text-[11px] text-white/45">
          Stickers unavailable right now — the ✏️ Text tab still works.
        </p>
      ) : (
        <>
          <div className="grid max-h-60 grid-cols-3 gap-1 overflow-y-auto pr-0.5">
            {stickers.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onPickImage(s.url)}
                className="flex aspect-square items-center justify-center overflow-hidden rounded-md border border-white/5 bg-black/20 transition hover:border-neon-purple/50"
                aria-label={`Send sticker: ${s.alt}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.preview}
                  alt={s.alt}
                  loading="lazy"
                  className="max-h-full max-w-full object-contain"
                />
              </button>
            ))}
          </div>
          <p className="px-1 pt-1.5 text-[9px] text-white/30">
            Tap a sticker to send it. Via Tenor.
          </p>
        </>
      )}
    </div>
  );
}
