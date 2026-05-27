// Karochat — /write/[id]/edit — edit an existing publication.
//
// Owner-only. The publications RLS already enforces this; we additionally
// 404 if the row doesn't belong to the caller for a cleaner UX than a
// blank page.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { Editor, type EditorInitial } from "../../_components/Editor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit · Karochat",
  description: "Edit your publication."
};

type Category = {
  slug: string;
  label: string;
  icon: string | null;
  is_adult: boolean;
};

export default async function EditPublicationPage({
  params
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?redirect=/write/${params.id}/edit`);
  if ((user as any).is_anonymous) redirect("/signup?reason=write");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");

  const { data: row } = await supabase
    .from("publications")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!row || (row as any).author_profile_id !== user.id) notFound();

  const { data: catsResp } = await supabase
    .from("publication_categories")
    .select("slug,label,icon,is_adult")
    .eq("active", true)
    .order("position", { ascending: true });

  const initial: EditorInitial = {
    id: (row as any).id,
    slug: (row as any).slug,
    title: (row as any).title ?? "",
    subtitle: (row as any).subtitle ?? "",
    pen_name: (row as any).pen_name ?? "",
    category_slug: (row as any).category_slug ?? null,
    is_adult: !!(row as any).is_adult,
    cover_image_url: (row as any).cover_image_url ?? null,
    body_markdown: (row as any).body_markdown ?? "",
    status: ((row as any).status ?? "draft") as EditorInitial["status"],
    tags: ((row as any).tags ?? []) as string[]
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-3 py-6 md:py-8">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/write" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <div className="flex items-center gap-2 text-xs">
          {initial.status === "published" && initial.slug && (
            <Link
              href={`/read/${initial.slug}`}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
            >
              🔗 View public
            </Link>
          )}
          <Link
            href="/write"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <section className="mt-6">
        <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
          ✍ Edit · {initial.status === "published" ? "Published" : "Draft"}
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white">
          {initial.title || "Untitled draft"}
        </h1>
      </section>

      <section className="mt-5">
        <Editor
          initial={initial}
          categories={(catsResp ?? []) as Category[]}
          userId={user.id}
        />
      </section>
    </main>
  );
}
