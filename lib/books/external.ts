// Karochat — public-domain + open-library cross-reference for books.
//
// Given a book title + author, query Project Gutenberg's Gutendex API
// and the OpenLibrary search API. Returns a small, normalised list of
// references so /books/[id] can show "Find this book elsewhere".
//
// All upstream APIs are free, anonymous, no key required. We:
//   • cap title+author to 200 chars total (URLencode safety)
//   • set short timeouts (4s per upstream) so a slow third party
//     doesn't slow the book page
//   • swallow per-source errors so one being down doesn't kill the
//     other.

export type ExternalRef = {
  source: "gutenberg" | "openlibrary";
  title: string;
  author: string | null;
  url: string;
  downloads?: number | null;
  publish_year?: number | null;
  cover_url?: string | null;
  is_free_full_text?: boolean;
};

const GUTENBERG_TIMEOUT_MS = 4000;
const OPENLIBRARY_TIMEOUT_MS = 4000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function searchGutenberg(
  title: string,
  author: string | null
): Promise<ExternalRef[]> {
  const q = [title, author].filter(Boolean).join(" ").slice(0, 200);
  const url = `https://gutendex.com/books?search=${encodeURIComponent(q)}`;
  const res = await withTimeout(
    fetch(url, { cache: "no-store" }),
    GUTENBERG_TIMEOUT_MS
  );
  if (!res.ok) return [];
  const json: any = await res.json();
  const items: any[] = Array.isArray(json?.results) ? json.results : [];
  return items.slice(0, 5).map((b: any) => {
    const authorName =
      Array.isArray(b.authors) && b.authors[0]?.name
        ? String(b.authors[0].name)
        : null;
    // Prefer canonical Gutenberg HTML / EPUB pages.
    const formats = b.formats ?? {};
    const epub =
      formats["application/epub+zip"] || formats["application/epub+zip;"];
    const html =
      formats["text/html"] || formats["text/html; charset=utf-8"];
    const pageUrl =
      typeof epub === "string"
        ? epub
        : typeof html === "string"
        ? html
        : `https://www.gutenberg.org/ebooks/${b.id}`;
    return {
      source: "gutenberg" as const,
      title: String(b.title ?? "Untitled"),
      author: authorName,
      url: pageUrl,
      downloads: typeof b.download_count === "number" ? b.download_count : null,
      cover_url: typeof formats["image/jpeg"] === "string"
        ? formats["image/jpeg"]
        : null,
      is_free_full_text: true
    };
  });
}

async function searchOpenLibrary(
  title: string,
  author: string | null
): Promise<ExternalRef[]> {
  const params = new URLSearchParams({
    title,
    limit: "5"
  });
  if (author) params.set("author", author);
  const url = `https://openlibrary.org/search.json?${params.toString()}`;
  const res = await withTimeout(
    fetch(url, { cache: "no-store" }),
    OPENLIBRARY_TIMEOUT_MS
  );
  if (!res.ok) return [];
  const json: any = await res.json();
  const docs: any[] = Array.isArray(json?.docs) ? json.docs : [];
  return docs.slice(0, 5).map((d: any) => {
    const authorName =
      Array.isArray(d.author_name) && d.author_name[0]
        ? String(d.author_name[0])
        : null;
    const olKey =
      typeof d.key === "string" && d.key.startsWith("/works/") ? d.key : null;
    const pageUrl = olKey
      ? `https://openlibrary.org${olKey}`
      : `https://openlibrary.org/search?title=${encodeURIComponent(title)}`;
    const coverId = typeof d.cover_i === "number" ? d.cover_i : null;
    return {
      source: "openlibrary" as const,
      title: String(d.title ?? "Untitled"),
      author: authorName,
      url: pageUrl,
      publish_year:
        typeof d.first_publish_year === "number" ? d.first_publish_year : null,
      cover_url: coverId
        ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
        : null,
      is_free_full_text: false
    };
  });
}

export async function lookupExternalReferences(
  title: string,
  author: string | null
): Promise<{ gutenberg: ExternalRef[]; openlibrary: ExternalRef[] }> {
  const cleanTitle = title.trim().slice(0, 160);
  const cleanAuthor = author?.trim().slice(0, 80) || null;
  if (!cleanTitle) return { gutenberg: [], openlibrary: [] };

  const [gutenberg, openlibrary] = await Promise.all([
    searchGutenberg(cleanTitle, cleanAuthor).catch(() => [] as ExternalRef[]),
    searchOpenLibrary(cleanTitle, cleanAuthor).catch(() => [] as ExternalRef[])
  ]);
  return { gutenberg, openlibrary };
}
