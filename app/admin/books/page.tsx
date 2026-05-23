// Karochat — /admin/books (v9 Phase 2)
//
// Operator queue mirroring /admin/verifications. Two sections:
//   • Pending books — uploads queued for review (status='pending_review')
//   • Open copyright complaints — book_copyright_complaints status='pending'
//
// Both gated on profiles.is_admin. Signed URLs (1h TTL) for the
// uploaded files so the operator can review without exposing the
// private bucket publicly.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { PendingBookRow, type PendingBook } from "./PendingBookRow";
import { ComplaintRow, type Complaint } from "./ComplaintRow";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · Books · Karochat",
  robots: { index: false, follow: false }
};

export default async function AdminBooksPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/admin/books");

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

  const [pendingResp, complaintResp] = await Promise.all([
    supabase.rpc("list_pending_books", { p_limit: 100 }),
    supabase.rpc("list_open_complaints", { p_limit: 100 })
  ]);
  const pendingBooks = (pendingResp.data ?? []) as PendingBook[];
  const complaints = (complaintResp.data ?? []) as Complaint[];

  // Mint signed URLs for pending book files so admin can preview them.
  const paths = pendingBooks.map((b) => b.file_url).filter(Boolean);
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signedRows } = await supabase.storage
      .from("books-files")
      .createSignedUrls(paths, 60 * 60);
    for (const s of signedRows ?? []) {
      if (s.signedUrl && s.path) signed.set(s.path, s.signedUrl);
    }
  }
  const pendingWithUrl = pendingBooks.map((b) => ({
    ...b,
    file_signed_url: signed.get(b.file_url) ?? null
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
            href="/books"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
          >
            ← Books
          </Link>
        </div>
      </header>

      <section className="surface-glass tint-amber mt-8 p-7 sm:p-9">
        <p className="text-[10px] uppercase tracking-widest text-neon-amber/70">
          📚 Admin · Books queue
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-white">
          Review uploads + handle takedowns
        </h1>
        <p className="mt-2 text-sm text-white/70">
          {pendingBooks.length} pending review · {complaints.length} open complaints.
          Public-domain + author-uploaded books skip this queue (live
          instantly). Creative Commons + author-permission + fair-use land
          here.
        </p>
        <p className="mt-1 text-[11px] text-white/45">
          Approve flips status to <strong>live</strong>. Takedown flips to{" "}
          <strong>takedown</strong>, hashes the file into{" "}
          <code className="font-mono">book_takedown_hashes</code> so the
          same upload can&apos;t be retried, and resolves any matching
          complaint.
        </p>
      </section>

      <section className="mt-6">
        <p className="text-[10px] uppercase tracking-widest text-white/45">
          Pending review ({pendingBooks.length})
        </p>
        {pendingBooks.length === 0 ? (
          <div className="surface-glass mt-2 p-6 text-center text-sm text-white/55">
            🎉 No books waiting for review.
          </div>
        ) : (
          <div className="mt-2 space-y-3">
            {pendingWithUrl.map((b) => (
              <PendingBookRow key={b.id} row={b} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <p className="text-[10px] uppercase tracking-widest text-white/45">
          Open copyright complaints ({complaints.length})
        </p>
        {complaints.length === 0 ? (
          <div className="surface-glass mt-2 p-6 text-center text-sm text-white/55">
            🎉 No open complaints.
          </div>
        ) : (
          <div className="mt-2 space-y-3">
            {complaints.map((c) => (
              <ComplaintRow key={c.id} row={c} />
            ))}
          </div>
        )}
      </section>

      <footer className="mt-10 text-center text-[11px] text-white/30">
        Signed URLs above expire in 1 hour — refresh to mint fresh ones.
      </footer>
    </main>
  );
}
