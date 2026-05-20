import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { AdRails } from "@/components/AdRails";
import { ShortUpload } from "./ShortUpload";

export const dynamic = "force-dynamic";

export default async function NewShortPage() {
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
      <main className="mx-auto flex min-h-[100dvh] max-w-xl flex-col px-1 py-5 md:py-7">
        <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/rooms" className="flex items-center gap-2">
            <Logo className="h-6 w-6" />
            <Wordmark className="text-lg" />
          </Link>
          <Link
            href="/shorts"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
          >
            ← Back to feed
          </Link>
        </header>

        <section className="surface-glass mt-5 p-5">
          <h1 className="font-display text-xl font-semibold">Post a short</h1>
          <p className="mt-1 text-sm text-white/55">
            Vertical video works best. Max 50 MB. MP4, WebM, MOV.
          </p>
          <div className="mt-4">
            <ShortUpload currentUserId={user.id} />
          </div>
        </section>
      </main>
    </AdRails>
  );
}
