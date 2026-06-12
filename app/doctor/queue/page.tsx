// Karochat — /doctor/queue (v9 Phase 4, verified doctors only).
//
// Incoming doctor beacons + the doctor's own active/recent sessions.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { DoctorBanner } from "../_components/DoctorBanner";
import { QueueBoard } from "./QueueBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Incoming requests · Karochat doctors",
  robots: { index: false, follow: false }
};

export default async function DoctorQueuePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/doctor/queue");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, is_verified_doctor")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");
  if (!profile.is_verified_doctor) redirect("/doctor/verify");

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-4xl flex-col px-3 py-6 md:py-8">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/doctor" className="flex min-w-0 items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href="/doctor/availability"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
          >
            🗓 Hours
          </Link>
          <Link
            href="/doctor"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
          >
            ← Doctors
          </Link>
        </div>
      </header>

      <section className="mt-6">
        <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
          📥 Incoming requests
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white">
          People waiting for a doctor
        </h1>
        <p className="mt-2 text-sm text-white/70">
          Accepting opens a private 1:1 chat with the person (voice/video
          available inside). Wrap up each consult with a short
          recommendation so there&apos;s a record for both of you.
        </p>
      </section>

      <div className="mt-5">
        <DoctorBanner />
      </div>

      <div className="mt-5">
        <QueueBoard />
      </div>
    </main>
  );
}
