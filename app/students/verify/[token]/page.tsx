// Karochat — /students/verify/[token]
//
// Public landing page parents (or the student themselves) hit when they
// tap the one-time link sent by /api/students/verify/send. We:
//   1. Read the token from the route + the `via=email|phone` query param.
//   2. Call the confirm_verification_token RPC (anon-callable) using the
//      anon supabase client — no login required, the parent isn't a
//      Karochat user.
//   3. Render the appropriate state (success / already-confirmed / link
//      invalid).
//
// The RPC is idempotent: a second click after success still returns
// status='verified' with a friendly "already verified" message.

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Logo, Wordmark } from "@/components/Brand";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = { via?: string };

export default async function ConsentLandingPage({
  params,
  searchParams
}: {
  params: { token: string };
  searchParams: SearchParams;
}) {
  const token = decodeURIComponent(params.token ?? "");
  const via =
    searchParams?.via === "phone" || searchParams?.via === "email"
      ? searchParams.via
      : "email";

  // Use the plain anon client — the parent is unauthenticated and the
  // confirm RPC is SECURITY DEFINER with EXECUTE granted to anon.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: rows, error } = await supabase.rpc(
    "confirm_verification_token",
    { p_token: token, p_via: via }
  );

  const row = Array.isArray(rows) ? rows[0] : rows;
  const ok = !error && !!row?.ok;
  const message: string =
    row?.message ??
    error?.message ??
    "Could not confirm this link right now.";
  const status = row?.status as string | undefined;
  const isMinor = row?.is_minor as boolean | undefined;

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-4 py-8">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <span className="text-[10px] uppercase tracking-widest text-white/40">
          Students Network · consent
        </span>
      </header>

      <section
        className={`mt-8 rounded-3xl border p-7 sm:p-9 ${
          ok
            ? "border-neon-mint/30 bg-neon-mint/8"
            : "border-neon-red/30 bg-neon-red/5"
        }`}
      >
        <p
          className={`text-[10px] uppercase tracking-widest ${
            ok ? "text-neon-mint/80" : "text-neon-red/80"
          }`}
        >
          {ok
            ? status === "verified"
              ? "✓ Consent recorded"
              : "✓ Confirmed"
            : "✕ Link issue"}
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white sm:text-3xl">
          {ok
            ? "Thanks — you're done."
            : "We couldn't confirm this link."}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/75">{message}</p>

        {ok && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-[13px] leading-relaxed text-white/75">
            <p className="font-medium text-white">What happens now</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Their Karochat student profile is now active. They&apos;ll
                see the lobbies, the catalog, Help Beacons, and the
                teaching kit the next time they open the app.
              </li>
              {isMinor && (
                <li>
                  Because they&apos;re under 18, sessions auto-record,
                  cross-age DMs are off by default, and you can request a
                  parent digest at any time via the in-app contact.
                </li>
              )}
              <li>
                You can revoke this consent at any time by replying to the
                consent email or contacting support.
              </li>
            </ul>
          </div>
        )}

        {!ok && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-[13px] leading-relaxed text-white/75">
            <p className="font-medium text-white">Common reasons</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                The student resubmitted the verification form, which
                replaced the link. Ask them to forward the most recent
                email / SMS.
              </li>
              <li>The link was copied incompletely. Try tapping the
              button in the email instead of pasting.</li>
            </ul>
          </div>
        )}

        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75 hover:bg-white/10"
          >
            ← Back to Karochat
          </Link>
        </div>
      </section>

      <footer className="mt-8 text-center text-[11px] text-white/30">
        Karochat — a free, global community platform.
      </footer>
    </main>
  );
}
