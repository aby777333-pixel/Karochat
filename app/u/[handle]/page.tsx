import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { PresenceDot } from "@/components/PresenceDot";
import { ReportProfileButton } from "./ReportProfileButton";

export const dynamic = "force-dynamic";

type PublicProfile = {
  id: string;
  username: string;
  display_name: string | null;
  is_guest: boolean | null;
  presence_state: string | null;
  status_text: string | null;
  status_emoji: string | null;
  mood: string | null;
  mood_expires_at: string | null;
  traveling_in_city: string | null;
  traveling_until: string | null;
  bio_drop: string | null;
  bio_drop_updated_at: string | null;
  created_at: string;
  vibe_kindness: number;
  vibe_realness: number;
  vibe_quality: number;
  vouch_count: number;
};

type Vouch = {
  id: string;
  note: string;
  created_at: string;
  voucher_username: string | null;
  voucher_display_name: string | null;
  voucher_is_guest: boolean | null;
  voucher_presence_state: string | null;
};

async function loadProfile(handle: string): Promise<PublicProfile | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.rpc("get_public_profile", {
    p_username: handle
  });
  const rows = (data ?? []) as PublicProfile[];
  return rows[0] ?? null;
}

async function loadVouches(profileId: string): Promise<Vouch[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("vouches_received_view")
    .select("*")
    .eq("vouched_id", profileId)
    .limit(12);
  return ((data ?? []) as Vouch[]);
}

export async function generateMetadata({
  params
}: {
  params: { handle: string };
}): Promise<Metadata> {
  const handle = params.handle.toLowerCase().replace(/^@/, "");
  const profile = await loadProfile(handle);
  if (!profile) return { title: "Profile · Karochat" };
  const name = profile.display_name ?? `@${profile.username}`;
  return {
    title: `${name} · Karochat`,
    description: `${name}'s profile on Karochat — chat, make friends, share, care.`,
    openGraph: {
      title: `${name} · Karochat`,
      description: `${name}'s profile on Karochat.`,
      type: "profile"
    }
  };
}

const MOOD_EMOJI: Record<string, string> = {
  chatty: "💬", quiet: "🤫", flirty: "😘", focused: "🎯",
  low: "🌧️", celebrating: "🎉", lonely: "🌒", horny: "🔥",
  processing: "🌀"
};

function moodLive(p: PublicProfile) {
  if (!p.mood) return null;
  if (p.mood_expires_at && new Date(p.mood_expires_at) <= new Date()) return null;
  return p.mood;
}
function travelLive(p: PublicProfile) {
  if (!p.traveling_in_city) return null;
  if (p.traveling_until && new Date(p.traveling_until) <= new Date()) return null;
  return p.traveling_in_city;
}

export default async function ProfilePage({
  params
}: {
  params: { handle: string };
}) {
  const handle = params.handle.toLowerCase().replace(/^@/, "").trim();
  if (!handle) notFound();

  const profile = await loadProfile(handle);
  if (!profile) notFound();

  const vouches = await loadVouches(profile.id);
  const mood = moodLive(profile);
  const travel = travelLive(profile);
  const name = profile.display_name ?? `@${profile.username}`;
  const since = new Date(profile.created_at);
  const sinceText = since.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-5 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-7 w-7" />
          <Wordmark className="text-lg" />
        </Link>
        <Link
          href="/rooms"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
        >
          ← Rooms
        </Link>
      </header>

      <section className="surface-glass tint-purple mt-8 p-7 sm:p-9">
        <div className="flex items-start gap-4">
          <Avatar name={name} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-xs">
              <PresenceDot state={profile.presence_state ?? "offline"} pulse />
              <span className="font-mono uppercase tracking-widest text-white/55">
                {profile.presence_state ?? "offline"}
              </span>
              {profile.is_guest && (
                <span className="rounded-sm bg-white/10 px-1 text-[9px] uppercase tracking-widest text-white/55">
                  guest
                </span>
              )}
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-white">
              {name}
            </h1>
            <p className="font-mono text-sm text-white/55">@{profile.username}</p>
            {(profile.status_text || mood || travel) && (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/85">
                {profile.status_text && (
                  <span>
                    {profile.status_emoji ? `${profile.status_emoji} ` : ""}
                    {profile.status_text}
                  </span>
                )}
                {mood && (
                  <span className="rounded-sm bg-neon-purple/15 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-neon-purple">
                    {MOOD_EMOJI[mood] ?? "·"} {mood}
                  </span>
                )}
                {travel && (
                  <span className="rounded-sm bg-neon-amber/15 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-neon-amber">
                    🧳 visiting {travel}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={`/meet/${profile.username}`}
            className="rounded-xl bg-neon-blue px-4 py-2 text-sm font-medium text-ink-900 shadow-glow-blue hover:bg-neon-blue/90"
          >
            📞 Meet {name}
          </Link>
          <Link
            href="/rooms"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Find more people
          </Link>
          <ReportProfileButton
            profileId={profile.id}
            handle={profile.username}
          />
        </div>

        {profile.bio_drop && (
          <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-3 text-sm leading-relaxed text-white/80">
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              Bio drop
            </p>
            <p className="mt-1.5 whitespace-pre-wrap">{profile.bio_drop}</p>
          </div>
        )}

        <p className="mt-5 text-[11px] text-white/35">
          On Karochat since {sinceText}
        </p>
      </section>

      {/* Vibes */}
      <section className="surface-glass tint-blue mt-5 p-5">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          Vibes received
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <VibeTile label="kind"    emoji="🌷" count={profile.vibe_kindness} />
          <VibeTile label="real"    emoji="✨" count={profile.vibe_realness} />
          <VibeTile label="quality" emoji="🎯" count={profile.vibe_quality}  />
        </div>
        <p className="mt-3 text-[11px] text-white/45">
          Karochat doesn&apos;t show follower counts. Vibes are positive-only
          and given one per day from people who&apos;ve interacted with them.
        </p>
      </section>

      {/* Vouches */}
      <section className="surface-glass tint-mint mt-5 p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-[10px] uppercase tracking-widest text-white/40">
            Vouches · {profile.vouch_count}
          </p>
          {profile.vouch_count > vouches.length && (
            <span className="text-[10px] text-white/40">
              showing {vouches.length}
            </span>
          )}
        </div>
        {vouches.length === 0 ? (
          <p className="mt-3 text-sm text-white/55">
            No vouches yet. People can vouch for {name} once they&apos;ve
            spent time together.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {vouches.map((v) => {
              const vname =
                v.voucher_display_name ?? v.voucher_username ?? "someone";
              return (
                <li
                  key={v.id}
                  className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm"
                >
                  <p className="text-white/85">&ldquo;{v.note}&rdquo;</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/45">
                    <PresenceDot
                      state={v.voucher_presence_state ?? "offline"}
                    />
                    <span>— {vname}</span>
                    {v.voucher_username && (
                      <Link
                        href={`/u/${v.voucher_username}`}
                        className="text-white/40 hover:text-white"
                      >
                        @{v.voucher_username}
                      </Link>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="mt-8 space-y-1 text-center text-[11px] text-white/30">
        <p>Be kind. Be real. Live and let live.</p>
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link href="/charter" className="hover:text-white">
            The People&apos;s Charter
          </Link>
          <span aria-hidden>·</span>
          <a href="mailto:info@karochat.co" className="hover:text-white">
            info@karochat.co
          </a>
        </p>
      </footer>
    </main>
  );
}

function VibeTile({
  emoji,
  label,
  count
}: {
  emoji: string;
  label: string;
  count: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-black/25 px-3 py-3">
      <span aria-hidden className="text-2xl">{emoji}</span>
      <span className="font-mono text-lg text-white">{count}</span>
      <span className="text-[10px] uppercase tracking-widest text-white/45">
        {label}
      </span>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .replace(/^@/, "")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = (name.charCodeAt(0) * 37) % 360;
  return (
    <div
      className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl font-mono text-lg font-semibold text-ink-900"
      style={{
        background: `linear-gradient(135deg, hsl(${hue},80%,65%), hsl(${(hue + 60) % 360},80%,55%))`
      }}
    >
      {initials || "?"}
    </div>
  );
}
