import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { NotesClient } from "./NotesClient";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/students/notes");

  const { data: verif } = await supabase.rpc("am_i_verified");
  if (!verif) redirect("/students");

  const { data: notes } = await supabase
    .from("student_notes")
    .select("id, title, subject, topic, syllabus, updated_at, capsule_token")
    .eq("owner_profile_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-3 py-6">
      <header className="surface-glass flex items-center justify-between px-4 py-2">
        <Link href="/students" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-base" />
          <span className="ml-2 text-xs text-white/50">/ notes</span>
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
          📓 My notes
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white">
          Your personal knowledge layer.
        </h1>
        <p className="mt-2 text-sm text-white/70">
          Karo summaries from beacon sessions, your handwritten whiteboards,
          and your own notes. Generate flashcards in a tap. Share a
          Knowledge Capsule with a friend studying the same thing.
        </p>
      </section>

      <NotesClient initial={(notes ?? []) as any} />
    </main>
  );
}
