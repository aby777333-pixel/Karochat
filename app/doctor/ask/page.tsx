// Karochat — /doctor/ask (v9 Phase 4).
//
// Symptom composer + live emergency triage + routing status. Server
// renders the shell + emergency sidebar; AskDoctorFlow does the rest.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { DoctorBanner } from "../_components/DoctorBanner";
import { AskDoctorFlow } from "./AskDoctorFlow";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ask a doctor · Karochat",
  description:
    "Describe what's going on and get connected to a verified doctor for general guidance.",
  robots: { index: false, follow: false }
};

export default async function AskDoctorPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/doctor/ask");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, is_guest")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-3 py-6 md:py-8">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/doctor" className="flex min-w-0 items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <Link
          href="/doctor"
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
        >
          ← Doctors
        </Link>
      </header>

      <section className="mt-6">
        <p className="text-[10px] uppercase tracking-widest text-neon-blue/80">
          🩺 Ask a doctor
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white">
          What&apos;s going on?
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/70">
          Your request goes to verified doctors who are online right now.
          Whoever accepts opens a private chat with you — voice and video
          included if you both want it.
        </p>
      </section>

      <div className="mt-5">
        <DoctorBanner />
      </div>

      <div className="mt-5">
        <AskDoctorFlow isGuest={profile.is_guest === true} />
      </div>

      <footer className="mt-10 text-center text-[11px] text-white/30">
        Your description is shared only with verified doctors. Consults are
        private 1:1 chats — report any doctor who asks for payment outside
        Karochat.
      </footer>
    </main>
  );
}
