import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { SquadsClient } from "./SquadsClient";

export const dynamic = "force-dynamic";

export default async function SquadsPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/students/squads");

  const { data: verif } = await supabase.rpc("am_i_verified");
  if (!verif) redirect("/students");

  const { data: myMemberships } = await supabase
    .from("study_squad_members")
    .select("squad_id, role")
    .eq("profile_id", user.id);
  const ids = (myMemberships ?? []).map((m) => m.squad_id);

  const { data: mySquads } = ids.length
    ? await supabase
        .from("study_squads")
        .select("id, name, subject, level, syllabus, description, member_count, max_members, visibility, owner_profile_id")
        .in("id", ids)
    : { data: [] };

  const { data: listed } = await supabase
    .from("study_squads")
    .select("id, name, subject, level, member_count, max_members, description")
    .eq("visibility", "listed_private")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-3 py-6">
      <header className="surface-glass flex items-center justify-between px-4 py-2">
        <Link href="/students" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-base" />
          <span className="ml-2 text-xs text-white/50">/ squads</span>
        </Link>
        <Link
          href="/students"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
        >
          ← Students
        </Link>
      </header>

      <section className="surface-glass tint-mint mt-5 p-5">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          🧠 Study squads
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white">
          Small groups, big momentum.
        </h1>
        <p className="mt-2 text-sm text-white/70">
          2-20 students studying the same thing. Persistent chat, shared
          whiteboards, recurring sessions. Karo nudges you when engagement
          dips.
        </p>
      </section>

      <SquadsClient
        currentUserId={user.id}
        mine={(mySquads ?? []) as any}
        listed={(listed ?? []) as any}
      />
    </main>
  );
}
