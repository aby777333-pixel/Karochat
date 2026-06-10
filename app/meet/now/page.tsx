import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { MeetNowClient } from "./MeetNowClient";
import { RadarClient } from "./RadarClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meet now · Karochat",
  description:
    "5-minute random one-on-one chat with anyone else who's also looking right now."
};

export default async function MeetNowPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/meet/now");

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

      <section className="surface-glass tint-amber mt-8 p-7 sm:p-9">
        <p className="text-[10px] uppercase tracking-widest text-neon-amber/70">
          ⚡ Meet someone now
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-white">
          Scan for people around you.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          Travelling, new in town, or just curious who&apos;s nearby? Press the
          scanner — anyone else on the radar within range gets a ping, and you
          can wave, message, or jump on a voice/video call. Or take the
          5-minute random match below.
        </p>
      </section>

      {/* Location radar / scanner — the headline Meet-now feature. */}
      <RadarClient currentUserId={user.id} />

      <div className="my-8 flex items-center gap-3 text-[11px] uppercase tracking-widest text-white/30">
        <span className="h-px flex-1 bg-white/10" />
        or — 5-minute random
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <div className="px-1">
        <h2 className="font-display text-xl font-semibold text-white">
          5 minutes. One stranger.
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-white/70">
          We&apos;ll match you with one other person who&apos;s also looking
          right now. The chat self-destructs after 5 minutes unless you both
          decide to keep going.
        </p>
      </div>

      <MeetNowClient />

      <footer className="mt-8 text-center text-[11px] text-white/30">
        Be kind. Be real. Strangers are just friends you haven&apos;t met.
      </footer>
    </main>
  );
}
