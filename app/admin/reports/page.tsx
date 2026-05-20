import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { ReportRow } from "./ReportRow";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · Reports · Karochat",
  robots: { index: false, follow: false }
};

type Report = {
  id: string;
  reporter_id: string | null;
  reporter_handle: string | null;
  target_kind: "message" | "user" | "room";
  target_id: string;
  category: string;
  body: string | null;
  status: "new" | "triaged" | "actioned" | "dismissed";
  reviewer_id: string | null;
  priority: number;
  created_at: string;
};

export default async function AdminReportsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/admin/reports");

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

  const { data, error } = await supabase.rpc("admin_list_reports", { p_limit: 200 });
  const reports = (data ?? []) as Report[];

  // Per-category counters for the dashboard header.
  const byCategory = reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-5 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-7 w-7" />
          <Wordmark className="text-lg" />
        </Link>
        <Link
          href="/rooms"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
        >
          ← Rooms
        </Link>
      </header>

      <section className="surface-glass tint-red mt-8 p-7 sm:p-9">
        <p className="text-[10px] uppercase tracking-widest text-neon-red/70">
          🚩 Admin · Reports
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-white">
          Safety queue
        </h1>
        <p className="mt-2 text-sm text-white/70">
          {reports.length} open ·{" "}
          {Object.entries(byCategory)
            .map(([k, v]) => `${v} ${k}`)
            .join(" · ") || "all clear"}
        </p>
        <p className="mt-1 text-[11px] text-white/45">
          Reports tagged <strong>minor</strong> or <strong>ncii</strong> are
          auto-prioritized to 100. Other high-harm categories (doxxing,
          violence) get 50.
        </p>
      </section>

      {error && (
        <div className="surface-glass tint-red mt-5 p-4 text-sm text-neon-red">
          {error.message}
        </div>
      )}

      <section className="mt-5 space-y-3">
        {reports.length === 0 ? (
          <div className="surface-glass mt-5 p-7 text-center text-sm text-white/55">
            🎉 Queue is empty.
          </div>
        ) : (
          reports.map((r) => <ReportRow key={r.id} r={r} />)
        )}
      </section>

      <footer className="mt-8 text-center text-[11px] text-white/30">
        Triage with care.
      </footer>
    </main>
  );
}
