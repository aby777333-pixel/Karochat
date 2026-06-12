// Karochat — /doctor/verify (v9 Phase 4).
//
// Medical-council verification application. Server renders the shell +
// current application status; VerifyFlow handles uploads (private
// medical-evidence bucket) + the submit RPC.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { DoctorBanner } from "../_components/DoctorBanner";
import { VerifyFlow } from "./VerifyFlow";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Doctor verification · Karochat",
  robots: { index: false, follow: false }
};

export default async function DoctorVerifyPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/doctor/verify");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, is_guest, is_verified_doctor")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");

  const { data: existing } = await supabase
    .from("medical_verifications")
    .select("id, status, reviewer_note, specialty, council_name, created_at, verified_at, expires_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-3 py-6 md:py-8">
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
          🪪 Doctor verification
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white">
          Verify your medical registration
        </h1>
        <p className="mt-2 text-sm text-white/70">
          An operator checks your registration number against your medical
          council&apos;s public registry (NMC/state councils in India, GMC in
          the UK, state boards in the US, …). Your documents stay in a
          private bucket only operators can open. Verification lasts one
          year.
        </p>
      </section>

      <div className="mt-5">
        <DoctorBanner />
      </div>

      <div className="mt-5">
        <VerifyFlow
          userId={user.id}
          isGuest={profile.is_guest === true}
          existing={existing ?? null}
        />
      </div>
    </main>
  );
}
