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
      { href: "/meet/now", label: "Meet now", emoji: "⚡", grad: "from-amber-400 to-orange-500" },
      { href: "/handshake", label: "Handshake", emoji: "🤝", grad: "from-emerald-400 to-teal-500" },
      { href: "/shorts", label: "Shorts", emoji: "🎬", grad: "from-pink-500 to-rose-500" },
      { href: "/rooms?create=1", label: "New room", emoji: "➕", grad: "from-sky-400 to-blue-600" }
    ]
  },
  {
    title: "Library & writing",
    tiles: [
      { href: "/books", label: "Books", emoji: "📚", grad: "from-blue-400 to-indigo-600" },
      { href: "/read", label: "Read", emoji: "📖", grad: "from-violet-400 to-purple-600" },
      { href: "/write", label: "Write", emoji: "✍️", grad: "from-teal-400 to-emerald-600" },
      { href: "/sexed", label: "Sex ed", emoji: "💞", grad: "from-rose-400 to-pink-600" }
    ]
  },
  {
    title: "Community",
    tiles: [
      { href: "#browse-rooms", label: "Enter lobby", emoji: "🏠", grad: "from-cyan-400 to-sky-600" },
      { href: "/stories/new", label: "Add story", emoji: "✨", grad: "from-fuchsia-400 to-purple-600" },
      { href: "/shorts/new", label: "Post short", emoji: "📹", grad: "from-orange-400 to-red-500" },
      { href: "/write/new", label: "New post", emoji: "📝", grad: "from-lime-400 to-green-600" }
    ]
  }
];

function TileLink({ tile }: { tile: Tile }) {
  // items-start + a fixed-height label block keeps every icon on the same
  // line and every label aligned, whether the label is one or two lines.
  const cls =
    "group flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-2 py-4 text-center shadow-sm shadow-black/20 transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.09] active:scale-95";
  const inner = (
    <>
      <span
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tile.grad} text-[26px] shadow-lg shadow-black/40 ring-1 ring-white/15 transition group-hover:scale-110`}
      >
        {tile.emoji}
      </span>
      <span className="flex min-h-[2.4em] items-start justify-center text-xs font-semibold leading-tight text-white">
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
