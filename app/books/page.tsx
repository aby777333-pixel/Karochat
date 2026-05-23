// Karochat — /books (v9 Phase 1 placeholder)
//
// Phase 1 (foundations) ships the schema for the books library + the IA
// shell tab. The actual upload flow + reader + Karo features land in
// Phase 2 — see memory/project_v9_plan.md for the build order.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { AccountMenu } from "@/components/AccountMenu";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Books · Karochat",
  description:
    "User-contributable global library — public-domain + Creative Commons + author-uploaded works, read in-app or downloaded."
};

export default async function BooksPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/books");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, privacy_mode")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-3 py-6 md:py-8">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/rooms" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <div className="flex items-center gap-2 text-xs md:gap-3">
          <Link
            href="/rooms"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
          >
            ← Rooms
          </Link>
          <Link
            href="/students"
            className="rounded-lg border border-neon-mint/40 bg-neon-mint/10 px-3 py-1.5 text-neon-mint hover:bg-neon-mint/20"
          >
            🎓 Students
          </Link>
          <AccountMenu
            username={profile.username as string}
            displayName={profile.display_name as string | null}
            avatarUrl={profile.avatar_url as string | null}
            initialPrivacyMode={
              (profile.privacy_mode as
                | "open"
                | "friends_only"
                | "invisible"
                | "decoy"
                | "stealth") ?? "open"
            }
          />
        </div>
      </header>

      <section className="surface-glass mt-6 rounded-3xl border border-neon-blue/25 bg-gradient-to-br from-neon-blue/10 via-transparent to-neon-mint/5 p-7 sm:p-10">
        <p className="text-[10px] uppercase tracking-widest text-neon-blue/80">
          📚 Books · v9 · Coming in Phase 2
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-white sm:text-4xl">
          A global library, contributed by readers.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">
          The Karochat Books library will hold public-domain works,
          Creative Commons titles, and books uploaded by their authors —
          read in-app via a pop-up reader, translated by Karo into 60+
          languages, explained paragraph-by-paragraph, and read aloud as
          an audiobook. Book Clubs hook into Study Squads automatically.
        </p>
        <p className="mt-3 max-w-2xl text-[12px] text-white/45">
          Foundation schema is live (Phase 1, migration 0042). Phase 2
          adds the upload flow with the license-declaration gate,
          perceptual-hash deduplication against takedown lists, the
          pop-up PDF/EPUB reader, and the DMCA reporting path.
        </p>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <FeatureTile
          icon="📖"
          title="Pop-up reader"
          body="PDF + EPUB in a modal. Dark / sepia / light. Bookmarks sync across devices."
        />
        <FeatureTile
          icon="🌐"
          title="Karo translate"
          body="Tap any paragraph — Karo translates into your preferred language in 60+ tongues."
        />
        <FeatureTile
          icon="🧠"
          title="Explain to me"
          body="Tap a paragraph — Karo explains in plain language at your level."
        />
        <FeatureTile
          icon="🔊"
          title="Audiobook mode"
          body="Karo reads it to you. Works in voice rooms — study squads can listen together."
        />
        <FeatureTile
          icon="✍️"
          title="Highlights + notes"
          body="Saved highlights flow into your Karochat Notes (from v8)."
        />
        <FeatureTile
          icon="📚"
          title="Book clubs"
          body="A Book Club is a Study Squad wrapped around one book — chapter discussion rooms auto-spawn."
        />
      </section>

      <section className="surface-glass mt-6 rounded-2xl border border-neon-amber/25 bg-neon-amber/5 p-5">
        <p className="text-[10px] uppercase tracking-widest text-neon-amber/80">
          📜 Why we won&apos;t be a piracy lounge
        </p>
        <p className="mt-2 text-sm leading-relaxed text-white/80">
          Every book upload requires a license declaration: public
          domain, Creative Commons, your own writing, author permission,
          or a fair-use claim. We hash-deduplicate against known takedown
          lists and respond to DMCA notices within 24 hours. Three valid
          claims against the same uploader = permanent upload ban.
        </p>
        <p className="mt-2 text-[11px] text-white/55">
          The bet is that authors bring readers; Karochat takes 0% on
          author book sales — we link out to your store, you keep all of
          it.
        </p>
      </section>

      <footer className="mt-10 text-center text-[11px] text-white/30">
        Phase 1 placeholder · the real library lands in Phase 2.
      </footer>
    </main>
  );
}

function FeatureTile({
  icon,
  title,
  body
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="surface-glass rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-2xl">{icon}</p>
      <p className="mt-1 font-display text-sm font-semibold text-white">
        {title}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-white/65">{body}</p>
    </div>
  );
}
