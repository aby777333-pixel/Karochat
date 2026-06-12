import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · Owner portal · Karochat",
  robots: { index: false, follow: false }
};

type Overview = Record<string, number>;

const STATS = [
  { label: "Users", key: "users_total", accent: "text-neon-blue" },
  { label: "Online now", key: "users_online", accent: "text-neon-mint" },
  { label: "New (24h)", key: "users_24h", accent: "text-neon-mint" },
  { label: "Guests", key: "users_guests", accent: "text-white/70" },
  { label: "Official rooms", key: "rooms_official", accent: "text-neon-purple" },
  { label: "User rooms", key: "rooms_user", accent: "text-neon-purple" },
  { label: "DMs", key: "dms", accent: "text-white/70" },
  { label: "Messages", key: "messages_total", accent: "text-neon-blue" },
  { label: "Messages (24h)", key: "messages_24h", accent: "text-neon-mint" },
  { label: "Shorts", key: "shorts", accent: "text-neon-amber" },
  { label: "Publications", key: "publications", accent: "text-neon-amber" },
  { label: "Live stories", key: "stories_live", accent: "text-neon-amber" },
  { label: "Sex-ed articles", key: "sexed_articles", accent: "text-neon-red" },
  { label: "Open reports", key: "reports_open", accent: "text-neon-red" },
  { label: "Abuse flags (24h)", key: "abuse_24h", accent: "text-neon-red" },
  { label: "Blacklisted IPs", key: "blacklist", accent: "text-neon-red" }
];

export default async function AdminHomePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/admin");

  const { data: prof } = await supabase
    .from("profiles")
    .select("id, is_admin, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!prof?.is_admin) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-5 py-8 text-center">
        <Logo className="h-10 w-10" />
        <Wordmark className="mt-3 text-2xl" />
        <p className="mt-6 text-sm text-white/70">
          The owner portal is restricted. Set{" "}
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

  const { data } = await supabase.rpc("admin_overview");
  const o = (data ?? {}) as Overview;
  const n = (k: string) => (typeof o[k] === "number" ? o[k]!.toLocaleString() : "—");

  const modules: { href: string; emoji: string; title: string; desc: string; badge?: number }[] = [
    { href: "/admin/abuse", emoji: "🚫", title: "Abuse & IP blacklist", desc: "Flagged events, blacklist IPs, export for authorities.", badge: o.abuse_24h },
    { href: "/admin/reports", emoji: "🚩", title: "Reports", desc: "User / room / message safety queue.", badge: o.reports_open },
    { href: "/admin/verifications", emoji: "🪪", title: "Verifications", desc: "Student / identity verification queue." },
    { href: "/admin/doctors", emoji: "🩺", title: "Doctors", desc: "Medical-council verification queue." },
    { href: "/admin/books", emoji: "📚", title: "Books", desc: "Library moderation & takedowns." },
    { href: "/admin/publications", emoji: "📖", title: "Publications", desc: "Read/Write moderation & reports." }
  ];

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

      <section className="surface-glass tint-purple mt-8 p-7 sm:p-9">
        <p className="text-[10px] uppercase tracking-widest text-neon-purple/80">
          🛠 Owner portal
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-white">
          Everything, at a glance
        </h1>
        <p className="mt-2 text-sm text-white/70">
          Welcome back{prof.display_name ? `, ${prof.display_name}` : ""}. Live platform
          metrics and every moderation control in one place.
        </p>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.key} className="surface-glass p-4">
            <p className={`font-display text-2xl font-semibold ${s.accent ?? "text-white"}`}>
              {n(s.key)}
            </p>
            <p className="mt-0.5 text-[11px] uppercase tracking-widest text-white/45">
              {s.label}
            </p>
          </div>
        ))}
      </section>

      <h2 className="mt-8 font-display text-lg font-semibold text-white">Controls</h2>
      <section className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="surface-glass flex items-start gap-3 p-4 transition hover:bg-white/[0.07]"
          >
            <span className="text-2xl">{m.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-display text-[15px] font-semibold text-white">
                  {m.title}
                </span>
                {!!m.badge && m.badge > 0 && (
                  <span className="rounded-full bg-neon-red/20 px-2 text-[10px] font-semibold text-neon-red">
                    {m.badge}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-[12px] text-white/55">{m.desc}</span>
            </span>
            <span aria-hidden className="text-white/40">→</span>
          </Link>
        ))}
      </section>

      <footer className="mt-8 text-center text-[11px] text-white/30">
        Owner-only · handle member data lawfully.
      </footer>
    </main>
  );
}
