// Karochat — free Sports TV & radio sources for the Sports hub.
//
// Reuses the same key-less community directories as the TV & Radio feature:
//   • TV    — iptv-org public playlists. "Worldwide" pulls the curated sports
//             category playlist; a country pulls that country's playlist and
//             keeps the sports channels. HLS (.m3u8), played via hls.js.
//   • Radio — radio-browser.info, filtered to the "sports" tag per country.
// Third-party community streams — availability varies; handled gracefully.

import { COUNTRIES as BASE_COUNTRIES, type Country } from "@/lib/liveChannels";

export type { Country };

// "Worldwide" first (the sports category playlist), then the standard countries.
export const SPORTS_COUNTRIES: Country[] = [
  { code: "global", name: "Worldwide", flag: "🌍" },
  ...BASE_COUNTRIES
];

export type SportsTv = { name: string; url: string; logo: string; group: string };
export type SportsRadio = {
  name: string;
  url: string;
  favicon: string;
  bitrate: number;
  tags: string;
};

// Heuristic: keep channels whose group-title or name looks sports-related.
const SPORT_RE =
  /sport|football|soccer|cricket|basketball|tennis|rugby|nba|nfl|nhl|mlb|espn|bein|sky\s?sports|dazn|eurosport|f1|formula|moto\s?gp|hockey|golf|baseball|wwe|ufc|box|olympic|athl|racing|fight|league|premier|laliga|bundesliga|serie\s?a/i;

function parseM3u(text: string): SportsTv[] {
  const lines = text.split(/\r?\n/);
  const out: SportsTv[] = [];
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

export async function fetchSportsTv(code: string): Promise<SportsTv[]> {
  const url =
    code === "global"
      ? "https://iptv-org.github.io/iptv/categories/sports.m3u"
      : `https://iptv-org.github.io/iptv/countries/${code}.m3u`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const all = parseM3u(await res.text());
  if (code === "global") return all;
  return all.filter((c) => SPORT_RE.test(c.group) || SPORT_RE.test(c.name));
}

export async function fetchSportsRadio(code: string): Promise<SportsRadio[]> {
  // Worldwide → top sports stations regardless of country; else by country.
  const base = "https://de1.api.radio-browser.info/json/stations";
  const url =
    code === "global"
      ? `${base}/bytag/sports?hidebroken=true&order=clickcount&reverse=true&limit=150`
      : `${base}/search?tag=sports&countrycode=${code.toUpperCase()}&hidebroken=true&order=clickcount&reverse=true&limit=150`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as any[];
  return (data ?? [])
    .map((s) => ({
      name: (s.name ?? "Station").trim() || "Station",
      url: (s.url_resolved || s.url || "") as string,
      favicon: (s.favicon || "") as string,
      bitrate: (s.bitrate || 0) as number,
      tags: (s.tags || "") as string
    }))
    .filter((s) => !!s.url);
}
