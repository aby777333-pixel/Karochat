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
