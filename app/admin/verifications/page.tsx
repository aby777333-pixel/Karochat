// Karochat — /admin/verifications
//
// Operator approval queue for id_upload and result_upload submissions.
// Mirrors /admin/reports: gated on profiles.is_admin, server-fetches the
// pending rows via the list_pending_verifications RPC (admin-checked
// inside the RPC), and renders a row component for approve / reject.
//
// Wave 20.12 added this — Wave 20.11 already routes edu_email +
// guardian_consent through a confirmation link, so this queue only sees
// the two methods that genuinely need human eyes on a photo + date.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { VerificationRow, type PendingRow } from "./VerificationRow";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · Verifications · Karochat",
  robots: { index: false, follow: false }
};

export default async function AdminVerificationsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/admin/verifications");

  const { data: prof } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!prof?.is_admin) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-5 py-8 text-center">
        <Logo className="h-10 w-10" />
        <Wordmark className="mt-3 text-2xl" />
        <p className="mt-6 text-sm text-white/70">
          The admin dashboard is restricted to operators. If you should have
          access, flip <code className="font-mono">profiles.is_admin = true</code>{" "}
          in the database for your account.
        </p>
        <Link
          href="/rooms"
          className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
        >
          ← Back to rooms
        </Link>
      </main>
    );
  }

  const { data, error } = await supabase.rpc("list_pending_verifications", {
    p_limit: 200
  });
  const rows = (data ?? []) as PendingRow[];

  // Pre-mint signed URLs for the uploaded photos so the row component
  // can render them inline without a second round-trip per row. 1-hour
  // TTL — plenty of time for review.
  const signedByPath = new Map<string, string>();
  const allPaths = rows
    .flatMap((r) => [r.id_card_url, r.marksheet_url])
    .filter((s): s is string => !!s);
  if (allPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("student-verifications")
      .createSignedUrls(allPaths, 60 * 60);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) signedByPath.set(s.path, s.signedUrl);
    }
  }
  const rowsWithUrls = rows.map((r) => ({
    ...r,
    id_card_signed_url: r.id_card_url
      ? signedByPath.get(r.id_card_url) ?? null
      : null,
    marksheet_signed_url: r.marksheet_url
      ? signedByPath.get(r.marksheet_url) ?? null
      : null
  }));

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-5 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-7 w-7" />
          <Wordmark className="text-lg" />
        </Link>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/admin"
            className="rounded-lg border border-neon-purple/30 bg-neon-purple/10 px-3 py-1.5 text-neon-purple hover:bg-neon-purple/20"
          >
            ← Admin
          </Link>
          <Link
            href="/admin/reports"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
          >
            Reports →
          </Link>
          <Link
            href="/rooms"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
          >
            ← Rooms
          </Link>
        </div>
      </header>

      <section className="surface-glass tint-amber mt-8 p-7 sm:p-9">
        <p className="text-[10px] uppercase tracking-widest text-neon-amber/70">
          🎓 Admin · Student verifications
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-white">
          Verification queue
        </h1>
        <p className="mt-2 text-sm text-white/70">
          {rows.length} pending · ID-card and marksheet uploads only.
          Edu-email + guardian-consent flows confirm themselves via the
          link in the recipient&apos;s inbox / phone.
        </p>
        <p className="mt-1 text-[11px] text-white/45">
          Approve flips the row to <strong>verified</strong>, sets a 12-month
          expiry, and unlocks the Students Network for the student. Reject
          flips it to <strong>rejected</strong> and the student can resubmit.
        </p>
      </section>

      {error && (
        <div className="surface-glass tint-red mt-5 p-4 text-sm text-neon-red">
          {error.message}
        </div>
      )}

      <section className="mt-5 space-y-3">
        {rows.length === 0 ? (
          <div className="surface-glass mt-5 p-7 text-center text-sm text-white/55">
            🎉 No pending uploads — the queue is empty.
          </div>
        ) : (
          rowsWithUrls.map((r) => <VerificationRow key={r.id} r={r} />)
        )}
      </section>

      <footer className="mt-8 text-center text-[11px] text-white/30">
        Photos auto-expire (signed URL) every hour — refresh to mint new ones.
      </footer>
    </main>
  );
}
