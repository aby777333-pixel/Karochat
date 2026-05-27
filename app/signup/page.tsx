// Karochat — /signup — email + password account creation.
//
// New users who want password-based login (instead of magic-link every
// time) sign up here. Supabase sends a confirmation email; clicking the
// link in it lands on /auth/callback and confirms the account. After
// confirmation, future logins use email+password directly via the
// existing /login form.

import Link from "next/link";
import { Logo, Wordmark } from "@/components/Brand";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign up · Karochat",
  description:
    "Create a Karochat account with email + password. Lets you publish writing, save preferences, and skip the magic-link step next time."
};

export default function SignupPage({
  searchParams
}: {
  searchParams?: { reason?: string };
}) {
  const reason = searchParams?.reason;
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 py-10">
      <Link href="/" className="flex items-center gap-2">
        <Logo className="h-6 w-6" />
        <Wordmark className="text-lg" />
      </Link>

      <section className="surface-glass mt-8 rounded-3xl border border-neon-mint/25 bg-gradient-to-br from-neon-mint/10 via-transparent to-neon-blue/5 p-6">
        <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
          ✨ New account
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white">
          Create your Karochat account.
        </h1>
        {reason === "write" ? (
          <p className="mt-2 text-sm text-white/75">
            Publishing on Karochat needs an email-registered account.
            Guest accounts can read but not write. Set a password here and
            you&apos;ll sign in directly next time — no magic links every
            visit.
          </p>
        ) : (
          <p className="mt-2 text-sm text-white/75">
            Set a password and you&apos;ll sign in directly next time — no
            magic links every visit. You can also keep using magic links if
            you prefer.
          </p>
        )}
      </section>

      <SignupForm />

      <p className="mt-6 text-[11px] text-white/40">
        By signing up you accept the{" "}
        <Link href="/legal/terms" className="underline hover:text-white">
          Terms
        </Link>
        ,{" "}
        <Link href="/legal/community" className="underline hover:text-white">
          Community Guidelines
        </Link>
        , and{" "}
        <Link href="/legal/privacy" className="underline hover:text-white">
          Privacy Notice
        </Link>
        .
      </p>
      <p className="mt-2 text-[11px] text-white/40">
        Already have an account?{" "}
        <Link href="/" className="text-neon-blue underline-offset-2 hover:underline">
          Log in
        </Link>
        .
      </p>
    </main>
  );
}
