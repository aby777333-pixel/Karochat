import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo, SLOGAN, Wordmark } from "@/components/Brand";
import { LoginForm } from "./LoginForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, terms_accepted_at")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.username) redirect("/onboarding");
    if (!profile.terms_accepted_at) redirect("/terms");
    redirect("/rooms");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
      <header className="flex items-center">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <Wordmark />
        </Link>
      </header>

      <section className="mt-16 grid flex-1 grid-cols-1 items-center gap-10 md:mt-24 md:grid-cols-2">
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-widest text-white/60">
            <span className="h-1.5 w-1.5 rounded-full bg-neon-blue shadow-glow-blue" />
            Realtime · cross-platform · made for people
          </p>
          <h1 className="text-balance font-display text-5xl font-semibold leading-tight tracking-tight md:text-6xl">
            The internet felt personal once.
            <span className="block bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent">
              Karochat brings it back.
            </span>
          </h1>
          <p className="max-w-xl text-balance text-base text-white/70 md:text-lg">
            {SLOGAN}
          </p>
          <ul className="grid grid-cols-2 gap-3 text-sm text-white/70 md:max-w-md">
            <li className="surface-glass px-3 py-2">Live presence</li>
            <li className="surface-glass px-3 py-2">Nudges &amp; status</li>
            <li className="surface-glass px-3 py-2">Voice, video, AI</li>
            <li className="surface-glass px-3 py-2">Web · desktop · mobile</li>
          </ul>
        </div>

        <div className="surface-glass mx-auto w-full max-w-md p-6 md:p-7">
          <h2 className="font-display text-2xl font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-white/60">
            Enter your email &amp; phone for instant full access — no password, no
            verification. Or continue as a guest.
          </p>
          <div className="mt-5">
            <LoginForm />
          </div>
        </div>
      </section>

      <footer className="mt-16 space-y-1 text-xs text-white/40">
        <p>© {new Date().getFullYear()} Karochat · Be kind. Be real.</p>
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <a href="mailto:info@karochat.co" className="hover:text-white">
            info@karochat.co
          </a>
          <span aria-hidden>·</span>
          <a
            href="mailto:ads@karochat.co?subject=Advertise%20on%20Karochat"
            className="hover:text-white"
            title="Sponsor a room or place a creative in our rails"
          >
            📣 Advertise
          </a>
        </p>
      </footer>
    </main>
  );
}
