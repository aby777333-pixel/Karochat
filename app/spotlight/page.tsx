import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { AdRails } from "@/components/AdRails";
import { SpotlightFeed, type SpotItem } from "./SpotlightFeed";

export const dynamic = "force-dynamic";

const PAGE = 20;

export default async function SpotlightPage() {
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

  const { data: items } = await supabase.rpc("list_spotlight", {
    p_limit: PAGE,
    p_offset: 0
  });

  return (
    <AdRails>
      <main className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-1 py-5 md:py-7">
        <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/rooms" className="flex items-center gap-2">
            <Logo className="h-6 w-6" />
            <Wordmark className="text-lg" />
          </Link>
          <nav className="flex shrink-0 items-center gap-1.5 text-xs">
            <Link
              href="/shorts"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
            >
              🎬<span className="hidden md:inline"> Shorts</span>
            </Link>
            <Link
              href="/shorts/new"
              className="rounded-lg bg-neon-blue px-3 py-1.5 font-medium text-ink-900 shadow-glow-blue hover:bg-neon-blue/90"
            >
              + <span className="hidden md:inline">Post</span>
            </Link>
          </nav>
        </header>

        <section className="surface-glass mt-5 px-4 pt-4">
          <h1 className="font-display text-xl font-semibold">
            <span aria-hidden className="mr-1.5">✨</span>Spotlight
          </h1>
          <p className="mb-3 mt-1 text-sm text-white/55">
            The shorts everyone’s watching — ranked by what people are liking,
            commenting on, and watching right now.
          </p>
          <SpotlightFeed
            currentUserId={user.id}
            initialItems={(items ?? []) as SpotItem[]}
            pageSize={PAGE}
          />
        </section>
      </main>
    </AdRails>
  );
}
