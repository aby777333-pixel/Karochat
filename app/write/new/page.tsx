// Karochat — /write/new — new publication composer.
//
// Requires an email-registered (non-anonymous) session. Anonymous guests
// and signed-out visitors are redirected.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { Editor } from "../_components/Editor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New piece · Karochat",
  description: "Start a new story, essay, or journal entry."
};

type Category = {
  slug: string;
  label: string;
  icon: string | null;
  is_adult: boolean;
};

export default async function NewPublicationPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/write/new");
  if ((user as any).is_anonymous) redirect("/signup?reason=write");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");

  const { data: catsResp } = await supabase
    .from("publication_categories")
    .select("slug,label,icon,is_adult")
    .eq("active", true)
    .order("position", { ascending: true });

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-3 py-6 md:py-8">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/write" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/write"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <section className="mt-6">
        <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
          ✍ New piece
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white">
          Start writing.
        </h1>
        <p className="mt-1 text-sm text-white/65">
          Drafts auto-save once you start. You stay in control of when (or if)
          it becomes public.
        </p>
      </section>

      <section className="mt-5">
        <Editor
          initial={{
            id: null,
            slug: null,
            title: "",
            subtitle: "",
            pen_name: "",
            category_slug: null,
            is_adult: false,
            cover_image_url: null,
            body_markdown: "",
            status: "draft",
            tags: []
          }}
          categories={(catsResp ?? []) as Category[]}
          userId={user.id}
        />
      </section>
    </main>
  );
}
