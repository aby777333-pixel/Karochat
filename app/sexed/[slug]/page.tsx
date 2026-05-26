// Karochat — /sexed/[slug] (v9 Phase 3)
//
// Article reader. get_sexed_article RPC applies age-tier filtering
// server-side; if a 16_17 caller tries to fetch an 18plus article slug
// they just get no row → 404. So no client-side gating needed.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { Markdown } from "@/components/Markdown";
import { CrisisHelplineCard } from "../_components/CrisisHelplineCard";

export const dynamic = "force-dynamic";

type Article = {
  id: string;
  slug: string;
  title: string;
  body_markdown: string;
  topic: string | null;
  language: string;
  age_band: "13_15" | "16_17" | "18plus" | "all";
  region_tags: string[];
  view_count: number;
  created_at: string;
  reviewer_username: string | null;
  reviewed_at: string | null;
};

type Helpline = {
  id: string;
  country: string;
  kind: string;
  name: string;
  phone: string | null;
  sms: string | null;
  url: string | null;
  hours: string | null;
  languages: string[] | null;
  notes: string | null;
};

const AGE_LABEL: Record<string, { label: string; tint: string }> = {
  "13_15": { label: "13–15", tint: "border-neon-blue/40 bg-neon-blue/10 text-neon-blue" },
  "16_17": { label: "16–17", tint: "border-neon-amber/40 bg-neon-amber/10 text-neon-amber" },
  "18plus": { label: "18+", tint: "border-neon-red/40 bg-neon-red/10 text-neon-red" },
  all: { label: "All ages", tint: "border-white/15 bg-white/5 text-white/70" }
};

export default async function ArticlePage({
  params
}: {
  params: { slug: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?redirect=/sexed/${params.slug}`);

  const [{ data: rows, error }, { data: helplineData }] = await Promise.all([
    supabase.rpc("get_sexed_article", { p_slug: params.slug }),
    supabase.rpc("list_helplines_for", { p_country: "IN", p_kinds: null })
  ]);
  if (error) {
    return (
      <Shell>
        <p className="mt-6 rounded-xl border border-neon-red/30 bg-neon-red/10 p-4 text-sm text-neon-red">
          {error.message}
        </p>
      </Shell>
    );
  }
  const article = (Array.isArray(rows) ? rows[0] : rows) as Article | undefined;
  if (!article) notFound();
  const ag = AGE_LABEL[article.age_band] ?? AGE_LABEL.all!;
  const helplines = (helplineData ?? []) as Helpline[];

  return (
    <Shell>
      <article className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
            💞 Sex ed{article.topic ? ` · ${article.topic}` : ""}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-white">
            {article.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className={`rounded-sm border px-1.5 py-0.5 ${ag.tint}`}>
              {ag.label}
            </span>
            <span className="rounded-sm border border-white/15 bg-white/5 px-1.5 py-0.5 text-white/70">
              {article.language.toUpperCase()}
            </span>
            <span className="text-white/45">
              {article.view_count} reads
            </span>
            {article.reviewer_username && (
              <span className="text-white/45">
                · reviewed by @{article.reviewer_username}
              </span>
            )}
          </div>

          <div className="surface-glass tint-amber mt-5 px-4 py-3 text-[12px] leading-relaxed text-white/80">
            📜 <strong>This is education, not medical care.</strong> If
            something is hurting, infected, bleeding, or causing distress,
            see a clinician. We list helplines in the sidebar.
          </div>

          <div className="mt-6">
            <Markdown source={article.body_markdown} />
          </div>

          <div className="surface-glass mt-10 p-5">
            <p className="text-[10px] uppercase tracking-widest text-white/45">
              Still have a question?
            </p>
            <p className="mt-1 text-sm text-white/75">
              Ask Karo anonymously. It&apos;s queer-affirming, age-aware,
              and won&apos;t pretend to be a doctor when it isn&apos;t one.
            </p>
            <Link
              href="/sexed/ask"
              className="mt-3 inline-block rounded-lg bg-neon-mint px-3 py-1.5 text-sm font-medium text-ink-900 hover:bg-neon-mint/90"
            >
              💬 Ask anonymously →
            </Link>
          </div>
        </div>

        <aside className="space-y-4">
          <Link
            href="/sexed"
            className="surface-glass block p-3 text-[12px] text-white/75 transition hover:bg-white/10"
          >
            ← Back to library
          </Link>
          <CrisisHelplineCard helplines={helplines.slice(0, 5)} compact />
        </aside>
      </article>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-3 py-6 md:py-8">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/sexed" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <Link
          href="/sexed"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
        >
          ← Library
        </Link>
      </header>
      {children}
    </main>
  );
}
