import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { SignOutButton } from "@/components/SignOutButton";
import { AdRails } from "@/components/AdRails";
import { ShortsFeed, type ShortRow } from "./ShortsFeed";

export const dynamic = "force-dynamic";

export default async function ShortsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, terms_accepted_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");
  if (!profile.terms_accepted_at) redirect("/terms");

  const { data: rawShorts } = await supabase
    .from("shorts_with_author")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const shorts = (rawShorts ?? []) as ShortRow[];

  // Likes I've made — surface so the heart button starts in the right state.
  const myLikedIds = new Set<string>();
  if (shorts.length > 0) {
    const { data: liked } = await supabase
      .from("short_likes")
      .select("short_id")
      .eq("user_id", user.id)
      .in("short_id", shorts.map((s) => s.id));
    for (const row of liked ?? []) myLikedIds.add(row.short_id as string);
  }

  return (
    <AdRails>
      <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-1 py-5 md:py-7">
        <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/rooms" className="flex items-center gap-2">
            <Logo className="h-6 w-6" />
            <Wordmark className="text-lg" />
          </Link>
          <nav className="scroll-thin flex shrink-0 items-center gap-1.5 overflow-x-auto text-xs md:gap-2">
            <Link
              href="/rooms"
              className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
            >
              ← <span className="hidden md:inline">Rooms</span>
            </Link>
            <Link
              href="/shorts"
              className="shrink-0 rounded-lg border border-neon-blue/40 bg-neon-blue/10 px-3 py-1.5 text-neon-blue"
            >
              🎬<span className="hidden md:inline"> Shorts</span>
            </Link>
            <Link
              href="/shorts/new"
              className="shrink-0 rounded-lg bg-neon-blue px-3 py-1.5 font-medium text-ink-900 shadow-glow-blue hover:bg-neon-blue/90"
            >
              + <span className="hidden md:inline">Post</span>
            </Link>
            <SignOutButton />
          </nav>
        </header>

        <ShortsFeed
          currentUserId={user.id}
          initialShorts={shorts}
          initiallyLiked={Array.from(myLikedIds)}
        />
      </main>
    </AdRails>
  );
}
