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
          built on kindness, respect, and friendship, where we choose love over hate, share and
          care, and stand together against cruelty and fear. Build bridges, not walls. Because
          life is short and the future uncertain, all we truly have is now — so live fully,
          forgive freely, connect deeply, and make the world a little better, one conversation
          at a time.
        </p>
      </div>
    </section>
  );
}
