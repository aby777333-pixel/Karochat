// Karochat — /read/[slug] — public reader for a publication.
//
// Open to anonymous guests. The get_publication RPC enforces:
//   - status='published' for non-owners
//   - adult-flagged rows return nothing if the caller hasn't attested
// Drafts return only to their author.

import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { Markdown } from "@/components/Markdown";
import { ReportButton } from "./ReportButton";

export const dynamic = "force-dynamic";

type Publication = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  body_markdown: string;
  category_slug: string | null;
  pen_name: string | null;
  author_profile_id: string;
  author_username: string | null;
  author_display_name: string | null;
  cover_image_url: string | null;
  is_adult: boolean;
  status: "draft" | "published" | "hidden";
  view_count: number;
  language: string;
  tags: string[];
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type Media = {
  id: string;
  kind: "image" | "pdf" | "video" | "audio";
  url: string;
  caption: string | null;
};

export default async function PublicationReaderPage({
  params
}: {
  params: { slug: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: rows, error } = await supabase.rpc("get_publication", {
    p_slug: params.slug
  });
  if (error) {
    return (
      <Shell isSignedIn={!!user}>
        <p className="mt-6 rounded-xl border border-neon-red/30 bg-neon-red/10 p-4 text-sm text-neon-red">
          {error.message}
        </p>
      </Shell>
    );
  }
  const article = (Array.isArray(rows) ? rows[0] : rows) as Publication | undefined;
  if (!article) notFound();

  const { data: mediaData } = await supabase.rpc("list_publication_media", {
    p_publication_id: article.id
  });
  const media = (mediaData ?? []) as Media[];

  const isOwner = user?.id === article.author_profile_id;
  const isDraft = article.status !== "published";
  const author =
    article.pen_name?.trim() ||
    article.author_display_name?.trim() ||
    (article.author_username ? `@${article.author_username}` : "anon");

  return (
    <Shell isSignedIn={!!user}>
      <article className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_240px]">
        <div className="min-w-0">
          {isDraft && (
            <div className="surface-glass tint-amber mb-4 px-4 py-3 text-[12px] text-white/80">
              📝 You&apos;re reading your own draft. It&apos;s private until you publish it.
            </div>
          )}

          {article.cover_image_url && (
            <figure className="mb-5 overflow-hidden rounded-2xl border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.cover_image_url}
                alt=""
                className="block w-full object-cover"
              />
            </figure>
          )}

          <p className="text-[10px] uppercase tracking-widest text-neon-purple/80">
            📚 Read{article.category_slug ? ` · ${article.category_slug}` : ""}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-white">
            {article.title}
          </h1>
          {article.subtitle && (
            <p className="mt-2 text-lg leading-relaxed text-white/75">
              {article.subtitle}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="text-white/70">
              by <span className="text-white">{author}</span>
            </span>
            {article.is_adult && (
              <span className="rounded-sm border border-neon-red/40 bg-neon-red/10 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-neon-red">
                18+
              </span>
            )}
            <span className="text-white/40">·</span>
            <span className="text-white/45">{article.view_count} reads</span>
            {article.published_at && (
              <>
                <span className="text-white/40">·</span>
                <span className="text-white/45">
                  {new Date(article.published_at).toLocaleDateString()}
                </span>
              </>
            )}
          </div>

          <div className="mt-7">
            <Markdown source={article.body_markdown || "_(empty)_"} />
          </div>

          {media.length > 0 && (
            <section className="mt-10">
              <p className="text-[10px] uppercase tracking-widest text-white/45">
                Attachments
              </p>
              <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {media.map((m) => (
                  <li key={m.id} className="surface-glass overflow-hidden">
                    {m.kind === "image" && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt={m.caption ?? ""} className="block w-full" />
                    )}
                    {m.kind === "video" && (
                      <video src={m.url} controls className="block w-full" />
                    )}
                    {m.kind === "audio" && (
                      <audio src={m.url} controls className="block w-full p-3" />
                    )}
                    {m.kind === "pdf" && (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 text-sm text-neon-blue underline-offset-2 hover:underline"
                      >
                        📄 Open PDF →
                      </a>
                    )}
                    {m.caption && (
                      <p className="px-3 pb-3 pt-2 text-[12px] text-white/60">
                        {m.caption}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {isOwner && (
            <div className="surface-glass mt-10 p-5">
              <p className="text-[10px] uppercase tracking-widest text-white/45">
                You wrote this
              </p>
              <div className="mt-2 flex gap-2">
                <Link
                  href={`/write/${article.id}/edit`}
                  className="rounded-lg bg-neon-mint px-3 py-1.5 text-sm font-medium text-ink-900 hover:bg-neon-mint/90"
                >
                  ✍ Edit
                </Link>
                <Link
                  href="/write"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
                >
                  Dashboard
                </Link>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <Link
            href="/read"
            className="surface-glass block p-3 text-[12px] text-white/75 transition hover:bg-white/10"
          >
            ← All publications
          </Link>
          {article.tags && article.tags.length > 0 && (
            <div className="surface-glass p-3 text-[12px]">
              <p className="text-[10px] uppercase tracking-widest text-white/45">Tags</p>
              <p className="mt-1 flex flex-wrap gap-1 text-white/75">
                {article.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5"
                  >
                    {t}
                  </span>
                ))}
              </p>
            </div>
          )}
          {!isOwner && user && !isDraft && (
            <div className="surface-glass p-3 text-[12px]">
              <ReportButton publicationId={article.id} />
            </div>
          )}
        </aside>
      </article>
    </Shell>
  );
}

function Shell({
  children,
  isSignedIn
}: {
  children: React.ReactNode;
  isSignedIn: boolean;
}) {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-3 py-6 md:py-8">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/read" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <div className="flex items-center gap-2 text-xs">
          {isSignedIn && (
            <Link
              href="/write"
              className="rounded-lg border border-neon-mint/40 bg-neon-mint/10 px-3 py-1.5 text-neon-mint hover:bg-neon-mint/20"
            >
              ✍ Write
            </Link>
          )}
          <Link
            href="/read"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
          >
            ← Library
          </Link>
        </div>
      </header>
      {children}
    </main>
  );
}
