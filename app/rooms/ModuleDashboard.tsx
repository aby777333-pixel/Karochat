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
    title: "Spontaneous",
    tiles: [
      { href: "/meet/now", label: "Meet now", emoji: "⚡", grad: "from-amber-300 via-orange-400 to-orange-600" },
      { href: "/handshake", label: "Handshake", emoji: "🤝", grad: "from-emerald-300 via-teal-400 to-cyan-500" },
      { href: "/shorts", label: "Shorts", emoji: "🎬", grad: "from-pink-400 via-rose-500 to-fuchsia-600" },
      { href: "/rooms?create=1", label: "New room", emoji: "➕", grad: "from-sky-300 via-blue-500 to-indigo-600" }
    ]
  },
  {
    title: "Library & writing",
    tiles: [
      { href: "/books", label: "Books", emoji: "📚", grad: "from-blue-400 via-indigo-500 to-violet-600" },
      { href: "/read", label: "Read", emoji: "📖", grad: "from-violet-400 via-purple-500 to-fuchsia-600" },
      { href: "/write", label: "Write", emoji: "✍️", grad: "from-teal-300 via-emerald-400 to-green-500" },
      { href: "/sexed", label: "Sex ed", emoji: "💞", grad: "from-rose-400 via-pink-500 to-fuchsia-600" }
    ]
  },
  {
    title: "Community",
    tiles: [
      { href: "#browse-rooms", label: "Enter lobby", emoji: "🏠", grad: "from-cyan-300 via-sky-400 to-blue-600" },
      { href: "/stories/new", label: "Add story", emoji: "✨", grad: "from-fuchsia-400 via-purple-500 to-indigo-600" },
      { href: "/shorts/new", label: "Post short", emoji: "📹", grad: "from-orange-300 via-red-400 to-rose-600" },
      { href: "/write/new", label: "New post", emoji: "📝", grad: "from-lime-300 via-green-400 to-emerald-600" }
    ]
  }
];

function TileLink({ tile }: { tile: Tile }) {
  // Steel card base + neon icon chip with layered 3D shadows. items-start +
  // a fixed-height label block keeps every icon on the same line and every
  // label aligned, whether the label is one or two lines.
  const cls =
    "group flex flex-col items-center gap-2.5 rounded-2xl border border-white/15 bg-gradient-to-b from-slate-500/30 via-slate-700/30 to-slate-900/50 px-2 py-4 text-center shadow-[0_6px_16px_rgba(0,0,0,0.5)] ring-1 ring-inset ring-white/10 transition hover:-translate-y-0.5 hover:border-white/30 hover:from-slate-400/40 hover:to-slate-900/60 hover:shadow-[0_10px_24px_rgba(0,0,0,0.6)] active:scale-95";
  const inner = (
    <>
      <span
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tile.grad} text-[26px] shadow-[0_8px_18px_rgba(0,0,0,0.55),inset_0_1px_2px_rgba(255,255,255,0.5)] ring-1 ring-white/30 transition group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:brightness-110`}
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
