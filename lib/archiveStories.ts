// Karochat — free audio/video stories from the Internet Archive (archive.org).
//
// archive.org's advancedsearch API is key-less and CORS-enabled, and hosts a
// huge public-domain / freely-licensed catalog: LibriVox audiobooks, old-time
// radio, classic films, music, poetry and more — in many languages. We query it
// from the browser and play items through archive.org's official embed player,
// so Karochat hosts nothing and nothing can break from a dead file link.

export type ArchiveItem = {
  id: string;
  title: string;
  creator?: string;
  mediatype: string;
  year?: string;
  language?: string;
};

export type ArchiveCategory = { key: string; label: string; emoji: string; query: string };

export const CATEGORIES: ArchiveCategory[] = [
  { key: "audiobooks", label: "Audiobooks", emoji: "📚", query: "collection:(librivoxaudio)" },
  { key: "stories", label: "Stories & tales", emoji: "📖", query: "mediatype:(audio) AND subject:(stories OR folklore OR fairy)" },
  { key: "kids", label: "Children's", emoji: "🧸", query: "collection:(librivoxaudio) AND subject:(children)" },
  { key: "poetry", label: "Poetry", emoji: "🪶", query: "collection:(librivoxaudio) AND subject:(poetry)" },
  { key: "radio", label: "Old-time radio", emoji: "📻", query: "collection:(oldtimeradio)" },
  { key: "films", label: "Free films", emoji: "🎬", query: "mediatype:(movies) AND collection:(feature_films)" },
  { key: "shorts", label: "Short films", emoji: "🎞️", query: "mediatype:(movies) AND collection:(short_films)" },
  { key: "music", label: "Music", emoji: "🎵", query: "mediatype:(audio) AND collection:(opensource_audio)" }
];

export const LANGUAGES = [
  "Any",
  "English",
  "Hindi",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Russian",
  "Chinese",
  "Japanese",
  "Arabic",
  "Tamil",
  "Telugu",
  "Bengali",
  "Urdu"
];

function pick(v: unknown): string | undefined {
  if (Array.isArray(v)) return typeof v[0] === "string" ? v[0] : undefined;
  return typeof v === "string" ? v : v != null ? String(v) : undefined;
}

export async function fetchArchive(
  baseQuery: string,
  language: string,
  search: string,
  rows = 48
): Promise<ArchiveItem[]> {
  let q = baseQuery;
  const term = search.trim();
  if (term) q = `(${baseQuery}) AND (${term})`;
  if (language && language !== "Any") q += ` AND language:(${language})`;
  const params =
    `q=${encodeURIComponent(q)}` +
    "&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=mediatype&fl[]=year&fl[]=language" +
    `&sort[]=${encodeURIComponent("downloads desc")}&rows=${rows}&page=1&output=json`;
  const res = await fetch(`https://archive.org/advancedsearch.php?${params}`, {
    cache: "no-store"
  });
  if (!res.ok) return [];
  const data = (await res.json()) as any;
  const docs: any[] = data?.response?.docs ?? [];
  return docs
    .filter((d) => d && d.identifier)
    .map((d) => ({
      id: String(d.identifier),
      title: pick(d.title) ?? String(d.identifier),
      creator: pick(d.creator),
      mediatype: pick(d.mediatype) ?? "audio",
      year: pick(d.year),
      language: pick(d.language)
    }));
}

export function embedUrl(id: string): string {
  return `https://archive.org/embed/${encodeURIComponent(id)}`;
}
export function detailsUrl(id: string): string {
  return `https://archive.org/details/${encodeURIComponent(id)}`;
}
