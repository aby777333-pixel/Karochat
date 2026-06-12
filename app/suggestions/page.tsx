// Karochat — /suggestions.
//
// Community suggestion wall: anyone can propose ways to make Karochat
// better, friendlier, more united. Server renders the shell + first
// page of suggestions; SuggestionsBoard handles composing, hearting,
// and (for the operator) status changes.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { SuggestionsBoard, type Suggestion } from "./SuggestionsBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Suggestions · Karochat",
  description:
    "Tell us how to make Karochat better, friendlier, and more united. Make love, not war."
};

export default async function SuggestionsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/suggestions");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, is_guest, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");

  const { data: initial } = await supabase.rpc("list_suggestions", {
    p_limit: 100
  });

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-3 py-6 md:py-8">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/rooms" className="flex min-w-0 items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <Link
          href="/rooms"
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
        >
          ← Rooms
        </Link>
      </header>

      <section className="mt-6">
        <p className="text-[10px] uppercase tracking-widest text-neon-amber/80">
          💡 Suggestions
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white">
          Help us make Karochat better
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          This place belongs to everyone in it. If something would make it
          friendlier, kinder, funnier, or bring people a little closer
          together — say it here. Big ideas, small ideas, half ideas:
          all welcome.
        </p>
      </section>

      <section className="surface-glass tint-amber mt-5 p-4">
        <p className="text-[10px] uppercase tracking-widest text-neon-amber/80">
          🕊 Our motto: make love, not war
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-white/80">
          Let&apos;s care, share, joke around, and make each other happy —
          life is short and we&apos;re all just passing through. One day the
          last person who ever said our name will be gone too. Until then,
          let&apos;s make this a place worth remembering each other by.
        </p>
      </section>

      <div className="mt-5">
        <SuggestionsBoard
          initial={(initial ?? []) as Suggestion[]}
          isGuest={profile.is_guest === true}
          isAdmin={profile.is_admin === true}
        />
      </div>

      <footer className="mt-10 text-center text-[11px] text-white/30">
        Suggestions are public to the community. Up to 5 per day each —
        quality over quantity. 💛
      </footer>
    </main>
  );
}
