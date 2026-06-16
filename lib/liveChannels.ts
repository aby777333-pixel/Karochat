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

export const RADIO_THEMES: RadioTheme[] = [
  {
    code: "theme:pinkfloyd",
    name: "Pink Floyd",
    flag: "🎸",
    terms: ["pink floyd"],
    tags: ["pink floyd", "progressive rock"],
    fallback: [
      T("Exclusively Pink Floyd", "https://streaming.exclusive.radio/er/pinkfloyd/icecast.audio", "pink floyd, rock"),
      T("Labgate · Pink Floyd · Yes · Genesis", "https://s2.ssl-stream.com/radio/8160/radio.mp3", "progressive rock")
    ]
  },
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
      T("Kuschelrock (laut.fm)", "https://stream.laut.fm/kuschelrock", "kuschelrock, soft rock"),
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
      T("Kuschelrock (laut.fm)", "https://stream.laut.fm/kuschelrock", "soft rock, lovesongs"),
      T("RPR1. · Kuschelrock", "https://stream.rpr1.de/kuschelrock/mp3-128/radiobrowser", "soft rock, lovesongs")
    ]
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
