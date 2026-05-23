// Karochat — /books/[id] (v9 Phase 2)
//
// Book detail page. Server-rendered: calls get_book RPC (bumps read_count
// when applicable + returns can_read + is_owner), mints a 1h signed URL
// for the file (file lives in the private books-files bucket), then
// hands off to the client BookDetail component for the pop-up reader,
// bookmark, and copyright report modal.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { BookDetail } from "./BookDetail";

export const dynamic = "force-dynamic";

type Book = {
  id: string;
  title: string;
  author: string | null;
  uploader_profile_id: string | null;
  uploader_username: string | null;
  uploader_display_name: string | null;
  language: string;
  file_url: string;
  file_size_bytes: number | null;
  format: string;
  cover_url: string | null;
  isbn: string | null;
  page_count: number | null;
  word_count: number | null;
  license_type: string;
  cc_license_code: string | null;
  license_metadata: Record<string, any>;
  genres: string[];
  syllabus_codes: string[];
  age_suitability: string;
  visibility: string;
  download_count: number;
  read_count: number;
  avg_rating: number | null;
  rating_count: number;
  status: string;
  uploaded_at: string;
  can_read: boolean;
  is_owner: boolean;
};

export default async function BookDetailPage({
  params
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?redirect=/books/${params.id}`);

  const { data: rows, error } = await supabase.rpc("get_book", {
    p_id: params.id
  });
  if (error) {
    return (
      <Shell>
        <p className="mt-6 rounded-xl border border-neon-red/30 bg-neon-red/10 p-4 text-sm text-neon-red">
          {error.message}
        </p>
      </Shell>
    );
  }
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) notFound();
  const book = row as Book;

  if (book.status === "takedown") {
    return (
      <Shell>
        <section className="surface-glass tint-red mt-6 p-7">
          <p className="text-[10px] uppercase tracking-widest text-neon-red/80">
            ✕ Taken down
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-white">
            This book is no longer available.
          </h1>
          <p className="mt-2 text-sm text-white/75">
            It was removed after a copyright complaint. The takedown is
            logged at /transparency/books (coming with the public-domain
            launch).
          </p>
        </section>
      </Shell>
    );
  }

  let signedUrl: string | null = null;
  if (book.can_read) {
    const { data: signed } = await supabase.storage
      .from("books-files")
      .createSignedUrl(book.file_url, 60 * 60);
    signedUrl = signed?.signedUrl ?? null;
  }

  return (
    <Shell>
      <BookDetail book={book} signedUrl={signedUrl} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-3 py-6 md:py-8">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/books" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <Link
          href="/books"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
        >
          ← Library
        </Link>
      </header>
      {children}
    </main>
  );
}
