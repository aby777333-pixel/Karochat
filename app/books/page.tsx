// Karochat — /books (v9 Phase 2)
//
// Real listing: public live books from list_public_books, plus the
// caller's own uploads from list_my_books with pending / live / takedown
// status badges. "Upload a book" CTA leads to /books/upload.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { AccountMenu } from "@/components/AccountMenu";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Books · Karochat",
  description:
    "Karochat books library — public-domain, Creative Commons, and author-uploaded works, read in-app or downloaded."
};

type PublicBook = {
  id: string;
  title: string;
  author: string | null;
  language: string;
  cover_url: string | null;
  format: string;
  license_type: string;
  age_suitability: string;
  genres: string[];
  page_count: number | null;
  download_count: number;
  read_count: number;
  avg_rating: number | null;
  uploaded_at: string;
};
type MyBook = {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  format: string;
  license_type: string;
  status: "pending_review" | "live" | "takedown" | "rejected";
  visibility: string;
  download_count: number;
  read_count: number;
  uploaded_at: string;
};

const LICENSE_BADGE: Record<string, { label: string; tint: string }> = {
  public_domain: { label: "PD", tint: "border-neon-mint/40 bg-neon-mint/10 text-neon-mint" },
  creative_commons: { label: "CC", tint: "border-neon-blue/40 bg-neon-blue/10 text-neon-blue" },
  author_uploaded: { label: "Author", tint: "border-neon-amber/40 bg-neon-amber/10 text-neon-amber" },
  author_permission: { label: "Permission", tint: "border-white/20 bg-white/5 text-white/75" },
  fair_use: { label: "Fair-use", tint: "border-white/20 bg-white/5 text-white/75" },
  unspecified: { label: "—", tint: "border-white/10 bg-white/3 text-white/45" }
};
const STATUS_BADGE: Record<string, { label: string; tint: string }> = {
  pending_review: { label: "pending review", tint: "border-neon-amber/40 bg-neon-amber/10 text-neon-amber" },
  live: { label: "live", tint: "border-neon-mint/40 bg-neon-mint/10 text-neon-mint" },
  takedown: { label: "taken down", tint: "border-neon-red/40 bg-neon-red/10 text-neon-red" },
  rejected: { label: "rejected", tint: "border-neon-red/40 bg-neon-red/10 text-neon-red" }
};

export default async function BooksPage({
  searchParams
}: {
  searchParams?: { q?: string; genre?: string; lang?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/books");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, privacy_mode")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");

  const q = searchParams?.q?.trim() ?? null;
  const genre = searchParams?.genre?.trim() ?? null;
  const lang = searchParams?.lang?.trim() ?? null;

  const [publicResp, myResp] = await Promise.all([
    supabase.rpc("list_public_books", {
      p_query: q || null,
      p_genre: genre || null,
      p_language: lang || null,
      p_limit: 60,
      p_offset: 0
    }),
    supabase.rpc("list_my_books")
  ]);
  const publicBooks = (publicResp.data ?? []) as PublicBook[];
  const myBooks = (myResp.data ?? []) as MyBook[];

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-3 py-6 md:py-8">
      <header className="surface-glass flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/rooms" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs sm:justify-end md:gap-3">
          <Link
            href="/books/upload"
            className="rounded-lg border border-neon-mint/40 bg-neon-mint/10 px-3 py-1.5 text-neon-mint hover:bg-neon-mint/20"
          >
            + Upload a book
          </Link>
          <Link
            href="/rooms"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
          >
            ← Rooms
          </Link>
          {/* 🎓 Students — hidden while the module is spun out into a
              separate app. Keep for easy re-enable.
          <Link
            href="/students"
            className="rounded-lg border border-neon-mint/40 bg-neon-mint/10 px-3 py-1.5 text-neon-mint hover:bg-neon-mint/20"
          >
            🎓 Students
          </Link>
          */}
          <AccountMenu
            username={profile.username as string}
            displayName={profile.display_name as string | null}
            avatarUrl={(profile as any).avatar_url ?? null}
            initialPrivacyMode={
              ((profile as any).privacy_mode as
                | "open"
                | "friends_only"
                | "invisible"
                | "decoy"
                | "stealth") ?? "open"
            }
          />
        </div>
      </header>

      <section className="surface-glass mt-6 rounded-3xl border border-neon-blue/25 bg-gradient-to-br from-neon-blue/10 via-transparent to-neon-mint/5 p-6 sm:p-9">
        <p className="text-[10px] uppercase tracking-widest text-neon-blue/80">
          📚 Books · v9 · {publicBooks.length} live
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-white sm:text-4xl">
          A global library, contributed by readers.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">
          Public-domain works, Creative Commons titles, and books
          uploaded by their authors. Read in-app via a pop-up reader.
          Karochat takes 0% on author book sales — we link out, you keep
          all of it.
        </p>
        <form
          method="get"
          action="/books"
          className="mt-4 flex flex-wrap items-center gap-2"
        >
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search title or author"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/40"
          />
          <input
            name="lang"
            defaultValue={lang ?? ""}
            placeholder="lang (en, hi, ta…)"
            className="w-32 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/40"
          />
          <input
            name="genre"
            defaultValue={genre ?? ""}
            placeholder="genre"
            className="w-32 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/40"
          />
          <button
            type="submit"
            className="rounded-xl bg-neon-blue px-4 py-2 text-sm font-medium text-ink-900 hover:bg-neon-blue/90"
          >
            Search
          </button>
          {(q || lang || genre) && (
            <Link
              href="/books"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
            >
              Clear
            </Link>
          )}
        </form>
      </section>

      {myBooks.length > 0 && (
        <section className="mt-6">
          <p className="text-[10px] uppercase tracking-widest text-white/45">
            Your uploads
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {myBooks.map((b) => {
              const lic = LICENSE_BADGE[b.license_type] ?? LICENSE_BADGE.unspecified!;
              const st = STATUS_BADGE[b.status] ?? STATUS_BADGE.live!;
              return (
                <Link
                  key={b.id}
                  href={`/books/${b.id}`}
                  className="surface-glass flex items-center gap-3 p-3 hover:bg-white/10"
                >
                  <BookCover url={b.cover_url} title={b.title} small />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {b.title}
                    </p>
                    <p className="truncate text-[11px] text-white/55">
                      {b.author ?? "Unknown author"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className={`rounded-sm border px-1 ${st.tint}`}>
                        {st.label}
                      </span>
                      <span className={`rounded-sm border px-1 ${lic.tint}`}>
                        {lic.label}
                      </span>
                      <span className="text-white/40">
                        · {b.read_count} reads · {b.download_count} dl
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-6">
        <p className="text-[10px] uppercase tracking-widest text-white/45">
          Library
        </p>
        {publicBooks.length === 0 ? (
          <div className="surface-glass mt-2 p-7 text-center text-sm text-white/55">
            {q || lang || genre
              ? `Nothing matches "${q ?? ""}${lang ? ` lang=${lang}` : ""}${genre ? ` genre=${genre}` : ""}".`
              : "Be the first — tap “+ Upload a book” to seed the library."}
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {publicBooks.map((b) => {
              const lic = LICENSE_BADGE[b.license_type] ?? LICENSE_BADGE.unspecified!;
              return (
                <Link
                  key={b.id}
                  href={`/books/${b.id}`}
                  className="group surface-glass overflow-hidden hover:bg-white/10"
                >
                  <BookCover url={b.cover_url} title={b.title} />
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-medium text-white">
                      {b.title}
                    </p>
                    <p className="truncate text-[11px] text-white/55">
                      {b.author ?? "Unknown author"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className={`rounded-sm border px-1 ${lic.tint}`}>
                        {lic.label}
                      </span>
                      <span className="text-white/40">
                        {b.language.toUpperCase()}
                        {b.page_count ? ` · ${b.page_count}p` : ""} ·{" "}
                        {b.format.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="surface-glass mt-8 rounded-2xl border border-neon-amber/25 bg-neon-amber/5 p-5">
        <p className="text-[10px] uppercase tracking-widest text-neon-amber/80">
          📜 Why we don&apos;t host pirated books
        </p>
        <p className="mt-2 text-sm leading-relaxed text-white/80">
          Every upload requires a license declaration: public domain,
          Creative Commons, your own writing, author permission, or a
          fair-use claim. Files are hash-deduplicated against known
          takedowns. DMCA notices resolved within 24h. Three valid
          claims against the same uploader = permanent upload ban.
        </p>
      </section>

      <footer className="mt-10 text-center text-[11px] text-white/30">
        Karochat takes 0% on author book sales — we link out, you keep all of it.
      </footer>
    </main>
  );
}

function BookCover({
  url,
  title,
  small
}: {
  url: string | null;
  title: string;
  small?: boolean;
}) {
  if (url) {
    return (
      <div
        className={`overflow-hidden bg-black/40 ${
          small ? "h-16 w-12 shrink-0 rounded-md" : "aspect-[2/3] w-full"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`${title} cover`} className="h-full w-full object-cover" />
      </div>
    );
  }
  // Text-based fallback cover — first letter on tinted gradient.
  const initial = title.slice(0, 1).toUpperCase();
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-neon-blue/30 to-neon-mint/20 text-white ${
        small
          ? "h-16 w-12 shrink-0 rounded-md text-xl font-bold"
          : "aspect-[2/3] w-full text-4xl font-bold"
      }`}
    >
      {initial}
    </div>
  );
}
