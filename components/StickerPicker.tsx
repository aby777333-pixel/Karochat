"use client";

// Karochat — sticker picker.
//
// Curated kaomoji / emoji-art "stickers" sent as ordinary text messages
// (no schema or send-path changes — picking inserts into the composer).
// Same viewport-clamp pattern as the other composer popovers: fixed +
// centered on phones, button-anchored on sm+.

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

const PACKS: { name: string; stickers: string[] }[] = [
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
      "─=≡Σ((( つ♡ω♡)つ",
      "💌💌💌",
      "🌹 for you 🌹"
    ]
  },
  {
    name: "Hype",
    stickers: [
      "\\(^o^)/ ✨",
      "ヽ(^▽^)ノ",
      "(ﾉ^ヮ^)ﾉ*:･ﾟ✧",
      "🎉🎊🥳🎊🎉",
      "✨ヽ(゜▽゜)ノ✨",
      "LET'S GOOO 🚀🚀🚀",
      "(ง •_•)ง",
      "🏆 W 🏆",
      "⚡⚡⚡⚡⚡",
      "💪😤💪"
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
      "☜(ﾟヮﾟ☜)",
      "🤡🤡🤡",
      "💀💀💀",
      "(ノಠ益ಠ)ノ",
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
      "(っ- ‸ - ς)",
      "(ノ_<。)",
      "🌧😔🌧"
    ]
  },
  {
    name: "Animals",
    stickers: [
      "ʕ•ᴥ•ʔ",
      "(=^･ω･^=)",
      "🐶💨",
      "(・Θ・)",
      "∪･ω･∪",
      "ฅ^•ω•^ฅ",
      "🦋✨🦋",
      "><(((º>",
      "🐢💤",
      "ʕ -ᴥ- ʔ💤"
    ]
  },
  {
    name: "Chai",
    stickers: [
      "☕ chai? ☕",
      "( ˘▽˘)っ🍵",
      "🍕❓",
      "🍜🥢😋",
      "🧋🧋🧋",
      "(っ˘ڡ˘ς) 🍰",
      "🌶🔥🌶",
      "🍳 breakfast club 🍳"
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
      "☁️☁️☁️",
      "🕯 present 🕯",
      "(￣o￣) zzZZ"
    ]
  }
];

export function StickerPicker({
  onPick,
  onClose
}: {
  onPick: (sticker: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<string>(PACKS[0]!.name);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [onClose]);

  const stickers = PACKS.find((p) => p.name === tab)?.stickers ?? [];

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Sticker picker"
      className="fixed inset-x-3 bottom-28 z-[60] mx-auto w-auto max-w-[340px] rounded-xl border border-white/10 bg-ink-800/95 p-2 shadow-xl backdrop-blur sm:absolute sm:inset-x-auto sm:bottom-12 sm:left-0 sm:mx-0 sm:w-[320px] sm:max-w-none"
    >
      <div className="flex items-center justify-between px-1 pb-1.5">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          🧩 Stickers
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sticker picker"
          className="rounded-md border border-white/10 bg-white/5 px-1.5 text-[10px] text-white/60 hover:bg-white/10"
        >
          ✕
        </button>
      </div>
      <div className="mb-1 flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PACKS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => setTab(p.name)}
            className={clsx(
              "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] uppercase tracking-widest transition",
              tab === p.name
                ? "bg-neon-purple/15 text-neon-purple"
                : "text-white/45 hover:bg-white/5 hover:text-white/80"
            )}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto pr-0.5">
        {stickers.map((s, i) => (
          <button
            key={`${tab}-${i}`}
            type="button"
            onClick={() => onPick(s)}
            className="truncate rounded-lg border border-white/5 bg-black/30 px-2 py-2.5 text-center text-sm hover:border-neon-purple/40 hover:bg-white/5"
            title="Insert sticker"
          >
            {s}
          </button>
        ))}
      </div>
      <p className="px-1 pt-1.5 text-[9px] text-white/30">
        Tap to insert — edit or add words before sending.
      </p>
    </div>
  );
}
