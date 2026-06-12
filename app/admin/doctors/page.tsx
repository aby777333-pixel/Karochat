// Karochat — /admin/doctors (v9 Phase 4).
//
// Operator queue for medical-council verification. Evidence lives in
// the private medical-evidence bucket; this server page mints 1-hour
// signed URLs (the admin storage policy allows the read) and the client
// list calls admin_review_medical_verification.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { ReviewList, type Application } from "./ReviewList";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Doctor verifications · Karochat admin",
  robots: { index: false, follow: false }
};

async function signEvidence(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  path: string | null
): Promise<string | null> {
  if (!path) return null;
  // Older rows may hold full URLs; only sign bucket paths.
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage
    .from("medical-evidence")
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export default async function AdminDoctorsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/admin/doctors");

  const { data: prof } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!prof?.is_admin) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col items-center justify-center px-3">
        <p className="surface-glass p-6 text-sm text-white/70">
          🔒 Operators only.
        </p>
      </main>
    );
  }

  const [pendingResp, recentResp] = await Promise.all([
    supabase.rpc("admin_list_medical_verifications", { p_status: "pending" }),
    supabase.rpc("admin_list_medical_verifications", { p_status: null })
  ]);

  const pendingRaw = (pendingResp.data ?? []) as Application[];
  const pending: Application[] = await Promise.all(
    pendingRaw.map(async (a) => ({
      ...a,
      registration_evidence_url: await signEvidence(
        supabase,
        a.registration_evidence_url
      ),
      id_evidence_url: await signEvidence(supabase, a.id_evidence_url),
      selfie_with_id_url: await signEvidence(supabase, a.selfie_with_id_url)
    }))
  );

  const recent = ((recentResp.data ?? []) as Application[])
    .filter((a) => a.status !== "pending")
    .slice(-10)
    .reverse();

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-4xl flex-col px-3 py-6 md:py-8">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/admin" className="flex min-w-0 items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <Link
          href="/admin"
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
        >
          ← Admin
        </Link>
      </header>

      <section className="mt-6">
        <p className="text-[10px] uppercase tracking-widest text-neon-blue/80">
          🩺 Doctor verifications
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white">
          Council-registry review queue
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/70">
          For each application: open the council&apos;s public registry,
          search the registration number, and confirm the name matches the
          ID. India: NMC&apos;s{" "}
          <a
            href="https://www.nmc.org.in/information-desk/indian-medical-register/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neon-blue hover:underline"
          >
            Indian Medical Register
          </a>
          . UK:{" "}
          <a
            href="https://www.gmc-uk.org/registration-and-licensing/the-medical-register"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neon-blue hover:underline"
          >
            GMC register
          </a>
          .
        </p>
      </section>

      <div className="mt-5">
        <ReviewList pending={pending} recent={recent} />
      </div>
    </main>
  );
}
