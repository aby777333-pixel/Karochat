import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { AbuseConsole, type AbuseEvent } from "./AbuseConsole";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · Abuse & IP blacklist · Karochat",
  robots: { index: false, follow: false }
};

export default async function AdminAbusePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/admin/abuse");

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
          Restricted to operators. Set{" "}
          <code className="font-mono">profiles.is_admin = true</code> for your account.
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

  const [eventsResp, blResp] = await Promise.all([
    supabase
      .from("abuse_events")
      .select("id, user_id, ip, user_agent, category, snippet, room_id, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("ip_blacklist")
      .select("ip, reason, created_at")
      .order("created_at", { ascending: false })
  ]);

  const events = (eventsResp.data ?? []) as AbuseEvent[];
  const blacklist = (blResp.data ?? []) as { ip: string; reason: string | null; created_at: string }[];

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-5 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-7 w-7" />
          <Wordmark className="text-lg" />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="rounded-lg border border-neon-purple/30 bg-neon-purple/10 px-3 py-1.5 text-xs text-neon-purple hover:bg-neon-purple/20"
          >
            ← Admin
          </Link>
          <Link
            href="/admin/reports"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
          >
            Reports
          </Link>
          <Link
            href="/rooms"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
          >
            ← Rooms
          </Link>
        </div>
      </header>

      <section className="surface-glass tint-red mt-8 p-7 sm:p-9">
        <p className="text-[10px] uppercase tracking-widest text-neon-red/70">
          🚫 Admin · Abuse &amp; IP blacklist
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-white">
          Safety enforcement
        </h1>
        <p className="mt-2 text-sm text-white/70">
          {events.length} flagged event{events.length === 1 ? "" : "s"} ·{" "}
          {blacklist.length} blacklisted IP{blacklist.length === 1 ? "" : "s"}. Blacklisted
          IPs are refused at login. Export the log to hand to authorities.
        </p>
      </section>

      <AbuseConsole events={events} initialBlacklist={blacklist} />

      <footer className="mt-8 text-center text-[11px] text-white/30">
        Handle this data lawfully. Retain only what you need; disclose only to
        proper authorities.
      </footer>
    </main>
  );
}
