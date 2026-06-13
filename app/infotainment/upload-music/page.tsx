import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { MusicUpload } from "./MusicUpload";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Upload music · Karochat",
  description: "Upload your own music to KaroChat Infotainment."
};

export default async function UploadMusicPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/infotainment/upload-music");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col px-4 py-6 sm:py-8">
      <header className="flex items-center justify-between gap-2">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Logo className="h-9 w-9" />
          <Wordmark className="text-lg" />
        </Link>
        <Link
          href="/infotainment"
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
        >
          ← Infotainment
        </Link>
      </header>

      <section className="surface-glass tint-mint mt-6 p-5 sm:p-6">
        <h1 className="font-display text-2xl font-semibold text-white">
          🎵 Upload your music
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-white/70">
          Share your own tracks with KaroChat. MP3, WAV, M4A, OGG or FLAC, up to
          40&nbsp;MB. You keep the rights to everything you upload.
        </p>

        <div className="mt-5">
          <MusicUpload
            currentUserId={user.id}
            defaultArtist={(profile.display_name as string) ?? (profile.username as string)}
          />
        </div>
      </section>
    </main>
  );
}
