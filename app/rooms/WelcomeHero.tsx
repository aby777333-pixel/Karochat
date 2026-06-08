// Karochat — welcome hero (Wave 22).
//
// A warm, inclusive banner at the top of the lobby that puts people of every
// ethnicity, age and culture front-and-centre — echoing the People's Charter
// ("Karochat is for people. All of them."). Pure presentational server
// component: no client JS, nothing to break.

// A deliberately diverse cast: varied skin tones, ages, genders and cultural
// markers (hijab, turban, elder, child) so the banner reads as "everyone".
const FACES = [
  "👩🏿‍🦱",
  "🧑🏽",
  "👳🏾‍♂️",
  "👵🏼",
  "🧕🏽",
  "👨🏻‍🦰",
  "🧑🏿‍🦲",
  "👩🏾‍🦰",
  "👨🏽",
  "🧒🏻"
];

export function WelcomeHero() {
  return (
    <section className="surface-glass relative overflow-hidden p-0">
      {/* warm, inclusive gradient wash */}
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "linear-gradient(120deg, rgba(163,113,255,0.30), rgba(255,45,85,0.22) 45%, rgba(255,176,32,0.22) 75%, rgba(25,229,193,0.22))"
        }}
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
            Karochat is for people — all of them
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold leading-tight text-white sm:text-3xl">
            Everyone&apos;s welcome here.
          </h2>
          <p className="mt-1 max-w-md text-sm text-white/75">
            Every colour, every culture, every kind of human. Meet your mate,
            make friends, share and care. Be kind. Be real.
          </p>
        </div>

        {/* Overlapping circle of diverse faces — "a picture of people of all
            ethnicities" rendered with full-colour emoji so it works on every
            device with zero external assets. */}
        <div className="flex shrink-0 -space-x-3 self-start sm:self-center">
          {FACES.map((face, i) => (
            <span
              key={i}
              className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-2xl shadow-md shadow-black/30 ring-2 ring-ink-900 backdrop-blur-sm sm:h-12 sm:w-12"
              style={{ zIndex: FACES.length - i }}
              aria-hidden
            >
              {face}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
