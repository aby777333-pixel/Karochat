import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";

export const dynamic = "force-dynamic";
export const metadata = { title: "Knowledge Capsule · Karochat" };

export default async function CapsulePage({
  params
}: {
  params: { token: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: note } = await supabase
    .from("student_notes")
    .select("title, subject, topic, syllabus, body_markdown, karo_summary, flashcards, capsule_expires_at, created_at")
    .eq("capsule_token", params.token)
    .maybeSingle();

  if (!note) notFound();
  if (
    note.capsule_expires_at &&
    new Date(note.capsule_expires_at) <= new Date()
  ) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-5 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-7 w-7" />
          <Wordmark className="text-lg" />
        </Link>
        {/* Students module hidden for now (being spun out into a separate
            app). Keep this CTA for easy re-enable.
        <Link
          href="/students"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
        >
          Join Karochat Students →
        </Link>
        */}
      </header>

      <section className="surface-glass tint-mint mt-8 p-7 sm:p-9">
        <p className="text-[10px] uppercase tracking-widest text-neon-mint/70">
          📦 Knowledge capsule
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-white">
          {note.title}
        </h1>
        <p className="mt-2 text-[11px] text-white/45">
          {[note.subject, note.topic, note.syllabus].filter(Boolean).join(" · ")}
        </p>
      </section>

      {note.karo_summary && (
        <section className="surface-glass mt-5 p-5">
          <p className="text-[10px] uppercase tracking-widest text-white/40">
            ✨ Karo summary
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-white/85">
            {note.karo_summary}
          </p>
        </section>
      )}

      {note.body_markdown && (
        <section className="surface-glass mt-5 p-5">
          <p className="text-[10px] uppercase tracking-widest text-white/40">
            Notes
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-white/85">
            {note.body_markdown}
          </p>
        </section>
      )}

      {Array.isArray(note.flashcards) && note.flashcards.length > 0 && (
        <section className="surface-glass tint-blue mt-5 p-5">
          <p className="text-[10px] uppercase tracking-widest text-white/40">
            🧠 Flashcards · {note.flashcards.length}
          </p>
          <ul className="mt-3 space-y-2">
            {note.flashcards.map((c: any, i: number) => (
              <li key={i} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm">
                <p className="text-white/85">Q: {c.q}</p>
                <p className="mt-1 text-white/60">A: {c.a}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-8 text-center text-[11px] text-white/30">
        Karochat · Students Network. Capsules expire after 30 days.
      </footer>
    </main>
  );
}
