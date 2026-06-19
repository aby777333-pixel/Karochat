import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { AdRails } from "@/components/AdRails";
import { FeedClient, type FeedPost } from "./FeedClient";

export const dynamic = "force-dynamic";

const PAGE = 20;

export default async function FeedPage() {
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

  const { data: posts } = await supabase.rpc("list_feed", {
    p_scope: "following",
    p_limit: PAGE,
    p_offset: 0
  });

  return (
    <AdRails>
      <main className="mx-auto flex min-h-[100dvh] max-w-xl flex-col px-1 py-5 md:py-7">
        <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/rooms" className="flex items-center gap-2">
            <Logo className="h-6 w-6" />
            <Wordmark className="text-lg" />
          </Link>
          <Link
            href="/rooms"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
          >
            ← Back
          </Link>
        </header>

        <section className="surface-glass mt-5 px-3 pt-4">
          <h1 className="px-1 font-display text-xl font-semibold">
            <span aria-hidden className="mr-1.5">📷</span>Posts
          </h1>
          <p className="mb-3 mt-1 px-1 text-sm text-white/55">
            Share photos &amp; carousels. Follow people to fill your feed.
          </p>
          <FeedClient
            currentUserId={user.id}
            initialPosts={(posts ?? []) as FeedPost[]}
            pageSize={PAGE}
          />
        </section>
      </main>
    </AdRails>
  );
}
