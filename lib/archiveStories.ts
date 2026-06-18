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

// `query` is the default catalog (used for "Any" and English — the curated
// English collections like LibriVox/old-time radio are English by nature).
// `i18nQuery` is the broader query used when a SPECIFIC non-English language is
// picked: those English-only collections hold essentially no other-language
// titles, so we fall back to the wider public audio/film space and let the
// language filter do the work. Without this, picking e.g. Tamil returns nothing.
export type ArchiveCategory = {
  key: string;
  label: string;
  emoji: string;
  query: string;
  i18nQuery?: string;
};

export const CATEGORIES: ArchiveCategory[] = [
  { key: "audiobooks", label: "Audiobooks", emoji: "📚", query: "collection:(librivoxaudio)", i18nQuery: "mediatype:(audio)" },
  { key: "stories", label: "Stories & tales", emoji: "📖", query: "mediatype:(audio) AND subject:(stories OR folklore OR fairy)", i18nQuery: "mediatype:(audio) AND subject:(story OR stories OR folklore OR fairy OR tale OR fiction OR novel)" },
  { key: "kids", label: "Children's", emoji: "🧸", query: "collection:(librivoxaudio) AND subject:(children)", i18nQuery: "mediatype:(audio) AND subject:(children OR kids OR juvenile OR story OR folk OR nursery OR moral)" },
  { key: "poetry", label: "Poetry", emoji: "🪶", query: "collection:(librivoxaudio) AND subject:(poetry)", i18nQuery: "mediatype:(audio) AND subject:(poetry OR poem OR poems OR verse OR kavithai OR kavitha OR kavita OR ghazal)" },
  { key: "radio", label: "Old-time radio", emoji: "📻", query: "collection:(oldtimeradio)", i18nQuery: 'mediatype:(audio) AND subject:(radio OR broadcast OR "radio drama" OR "radio play" OR "radio serial" OR nataka OR natak OR drama OR serial)' },
  { key: "films", label: "Free films", emoji: "🎬", query: "mediatype:(movies) AND collection:(feature_films OR silent_films OR classic_tv)", i18nQuery: "mediatype:(movies) AND -collection:(short_films OR animationandcartoons OR prelinger OR more_animation) AND -subject:(short OR cartoon OR animation)" },
  { key: "shorts", label: "Short films", emoji: "🎞️", query: "mediatype:(movies) AND collection:(short_films OR animationandcartoons OR prelinger OR more_animation OR classic_cartoons)", i18nQuery: 'mediatype:(movies) AND (collection:(short_films OR animationandcartoons OR prelinger OR more_animation) OR subject:(short OR "short film" OR cartoon OR animation OR animated))' },
  { key: "music", label: "Music", emoji: "🎵", query: "mediatype:(audio) AND collection:(opensource_audio)", i18nQuery: "mediatype:(audio)" }
];

// Indian languages first (Karochat's core audience), then world languages.
export const LANGUAGES = [
  "Any",
  "English",
  "Hindi",
  "Tamil",
  "Malayalam",
  "Telugu",
  "Kannada",
  "Bengali",
  "Marathi",
  "Gujarati",
  "Punjabi",
  "Urdu",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Russian",
  "Chinese",
  "Japanese",
  "Arabic"
];

// archive.org stores `language` inconsistently — as the full English name, the
// ISO 639-2 code, and sometimes the 639-1 code. The codes carry most of the
// non-English catalog (e.g. "tam"/"mal"/"hin" vastly out-number "Tamil"/etc),
// so we OR every known form to maximise recall. Field matching is
// case-insensitive, so we don't also list lowercase spellings.
const LANG_TOKENS: Record<string, string[]> = {
  English: ["English", "eng", "en"],
  Hindi: ["Hindi", "hin", "hi"],
  Tamil: ["Tamil", "tam", "ta"],
  Malayalam: ["Malayalam", "mal", "ml"],
  Telugu: ["Telugu", "tel", "te"],
  Kannada: ["Kannada", "kan", "kn"],
  Bengali: ["Bengali", "ben", "bn"],
  Marathi: ["Marathi", "mar", "mr"],
  Gujarati: ["Gujarati", "guj", "gu"],
  Punjabi: ["Punjabi", "Panjabi", "pan", "pa"],
  Urdu: ["Urdu", "urd", "ur"],
  Spanish: ["Spanish", "spa", "es"],
  French: ["French", "fre", "fra", "fr"],
  German: ["German", "ger", "deu", "de"],
  Italian: ["Italian", "ita", "it"],
  Portuguese: ["Portuguese", "por", "pt"],
  Russian: ["Russian", "rus", "ru"],
  Chinese: ["Chinese", "chi", "zho", "zh"],
  Japanese: ["Japanese", "jpn", "ja"],
  Arabic: ["Arabic", "ara", "ar"]
};

// The Lucene `language:(…)` clause for a chosen language, or null when no filter
// should apply. "Any" means no filter; "English" also means no filter, because
// the curated English collections don't reliably populate the language field
// (filtering them on language:(English) wrongly returns almost nothing).
export function languageClause(language: string): string | null {
  if (!language || language === "Any" || language === "English") return null;
  const tokens = LANG_TOKENS[language] ?? [language];
  return tokens.join(" OR ");
}

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
  const lc = languageClause(language);
  if (lc) q += ` AND language:(${lc})`;
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
