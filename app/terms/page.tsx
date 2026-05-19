import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { AcceptTermsForm } from "./AcceptTermsForm";

export const dynamic = "force-dynamic";

export default async function TermsGatePage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, terms_accepted_at, terms_version, is_guest")
    .eq("id", user.id)
    .maybeSingle();

  // Anonymous users get an auto-profile via trigger. Email users go through onboarding first.
  if (!profile?.username) redirect("/onboarding");
  if (profile.terms_accepted_at) redirect("/rooms");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 py-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <Wordmark />
        </Link>
        <p className="text-xs text-white/40">
          Signed in as <span className="text-white">{profile.display_name}</span>
          {profile.is_guest && <span className="ml-1 text-white/40">(guest)</span>}
        </p>
      </header>

      <section className="surface-glass mt-10 p-7">
        <h1 className="font-display text-2xl font-semibold">Before you enter</h1>
        <p className="mt-2 text-sm text-white/70">
          Karochat is a free, global place for people to find their people.
          Please take a minute to read what we ask of you and what we promise
          in return.
        </p>

        <ul className="mt-5 space-y-3 text-sm">
          <li className="rounded-xl border border-white/10 bg-white/5 p-4">
            <Link href="/legal/community" target="_blank" className="font-medium text-white hover:underline">
              Community Guidelines →
            </Link>
            <p className="mt-1 text-white/60">
              Be kind. Be real. Respect consent. Identity-affirming rooms
              (LGBTQIA+, regional, college, profession, neighbourhood) are
              welcome and first-class. Hate speech, threats, CSAM, doxxing, and
              non-consensual imagery are not.
            </p>
          </li>
          <li className="rounded-xl border border-white/10 bg-white/5 p-4">
            <Link href="/legal/terms" target="_blank" className="font-medium text-white hover:underline">
              Terms of Use →
            </Link>
            <p className="mt-1 text-white/60">
              You keep ownership of what you post. We host it so others in your
              rooms can read it. The Service is provided as-is, free of charge.
            </p>
          </li>
          <li className="rounded-xl border border-white/10 bg-white/5 p-4">
            <Link href="/legal/privacy" target="_blank" className="font-medium text-white hover:underline">
              Privacy Notice →
            </Link>
            <p className="mt-1 text-white/60">
              We collect what we need to run the Service — and nothing more. We
              don&rsquo;t sell your data. Messages in public rooms are visible
              to room members; messages in private rooms are visible only to
              people you&rsquo;ve invited.
            </p>
          </li>
        </ul>

        <AcceptTermsForm />
      </section>

      <footer className="mt-8 text-center text-[11px] text-white/30">
        You can review or revoke these at any time from settings.
      </footer>
    </main>
  );
}
