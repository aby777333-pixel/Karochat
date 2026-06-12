// Karochat — /doctor/availability (v9 Phase 4, verified doctors only).

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { AvailabilityEditor } from "./AvailabilityEditor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My doctor hours · Karochat",
  robots: { index: false, follow: false }
};

export default async function DoctorAvailabilityPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/doctor/availability");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, is_verified_doctor")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");
  if (!profile.is_verified_doctor) redirect("/doctor/verify");

  const { data: slots } = await supabase
    .from("doctor_availability")
    .select("day_of_week, start_time, end_time, timezone")
    .eq("profile_id", user.id)
    .order("day_of_week")
    .order("start_time");

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
        <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
          🗓 Your weekly hours
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white">
          When can people expect you?
        </h1>
        <p className="mt-2 text-sm text-white/70">
          These show on the doctor directory so people know when to ask.
          They&apos;re a promise of attention, not a contract — you only
          receive requests while you&apos;re actually online.
        </p>
      </section>

      <div className="mt-5">
        <AvailabilityEditor initialSlots={slots ?? []} />
      </div>
    </main>
  );
}
