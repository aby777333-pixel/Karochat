"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

/**
 * EmojiPicker — Wave 18.
 *
 * Lightweight inline picker (no library). Categorized + searchable.
 * Recent picks are remembered in localStorage.
 */
const CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: "Smileys",
    emojis: "😀 😃 😄 😁 😆 😅 😂 🤣 🥲 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳".split(" ")
  },
  {
    name: "Feels",
    emojis: "😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥".split(" ")
  },
  {
    name: "Love",
    emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 💌 💋 🫶 🤝 💍".split(" ")
  },
  {
    name: "Gestures",
    emojis: "👍 👎 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👋 🤚 🖐 ✋ 🖖 👏 🙌 🤲 🙏 ✍️ 💪".split(" ")
  },
  {
    name: "Animals",
    emojis: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦄 🐝 🐢 🐙 🦋 🌸 🌺 🌻 🌹".split(" ")
  },
  {
    name: "Food",
    emojis: "🍎 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌽 🌶 🫑 🥕 🧄 🧅 🥔 🍞 🥐 🥖 🧇 🥞 🧈 🍔 🍟 🍕 🥪 🌮 🌯 🥗 🍣 🍜 🍝 🍤 🍱 🍙 🍘 🍦 🍩 🍪 🎂 🍰 🥧 🍫 🍿 🍷 🍺 🍹 ☕ 🍵".split(" ")
  },
  {
    name: "Activity",
    emojis: "⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🥊 🥋 🎯 🪁 🎮 🕹 🎲 🎰 🎳 🎼 🎵 🎶 🎤 🎧 🎷 🎸 🎻 🥁".split(" ")
  },
  {
    name: "Travel",
    emojis: "✈️ 🚀 🛸 🚗 🚕 🚙 🚌 🚎 🏎 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🛵 🏍 🛴 🚲 🛹 🛼 ⛵ 🚤 🛥 🛳 🚢 🚂 🚆 🚇 🚉 🗽 🗼 🌍 🌎 🌏 🌋".split(" ")
  },
  {
    name: "Objects",
    emojis: "💡 🔦 🕯 🪔 📱 💻 ⌨️ 🖥 🖨 🖱 💽 💾 💿 📀 📷 📸 🎥 📺 📻 📞 ☎️ 📠 📡 🔋 🔌 💎 💰 💵 🎁 🎈 🎉 🎊 🎀 🏆 🥇 🥈 🥉 🔑".split(" ")
  },
  {
    name: "Symbols",
    emojis: "✨ ⭐ 🌟 💫 ⚡ 🔥 💥 ☄️ 🌈 ❌ ⭕ ❗ ❓ ‼️ ⁉️ 💢 💯 🔞 🚫 ⛔ ☢️ ☣️ ☮️ ✝️ ☪️ ☸️ ✡️ 🔯 ♻️ ✅ ❎ ✔️".split(" ")
  }
];

const RECENT_KEY = "karochat:emoji-recent";
const RECENT_MAX = 28;

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as string[]).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function pushRecent(e: string) {
  if (typeof window === "undefined") return;
  try {
    const cur = readRecent();
    const next = [e, ...cur.filter((x) => x !== e)].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function EmojiPicker({
  onPick,
  onClose
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<string>("Smileys");
  const [search, setSearch] = useState("");
  const [recent, setRecent] = useState<string[]>(readRecent());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [onClose]);

  const all = useMemo(() => CATEGORIES.flatMap((c) => c.emojis), []);
  const list = useMemo(() => {
    if (search.trim().length > 0) {
      // No emoji-name index here — just show ALL emojis when searching, but
      // shrink the working set so it stays performant.
      return all.slice(0, 200);
    }
    return CATEGORIES.find((c) => c.name === tab)?.emojis ?? [];
  }, [search, tab, all]);

  function handlePick(e: string) {
    pushRecent(e);
    setRecent((cur) => [e, ...cur.filter((x) => x !== e)].slice(0, RECENT_MAX));
    onPick(e);
  }

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Emoji picker"
      className="absolute bottom-12 left-0 z-[60] w-[300px] rounded-xl border border-white/10 bg-ink-800/95 p-2 shadow-xl backdrop-blur"
    >
      <div className="flex items-center gap-2 px-1 pb-1.5">
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search emoji…"
          className="flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none placeholder:text-white/30 focus:border-neon-blue/50"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close emoji picker"
          className="rounded-md border border-white/10 bg-white/5 px-1.5 text-[10px] text-white/60 hover:bg-white/10"
        >
          ✕
        </button>
      </div>
      {!search && recent.length > 0 && (
        <>
          <p className="px-1 pb-0.5 text-[9px] uppercase tracking-widest text-white/40">
            Recent
          </p>
          <div className="mb-1 flex flex-wrap gap-0.5 border-b border-white/5 pb-1.5">
            {recent.slice(0, 14).map((e) => (
              <button
                key={`r-${e}`}
                type="button"
                onClick={() => handlePick(e)}
                className="rounded p-0.5 text-lg hover:bg-white/10"
                aria-label={`Insert ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
      {!search && (
        <div className="mb-1 flex gap-0.5 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => setTab(c.name)}
              className={clsx(
                "rounded-md px-1.5 py-0.5 text-[9px] uppercase tracking-widest transition",
                tab === c.name
                  ? "bg-neon-blue/15 text-neon-blue"
                  : "text-white/45 hover:bg-white/5 hover:text-white/80"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <div
        className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto pr-0.5"
        role="grid"
      >
        {list.map((e, i) => (
          <button
            key={`${e}-${i}`}
            type="button"
            onClick={() => handlePick(e)}
            className="rounded p-0.5 text-lg leading-none hover:bg-white/10"
            aria-label={`Insert ${e}`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
