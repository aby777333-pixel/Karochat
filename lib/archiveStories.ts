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
  // Which free library the item came from. "archive" (default) plays via the
  // archive.org embed/metadata player; "wikimedia"/"openverse" carry a direct
  // `mediaUrl` the hub plays natively.
  source?: "archive" | "wikimedia" | "openverse";
  mediaUrl?: string;
};

// `query` is the default catalog (used for "Any" and English — curated English
// collections like LibriVox/feature_films are English by nature). `i18nQuery` is
// the broader query used when a SPECIFIC non-English language is picked: those
// English-only collections hold essentially no other-language titles, so we fall
// back to the wider public audio/film space and let the language filter do the
// work. Subject-based categories work in any language as-is, so they can omit
// i18nQuery and the hub reuses `query`.
export type ArchiveCategory = {
  key: string;
  label: string;
  emoji: string;
  query: string;
  i18nQuery?: string;
};

// A primary group (Audiobooks, TV Series, Films, …) holding genre categories.
export type ArchiveGroup = {
  key: string;
  label: string;
  emoji: string;
  categories: ArchiveCategory[];
};

// ── Query builders ─────────────────────────────────────────────────────────
// Keep one consistent shape per medium so every genre is well-populated and
// language-aware. The English `query` leans on curated collections; the
// `i18nQuery` drops the collection lock so other languages return content.
const ab = (terms: string) => ({
  query: `mediatype:(audio) AND (collection:(librivoxaudio) OR subject:(audiobook)) AND subject:(${terms})`,
  // Non-English audio on archive.org is rarely tagged with English genre
  // subjects, so a `subject:(…)` filter collapses the count (e.g. Hindi Fiction
  // 15949 → 135). For a specific language we show the whole audio catalog in
  // that language and let the language filter do the work — far more content.
  i18nQuery: `mediatype:(audio)`
});
// Non-English movie content on archive.org is rarely tagged with English genre
// subjects, so a `subject:(…)` filter collapses the count (e.g. Tamil Action
// 3721 → 1, Malayalam Action 292 → 0). For a specific language we show the full
// movie catalog in that language and let the language filter do the work.
// English/Any keep the precise collection+subject `query`.
const tv = (terms: string) => ({
  query: `mediatype:(movies) AND (collection:(classic_tv) OR subject:("tv series" OR television OR sitcom OR teleserial)) AND subject:(${terms})`,
  i18nQuery: `mediatype:(movies)`
});
const film = (terms: string) => ({
  query: `mediatype:(movies) AND collection:(feature_films) AND subject:(${terms})`,
  i18nQuery: `mediatype:(movies)`
});
const shortf = (terms: string) => ({
  query: `mediatype:(movies) AND collection:(short_films OR animationandcartoons OR prelinger OR more_animation) AND subject:(${terms})`,
  i18nQuery: `mediatype:(movies)`
});

export const GROUPS: ArchiveGroup[] = [
  {
    key: "audiobooks",
    label: "Audiobooks",
    emoji: "🎧",
    categories: [
      { key: "ab-fiction", label: "Fiction", emoji: "📖", ...ab("fiction OR novel OR \"short stories\" OR literature") },
      { key: "ab-nonfiction", label: "Non-Fiction", emoji: "📘", ...ab("nonfiction OR \"non-fiction\" OR essays OR reference") },
      { key: "ab-selfhelp", label: "Self-Help", emoji: "🌱", ...ab("self-help OR \"self help\" OR motivational OR \"personal development\" OR success") },
      { key: "ab-business", label: "Business & Finance", emoji: "💼", ...ab("business OR finance OR economics OR investing OR money OR wealth") },
      { key: "ab-history", label: "History", emoji: "🏺", ...ab("history OR historical OR ancient OR war") },
      { key: "ab-spirituality", label: "Spirituality", emoji: "🕉️", ...ab("spiritual OR spirituality OR religion OR philosophy OR meditation OR devotional OR vedanta OR gita") },
      { key: "ab-bio", label: "Biographies", emoji: "👤", ...ab("biography OR autobiography OR memoir OR \"life of\"") },
      { key: "ab-science", label: "Science & Technology", emoji: "🔬", ...ab("science OR technology OR physics OR astronomy OR mathematics OR nature") },
      { key: "ab-kids", label: "Children's Audiobooks", emoji: "🧸", ...ab("children OR kids OR juvenile OR fairy OR nursery OR moral") },
      { key: "ab-language", label: "Language Learning", emoji: "🗣️", ...ab("language OR grammar OR linguistics OR vocabulary OR learning") }
    ]
  },
  {
    key: "tv",
    label: "TV Series",
    emoji: "📺",
    categories: [
      { key: "tv-drama", label: "Drama Series", emoji: "🎭", ...tv("drama") },
      { key: "tv-comedy", label: "Comedy Series", emoji: "😂", ...tv("comedy OR humor OR humour") },
      { key: "tv-sitcom", label: "Sitcoms", emoji: "📺", ...tv("sitcom OR \"situation comedy\"") },
      { key: "tv-action", label: "Action & Adventure", emoji: "💥", ...tv("action OR adventure") },
      { key: "tv-crime", label: "Crime & Mystery", emoji: "🕵️", ...tv("crime OR mystery OR detective OR thriller") },
      { key: "tv-scifi", label: "Science Fiction", emoji: "🚀", ...tv("\"science fiction\" OR \"sci-fi\" OR scifi") },
      { key: "tv-fantasy", label: "Fantasy", emoji: "🐉", ...tv("fantasy OR magic") },
      { key: "tv-historical", label: "Historical Series", emoji: "🏛️", ...tv("historical OR history OR period OR aitihasik") },
      { key: "tv-family", label: "Family Entertainment", emoji: "👨‍👩‍👧", ...tv("family OR children") },
      { key: "tv-classic", label: "Classic Television", emoji: "📼", query: "mediatype:(movies) AND collection:(classic_tv)", i18nQuery: "mediatype:(movies)" },
      { key: "tv-indian", label: "Classic Indian TV", emoji: "🇮🇳", query: 'title:(buniyaad OR buniyad OR "hum log" OR nukkad OR "dekh bhai dekh" OR "wagle ki duniya" OR "yeh jo hai zindagi" OR "malgudi days" OR "byomkesh bakshi" OR circus OR fauji OR "office office" OR "didi" OR "shrimaan shrimati")' },
      { key: "tv-reality", label: "Reality & Talent Shows", emoji: "🎙️", ...tv("reality OR \"talent show\" OR \"game show\" OR \"reality show\"") },
      { key: "tv-docuseries", label: "Documentary Series", emoji: "🎥", ...tv("documentary OR docuseries OR documentaries") }
    ]
  },
  {
    key: "films",
    label: "Films",
    emoji: "🎬",
    categories: [
      { key: "film-action", label: "Action", emoji: "💥", ...film("action") },
      { key: "film-adventure", label: "Adventure", emoji: "🧭", ...film("adventure") },
      { key: "film-comedy", label: "Comedy", emoji: "😂", ...film("comedy OR humor OR humour") },
      { key: "film-drama", label: "Drama", emoji: "🎭", ...film("drama") },
      { key: "film-romance", label: "Romance", emoji: "❤️", ...film("romance OR romantic OR love") },
      { key: "film-thriller", label: "Thriller", emoji: "🔪", ...film("thriller OR suspense") },
      { key: "film-horror", label: "Horror / Slasher / Gore", emoji: "👻", ...film("horror OR slasher OR gore OR splatter OR macabre") },
      { key: "film-mystery", label: "Mystery", emoji: "🔍", ...film("mystery OR detective") },
      { key: "film-crime", label: "Crime", emoji: "🚔", ...film("crime OR noir OR gangster") },
      { key: "film-scifi", label: "Science Fiction", emoji: "🚀", ...film("\"science fiction\" OR \"sci-fi\" OR scifi") },
      { key: "film-fantasy", label: "Fantasy", emoji: "🐉", ...film("fantasy OR magic") },
      { key: "film-historical", label: "Historical", emoji: "🏛️", ...film("historical OR history OR period") },
      { key: "film-war", label: "War", emoji: "🎖️", ...film("war OR \"world war\" OR military") },
      { key: "film-animation", label: "Animation", emoji: "🐭", query: "mediatype:(movies) AND collection:(animationandcartoons OR more_animation OR classic_cartoons)", i18nQuery: "mediatype:(movies) AND subject:(animation OR animated OR cartoon)" },
      { key: "film-family", label: "Family", emoji: "👨‍👩‍👧", ...film("family OR children") },
      { key: "film-documentary", label: "Documentary", emoji: "🎥", ...film("documentary OR documentaries") },
      { key: "film-indie", label: "Independent Cinema", emoji: "🎟️", ...film("independent OR indie") },
      { key: "film-international", label: "International Cinema", emoji: "🌍", query: "mediatype:(movies) AND collection:(feature_films) AND -language:(English OR eng OR en)", i18nQuery: "mediatype:(movies)" },
      { key: "film-award", label: "Award-Winning Films", emoji: "🏆", ...film("award OR \"award winning\" OR \"academy award\" OR oscar") },
      { key: "film-classic", label: "Classic Films", emoji: "🎞️", query: "mediatype:(movies) AND collection:(feature_films OR silent_films) AND year:[1920 TO 1969]", i18nQuery: "mediatype:(movies) AND year:[1920 TO 1969]" }
    ]
  },
  {
    key: "shorts",
    label: "Short Films",
    emoji: "🎞️",
    categories: [
      { key: "short-drama", label: "Drama Shorts", emoji: "🎭", ...shortf("drama") },
      { key: "short-comedy", label: "Comedy Shorts", emoji: "😂", ...shortf("comedy OR humor OR humour") },
      { key: "short-animation", label: "Animation Shorts", emoji: "🐭", query: "mediatype:(movies) AND collection:(animationandcartoons OR more_animation OR classic_cartoons)", i18nQuery: "mediatype:(movies) AND subject:(animation OR animated OR cartoon)" },
      { key: "short-documentary", label: "Documentary Shorts", emoji: "🎥", ...shortf("documentary OR documentaries") },
      { key: "short-experimental", label: "Experimental Shorts", emoji: "🌀", ...shortf("experimental OR avant-garde OR \"avant garde\"") },
      { key: "short-student", label: "Student Films", emoji: "🎓", ...shortf("student OR \"film school\" OR thesis") },
      { key: "short-indie", label: "Independent Shorts", emoji: "🎟️", ...shortf("independent OR indie") },
      { key: "short-award", label: "Award-Winning Shorts", emoji: "🏆", ...shortf("award OR \"award winning\"") },
      { key: "short-international", label: "International Shorts", emoji: "🌍", query: "mediatype:(movies) AND collection:(short_films) AND -language:(English OR eng OR en)", i18nQuery: "mediatype:(movies) AND subject:(short OR \"short film\")" },
      { key: "short-family", label: "Family & Children's Shorts", emoji: "🧸", ...shortf("family OR children OR kids") }
    ]
  },
  {
    key: "myth",
    label: "Mythological & Epic",
    emoji: "🕉️",
    categories: [
      { key: "myth-ramayana", label: "Ramayana", emoji: "🏹", query: "title:(ramayan OR ramayana OR ramayanam OR ramayan)" },
      { key: "myth-mahabharata", label: "Mahabharata", emoji: "⚔️", query: "title:(mahabharat OR mahabharata OR mahabharatham)" },
      { key: "myth-krishna", label: "Shri Krishna", emoji: "🦚", query: 'title:("shri krishna" OR "shree krishna" OR krishna OR "shri krishn")' },
      { key: "myth-vishnu", label: "Vishnu Puran", emoji: "🐚", query: 'title:("vishnu puran" OR "vishnu purana")' },
      { key: "myth-chanakya", label: "Chanakya", emoji: "📜", query: "title:(chanakya OR chanakaya)" },
      { key: "myth-bharat", label: "Bharat Ek Khoj", emoji: "🗺️", query: 'title:("bharat ek khoj")' },
      { key: "myth-devotional", label: "Devotional & Spiritual", emoji: "🪔", query: 'subject:(devotional OR bhakti OR aarti OR bhajan OR spiritual) OR title:(hanuman OR "shiv" OR ganesh OR durga OR "om namah")' },
      { key: "myth-epics", label: "Other Epics & Mythology", emoji: "📿", query: 'subject:(mythology OR epic OR hindu OR puranas OR pauranik OR \"indian epic\") OR title:("vikram betaal" OR "jai hanuman" OR "om namah shivay" OR "luv kush")' }
    ]
  },
  {
    key: "bible",
    label: "Bible & Faith",
    emoji: "✝️",
    categories: [
      { key: "bible-audio", label: "Bible (Audio)", emoji: "📖", query: 'mediatype:(audio) AND title:(bible) AND subject:(bible OR scripture OR audiobible OR "holy bible")', i18nQuery: "mediatype:(audio) AND subject:(bible OR scripture OR gospel)" },
      { key: "bible-films", label: "Bible Films & Series", emoji: "🎬", query: 'mediatype:(movies) AND title:(bible OR jesus OR gospel OR "ten commandments" OR moses OR "king of kings" OR "superbook")', i18nQuery: "mediatype:(movies) AND subject:(bible OR jesus OR gospel OR christian)" },
      { key: "bible-jesus", label: "Jesus & Gospel Films", emoji: "✨", query: 'mediatype:(movies) AND title:(jesus OR christ OR gospel OR "passion of" OR nativity OR "jesus of nazareth")' },
      { key: "bible-study", label: "Bible Study & Sermons", emoji: "🙏", query: 'subject:(sermon OR sermons OR preaching OR "bible study" OR gospel OR christianity OR scripture OR theology)' },
      { key: "bible-hovind", label: "Kent Hovind", emoji: "🦖", query: 'title:("kent hovind") OR creator:("kent hovind") OR title:(hovind OR "creation seminar")' },
      { key: "bible-debates", label: "Creation & Debates", emoji: "🎙️", query: 'subject:(apologetics OR creationism OR "intelligent design") OR title:("creation seminar" OR "creation vs evolution" OR "great debate" OR "does god exist")' },
      { key: "bible-music", label: "Gospel & Worship Music", emoji: "🎵", query: 'mediatype:(audio) AND subject:(gospel OR worship OR hymn OR hymns OR "christian music" OR praise)' },
      { key: "bible-series", label: "Famous Bible Series", emoji: "📺", query: 'title:("the bible" OR "jesus film" OR "visual bible" OR "ten commandments" OR superbook OR "ben-hur" OR "greatest story ever told" OR "jesus of nazareth" OR "gospel of john" OR "the chosen")' },
      { key: "bible-preachers", label: "Preachers & Apologists", emoji: "🎤", query: 'creator:("billy graham" OR spurgeon OR "ken ham" OR "william lane craig" OR macarthur OR "paul washer" OR "r.c. sproul" OR "voddie baucham") OR title:("billy graham" OR spurgeon OR "william lane craig" OR "paul washer" OR "answers in genesis" OR "john macarthur" OR "ken ham" OR "ham vs nye")' }
    ]
  },
  {
    key: "more",
    label: "More",
    emoji: "✨",
    categories: [
      { key: "more-kids", label: "Kids & Family", emoji: "🧒", query: "mediatype:(movies OR audio) AND subject:(children OR kids OR family OR juvenile)" },
      { key: "more-education", label: "Educational", emoji: "🎓", query: "subject:(education OR educational OR lecture OR tutorial OR course OR learning)" },
      { key: "more-travel", label: "Travel & Lifestyle", emoji: "✈️", query: "subject:(travel OR tourism OR lifestyle OR \"travelogue\")" },
      { key: "more-health", label: "Health & Wellness", emoji: "🧘", query: "subject:(health OR wellness OR yoga OR fitness OR meditation OR \"mental health\")" },
      { key: "more-cooking", label: "Cooking & Food", emoji: "🍳", query: "subject:(cooking OR food OR recipe OR cuisine OR culinary)" },
      { key: "more-music", label: "Music & Concerts", emoji: "🎵", query: "collection:(etree) OR (mediatype:(audio) AND subject:(music OR concert OR live OR song))" },
      { key: "more-arts", label: "Arts & Culture", emoji: "🎨", query: "subject:(art OR arts OR culture OR painting OR theatre OR dance OR museum)" },
      { key: "more-news", label: "News & Current Affairs", emoji: "📰", query: "mediatype:(movies) AND (collection:(universal_newsreels) OR subject:(news OR newsreel OR \"current affairs\"))" },
      { key: "more-sports", label: "Sports", emoji: "🏅", query: "subject:(sports OR cricket OR football OR olympics OR boxing OR athletics)" },
      { key: "more-gaming", label: "Gaming", emoji: "🎮", query: "subject:(gaming OR videogame OR \"video game\" OR gameplay OR esports OR \"let's play\")" },
      { key: "more-nature", label: "Nature & Wildlife", emoji: "🦁", query: "mediatype:(movies) AND subject:(nature OR wildlife OR animals OR ocean OR forest)" },
      { key: "more-nasa", label: "Space & NASA", emoji: "🚀", query: "mediatype:(movies) AND (collection:(nasa) OR subject:(nasa OR space OR apollo OR astronomy OR mars OR rocket))" },
      { key: "more-prelinger", label: "Prelinger Archive", emoji: "🎞️", query: "mediatype:(movies) AND collection:(prelinger)" },
      { key: "more-tech", label: "Technology", emoji: "💻", query: "subject:(technology OR computers OR software OR \"artificial intelligence\" OR internet)" },
      { key: "more-retro", label: "Retro & Nostalgia", emoji: "📼", query: "mediatype:(movies) AND collection:(prelinger OR classic_tv) AND year:[1940 TO 1989]" },
      { key: "more-regional", label: "Regional Language", emoji: "🗺️", query: "subject:(regional OR folk OR \"folk music\" OR traditional OR \"lok geet\")" },
      { key: "more-international", label: "International", emoji: "🌐", query: "mediatype:(movies) AND -language:(English OR eng OR en)" }
    ]
  }
];

// Flattened list (every genre across all groups). Kept for any consumer that
// wants a single array; keys are group-prefixed so they're globally unique.
export const CATEGORIES: ArchiveCategory[] = GROUPS.flatMap((g) => g.categories);

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

// Wikimedia Commons — free & Creative-Commons video/audio. Keyless and
// CORS-enabled (origin=*). Returns the same ArchiveItem shape but with a direct
// `mediaUrl` the hub plays natively (no archive.org embed). Best driven by the
// search box; the genre label is used as a fallback search term.
export async function fetchWikimedia(
  search: string,
  kind: "video" | "audio",
  rows = 40
): Promise<ArchiveItem[]> {
  const term = search.trim() || (kind === "video" ? "documentary" : "music");
  const q = `${term} filetype:${kind}`;
  const params =
    "action=query&format=json&origin=*&generator=search&gsrnamespace=6" +
    `&gsrsearch=${encodeURIComponent(q)}&gsrlimit=${rows}` +
    "&prop=imageinfo&iiprop=url%7Cmediatype%7Cextmetadata";
  let res: Response;
  try {
    res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      cache: "no-store"
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const data = (await res.json()) as any;
  const pages: any[] = data?.query?.pages ? Object.values(data.query.pages) : [];
  const out: ArchiveItem[] = [];
  for (const p of pages) {
    const info = p?.imageinfo?.[0];
    if (!info?.url) continue;
    const mt = String(info.mediatype || "").toUpperCase();
    const artist = info?.extmetadata?.Artist?.value;
    out.push({
      id: "wm-" + String(p.pageid ?? info.url),
      title: String(p.title || "")
        .replace(/^File:/, "")
        .replace(/\.[^.]+$/, ""),
      creator: artist
        ? String(artist).replace(/<[^>]+>/g, "").trim().slice(0, 60) || undefined
        : undefined,
      mediatype: mt === "VIDEO" ? "movies" : "audio",
      source: "wikimedia",
      mediaUrl: String(info.url)
    });
  }
  return out;
}

// Openverse — Creative-Commons audio aggregated from Jamendo, ccMixter, the
// Free Music Archive and more. Keyless + CORS (`Access-Control-Allow-Origin: *`).
// Returns native-playable mp3 URLs in `mediaUrl`. Keyword-driven via search.
export async function fetchOpenverse(search: string, rows = 20): Promise<ArchiveItem[]> {
  const term = search.trim() || "music";
  // Anonymous Openverse requests are capped at page_size 20 (else HTTP 401).
  const size = Math.min(Math.max(rows, 1), 20);
  const url =
    "https://api.openverse.org/v1/audio/" +
    `?q=${encodeURIComponent(term)}&page_size=${size}&mature=false`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    return [];
  }
  if (!res.ok) return []; // 429 (rate limit) or transient → empty, not a crash
  const data = (await res.json()) as any;
  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  const out: ArchiveItem[] = [];
  for (const r of results) {
    const media = r?.url; // direct audio file
    if (!media || typeof media !== "string") continue;
    out.push({
      id: "ov-" + String(r.id ?? media),
      title: String(r.title || "Untitled"),
      creator: r.creator ? String(r.creator).slice(0, 60) : r.provider,
      mediatype: "audio",
      source: "openverse",
      mediaUrl: media
    });
  }
  return out;
}

export function embedUrl(id: string): string {
  return `https://archive.org/embed/${encodeURIComponent(id)}`;
}
export function detailsUrl(id: string): string {
  return `https://archive.org/details/${encodeURIComponent(id)}`;
}
