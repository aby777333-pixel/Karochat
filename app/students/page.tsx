import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { StudentsHome } from "./StudentsHome";
import { VerificationGate } from "./VerificationGate";
import { AdRails } from "@/components/AdRails";
import { AccountMenu } from "@/components/AccountMenu";
import type { Category, Subcategory } from "@/app/rooms/CategoryBrowser";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Students Network · Karochat",
  description:
    "Verified-students learning network — Help Beacons, study squads, office hours, notes, age-band lobbies, and student rooms with chat, voice, video, and a shared whiteboard."
};

// The Students Network is being spun out into its own standalone app, so it's
// hidden from this build for now. Flip this to `false` to bring the whole
// module back — all the page code below is kept intact.
const STUDENTS_HIDDEN: boolean = true;

export default async function StudentsPage() {
  if (STUDENTS_HIDDEN) redirect("/rooms");

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/students");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, privacy_mode, terms_accepted_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");
  if (!profile.terms_accepted_at) redirect("/terms");

  // Wave 20.4 — Students Network is verified-only end-to-end.
  // Unverified, pending, or rejected users see ONLY the VerificationGate
  // (which renders the right panel for each state). They cannot reach the
  // lobbies, the catalog, the user-created student rooms, or Help Beacons
  // until status='verified'.
  const { data: verif } = await supabase.rpc("get_my_verification");
  const v = Array.isArray(verif) ? verif[0] : null;
  const isVerified = v?.status === "verified";

  // Only bother fetching the full student catalog for verified users —
  // unverified users can't see it anyway.
  let studentCategories: Category[] = [];
  let studentSubcategories: Subcategory[] = [];
  if (isVerified) {
    const [studentCatsResp, studentSubcatsResp] = await Promise.all([
      supabase
        .from("room_categories")
        .select("slug,label,description,icon,position,is_adult")
        .or("slug.eq.students,slug.like.students-%")
        .order("position", { ascending: true }),
      supabase
        .from("room_subcategories")
        .select("category_slug,slug,label,position")
        .or("category_slug.eq.students,category_slug.like.students-%")
        .order("position", { ascending: true })
    ]);
    studentCategories = (studentCatsResp.data ?? []) as Category[];
    studentSubcategories = (studentSubcatsResp.data ?? []) as Subcategory[];
  }

  return (
    <AdRails>
    <main className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-3 py-6 md:py-8">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/rooms" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <div className="flex items-center gap-2 text-xs md:gap-3">
          <Link
            href="/books"
            className="rounded-lg border border-neon-blue/40 bg-neon-blue/10 px-3 py-1.5 text-neon-blue hover:bg-neon-blue/20"
          >
            📚 Books
          </Link>
          <Link
            href="/rooms"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
          >
            ← Rooms
          </Link>
          <AccountMenu
            username={profile.username as string}
            displayName={profile.display_name as string | null}
            avatarUrl={(profile as any).avatar_url ?? null}
            initialPrivacyMode={
              ((profile as any).privacy_mode as
                | "open"
                | "friends_only"
                | "invisible"
                | "decoy"
                | "stealth") ?? "open"
            }
          />
        </div>
      </header>

      <section className="mt-6 rounded-3xl border border-neon-mint/25 bg-gradient-to-br from-neon-mint/10 via-transparent to-neon-blue/5 p-6 sm:p-9">
        <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
          🎓 Students Network · v9
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-white sm:text-4xl">
          Where students help students.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">
          {isVerified ? (
            <>
              Common lobbies, age-band lobbies, the official catalog, rooms you
              create, and 🆘 Help Beacons — all with chat, voice, video,
              screen-share, and a shared whiteboard.
            </>
          ) : (
            <>
              The Students Network is verified-only. Verify yourself once and
              you unlock common lobbies, age-band lobbies, the official subject
              / exam / cohort catalog, rooms you create, 🆘 Help Beacons, and
              the helper network. The platform minimum is age 13.
            </>
          )}
        </p>
      </section>

      {isVerified ? (
        <StudentsHome
          currentUserId={profile.id}
          verification={v}
          catalogCategories={studentCategories}
          catalogSubcategories={studentSubcategories}
        />
      ) : (
        <div id="verify-card" className="mt-2">
          <VerificationGate existing={v} currentUserId={profile.id} />
        </div>
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
    </AdRails>
  );
}
