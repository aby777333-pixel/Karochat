import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { AdRails } from "@/components/AdRails";
import { MapClient, type MapPin, type MyPin } from "./MapClient";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, terms_accepted_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");
  if (!profile.terms_accepted_at) redirect("/terms");

  const [{ data: pins }, { data: myPin }] = await Promise.all([
    supabase.rpc("list_map_pins"),
    supabase
      .from("karochat_map_pins")
      .select("visibility, precision_m, expires_at")
      .eq("profile_id", user.id)
      .maybeSingle()
  ]);

  return (
    <AdRails>
      <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-1 py-5 md:py-7">
        <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/rooms" className="flex items-center gap-2">
            <Logo className="h-6 w-6" />
            <Wordmark className="text-lg" />
          </Link>
          <Link
            href="/rooms"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
          >
            ← Back
          </Link>
        </header>

        <section className="surface-glass mt-5 p-5">
          <h1 className="font-display text-xl font-semibold">
            <span aria-hidden className="mr-1.5">🗺️</span>Karochat Map
          </h1>
          <p className="mt-1 text-sm text-white/55">
            See friends who choose to share where they are. You’re a 👻 ghost by
            default — nothing shows until you turn sharing on, and your spot is
            always blurred to the precision you pick.
          </p>
          <div className="mt-4">
            <MapClient
              currentUserId={user.id}
              initialPins={(pins ?? []) as MapPin[]}
              myPin={(myPin ?? null) as MyPin | null}
            />
          </div>
        </section>
      </main>
    </AdRails>
  );
}
