// Karochat — directory of free (ad-supported) streaming services worldwide.
//
// These are legitimate, legal FAST (Free Ad-Supported TV) and free VOD services
// — Pluto TV, Tubi, Plex, Xumo, Freevee, Samsung TV Plus, etc. They run in their
// own apps/sites, so we link out ("Open ↗") rather than embed. Organised by
// category, with a note on where each is available. Static, no JS, can't break.

type App = { name: string; url: string; blurb: string; where: string };
type Group = { title: string; emoji: string; apps: App[] };

const GROUPS: Group[] = [
  {
    title: "Free live TV (FAST)",
    emoji: "📡",
    apps: [
      { name: "Pluto TV", url: "https://pluto.tv", blurb: "Hundreds of free live channels — movies, crime, action, reality, news.", where: "US, UK, Europe, LatAm & more" },
      { name: "Samsung TV Plus", url: "https://www.samsung.com/us/tvs/tv-plus/", blurb: "Free live channels (works in-browser & on Samsung devices).", where: "Many regions" },
      { name: "Xumo Play", url: "https://play.xumo.com", blurb: "Free live TV + on-demand movies & documentaries.", where: "US (web)" },
      { name: "The Roku Channel", url: "https://therokuchannel.roku.com", blurb: "Free live channels + movies & shows.", where: "US, UK, CA, Mexico" },
      { name: "Plex Live TV", url: "https://watch.plex.tv/live-tv", blurb: "Free live channels + a big on-demand library.", where: "Worldwide" },
      { name: "LG Channels", url: "https://www.lg.com/us/lg-channels", blurb: "Free live TV on LG smart TVs.", where: "Many regions (LG TVs)" }
    ]
  },
  {
    title: "Free movies & series (VOD)",
    emoji: "🎬",
    apps: [
      { name: "Tubi", url: "https://tubitv.com", blurb: "Huge free library of movies & TV — incl. mature-rated titles.", where: "US, CA, UK, AU, MX & more" },
      { name: "Amazon Freevee", url: "https://www.amazon.com/freevee", blurb: "Free ad-supported movies & shows.", where: "US, UK, DE (varies)" },
      { name: "Crackle", url: "https://www.crackle.com", blurb: "Free movies & originals.", where: "US, AU & more" },
      { name: "Plex", url: "https://watch.plex.tv", blurb: "Free on-demand movies & shows.", where: "Worldwide" },
      { name: "Popcornflix", url: "https://www.popcornflix.com", blurb: "Free movies & series, no sign-up.", where: "US & more" },
      { name: "Vudu / Fandango at Home (free)", url: "https://www.vudu.com/content/movies/uxpage/Free", blurb: "Free ad-supported movies section.", where: "US" }
    ]
  },
  {
    title: "Free news & documentaries",
    emoji: "🗞️",
    apps: [
      { name: "Pluto TV News", url: "https://pluto.tv", blurb: "Free 24/7 news channels.", where: "Many regions" },
      { name: "Plex Live (News)", url: "https://watch.plex.tv/live-tv", blurb: "Free news channels in the live guide.", where: "Worldwide" },
      { name: "Internet Archive", url: "https://archive.org/details/movies", blurb: "Public-domain films & documentaries (also in Audiobooks tab).", where: "Worldwide" }
    ]
  },
  {
    title: "Library-card free (movies & more)",
    emoji: "📚",
    apps: [
      { name: "Kanopy", url: "https://www.kanopy.com", blurb: "Free films & documentaries with a library/university card.", where: "US, UK, CA, AU, NZ" },
      { name: "Hoopla", url: "https://www.hoopladigital.com", blurb: "Free movies, audiobooks & comics with a library card.", where: "US, CA, AU, UK, NZ" }
    ]
  },
  {
    title: "India & South Asia (free tiers)",
    emoji: "🇮🇳",
    apps: [
      { name: "MX Player", url: "https://www.mxplayer.in", blurb: "Free movies, shows & music across many languages.", where: "India" },
      { name: "JioCinema (free)", url: "https://www.jiocinema.com", blurb: "Large free catalogue incl. sport & shows.", where: "India" },
      { name: "Airtel Xstream Play", url: "https://www.airtelxstream.in", blurb: "Free + bundled content, many languages.", where: "India" },
      { name: "Hotstar (free tier)", url: "https://www.hotstar.com", blurb: "Some free content; rest with subscription.", where: "India & SEA" },
      { name: "YuppTV", url: "https://www.yupptv.com", blurb: "Free + paid Indian/regional live TV.", where: "India & diaspora" }
    ]
  }
];

export function FreeStreamingApps() {
  return (
    <section className="surface-glass mt-5 p-4 md:p-5">
      <h2 className="font-display text-lg font-semibold">📺 Free streaming apps &amp; live TV</h2>
      <p className="mt-1 text-sm text-white/55">
        Popular free, ad-supported streaming services from around the world — live
        TV, movies, series, news &amp; documentaries. They open in the service&apos;s
        own app or site. Availability varies by country.
      </p>

      <div className="mt-4 space-y-5">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/45">
              {g.emoji} {g.title}
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {g.apps.map((a) => (
                <li key={a.name}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block h-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 transition hover:border-neon-blue/40 hover:bg-white/5"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-white">{a.name}</span>
                      <span className="shrink-0 text-[11px] text-neon-blue">Open ↗</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-white/55">{a.blurb}</span>
                    <span className="mt-1 block text-[10px] text-white/35">📍 {a.where}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[10px] leading-relaxed text-white/35">
        These are independent third-party services with their own apps, accounts and
        terms. Karochat isn&apos;t affiliated with them and doesn&apos;t host their
        content — availability and catalogues vary by country and change over time.
      </p>
    </section>
  );
}
