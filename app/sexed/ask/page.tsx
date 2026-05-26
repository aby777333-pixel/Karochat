// Karochat — /sexed/ask (v9 Phase 3)
//
// Anonymous Karo Q&A composer. Server-renders the shell + helpline
// sidebar; the client AskFlow does the submit + answer rendering.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { CrisisHelplineCard } from "../_components/CrisisHelplineCard";
import { AskFlow } from "./AskFlow";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ask Karo anonymously · Sex ed · Karochat",
  description:
    "Ask anything you can't Google in peace. Karochat's Karo answers anonymously, queer-affirmingly, and age-appropriately.",
  robots: { index: false, follow: false }
};

type Helpline = {
  id: string;
  country: string;
  kind: string;
  name: string;
  phone: string | null;
  sms: string | null;
  url: string | null;
  hours: string | null;
  languages: string[] | null;
  notes: string | null;
};

export default async function AskPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/sexed/ask");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, birth_year")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");

  const [bandResp, helplineResp] = await Promise.all([
    supabase.rpc("current_user_age_band"),
    supabase.rpc("list_helplines_for", { p_country: "IN", p_kinds: null })
  ]);
  const band = (bandResp.data ?? "16_17") as
    | "13_15"
    | "16_17"
    | "18plus"
    | "unset";
  const helplines = (helplineResp.data ?? []) as Helpline[];

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-3 py-6 md:py-8">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/sexed" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <Link
          href="/sexed"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
        >
          ← Library
        </Link>
      </header>

      <section className="mt-6">
        <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
          💬 Ask Karo anonymously
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white">
          Karochat&apos;s sex ed Q&amp;A
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/70">
          Karo answers privately, doesn&apos;t link the question to your
          account, and won&apos;t pretend to be a doctor when it isn&apos;t
          one. Your question may later be reviewed by an educator and added
          (anonymously) to the public library if it could help someone else.
        </p>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <AskFlow band={band} />
        <aside className="space-y-4">
          <CrisisHelplineCard helplines={helplines.slice(0, 5)} compact />
        </aside>
      </div>

      <section className="surface-glass tint-amber mt-8 p-5">
        <p className="text-[10px] uppercase tracking-widest text-neon-amber/80">
          📜 This is education, not medical care
        </p>
        <p className="mt-2 text-sm leading-relaxed text-white/80">
          Karo is a friendly, queer-affirming AI educator, not a doctor.
          For pain, infection, bleeding, pregnancy concerns, or medication
          questions, see a clinician. For crisis topics, the helplines on
          the sidebar are free, confidential, and trained for this.
        </p>
      </section>

      <footer className="mt-10 text-center text-[11px] text-white/30">
        Questions are stored anonymously (no profile link) and may be answered
        publicly by an operator if they&apos;d help others.
      </footer>
    </main>
  );
}
