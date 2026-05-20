import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { VerificationGate } from "./VerificationGate";
import { StudentsHome } from "./StudentsHome";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Students Network · Karochat",
  description:
    "Verified-students learning network — Help Beacons, study squads, office hours, notes."
};

export default async function StudentsPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/students");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, terms_accepted_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");
  if (!profile.terms_accepted_at) redirect("/terms");

  // Check verification
  const { data: verif } = await supabase.rpc("get_my_verification");
  const v = Array.isArray(verif) ? verif[0] : null;
  const isVerified = v?.status === "verified";

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-3 py-6 md:py-8">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/rooms" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/rooms"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
          >
            ← Rooms
          </Link>
        </div>
      </header>

      <section className="mt-6 rounded-3xl border border-neon-mint/25 bg-gradient-to-br from-neon-mint/10 via-transparent to-neon-blue/5 p-6 sm:p-9">
        <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
          🎓 Students Network · v8
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-white sm:text-4xl">
          Where students help students.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">
          16+ verified network for real-time peer learning. Fire a 🆘 Help
          Beacon when you&apos;re stuck — Karo routes it to people who can
          actually answer. Study with squads. Take notes that come back as
          flashcards. Sit in on a professor&apos;s office hours.
        </p>
      </section>

      {isVerified ? (
        <StudentsHome
          currentUserId={profile.id}
          verification={v}
        />
      ) : (
        <VerificationGate
          existing={v}
          currentUserId={profile.id}
        />
      )}

      <footer className="mt-10 space-y-1 text-center text-[11px] text-white/30">
        <p>
          Be kind. Be real.{" "}
          <Link href="/charter" className="hover:text-white">
            The People&apos;s Charter
          </Link>{" "}
          applies here too — and helpers never ask for anything outside the
          session.
        </p>
      </footer>
    </main>
  );
}
