import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { AdRails } from "@/components/AdRails";
import { StreaksClient, type StreakRow } from "./StreaksClient";

export const dynamic = "force-dynamic";

export default async function StreaksPage() {
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

  const { data: streaks } = await supabase.rpc("list_my_streaks");

  return (
    <AdRails>
      <main className="mx-auto flex min-h-[100dvh] max-w-xl flex-col px-1 py-5 md:py-7">
        <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/rooms" className="flex items-center gap-2">
            <Logo className="h-6 w-6" />
            <Wordmark className="text-lg" />
          </Link>
          <Link
            href="/snaps"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
          >
            📸 Snaps
          </Link>
        </header>

        <section className="surface-glass mt-5 p-5">
          <h1 className="font-display text-xl font-semibold">
            <span aria-hidden className="mr-1.5">🔥</span>Streaks
          </h1>
          <p className="mt-1 text-sm text-white/55">
            Snap a friend back and forth every day to build a streak. Miss a day
            and it’s gone — unless you use your one Streak Mercy to bring it
            back.
          </p>
          <div className="mt-4">
            <StreaksClient initialStreaks={(streaks ?? []) as StreakRow[]} />
          </div>
        </section>
      </main>
    </AdRails>
  );
}
