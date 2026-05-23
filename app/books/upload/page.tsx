// Karochat — /books/upload (v9 Phase 2)
//
// Server wrapper that gates on auth + onboarding, then hands off to the
// client UploadFlow. The flow does the actual file upload, hash dedup,
// license declaration, and register_book_upload RPC call.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { UploadFlow } from "./UploadFlow";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Upload a book · Karochat",
  description: "Add a book to the Karochat library — public-domain, Creative Commons, or your own writing.",
  robots: { index: false, follow: false }
};

export default async function UploadBookPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/books/upload");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, terms_accepted_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");
  if (!profile.terms_accepted_at) redirect("/terms");

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-4xl flex-col px-3 py-6 md:py-8">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/books" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <Link
          href="/books"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
        >
          ← Library
        </Link>
      </header>

      <section className="mt-6">
        <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
          📚 Upload a book
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white">
          Add a title to the library.
        </h1>
        <p className="mt-2 text-sm text-white/70">
          PDFs, EPUBs, or MOBI files up to 100 MB. The license declaration
          is binding — false declarations result in immediate removal and
          can lead to permanent upload bans.
        </p>
      </section>

      <UploadFlow currentUserId={user.id} />

      <footer className="mt-10 text-center text-[11px] text-white/30">
        Karochat takes 0% on author book sales — we link out, you keep all of it.
      </footer>
    </main>
  );
}
