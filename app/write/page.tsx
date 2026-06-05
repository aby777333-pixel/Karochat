// Karochat — /write — author dashboard.
//
// Requires an email-registered (non-anonymous) session. Anonymous guests
// and signed-out visitors are redirected.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your writing · Karochat",
  description: "Drafts, published pieces, and analytics for your work."
};

type MyPublication = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published" | "hidden";
  category_slug: string | null;
  is_adult: boolean;
  view_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export default async function WriteDashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/write");

  // Anonymous guests can't publish. Send them to the sign-up flow.
  if ((user as any).is_anonymous) {
    redirect("/signup?reason=write");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");

  const { data, error } = await supabase.rpc("my_publications");
  const items = (data ?? []) as MyPublication[];

  const drafts = items.filter((p) => p.status === "draft");
  const published = items.filter((p) => p.status === "published");

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-3 py-6 md:py-8">
      <header className="surface-glass flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/rooms" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs sm:justify-end md:gap-3">
          <Link
            href="/read"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
          >
            📚 Read
          </Link>
          <Link
            href="/rooms"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
          >
            ← Rooms
          </Link>
        </div>
      </header>

      <section className="surface-glass mt-6 rounded-3xl border border-neon-mint/25 bg-gradient-to-br from-neon-mint/10 via-transparent to-neon-blue/5 p-6 sm:p-9">
        <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
          ✍ Your writing
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-white sm:text-4xl">
          Welcome back, {profile.display_name || `@${profile.username}`}.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">
          Drafts auto-save while you work. Publish when you&apos;re ready —
          you can always unpublish or edit later. Use a pen name for any
          piece you want to share pseudonymously.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/write/new"
            className="rounded-lg bg-neon-mint px-4 py-2 text-sm font-medium text-ink-900 hover:bg-neon-mint/90"
          >
            ＋ New piece
          </Link>
          <Link
            href="/read"
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            📚 Browse library
          </Link>
        </div>
      </section>

      {error && (
        <p className="mt-4 rounded-xl border border-neon-red/30 bg-neon-red/10 p-4 text-sm text-neon-red">
          {error.message}
        </p>
      )}

      <section className="mt-6 space-y-6">
        <PieceList
          title="Drafts"
          emoji="📝"
          empty="No drafts. Click ＋ New piece to start one."
          items={drafts}
          hrefBase="/write"
          showStatus={false}
        />
        <PieceList
          title="Published"
          emoji="🌍"
          empty="Nothing published yet. Publish a draft and it appears here."
          items={published}
          hrefBase="/read"
          showStatus
        />
      </section>
    </main>
  );
}

function PieceList({
  title,
  emoji,
  empty,
  items,
  hrefBase,
  showStatus
}: {
  title: string;
  emoji: string;
  empty: string;
  items: MyPublication[];
  hrefBase: string;
  showStatus: boolean;
}) {
  return (
    <section>
      <p className="text-[10px] uppercase tracking-widest text-white/45">
        {emoji} {title} · {items.length}
      </p>
      {items.length === 0 ? (
        <div className="surface-glass mt-2 p-6 text-center text-sm text-white/55">
          {empty}
        </div>
      ) : (
        <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((p) => (
            <li key={p.id} className="surface-glass p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-display text-[15px] font-semibold text-white line-clamp-2">
                  {p.title}
                </p>
                {p.is_adult && (
                  <span className="rounded-sm border border-neon-red/40 bg-neon-red/10 px-1 text-[10px] uppercase tracking-widest text-neon-red">
                    18+
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-white/45">
                {p.category_slug ? `${p.category_slug} · ` : ""}
                {showStatus && p.view_count > 0 ? `${p.view_count} reads · ` : ""}
                updated {new Date(p.updated_at).toLocaleDateString()}
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/write/${p.id}/edit`}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[12px] text-white/80 hover:bg-white/10"
                >
                  ✍ Edit
                </Link>
                {p.status === "published" && (
                  <Link
                    href={`${hrefBase}/${p.slug}`}
                    className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[12px] text-white/80 hover:bg-white/10"
                  >
                    🔗 View
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
