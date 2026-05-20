import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { HandshakeClient } from "./HandshakeClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Handshake · Karochat",
  description:
    "Bump phones (or scan codes) to instantly become DM-buddies on Karochat."
};

export default async function HandshakePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/handshake");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-5 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-7 w-7" />
          <Wordmark className="text-lg" />
        </Link>
        <Link
          href="/rooms"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
        >
          ← Rooms
        </Link>
      </header>

      <section className="surface-glass tint-mint mt-8 p-7 sm:p-9">
        <p className="text-[10px] uppercase tracking-widest text-neon-mint/70">
          🤝 Karochat handshake
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-white">
          Bump to befriend
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          Tap <span className="font-semibold text-white">Issue a code</span>{" "}
          and let someone nearby scan or claim it. Or shake your phone to
          broadcast a friendly &ldquo;ready&rdquo; pulse. A DM opens the
          instant both sides connect.
        </p>
      </section>

      <HandshakeClient />

      <footer className="mt-8 text-center text-[11px] text-white/30">
        Be kind. Be real. Live and let live.
      </footer>
    </main>
  );
}
