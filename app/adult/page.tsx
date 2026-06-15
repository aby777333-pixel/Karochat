import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { SignOutButton } from "@/components/SignOutButton";
import { AdRails } from "@/components/AdRails";
import { BirthYearCard, AdultAttestCard } from "@/app/sexed/_components/AgeGate";
import { AdultHub } from "./AdultHub";

export const dynamic = "force-dynamic";

export default async function AdultPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, terms_accepted_at, birth_year, adult_attested_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");
  if (!profile.terms_accepted_at) redirect("/terms");

  const currentYear = new Date().getFullYear();
  const birthYear = (profile as { birth_year: number | null }).birth_year ?? null;
  const attestedAt = (profile as { adult_attested_at: string | null }).adult_attested_at ?? null;
  const hasYear = !!birthYear;
  const is18 = hasYear && currentYear - (birthYear as number) >= 18;
  const attested = !!attestedAt;

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
          {!hasYear ? (
            <section className="surface-glass p-5">
              <h1 className="font-display text-xl font-semibold">🔞 Adult — 18+</h1>
              <p className="mt-1 text-sm text-white/60">
                This is an 18+ only area. Tell us your birth year to continue.
              </p>
              <BirthYearCard currentYear={currentYear} />
            </section>
          ) : !is18 ? (
            <section className="surface-glass p-5">
              <h1 className="font-display text-xl font-semibold">🔞 Adults only</h1>
              <p className="mt-2 text-sm text-white/70">
                This section is restricted to people aged 18 and over, so it isn&apos;t
                available on your account. The rest of Karochat is open to you.
              </p>
              <Link
                href="/rooms"
                className="mt-4 inline-block rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85 hover:bg-white/10"
              >
                ← Back to Karochat
              </Link>
            </section>
          ) : !attested ? (
            <section className="surface-glass p-5">
              <h1 className="font-display text-xl font-semibold">🔞 Adult — 18+</h1>
              <p className="mt-1 text-sm text-white/60">
                Confirm you&apos;re an adult and want to see adult content to unlock this
                area.
              </p>
              <AdultAttestCard />
            </section>
          ) : (
            <AdultHub
              userId={profile.id}
              userName={profile.display_name || profile.username}
            />
          )}
        </div>
      </main>
    </AdRails>
  );
}
