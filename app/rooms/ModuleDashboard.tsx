import Link from "next/link";

// Karochat — colourful module launcher (Wave 21).
//
// A bright, sectioned tile grid that surfaces every module at a glance,
// inspired by modern super-app home screens. Rendered near the top of the
// lobby. Mobile-first but looks great at every width. Pure links — no
// client JS — so it stays light and can't break the lobby.

type Tile = {
  href: string;
  label: string;
  emoji: string;
  /** tailwind gradient for the icon chip */
  grad: string;
};

type Section = { title: string; tiles: Tile[] };

const SECTIONS: Section[] = [
  {
    title: "Your space",
    tiles: [
      { href: "#saved", label: "Saved", emoji: "💾", grad: "from-slate-300 via-slate-500 to-slate-700" },
      { href: "#friends", label: "Friends", emoji: "🧑‍🤝‍🧑", grad: "from-emerald-300 via-teal-400 to-cyan-500" },
      { href: "#dms", label: "Messages", emoji: "💬", grad: "from-sky-300 via-blue-500 to-indigo-600" },
      { href: "#browse-rooms", label: "My rooms", emoji: "🚪", grad: "from-violet-400 via-purple-500 to-fuchsia-600" }
    ]
  },
  {
    title: "Spontaneous",
    tiles: [
      { href: "/rooms/00000000-0000-0000-0000-00000000aaaa", label: "Lobby", emoji: "🏠", grad: "from-amber-300 via-orange-400 to-pink-500" },
      { href: "/meet/now", label: "Meet now", emoji: "⚡", grad: "from-amber-300 via-orange-400 to-orange-600" },
      { href: "/handshake", label: "Handshake", emoji: "🤝", grad: "from-emerald-300 via-teal-400 to-cyan-500" },
      { href: "/rooms?create=1", label: "New room", emoji: "➕", grad: "from-sky-300 via-blue-500 to-indigo-600" }
    ]
  },
  // NOTE: The "Smart tools" section is intentionally hidden for now (kept for
  // later re-enable). The /organizer and /tools routes still work if visited
  // directly. To bring it back, restore this section object:
  // {
  //   title: "Smart tools",
  //   tiles: [
  //     { href: "/organizer", label: "Organizer", emoji: "🗂️", grad: "from-amber-300 via-orange-400 to-rose-500" },
  //     { href: "/tools#translate", label: "Translate", emoji: "🌐", grad: "from-sky-300 via-blue-400 to-indigo-600" },
  //     { href: "/tools#worldclock", label: "World Clock", emoji: "🕐", grad: "from-slate-300 via-slate-500 to-slate-700" },
  //     { href: "/tools#weather", label: "Weather", emoji: "⛅", grad: "from-cyan-300 via-sky-400 to-blue-500" },
  //     { href: "/tools#dictionary", label: "Dictionary", emoji: "📖", grad: "from-violet-400 via-purple-500 to-fuchsia-600" },
  //     { href: "/tools#convert", label: "Converter", emoji: "🔄", grad: "from-emerald-300 via-teal-400 to-cyan-500" },
  //     { href: "/tools#qr", label: "QR Code", emoji: "🔳", grad: "from-zinc-300 via-zinc-500 to-zinc-700" },
  //     { href: "/tools#calc", label: "Calculator", emoji: "🧮", grad: "from-amber-300 via-orange-400 to-red-500" }
  //   ]
  // },
  {
    title: "Library, media & entertainment",
    tiles: [
      { href: "/books", label: "Books", emoji: "📚", grad: "from-blue-400 via-indigo-500 to-violet-600" },
      { href: "/read", label: "Read", emoji: "📖", grad: "from-violet-400 via-purple-500 to-fuchsia-600" },
      { href: "/write", label: "Write", emoji: "✍️", grad: "from-teal-300 via-emerald-400 to-green-500" },
      { href: "/shorts", label: "Shorts", emoji: "🎬", grad: "from-pink-400 via-rose-500 to-fuchsia-600" },
      { href: "/videos", label: "Videos", emoji: "🎞️", grad: "from-sky-400 via-blue-500 to-indigo-600" },
      { href: "/livetv", label: "TV & Radio", emoji: "📺", grad: "from-cyan-300 via-sky-500 to-blue-700" },
      { href: "/karaoke", label: "Karaoke", emoji: "🎤", grad: "from-fuchsia-400 via-purple-500 to-indigo-600" },
      { href: "/sleep", label: "Sleep", emoji: "😴", grad: "from-indigo-400 via-purple-600 to-slate-900" },
      { href: "/sports", label: "Sports", emoji: "⚽", grad: "from-green-300 via-emerald-500 to-teal-700" },
      { href: "/audiobooks", label: "Audiobooks & Films", emoji: "🎧", grad: "from-amber-300 via-orange-400 to-rose-500" },
      { href: "/files", label: "Files & Apps", emoji: "📂", grad: "from-slate-300 via-slate-500 to-slate-700" },
      { href: "/onlinegames", label: "Online Games", emoji: "🎮", grad: "from-fuchsia-400 via-pink-500 to-rose-600" }
    ]
  },
  // NOTE: The "Infotainment" section is intentionally hidden for now (kept for
  // later re-enable). The /infotainment routes still work if visited directly.
  // To bring it back, restore this section object:
  // {
  //   title: "Infotainment",
  //   tiles: [
  //     { href: "/infotainment", label: "Movies & Music", emoji: "🎬", grad: "from-rose-400 via-red-500 to-fuchsia-600" },
  //     { href: "/infotainment#karaoke", label: "Karaoke & Live", emoji: "🎤", grad: "from-violet-400 via-purple-500 to-fuchsia-600" },
  //     { href: "/infotainment#golive", label: "Go Live", emoji: "📡", grad: "from-amber-300 via-orange-500 to-red-600" },
  //     { href: "/infotainment#royalty", label: "Royalty-Free", emoji: "🆓", grad: "from-emerald-300 via-teal-400 to-cyan-500" }
  //   ]
  // },
  {
    title: "Wellbeing",
    tiles: [
      { href: "/sexed", label: "Sex ed", emoji: "💞", grad: "from-rose-400 via-pink-500 to-fuchsia-600" },
      { href: "/sexed/ask", label: "Ask Karo", emoji: "💬", grad: "from-emerald-300 via-teal-400 to-cyan-500" },
      { href: "/ayurveda", label: "Ayurveda", emoji: "🌿", grad: "from-green-300 via-emerald-500 to-teal-700" },
      { href: "/diet", label: "Diet & Recipes", emoji: "🥗", grad: "from-lime-300 via-amber-400 to-orange-500" },
      { href: "/hope", label: "Hope", emoji: "🫂", grad: "from-sky-300 via-indigo-400 to-violet-600" },
      { href: "/fitness", label: "Fitness", emoji: "🏋️", grad: "from-rose-300 via-red-400 to-rose-600" },
      { href: "/breathe", label: "Breathe", emoji: "🌬️", grad: "from-cyan-300 via-sky-400 to-blue-500" },
      { href: "/firstaid", label: "First Aid", emoji: "🚑", grad: "from-red-400 via-rose-500 to-red-700" }
    ]
  },
  {
    title: "Community",
    tiles: [
      { href: "/stories/new", label: "Add story", emoji: "✨", grad: "from-fuchsia-400 via-purple-500 to-indigo-600" },
      { href: "/shorts/new", label: "Post short", emoji: "📹", grad: "from-orange-300 via-red-400 to-rose-600" },
      { href: "/videos/new", label: "Post video", emoji: "🎥", grad: "from-sky-300 via-blue-400 to-indigo-600" },
      { href: "/charter", label: "Charter", emoji: "🌍", grad: "from-cyan-300 via-sky-400 to-blue-600" }
      // NOTE: The "Suggestions", "Trivia", "Icebreakers" and "Inspiration" tiles
      // are intentionally hidden for now (kept for later re-enable). The
      // /suggestions, /quiz and /fun routes still work if visited directly.
      // To bring them back, restore these tiles (re-add the comma after Charter):
      // { href: "/suggestions", label: "Suggestions", emoji: "💡", grad: "from-amber-300 via-yellow-400 to-orange-500" },
      // { href: "/quiz", label: "Trivia", emoji: "🧠", grad: "from-indigo-300 via-blue-400 to-violet-600" },
      // { href: "/fun#icebreakers", label: "Icebreakers", emoji: "💬", grad: "from-teal-300 via-emerald-400 to-cyan-500" },
      // { href: "/fun#inspire", label: "Inspiration", emoji: "✨", grad: "from-amber-300 via-orange-400 to-pink-500" }
    ]
  }
  // NOTE: The "Grown-ups · 18+" section is intentionally hidden for now (kept
  // for later re-enable). The /adult route still works if visited directly.
  // To bring it back, restore this section object (re-add the comma after the
  // "Community" section above):
  // ,{
  //   title: "Grown-ups · 18+",
  //   tiles: [
  //     { href: "/adult", label: "Adult 18+", emoji: "🔞", grad: "from-rose-500 via-red-600 to-rose-900" }
  //   ]
  // }
];

function TileLink({ tile }: { tile: Tile }) {
  // Steel card base + neon icon chip with layered 3D shadows. items-start +
  // a fixed-height label block keeps every icon on the same line and every
  // label aligned, whether the label is one or two lines.
  // Matte carbon-grade card: dark graphite gradient + top sheen + deep drop
  // shadow for a raised 3D feel, with a crisp edge so tiles read clearly.
  const cls =
    "group flex flex-col items-center gap-2.5 rounded-2xl border border-white/12 bg-gradient-to-b from-zinc-700/70 via-zinc-900/85 to-black px-2 py-4 text-center shadow-[0_10px_22px_-4px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.10)] ring-1 ring-inset ring-white/[0.06] transition hover:-translate-y-0.5 hover:border-white/25 hover:shadow-[0_16px_30px_-6px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.16)] active:translate-y-0 active:scale-[0.97]";
  const inner = (
    <>
      <span
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tile.grad} text-[26px] shadow-[0_8px_18px_rgba(0,0,0,0.55),inset_0_1px_2px_rgba(255,255,255,0.35)] ring-1 ring-white/15 saturate-[.68] brightness-[.92] transition group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:saturate-100 group-hover:brightness-105`}
      >
        {tile.emoji}
      </span>
      <span className="flex min-h-[2.4em] items-start justify-center text-xs font-bold leading-tight text-white drop-shadow">
        {tile.label}
      </span>
    </>
  );
  // In-page anchors (e.g. "#browse-rooms") just smooth-scroll on the lobby —
  // a Next <Link> to the current route would be a no-op.
  if (tile.href.startsWith("#")) {
    return (
      <a href={tile.href} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={tile.href} className={cls}>
      {inner}
    </Link>
  );
}

export function ModuleDashboard() {
  return (
    <section className="surface-glass tint-purple p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold">Explore Karochat</h2>
        <span className="text-[11px] text-white/40">tap to jump in</span>
      </div>
      <div className="mt-3 space-y-5">
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/55">
              <span className="h-1 w-1 rounded-full bg-neon-purple" aria-hidden />
              {s.title}
            </p>
            <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
              {s.tiles.map((t) => (
                <TileLink key={t.label} tile={t} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
