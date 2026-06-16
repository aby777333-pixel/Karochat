// Karochat — free TV & radio channel sources for the Live TV & Radio player.
//
// Radio: radio-browser.info — a free, key-less, community directory of public
//   internet radio streams (CORS-enabled). Stations play in an <audio> element.
// TV: iptv-org — public per-country M3U playlists of free-to-air / publicly
//   available streams (github.io, CORS *). Streams are HLS (.m3u8) played via
//   hls.js. These are third-party community streams: some may be offline or
//   geo-restricted, which the player handles gracefully.

import { rbFetch } from "@/lib/radioBrowser";

export type Country = { code: string; name: string; flag: string };

// ISO-3166 alpha-2 (lowercase for iptv-org M3U filenames, upper-cased for
// radio-browser's countrycode filter).
export const COUNTRIES: Country[] = [
  { code: "us", name: "United States", flag: "🇺🇸" },
  { code: "gb", name: "United Kingdom", flag: "🇬🇧" },
  { code: "in", name: "India", flag: "🇮🇳" },
  { code: "ca", name: "Canada", flag: "🇨🇦" },
  { code: "au", name: "Australia", flag: "🇦🇺" },
  { code: "ie", name: "Ireland", flag: "🇮🇪" },
  { code: "de", name: "Germany", flag: "🇩🇪" },
  { code: "fr", name: "France", flag: "🇫🇷" },
  { code: "es", name: "Spain", flag: "🇪🇸" },
  { code: "it", name: "Italy", flag: "🇮🇹" },
  { code: "pt", name: "Portugal", flag: "🇵🇹" },
  { code: "nl", name: "Netherlands", flag: "🇳🇱" },
  { code: "se", name: "Sweden", flag: "🇸🇪" },
  { code: "no", name: "Norway", flag: "🇳🇴" },
  { code: "pl", name: "Poland", flag: "🇵🇱" },
  { code: "ru", name: "Russia", flag: "🇷🇺" },
  { code: "tr", name: "Turkey", flag: "🇹🇷" },
  { code: "gr", name: "Greece", flag: "🇬🇷" },
  { code: "br", name: "Brazil", flag: "🇧🇷" },
  { code: "mx", name: "Mexico", flag: "🇲🇽" },
  { code: "ar", name: "Argentina", flag: "🇦🇷" },
  { code: "co", name: "Colombia", flag: "🇨🇴" },
  { code: "cl", name: "Chile", flag: "🇨🇱" },
  { code: "jp", name: "Japan", flag: "🇯🇵" },
  { code: "kr", name: "South Korea", flag: "🇰🇷" },
  { code: "cn", name: "China", flag: "🇨🇳" },
  { code: "id", name: "Indonesia", flag: "🇮🇩" },
  { code: "my", name: "Malaysia", flag: "🇲🇾" },
  { code: "sg", name: "Singapore", flag: "🇸🇬" },
  { code: "ph", name: "Philippines", flag: "🇵🇭" },
  { code: "th", name: "Thailand", flag: "🇹🇭" },
  { code: "vn", name: "Vietnam", flag: "🇻🇳" },
  { code: "pk", name: "Pakistan", flag: "🇵🇰" },
  { code: "bd", name: "Bangladesh", flag: "🇧🇩" },
  { code: "lk", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "np", name: "Nepal", flag: "🇳🇵" },
  { code: "sa", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "ae", name: "UAE", flag: "🇦🇪" },
  { code: "qa", name: "Qatar", flag: "🇶🇦" },
  { code: "eg", name: "Egypt", flag: "🇪🇬" },
  { code: "ma", name: "Morocco", flag: "🇲🇦" },
  { code: "ng", name: "Nigeria", flag: "🇳🇬" },
  { code: "gh", name: "Ghana", flag: "🇬🇭" },
  { code: "ke", name: "Kenya", flag: "🇰🇪" },
  { code: "za", name: "South Africa", flag: "🇿🇦" }
];

export type TvChannel = { name: string; url: string; logo: string; group: string };
export type RadioStation = {
  name: string;
  url: string;
  favicon: string;
  bitrate: number;
  tags: string;
};

function parseM3u(text: string): TvChannel[] {
  const lines = text.split(/\r?\n/);
  const out: TvChannel[] = [];
  let pending: { name: string; logo: string; group: string } | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("#EXTINF")) {
      const comma = line.lastIndexOf(",");
      const name = comma >= 0 ? line.slice(comma + 1).trim() : "Channel";
      const logo = (line.match(/tvg-logo="([^"]*)"/) || [])[1] ?? "";
      const group = (line.match(/group-title="([^"]*)"/) || [])[1] ?? "";
      pending = { name: name || "Channel", logo, group };
    } else if (line && !line.startsWith("#")) {
      if (pending) {
        out.push({ name: pending.name, url: line, logo: pending.logo, group: pending.group });
        pending = null;
      }
    }
  }
  return out;
}

export async function fetchTv(code: string): Promise<TvChannel[]> {
  const res = await fetch(`https://iptv-org.github.io/iptv/countries/${code}.m3u`, {
    cache: "no-store"
  });
  if (!res.ok) return [];
  const text = await res.text();
  return parseM3u(text);
}

// Always-available stations to fall back to when the radio-browser directory is
// briefly down — well-known, stable, free streams (SomaFM + Radio Paradise) so
// the radio is never empty.
const FALLBACK_RADIO: RadioStation[] = [
  { name: "SomaFM · Groove Salad (chill)", url: "https://ice1.somafm.com/groovesalad-128-mp3", favicon: "", bitrate: 128, tags: "chillout, ambient" },
  { name: "SomaFM · Drone Zone (ambient)", url: "https://ice1.somafm.com/dronezone-128-mp3", favicon: "", bitrate: 128, tags: "ambient" },
  { name: "SomaFM · Lush (vocal)", url: "https://ice1.somafm.com/lush-128-mp3", favicon: "", bitrate: 128, tags: "vocal" },
  { name: "SomaFM · Indie Pop Rocks", url: "https://ice1.somafm.com/indiepop-128-mp3", favicon: "", bitrate: 128, tags: "indie pop" },
  { name: "SomaFM · Secret Agent (lounge)", url: "https://ice1.somafm.com/secretagent-128-mp3", favicon: "", bitrate: 128, tags: "lounge" },
  { name: "SomaFM · Beat Blender", url: "https://ice1.somafm.com/beatblender-128-mp3", favicon: "", bitrate: 128, tags: "downtempo" },
  { name: "SomaFM · Deep Space One", url: "https://ice1.somafm.com/deepspaceone-128-mp3", favicon: "", bitrate: 128, tags: "ambient, space" },
  { name: "SomaFM · Fluid (chillhop)", url: "https://ice1.somafm.com/fluid-128-mp3", favicon: "", bitrate: 128, tags: "chillhop" },
  { name: "SomaFM · Sonic Universe (jazz)", url: "https://ice1.somafm.com/sonicuniverse-128-mp3", favicon: "", bitrate: 128, tags: "jazz" },
  { name: "Radio Paradise · Main Mix", url: "https://stream.radioparadise.com/aac-320", favicon: "", bitrate: 320, tags: "eclectic" },
  { name: "Radio Paradise · Mellow Mix", url: "https://stream.radioparadise.com/mellow-320", favicon: "", bitrate: 320, tags: "mellow" },
  { name: "Radio Paradise · Rock Mix", url: "https://stream.radioparadise.com/rock-320", favicon: "", bitrate: 320, tags: "rock" }
];

export async function fetchRadio(code: string): Promise<RadioStation[]> {
  const data = await rbFetch(
    `/json/stations/search?countrycode=${code.toUpperCase()}&hidebroken=true&order=clickcount&reverse=true&limit=150`
  );
  const stations = (data ?? [])
    .map((s) => ({
      name: (s.name ?? "Station").trim() || "Station",
      url: (s.url_resolved || s.url || "") as string,
      favicon: (s.favicon || "") as string,
      bitrate: (s.bitrate || 0) as number,
      tags: (s.tags || "") as string
    }))
    .filter((s) => !!s.url);
  // Directory down / nothing returned → known-good stations so radio still works.
  return stations.length ? stations : FALLBACK_RADIO;
}

// ── Artists & themes radio ───────────────────────────────────────────────────
// Beyond the per-country browse, a curated set of artist / theme stations
// (Pink Floyd, Enigma, Kuschelrock, …) searched by name + tag on radio-browser.
// Each carries a verified always-on https fallback shown first, so the named
// artist always has a working stream even when the directory is briefly down.
export type RadioTheme = {
  code: string; // synthetic key, prefixed "theme:" so it never collides with a country code
  name: string;
  flag: string; // an emoji shown in the picker
  terms: string[]; // radio-browser name searches
  tags?: string[]; // radio-browser tag searches
  fallback: RadioStation[];
};

const T = (name: string, url: string, tags: string, bitrate = 128): RadioStation => ({
  name,
  url,
  favicon: "",
  bitrate,
  tags
});

// Helper for the common one-artist station on exclusive.radio (verified always-on,
// https + CORS-friendly). Slugs are lowercase, no spaces.
const ER = (name: string, slug: string, tags: string): RadioStation =>
  T(name, `https://streaming.exclusive.radio/er/${slug}/icecast.audio`, tags);
// Helper for laut.fm genre stations (verified always-on, https).
const LF = (name: string, slug: string, tags: string): RadioStation =>
  T(name, `https://stream.laut.fm/${slug}`, tags);

export const RADIO_THEMES: RadioTheme[] = [
  // ── Artists & bands ────────────────────────────────────────────────────────
  {
    code: "theme:pinkfloyd",
    name: "Pink Floyd",
    flag: "🎸",
    terms: ["pink floyd"],
    tags: ["pink floyd", "progressive rock"],
    fallback: [
      ER("Exclusively Pink Floyd", "pinkfloyd", "pink floyd, rock"),
      T("Labgate · Pink Floyd · Yes · Genesis", "https://s2.ssl-stream.com/radio/8160/radio.mp3", "progressive rock")
    ]
  },
  {
    code: "theme:abba",
    name: "ABBA",
    flag: "💃",
    terms: ["abba"],
    tags: ["abba", "pop", "70s", "disco"],
    fallback: [ER("Exclusively ABBA", "abba", "abba, pop"), LF("Disco (laut.fm)", "disco", "disco")]
  },
  {
    code: "theme:beegees",
    name: "Bee Gees",
    flag: "🕺",
    terms: ["bee gees", "beegees"],
    tags: ["bee gees", "disco", "70s", "pop"],
    fallback: [ER("Exclusively Bee Gees", "beegees", "bee gees, disco"), LF("Disco (laut.fm)", "disco", "disco")]
  },
  {
    code: "theme:boneym",
    name: "Boney M.",
    flag: "✨",
    terms: ["boney m", "boney m."],
    tags: ["boney m", "disco", "eurodisco", "70s"],
    fallback: [LF("Disco (laut.fm)", "disco", "disco, eurodisco"), LF("80s Hits (laut.fm)", "80er", "80s, disco")]
  },
  {
    code: "theme:queen",
    name: "Queen",
    flag: "👑",
    terms: ["queen"],
    tags: ["queen", "rock", "classic rock"],
    fallback: [ER("Exclusively Queen", "queen", "queen, rock")]
  },
  {
    code: "theme:beatles",
    name: "The Beatles",
    flag: "🪲",
    terms: ["beatles", "the beatles"],
    tags: ["beatles", "60s", "classic rock"],
    fallback: [ER("Exclusively The Beatles", "beatles", "beatles, rock")]
  },
  {
    code: "theme:elvis",
    name: "Elvis Presley",
    flag: "🎤",
    terms: ["elvis", "elvis presley"],
    tags: ["elvis", "rock and roll", "50s", "oldies"],
    fallback: [ER("Exclusively Elvis", "elvispresley", "elvis, rock and roll")]
  },
  {
    code: "theme:michaeljackson",
    name: "Michael Jackson",
    flag: "🕴️",
    terms: ["michael jackson"],
    tags: ["michael jackson", "pop", "soul", "80s"],
    fallback: [ER("Exclusively Michael Jackson", "michaeljackson", "michael jackson, pop")]
  },
  {
    code: "theme:madonna",
    name: "Madonna",
    flag: "💫",
    terms: ["madonna"],
    tags: ["madonna", "pop", "80s", "dance"],
    fallback: [ER("Exclusively Madonna", "madonna", "madonna, pop")]
  },
  {
    code: "theme:eltonjohn",
    name: "Elton John",
    flag: "🎹",
    terms: ["elton john"],
    tags: ["elton john", "pop", "classic rock"],
    fallback: [ER("Exclusively Elton John", "eltonjohn", "elton john, pop")]
  },
  {
    code: "theme:rollingstones",
    name: "The Rolling Stones",
    flag: "👅",
    terms: ["rolling stones"],
    tags: ["rolling stones", "classic rock", "rock"],
    fallback: [ER("Exclusively Rolling Stones", "rollingstones", "rolling stones, rock")]
  },
  {
    code: "theme:ledzeppelin",
    name: "Led Zeppelin",
    flag: "🎶",
    terms: ["led zeppelin"],
    tags: ["led zeppelin", "classic rock", "hard rock"],
    fallback: [ER("Exclusively Led Zeppelin", "ledzeppelin", "led zeppelin, rock")]
  },
  {
    code: "theme:u2",
    name: "U2",
    flag: "🎸",
    terms: ["u2"],
    tags: ["u2", "rock", "80s"],
    fallback: [ER("Exclusively U2", "u2", "u2, rock")]
  },
  {
    code: "theme:eagles",
    name: "Eagles",
    flag: "🦅",
    terms: ["eagles"],
    tags: ["eagles", "classic rock", "soft rock"],
    fallback: [ER("Exclusively Eagles", "eagles", "eagles, rock")]
  },
  // ── Genres & moods ─────────────────────────────────────────────────────────
  {
    code: "theme:enigma",
    name: "Enigma & chillout",
    flag: "🌙",
    terms: ["enigma", "enigmatic"],
    tags: ["enigma", "new age", "chillout"],
    fallback: [
      T("Enigmatic · Magnetic Chillout", "https://radio.enigmatic.su:8005/radio", "enigma, chillout", 256),
      T("Enigmatic Station", "https://listen2.myradio24.com/8226", "enigma, chillout", 256)
    ]
  },
  {
    code: "theme:kuschelrock",
    name: "Kuschelrock (soft rock)",
    flag: "💞",
    terms: ["kuschelrock"],
    tags: ["kuschelrock", "soft rock", "lovesongs"],
    fallback: [
      T("Radio Regenbogen · Kuschelrock", "https://stream.regenbogen.de/kuschelrock/mp3-128/radiobrowser", "kuschelrock, soft rock"),
      LF("Kuschelrock (laut.fm)", "kuschelrock", "kuschelrock, soft rock"),
      T("RPR1. · Kuschelrock", "https://stream.rpr1.de/kuschelrock/mp3-128/radiobrowser", "kuschelrock, soft rock")
    ]
  },
  {
    code: "theme:classicrock",
    name: "Classic rock",
    flag: "🤘",
    terms: ["classic rock"],
    tags: ["classic rock", "rock", "70s", "80s"],
    fallback: [
      T("0N · Classic Rock", "https://0n-classicrock.radionetz.de/0n-classicrock.mp3", "classic rock"),
      T("RdMix · Classic Rock 70s 80s 90s", "https://cast1.torontocast.com:4610/stream", "classic rock")
    ]
  },
  {
    code: "theme:softrock",
    name: "Soft rock & love songs",
    flag: "❤️",
    terms: ["soft rock", "love songs"],
    tags: ["soft rock", "lovesongs", "ballads"],
    fallback: [
      LF("Kuschelrock (laut.fm)", "kuschelrock", "soft rock, lovesongs"),
      T("RPR1. · Kuschelrock", "https://stream.rpr1.de/kuschelrock/mp3-128/radiobrowser", "soft rock, lovesongs")
    ]
  },
  {
    code: "theme:disco",
    name: "Disco & funk",
    flag: "🪩",
    terms: ["disco", "funk"],
    tags: ["disco", "funk", "70s", "soul"],
    fallback: [LF("Disco (laut.fm)", "disco", "disco, funk")]
  },
  {
    code: "theme:eurodance",
    name: "Eurodance",
    flag: "🎉",
    terms: ["eurodance"],
    tags: ["eurodance", "90s", "dance"],
    fallback: [LF("Eurodance (laut.fm)", "eurodance", "eurodance, 90s")]
  },
  {
    code: "theme:trance",
    name: "Trance",
    flag: "🌀",
    terms: ["trance"],
    tags: ["trance", "psytrance", "progressive trance"],
    fallback: [LF("Trance (laut.fm)", "trance", "trance"), T("SomaFM · Beat Blender", "https://ice1.somafm.com/beatblender-128-mp3", "downtempo")]
  },
  {
    code: "theme:techno",
    name: "Techno",
    flag: "🔊",
    terms: ["techno"],
    tags: ["techno", "tech house", "minimal"],
    fallback: [LF("Techno (laut.fm)", "techno", "techno"), T("0N · Techno", "https://0n-techno.radionetz.de/0n-techno.mp3", "techno")]
  },
  {
    code: "theme:house",
    name: "House & deep house",
    flag: "🏠",
    terms: ["house", "deep house"],
    tags: ["house", "deep house", "electronic"],
    fallback: [LF("House (laut.fm)", "house", "house, deep house")]
  },
  {
    code: "theme:80s",
    name: "80s hits",
    flag: "📼",
    terms: ["80s", "80er"],
    tags: ["80s", "pop", "new wave"],
    fallback: [LF("80s Hits (laut.fm)", "80er", "80s, pop")]
  },
  {
    code: "theme:90s",
    name: "90s hits",
    flag: "💿",
    terms: ["90s", "90er"],
    tags: ["90s", "pop", "dance"],
    fallback: [LF("90s Hits (laut.fm)", "90er", "90s, pop")]
  },
  {
    code: "theme:oldies",
    name: "Oldies (50s–60s)",
    flag: "🎙️",
    terms: ["oldies"],
    tags: ["oldies", "50s", "60s", "rock and roll"],
    fallback: [LF("Oldies (laut.fm)", "oldies", "oldies")]
  },
  {
    code: "theme:reggae",
    name: "Reggae",
    flag: "🌴",
    terms: ["reggae"],
    tags: ["reggae", "ska", "dancehall"],
    fallback: [LF("Reggae (laut.fm)", "reggae", "reggae")]
  },
  {
    code: "theme:jazz",
    name: "Jazz",
    flag: "🎷",
    terms: ["jazz"],
    tags: ["jazz", "smooth jazz", "swing"],
    fallback: [LF("Jazz (laut.fm)", "jazz", "jazz"), T("SomaFM · Sonic Universe", "https://ice1.somafm.com/sonicuniverse-128-mp3", "jazz")]
  },
  {
    code: "theme:blues",
    name: "Blues",
    flag: "🎺",
    terms: ["blues"],
    tags: ["blues", "rhythm and blues", "soul"],
    fallback: [LF("Blues (laut.fm)", "blues", "blues")]
  },
  {
    code: "theme:country",
    name: "Country",
    flag: "🤠",
    terms: ["country"],
    tags: ["country", "americana", "folk"],
    fallback: [LF("Country (laut.fm)", "country", "country")]
  },
  {
    code: "theme:lounge",
    name: "Lounge & chillout",
    flag: "🍸",
    terms: ["lounge", "chillout"],
    tags: ["lounge", "chillout", "downtempo"],
    fallback: [LF("Lounge (laut.fm)", "lounge", "lounge"), T("SomaFM · Secret Agent", "https://ice1.somafm.com/secretagent-128-mp3", "lounge")]
  }
];

export function isRadioTheme(code: string): boolean {
  return code.startsWith("theme:");
}

export async function fetchRadioTheme(code: string): Promise<RadioStation[]> {
  const theme = RADIO_THEMES.find((t) => t.code === code);
  if (!theme) return FALLBACK_RADIO;
  const paths = [
    ...theme.terms.map((t) => `/json/stations/search?name=${encodeURIComponent(t)}&hidebroken=true&order=clickcount&reverse=true&limit=60`),
    ...(theme.tags ?? []).map((t) => `/json/stations/search?tag=${encodeURIComponent(t)}&hidebroken=true&order=clickcount&reverse=true&limit=60`)
  ];
  const lists = await Promise.all(paths.map((p) => rbFetch(p)));
  const seen = new Set<string>();
  // Verified https fallback first (always playable), then directory finds.
  const out: RadioStation[] = [];
  for (const s of theme.fallback) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    out.push(s);
  }
  for (const arr of lists) {
    for (const s of arr ?? []) {
      const url = (s.url_resolved || s.url || "") as string;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push({
        name: (s.name ?? "Station").trim() || "Station",
        url,
        favicon: (s.favicon || "") as string,
        bitrate: (s.bitrate || 0) as number,
        tags: (s.tags || "") as string
      });
    }
  }
  return out.slice(0, 80);
}
