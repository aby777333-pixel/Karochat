import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: { handle: string };
}): Promise<Metadata> {
  const handle = params.handle.toLowerCase().replace(/^@/, "");
  return {
    title: `Meet @${handle} · Karochat`,
    description: `Start a private chat with @${handle} on Karochat — a global queer-friendly chat platform.`,
    openGraph: {
      title: `Meet @${handle} on Karochat`,
      description: `Tap to start a private chat with @${handle}.`,
      type: "website"
    }
  };
}

/**
 * v7 6.1 — personal Meet URL. Anyone can share `karochat.co/meet/<handle>`.
 *
 * Flow:
 *   • Signed-in visitor → find-or-create a 1:1 DM with the target, redirect.
 *   • Anon visitor      → render a landing page asking them to sign in,
 *                          carrying the handle in a cookie so the next
 *                          authenticated /rooms render can finish the dial.
 *   • Self-link         → render a "this is your own meet link" hint.
 */
export default async function MeetPage({
  params
}: {
  params: { handle: string };
}) {
  const handle = params.handle.toLowerCase().replace(/^@/, "").trim();
  if (!handle) redirect("/");

  const supabase = createSupabaseServerClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id, username, display_name, is_guest, presence_state")
    .eq("username", handle)
    .maybeSingle();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Target doesn't exist
  if (!target?.id) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-5 py-8 text-center">
        <header className="mb-6 flex items-center gap-2">
          <Logo className="h-7 w-7" />
          <Wordmark className="text-lg" />
        </header>
        <div className="surface-glass tint-amber p-6">
          <p className="font-display text-xl font-semibold text-white">
            No one here goes by @{handle}.
          </p>
          <p className="mt-2 text-sm text-white/65">
            Either the handle is taken by no one yet, or the link has a typo.
          </p>
          <Link
            href="/rooms"
            className="mt-4 inline-block rounded-lg bg-neon-blue px-4 py-2 text-sm font-medium text-ink-900 shadow-glow-blue hover:bg-neon-blue/90"
          >
            ← Lobby
          </Link>
        </div>
      </main>
    );
  }

  // Self-meet — just show their own meet URL
  if (user && user.id === target.id) {
    return <SelfMeetPage handle={handle} displayName={target.display_name} />;
  }

  // Authed visitor → mint the DM and redirect.
  if (user) {
    const { data: dmId, error: rpcErr } = await supabase.rpc(
      "get_or_create_dm",
      { p_target_user_id: target.id }
    );
    if (!rpcErr && dmId) {
      redirect(`/rooms/${dmId}`);
    }
    // Fall through to the not-authed landing if the RPC failed.
  }

  // Anon visitor → landing page.
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-5 py-8 text-center">
      <header className="mb-6 flex items-center gap-2">
        <Logo className="h-7 w-7" />
        <Wordmark className="text-lg" />
      </header>
      <div className="surface-glass tint-mint p-6">
        <p className="text-[11px] uppercase tracking-widest text-neon-mint">
          Personal meet link
        </p>
        <p className="mt-2 font-display text-2xl font-semibold text-white">
          You&apos;ve been invited to meet
        </p>
        <p className="mt-1 font-display text-3xl font-bold text-neon-mint">
          {target.display_name ?? `@${handle}`}
        </p>
        <p className="mt-3 text-sm text-white/65">
          Sign in to Karochat — magic-link in seconds, or join anonymously
          as a guest — and we&apos;ll drop you into a private chat with them
          straight away.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href={`/?meet=${encodeURIComponent(handle)}`}
            className="rounded-lg bg-neon-blue px-4 py-2.5 text-sm font-medium text-ink-900 shadow-glow-blue hover:bg-neon-blue/90"
          >
            Sign in &amp; meet →
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10"
          >
            What is Karochat?
          </Link>
        </div>
        <p className="mt-4 text-[11px] text-white/35">
          We never expose @{handle}&apos;s email. Only the handle.
        </p>
      </div>
    </main>
  );
}

function SelfMeetPage({
  handle,
  displayName
}: {
  handle: string;
  displayName: string | null;
}) {
  const fullUrl = `karochat.co/meet/${handle}`;
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-5 py-8 text-center">
      <header className="mb-6 flex items-center gap-2">
        <Logo className="h-7 w-7" />
        <Wordmark className="text-lg" />
      </header>
      <div className="surface-glass tint-mint p-6">
        <p className="text-[11px] uppercase tracking-widest text-neon-mint">
          This is YOUR meet link
        </p>
        <p className="mt-2 font-display text-xl font-semibold text-white">
          Share it anywhere, {displayName ?? `@${handle}`}.
        </p>
        <p className="mt-1 text-sm text-white/65">
          Anyone who opens it will land in a private chat with you. Drop it
          in your bio, your email signature, or paste it to a friend.
        </p>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-center font-mono text-sm text-white/90">
          {fullUrl}
        </div>
        <Link
          href="/rooms"
          className="mt-5 inline-block rounded-lg bg-neon-blue px-4 py-2 text-sm font-medium text-ink-900 shadow-glow-blue hover:bg-neon-blue/90"
        >
          ← Back to the lobby
        </Link>
      </div>
    </main>
  );
}
