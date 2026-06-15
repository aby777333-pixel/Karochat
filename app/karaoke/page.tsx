import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { SignOutButton } from "@/components/SignOutButton";
import { AdRails } from "@/components/AdRails";
import { KaraokeHub } from "./KaraokeHub";

export const dynamic = "force-dynamic";

export default async function KaraokePage() {
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

  return (
    <AdRails>
      <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-1 py-5 md:py-7">
        <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/rooms" className="flex items-center gap-2">
            <Logo className="h-6 w-6" />
            <Wordmark className="text-lg" />
          </Link>
          <nav className="flex shrink-0 items-center gap-1.5 text-xs md:gap-2">
            <Link
              href="/rooms"
              className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
            >
              ← <span className="hidden md:inline">Rooms</span>
            </Link>
            <SignOutButton />
          </nav>
        </header>

        <div className="mt-5">
          <KaraokeHub
            userId={profile.id}
            userName={profile.display_name || profile.username}
          />
        </div>
      </main>
    </AdRails>
  );
}
