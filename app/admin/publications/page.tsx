// Karochat — /admin/publications
//
// Operator queue for the publications platform (migration 0054 +
// admin/reports extensions in 0055). Two sections:
//
//   • Publications — every row in public.publications, any status, any
//     author. Filterable by status / category / search via searchParams.
//     Per-row actions: open public page, hide / unhide, expand body
//     inline.
//   • Open reports — user-filed publication_reports.status='open'.
//     Per-row actions: close, hide the reported publication.
//
// Gated on profiles.is_admin (same pattern as /admin/books and
// /admin/reports).

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { PublicationRow, type AdminPublication } from "./PublicationRow";
import { PublicationReportRow, type PublicationReport } from "./PublicationReportRow";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · Publications · Karochat",
  robots: { index: false, follow: false }
};

type Category = {
  slug: string;
  label: string;
  icon: string | null;
  is_adult: boolean;
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "hidden", label: "Hidden" }
] as const;

const PAGE_SIZE = 50;

export default async function AdminPublicationsPage({
  searchParams
}: {
  searchParams?: {
    status?: string;
    category?: string;
    q?: string;
    page?: string;
  };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/admin/publications");

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

  const status = (searchParams?.status ?? "").trim() || null;
  const category = (searchParams?.category ?? "").trim() || null;
  const q = (searchParams?.q ?? "").trim() || null;
  const pageNum = Math.max(1, parseInt(searchParams?.page ?? "1", 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const [catsResp, pubsResp, reportsResp] = await Promise.all([
    supabase
      .from("publication_categories")
      .select("slug,label,icon,is_adult")
      .eq("active", true)
      .order("position", { ascending: true }),
    supabase.rpc("admin_list_publications", {
      p_status: status,
      p_category: category,
      p_author: null,
      p_search: q,
      p_limit: PAGE_SIZE,
      p_offset: offset
    }),
    supabase.rpc("admin_list_publication_reports", {
      p_status: "open",
      p_limit: 100,
      p_offset: 0
    })
  ]);

  const categories = (catsResp.data ?? []) as Category[];
  const publications = (pubsResp.data ?? []) as AdminPublication[];
  const reports = (reportsResp.data ?? []) as PublicationReport[];
  const error =
    pubsResp.error?.message ??
    reportsResp.error?.message ??
    null;

  const qs = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string | null> = {
      status: status ?? null,
      category: category ?? null,
      q: q ?? null,
      page: pageNum > 1 ? String(pageNum) : null,
      ...overrides
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  const statusCounts = publications.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-5 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-7 w-7" />
          <Wordmark className="text-lg" />
        </Link>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/admin/books"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
          >
            Books →
          </Link>
          <Link
            href="/admin/verifications"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
          >
            Verifications →
          </Link>
          <Link
            href="/admin/reports"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
          >
            Reports →
          </Link>
          <Link
            href="/read"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
          >
            ← Read
          </Link>
        </div>
      </header>

      <section className="surface-glass tint-purple mt-8 p-7 sm:p-9">
        <p className="text-[10px] uppercase tracking-widest text-neon-purple/80">
          📚 Admin · Publications
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-white">
          Moderate user-published works
        </h1>
        <p className="mt-2 text-sm text-white/70">
          {publications.length} on this page
          {Object.keys(statusCounts).length > 0 ? (
            <>
              {" · "}
              {Object.entries(statusCounts)
                .map(([k, v]) => `${v} ${k}`)
                .join(" · ")}
            </>
          ) : null}
          {reports.length > 0 ? ` · ${reports.length} open reports` : null}
        </p>
        <p className="mt-1 text-[11px] text-white/45">
          Hiding flips <code className="font-mono">status</code> to{" "}
          <strong>hidden</strong> — the public RLS policy stops returning the
          row, but the author still sees it in their drafts/dashboard. Unhide
          flips it back to <strong>published</strong>.
        </p>
      </section>

      <form
        action="/admin/publications"
        method="get"
        className="mt-6 flex flex-wrap items-end gap-2"
      >
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-widest text-white/45">
          Status
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white outline-none focus:border-neon-purple/60"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-widest text-white/45">
          Category
          <select
            name="category"
            defaultValue={category ?? ""}
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white outline-none focus:border-neon-purple/60"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.icon ? `${c.icon} ` : ""}
                {c.label}
                {c.is_adult ? " · 18+" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[11px] uppercase tracking-widest text-white/45 sm:min-w-[240px]">
          Search title / author / pen-name
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="title, subtitle, username, pen name…"
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-neon-purple/60"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg border border-neon-purple/40 bg-neon-purple/15 px-3 py-1.5 text-sm font-medium text-neon-purple hover:bg-neon-purple/25"
        >
          Apply
        </button>
        {(status || category || q) && (
          <Link
            href="/admin/publications"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10"
          >
            Reset
          </Link>
        )}
      </form>

      {error && (
        <div className="surface-glass tint-red mt-5 p-4 text-sm text-neon-red">
          {error}
        </div>
      )}

      <section className="mt-6">
        <p className="text-[10px] uppercase tracking-widest text-white/45">
          Open reports ({reports.length})
        </p>
        {reports.length === 0 ? (
          <div className="surface-glass mt-2 p-6 text-center text-sm text-white/55">
            🎉 No open reports.
          </div>
        ) : (
          <div className="mt-2 space-y-3">
            {reports.map((r) => (
              <PublicationReportRow key={r.id} row={r} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <p className="text-[10px] uppercase tracking-widest text-white/45">
          Publications · page {pageNum}
        </p>
        {publications.length === 0 ? (
          <div className="surface-glass mt-2 p-8 text-center text-sm text-white/55">
            No matches.
          </div>
        ) : (
          <div className="mt-2 space-y-3">
            {publications.map((p) => (
              <PublicationRow key={p.id} row={p} />
            ))}
          </div>
        )}

        <div className="mt-5 flex justify-between text-sm">
          {pageNum > 1 ? (
            <Link
              href={`/admin/publications${qs({ page: String(pageNum - 1) })}`}
              className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          {publications.length === PAGE_SIZE ? (
            <Link
              href={`/admin/publications${qs({ page: String(pageNum + 1) })}`}
              className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      </section>

      <footer className="mt-10 text-center text-[11px] text-white/30">
        Hidden publications stay readable by the author from their writer
        dashboard.
      </footer>
    </main>
  );
}
