import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { InfotainmentClient, type InfoRoom } from "./InfotainmentClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Infotainment · Karochat",
  description:
    "Free movies & music, karaoke, podcasts, radio, watch parties — go live and broadcast to KaroChat."
};

export default async function InfotainmentPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/infotainment");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");

  // Pull every Infotainment room (cheap — capped) so the hub can group them
  // by section. Reuses the existing catalog RPC; RLS keeps it safe.
  const { data: roomsRaw } = await supabase.rpc("browse_catalog", {
    p_category_slug: "infotainment",
    p_subcategory_slug: null,
    p_limit: 400
  });
  const rooms = ((roomsRaw ?? []) as InfoRoom[]).map((r) => ({
    id: r.id,
    name: r.name,
    topic: r.topic,
    subcategory_slug: r.subcategory_slug,
    visibility: r.visibility,
    voice_enabled: r.voice_enabled,
    cam_enabled: r.cam_enabled,
    member_count: r.member_count
  }));

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-3 py-5 sm:px-5 sm:py-8">
      <header className="flex items-center justify-between gap-2">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Logo className="h-9 w-9" />
          <Wordmark className="text-lg" />
        </Link>
        <Link
          href="/rooms"
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
        >
          ← Rooms
        </Link>
      </header>

      <InfotainmentClient rooms={rooms} username={profile.username as string} />
    </main>
  );
}
