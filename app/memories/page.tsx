import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { AdRails } from "@/components/AdRails";
import { MemoriesGallery, type MemoryRow } from "./MemoriesGallery";

export const dynamic = "force-dynamic";

export default async function MemoriesPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, terms_accepted_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");
  if (!profile.terms_accepted_at) redirect("/terms");

  // Author-reads-own RLS exposes every past story (expired included); no cron
  // deletes them, so this is the full personal archive.
  const { data: memories } = await supabase
    .from("stories_with_author")
    .select(
      "id, kind, body, image_url, media_url, poster_url, audience_kind, expires_at, created_at, view_count"
    )
    .eq("author_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <AdRails>
      <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-1 py-5 md:py-7">
        <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/rooms" className="flex items-center gap-2">
            <Logo className="h-6 w-6" />
            <Wordmark className="text-lg" />
          </Link>
          <Link
            href="/stories/new"
            className="rounded-lg border border-neon-blue/40 bg-neon-blue/10 px-3 py-1.5 text-xs text-neon-blue hover:bg-neon-blue/20"
          >
            ＋ New moment
          </Link>
        </header>

        <section className="surface-glass mt-5 p-5">
          <h1 className="font-display text-xl font-semibold">
            <span aria-hidden className="mr-1.5">🗂️</span>Memories
          </h1>
          <p className="mt-1 text-sm text-white/55">
            Every moment you’ve ever posted, kept just for you after it expires.
            Re-share any of them as a fresh 24-hour story.
          </p>
          <div className="mt-4">
            <MemoriesGallery initialMemories={(memories ?? []) as MemoryRow[]} />
          </div>
        </section>
      </main>
    </AdRails>
  );
}
