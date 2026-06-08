// Karochat — welcome hero (Wave 22).
//
// A warm, inclusive banner at the top of the lobby — a bright grid of joyful
// people of every ethnicity and culture, echoing the People's Charter
// ("Karochat is for people. All of them."). Pure presentational server
// component: no client JS, nothing to break.

export function WelcomeHero() {
  return (
    <section className="surface-glass relative overflow-hidden p-0">
      {/* Full-width banner — natural aspect so no faces get cropped. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/welcome-people.webp"
        alt="A grid of joyful people of many ethnicities, ages and cultures"
        className="block w-full"
        loading="eager"
      />
      <div className="p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
          Karochat is for people — all of them
        </p>
        <h2 className="mt-0.5 font-display text-2xl font-semibold leading-tight text-white sm:text-3xl">
          Everyone&apos;s welcome here.
        </h2>
        <p className="mt-2 max-w-none text-[13px] leading-relaxed text-white/80 sm:text-sm">
          <span className="font-semibold text-white">KaroChat is for everyone</span> — a place
          where kindness, respect, friendship, and understanding come first, where people are
          encouraged to be nice to one another, to choose love over hate, to share and care, to
          help and support each other, to smile more and frown less, to celebrate what unites us
          rather than focus on what divides us, to stand together against cruelty, negativity,
          injustice, and those forces that seek to create fear and conflict, to build bridges
          instead of walls, to make love and not war — because life is short, precious, and
          unpredictable, because the past cannot be changed and the future is uncertain, and
          because all we truly have is this present moment, this gift of now: a moment to live
          fully, appreciate deeply, laugh freely, forgive generously, connect meaningfully,
          create beautiful memories, and make the world a little better through our words, our
          actions, and our humanity — one conversation at a time.
        </p>
      </div>
    </section>
  );
}
