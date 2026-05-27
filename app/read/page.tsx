// Karochat — /read — public list of user-published works.
//
// Renders for ANY visitor — anonymous guests included. The
// list_publications RPC returns only status='published' rows, and the
// underlying RLS filters adult-flagged rows for callers who haven't
// attested.

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Read · Karochat",
  description:
    "Stories, essays, journals, and experiences published by the Karochat community."
};

type Publication = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  category_slug: string | null;
  pen_name: string | null;
  author_username: string | null;
  author_display_name: string | null;
  cover_image_url: string | null;
  is_adult: boolean;
  view_count: number;
  published_at: string | null;
  language: string;
  tags: string[];
};

type Category = {
  slug: string;
  label: string;
  description: string | null;
  icon: string | null;
  is_adult: boolean;
};

export default async function ReadPage({
  searchParams
}: {
  searchParams?: { category?: string; q?: string; page?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const category = searchParams?.category?.trim() || null;
  const q = searchParams?.q?.trim() || null;
  const pageNum = Math.max(1, parseInt(searchParams?.page ?? "1", 10) || 1);
  const PAGE_SIZE = 24;

  const [catsResp, listResp] = await Promise.all([
    supabase
      .from("publication_categories")
      .select("slug,label,description,icon,is_adult")
      .eq("active", true)
      .order("position", { ascending: true }),
    supabase.rpc("list_publications", {
      p_category: category,
      p_include_adult: null,
      p_search: q,
      p_limit: PAGE_SIZE,
      p_offset: (pageNum - 1) * PAGE_SIZE
    })
  ]);

  const categories = (catsResp.data ?? []) as Category[];
  const publications = (listResp.data ?? []) as Publication[];
  const isSignedIn = !!user;

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-3 py-6 md:py-8">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
        <Link href={isSignedIn ? "/rooms" : "/"} className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <div className="flex items-center gap-2 text-xs md:gap-3">
          {isSignedIn ? (
            <>
              <Link
                href="/write"
                className="rounded-lg border border-neon-mint/40 bg-neon-mint/10 px-3 py-1.5 text-neon-mint hover:bg-neon-mint/20"
              >
                ✍ Write
              </Link>
              <Link
                href="/rooms"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              >
                ← Rooms
              </Link>
            </>
          ) : (
            <Link
              href="/?redirect=/write"
              className="rounded-lg border border-neon-mint/40 bg-neon-mint/10 px-3 py-1.5 text-neon-mint hover:bg-neon-mint/20"
            >
              Sign in to write →
            </Link>
          )}
        </div>
      </header>

      <section className="surface-glass mt-6 rounded-3xl border border-neon-purple/25 bg-gradient-to-br from-neon-purple/10 via-transparent to-neon-blue/5 p-6 sm:p-9">
        <p className="text-[10px] uppercase tracking-widest text-neon-purple/80">
          📚 Read · {publications.length}+ pieces
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-white sm:text-4xl">
          Stories, essays, journals — by people.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">
          Long-form writing by the Karochat community. Anyone can read.
          To publish, you need an email-registered account.{" "}
          {isSignedIn ? (
            <Link href="/write" className="text-neon-mint underline-offset-2 hover:underline">
              Open the writer dashboard →
            </Link>
          ) : (
            <Link href="/" className="text-neon-mint underline-offset-2 hover:underline">
              Sign up →
            </Link>
          )}
        </p>

        <form action="/read" method="get" className="mt-4 flex max-w-xl gap-2">
          {category && <input type="hidden" name="category" value={category} />}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search titles, subtitles, body…"
            className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-neon-blue/60"
          />
          <button
            type="submit"
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20"
          >
            Search
          </button>
        </form>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
        <div className="min-w-0">
          {category && (
            <div className="mb-3 flex items-center gap-2 text-[12px]">
              <span className="text-white/55">Filtered to:</span>
              <span className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-white/80">
                {categories.find((c) => c.slug === category)?.label ?? category}
              </span>
              <Link
                href={`/read${q ? `?q=${encodeURIComponent(q)}` : ""}`}
                className="ml-1 text-neon-blue underline-offset-2 hover:underline"
              >
                clear
              </Link>
            </div>
          )}

          {publications.length === 0 ? (
            <div className="surface-glass p-8 text-center text-sm text-white/55">
              {q
                ? "No matches yet — try a different search."
                : "Nothing has been published here yet. Be the first."}
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {publications.map((p) => {
                const author =
                  p.pen_name?.trim() ||
                  p.author_display_name?.trim() ||
                  (p.author_username ? `@${p.author_username}` : "anon");
                const cat = categories.find((c) => c.slug === p.category_slug);
                return (
                  <li key={p.id}>
                    <Link
                      href={`/read/${p.slug}`}
                      className="surface-glass block h-full overflow-hidden transition hover:bg-white/10"
                    >
                      {p.cover_image_url && (
                        <div className="relative h-32 w-full overflow-hidden border-b border-white/5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.cover_image_url}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/45">
                          {cat ? (
                            <span>
                              {cat.icon} {cat.label}
                            </span>
                          ) : (
                            <span>Uncategorised</span>
                          )}
                          {p.is_adult && (
                            <span className="rounded-sm border border-neon-red/40 bg-neon-red/10 px-1 text-neon-red">
                              18+
                            </span>
                          )}
                        </div>
                        <p className="mt-1 font-display text-lg font-semibold leading-tight text-white line-clamp-2">
                          {p.title}
                        </p>
                        {p.subtitle && (
                          <p className="mt-1 text-[13px] leading-snug text-white/65 line-clamp-2">
                            {p.subtitle}
                          </p>
                        )}
                        <p className="mt-2 text-[11px] text-white/45">
                          {author} · {p.view_count} reads
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {publications.length === PAGE_SIZE && (
            <div className="mt-5 flex justify-between text-sm">
              {pageNum > 1 ? (
                <Link
                  href={`/read?${new URLSearchParams({
                    ...(category ? { category } : {}),
                    ...(q ? { q } : {}),
                    page: String(pageNum - 1)
                  }).toString()}`}
                  className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
                >
                  ← Previous
                </Link>
              ) : (
                <span />
              )}
              <Link
                href={`/read?${new URLSearchParams({
                  ...(category ? { category } : {}),
                  ...(q ? { q } : {}),
                  page: String(pageNum + 1)
                }).toString()}`}
                className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
              >
                Next →
              </Link>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <nav className="surface-glass p-4">
            <p className="text-[10px] uppercase tracking-widest text-white/45">
              Browse by category
            </p>
            <ul className="mt-2 space-y-1 text-[13px]">
              <li>
                <Link
                  href={`/read${q ? `?q=${encodeURIComponent(q)}` : ""}`}
                  className={
                    "block rounded-md px-2 py-1 transition " +
                    (!category
                      ? "bg-neon-mint/15 text-neon-mint"
                      : "text-white/75 hover:bg-white/5 hover:text-white")
                  }
                >
                  ✨ All
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/read?category=${encodeURIComponent(c.slug)}${
                      q ? `&q=${encodeURIComponent(q)}` : ""
                    }`}
                    className={
                      "block rounded-md px-2 py-1 transition " +
                      (category === c.slug
                        ? "bg-neon-mint/15 text-neon-mint"
                        : "text-white/75 hover:bg-white/5 hover:text-white")
                    }
                  >
                    {c.icon} {c.label}
                    {c.is_adult && (
                      <span className="ml-1 text-[10px] text-neon-red/80">
                        18+
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {isSignedIn ? (
            <Link
              href="/write/new"
              className="surface-glass tint-amber block p-4 text-sm transition hover:bg-white/10"
            >
              <p className="text-[10px] uppercase tracking-widest text-neon-amber/80">
                Start writing
              </p>
              <p className="mt-1 font-display font-semibold text-white">
                New piece →
              </p>
              <p className="mt-1 text-[12px] text-white/60">
                Drafts auto-save. Publish when you&apos;re ready.
              </p>
            </Link>
          ) : (
            <Link
              href="/"
              className="surface-glass tint-amber block p-4 text-sm transition hover:bg-white/10"
            >
              <p className="text-[10px] uppercase tracking-widest text-neon-amber/80">
                Want to publish?
              </p>
              <p className="mt-1 font-display font-semibold text-white">
                Sign up with email →
              </p>
              <p className="mt-1 text-[12px] text-white/60">
                Free. Pseudonyms welcome. You stay in control.
              </p>
            </Link>
          )}
        </aside>
      </section>
    </main>
  );
}
