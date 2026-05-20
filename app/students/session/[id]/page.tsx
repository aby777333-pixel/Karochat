import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { SessionRoom } from "./SessionRoom";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/?redirect=/students/session/${params.id}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");

  const { data: session } = await supabase
    .from("beacon_sessions")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!session) redirect("/students");
  if (
    session.asker_profile_id !== user.id &&
    session.helper_profile_id !== user.id
  ) {
    redirect("/students");
  }

  // Fetch the beacon for context
  const { data: beacon } = session.beacon_id
    ? await supabase
        .from("help_beacons")
        .select("*")
        .eq("id", session.beacon_id)
        .maybeSingle()
    : { data: null };

  // Ensure a whiteboard exists for this session (lazy create).
  let { data: wb } = await supabase
    .from("whiteboards")
    .select("id, title, page_count")
    .eq("session_id", session.id)
    .maybeSingle();
  if (!wb) {
    const { data: created } = await supabase
      .from("whiteboards")
      .insert({
        owner_profile_id: session.asker_profile_id,
        session_id: session.id,
        title: beacon?.subject ? `Session · ${beacon.subject}` : "Session whiteboard"
      })
      .select("id, title, page_count")
      .single();
    wb = created ?? null;
    if (wb) {
      await supabase.from("whiteboard_pages").insert({
        whiteboard_id: wb.id,
        page_index: 0,
        data: { strokes: [] }
      });
    }
  }

  const partnerId =
    session.asker_profile_id === user.id
      ? session.helper_profile_id
      : session.asker_profile_id;
  const { data: partner } = await supabase
    .from("profiles")
    .select("id, username, display_name, presence_state")
    .eq("id", partnerId)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-3 py-4">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-2">
        <Link href="/students" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-base" />
        </Link>
        <p className="truncate font-mono text-xs uppercase tracking-widest text-white/55">
          🆘 session · with @{partner?.username ?? "anon"}
        </p>
        <Link
          href="/students"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
        >
          ← Students
        </Link>
      </header>

      {beacon && (
        <section className="surface-glass tint-red mt-3 px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-white/40">
            The question
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-white">
            {beacon.karo_rewritten_question ?? beacon.question_text}
          </p>
          {beacon.context_note && (
            <p className="mt-1 text-[11px] text-white/45">
              context: {beacon.context_note}
            </p>
          )}
        </section>
      )}

      <SessionRoom
        sessionId={session.id}
        whiteboardId={wb?.id ?? null}
        currentUserId={user.id}
        isAsker={session.asker_profile_id === user.id}
      />
    </main>
  );
}
