// Karochat — welcome hero (Wave 22).
//
// A warm, inclusive banner at the top of the lobby — a candid photo of people
// of every ethnicity, age and culture, echoing the People's Charter
// ("Karochat is for people. All of them."). Pure presentational server
// component: no client JS, nothing to break.

export function WelcomeHero() {
  return (
    <section className="surface-glass relative overflow-hidden p-0">
      <div className="relative h-40 w-full sm:h-52">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/welcome-people.webp"
          alt="A diverse group of people of many ethnicities, ages and cultures laughing together outdoors"
          className="h-full w-full object-cover object-center"
          loading="eager"
        />
        {/* legibility scrim */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/55 to-ink-900/5"
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/75">
            Karochat is for people — all of them
          </p>
          <h2 className="mt-0.5 font-display text-2xl font-semibold leading-tight text-white drop-shadow sm:text-3xl">
            Everyone&apos;s welcome here.
          </h2>
          <p className="mt-1 hidden max-w-md text-sm text-white/85 drop-shadow sm:block">
            Every colour, every culture, every kind of human. Meet your mate,
            make friends, share and care. Be kind. Be real.
          </p>
        </div>
      </div>
    </section>
  );
}
