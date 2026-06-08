// Karochat — /sexed (v9 Phase 3)
//
// Sex education library landing. Server-rendered. Age-tier filtering
// happens inside list_sexed_articles RPC — we never have to know the
// user's birth year client-side.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { AccountMenu } from "@/components/AccountMenu";
import { BirthYearCard, AdultAttestCard } from "./_components/AgeGate";
import { CrisisHelplineCard } from "./_components/CrisisHelplineCard";
import { ChildSafetyCard } from "./_components/ChildSafetyCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sex education · Karochat",
  description:
    "Karochat sex education library — bodies, consent, contraception, STIs, pleasure, queer-affirming, age-tiered."
};

type Article = {
  id: string;
  slug: string;
  title: string;
  topic: string | null;
  language: string;
  age_band: "13_15" | "16_17" | "18plus" | "all";
  region_tags: string[];
  view_count: number;
  created_at: string;
};

type Helpline = {
  id: string;
  country: string;
  kind: string;
  name: string;
  phone: string | null;
  sms: string | null;
  url: string | null;
  hours: string | null;
  languages: string[] | null;
  notes: string | null;
};

const TOPIC_GROUPS: Array<{ key: string; label: string; emoji: string }> = [
  { key: "puberty", label: "Puberty & bodies", emoji: "🌱" },
  { key: "consent", label: "Consent", emoji: "🤝" },
  { key: "identity", label: "Identity & orientation", emoji: "🌈" },
  { key: "safety", label: "Safety & abuse", emoji: "🛡️" },
  { key: "readiness", label: "Ready or not", emoji: "💭" },
  { key: "contraception", label: "Contraception", emoji: "💊" },
  { key: "sti", label: "STIs", emoji: "🧪" },
  { key: "pleasure", label: "Pleasure & anatomy", emoji: "💗" },
  { key: "technique", label: "Sex — technique", emoji: "🔥" },
  { key: "relationships", label: "Relationships & non-monogamy", emoji: "💞" },
  { key: "queer", label: "LGBTQ-specific", emoji: "🏳️‍🌈" },
  { key: "kink", label: "Kink & BDSM", emoji: "🪢" }
];

const AGE_LABEL: Record<string, { label: string; tint: string }> = {
  "13_15": { label: "13–15", tint: "border-neon-blue/40 bg-neon-blue/10 text-neon-blue" },
  "16_17": { label: "16–17", tint: "border-neon-amber/40 bg-neon-amber/10 text-neon-amber" },
  "18plus": { label: "18+", tint: "border-neon-red/40 bg-neon-red/10 text-neon-red" },
  all: { label: "All ages", tint: "border-white/15 bg-white/5 text-white/70" }
};

export default async function SexEdPage({
  searchParams
}: {
  searchParams?: { topic?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/sexed");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, privacy_mode, birth_year, adult_attested_at"
    )
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");

  const currentYear = new Date().getFullYear();
  const birthYear = (profile as any)?.birth_year as number | null;
  const adultAttested = !!(profile as any)?.adult_attested_at;
  const age = birthYear ? currentYear - birthYear : null;
  const showAttestCard = age !== null && age >= 18 && !adultAttested;
  const showBirthYearCard = birthYear === null;

  const topic = searchParams?.topic?.trim() || null;

  const [bandResp, articlesResp, helplineResp] = await Promise.all([
    supabase.rpc("current_user_age_band"),
    supabase.rpc("list_sexed_articles", {
      p_topic: topic,
      p_language: "en",
      p_limit: 100
    }),
    supabase.rpc("list_helplines_for", {
      p_country: "IN",
      p_kinds: null
    })
  ]);
  const band = (bandResp.data ?? "16_17") as
    | "13_15"
    | "16_17"
    | "18plus"
    | "unset";
  const articles = (articlesResp.data ?? []) as Article[];
  const helplines = (helplineResp.data ?? []) as Helpline[];

  // Group articles by topic for nicer browsing.
  const byTopic = new Map<string, Article[]>();
  for (const a of articles) {
    const key = a.topic ?? "misc";
    if (!byTopic.has(key)) byTopic.set(key, []);
    byTopic.get(key)!.push(a);
  }
  const topicsOnPage = TOPIC_GROUPS.filter((g) => byTopic.has(g.key));

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-3 py-6 md:py-8">
      <header className="surface-glass flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/rooms" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs sm:justify-end md:gap-3">
          <Link
            href="/sexed/ask"
            className="rounded-lg border border-neon-mint/40 bg-neon-mint/10 px-3 py-1.5 text-neon-mint hover:bg-neon-mint/20"
          >
            💬 Ask anonymously
          </Link>
          <Link
            href="/rooms"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
          >
            ← Rooms
          </Link>
          <AccountMenu
            username={profile.username as string}
            displayName={profile.display_name as string | null}
            avatarUrl={(profile as any).avatar_url ?? null}
            initialPrivacyMode={
              ((profile as any).privacy_mode as
                | "open"
                | "friends_only"
                | "invisible"
                | "decoy"
                | "stealth") ?? "open"
            }
          />
        </div>
      </header>

      <section className="surface-glass mt-6 rounded-3xl border border-neon-mint/25 bg-gradient-to-br from-neon-mint/10 via-transparent to-neon-blue/5 p-6 sm:p-9">
        <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
          💞 Sex ed · v9 · {articles.length} articles
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-white sm:text-4xl">
          Honest, queer-affirming, age-appropriate.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">
          Medically accurate articles about bodies, consent, identity,
          contraception, STIs, pleasure, and relationships — written for
          three age tiers. Plus an anonymous &quot;ask Karo&quot; for the
          questions you can&apos;t Google in peace. This is education, not
          medical care.
        </p>
        <p className="mt-3 inline-block rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-widest text-white/65">
          You&apos;re seeing:{" "}
          <span className="text-white">
            {band === "18plus"
              ? "the full 18+ library"
              : band === "16_17"
              ? "13-15 + 16-17 articles"
              : "13-15 articles"}
          </span>
        </p>
      </section>

      {showBirthYearCard && <BirthYearCard currentYear={currentYear} />}
      {showAttestCard && <AdultAttestCard />}

      <ChildSafetyCard />

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          {topic && (
            <div className="mb-3 flex items-center gap-2 text-[12px]">
              <span className="text-white/55">Filtered to:</span>
              <span className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-white/80">
                {TOPIC_GROUPS.find((g) => g.key === topic)?.label ?? topic}
              </span>
              <Link
                href="/sexed"
                className="ml-1 text-neon-blue underline-offset-2 hover:underline"
              >
                clear
              </Link>
            </div>
          )}

          {topicsOnPage.length === 0 ? (
            <div className="surface-glass p-7 text-center text-sm text-white/55">
              Nothing matches that filter yet — try a different topic.
            </div>
          ) : (
            <div className="space-y-7">
              {topicsOnPage.map((g) => (
                <section key={g.key}>
                  <p className="text-[10px] uppercase tracking-widest text-white/45">
                    {g.emoji} {g.label}
                  </p>
                  <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(byTopic.get(g.key) ?? []).map((a) => {
                      const ag = AGE_LABEL[a.age_band] ?? AGE_LABEL.all!;
                      return (
                        <li key={a.id}>
                          <Link
                            href={`/sexed/${a.slug}`}
                            className="surface-glass block h-full p-3 transition hover:bg-white/10"
                          >
                            <div className="flex items-baseline gap-2">
                              <span className="font-display text-[15px] font-semibold text-white">
                                {a.title}
                              </span>
                              <span
                                className={`rounded-sm border px-1 text-[10px] uppercase tracking-widest ${ag.tint}`}
                              >
                                {ag.label}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-white/45">
                              {a.view_count} reads
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <nav className="surface-glass p-4">
            <p className="text-[10px] uppercase tracking-widest text-white/45">
              Browse by topic
            </p>
            <ul className="mt-2 space-y-1 text-[13px]">
              {TOPIC_GROUPS.map((g) => (
                <li key={g.key}>
                  <Link
                    href={`/sexed?topic=${g.key}`}
                    className={
                      "block rounded-md px-2 py-1 transition " +
                      (topic === g.key
                        ? "bg-neon-mint/15 text-neon-mint"
                        : "text-white/75 hover:bg-white/5 hover:text-white")
                    }
                  >
                    {g.emoji} {g.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <CrisisHelplineCard helplines={helplines.slice(0, 5)} compact />
        </aside>
      </section>

      <section className="surface-glass tint-amber mt-8 rounded-2xl p-5">
        <p className="text-[10px] uppercase tracking-widest text-neon-amber/80">
          📜 This is education, not medical care
        </p>
        <p className="mt-2 text-sm leading-relaxed text-white/80">
          These articles are written by educators, not doctors. They&apos;re
          accurate to the best of our knowledge as of writing, but every
          body and every relationship is different. If something is hurting,
          bleeding, infected, or causing distress that interferes with
          sleep / school / work — see a clinician. Karochat&apos;s Ask-a-Doctor
          tier (Phase 4) will connect you to verified medical
          professionals.
        </p>
      </section>

      <footer className="mt-10 text-center text-[11px] text-white/30">
        20 starter articles · more coming · Karo will answer specific questions anonymously.
      </footer>
    </main>
  );
}
