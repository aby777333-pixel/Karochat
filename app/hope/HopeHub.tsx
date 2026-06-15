"use client";

// Karochat — Hope hub. A warm, life-affirming place for anyone struggling:
// crisis & distress helplines (country-wise + global directories), real rooms to
// talk and be heard, ways to volunteer/help, and ways to give. Helplines lead —
// this is peer support, not a crisis service.
//
// Reuses the tested rooms infra (browse_catalog + join_public_room). Helpline
// and resource data is curated & static; global directories cover every country.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Line = { name: string; contact: string; note?: string };
type CountryLines = { country: string; flag: string; items: Line[] };
type RoomRow = { id: string; name: string; topic: string | null; member_count: number };

// Global directories that cover (nearly) every country — the safest "all
// countries" answer, kept first.
const GLOBAL: Line[] = [
  { name: "Find A Helpline (130+ countries)", contact: "findahelpline.com", note: "Free, confidential helplines for your exact country." },
  { name: "Befrienders Worldwide", contact: "befrienders.org", note: "Emotional-support centres around the world." },
  { name: "IASP Crisis Centres", contact: "iasp.info/resources/Crisis_Centres", note: "International directory of crisis centres." },
  { name: "Open Counseling Hotlines", contact: "opencounseling.com/suicide-hotlines", note: "Worldwide hotline list by country." }
];

// Verified national lines (numbers can change — always confirm via Find A Helpline).
const HELPLINES: CountryLines[] = [
  { country: "United States", flag: "🇺🇸", items: [
    { name: "988 Suicide & Crisis Lifeline", contact: "Call or text 988" },
    { name: "Crisis Text Line", contact: "Text HOME to 741741" }
  ]},
  { country: "United Kingdom", flag: "🇬🇧", items: [
    { name: "Samaritans", contact: "116 123 (free, 24/7)" },
    { name: "Shout", contact: "Text SHOUT to 85258" }
  ]},
  { country: "India", flag: "🇮🇳", items: [
    { name: "Tele-MANAS (Govt of India)", contact: "14416 / 1-800-891-4416" },
    { name: "KIRAN Mental Health", contact: "1800-599-0019" },
    { name: "AASRA", contact: "+91 98204 66726" },
    { name: "Vandrevala Foundation", contact: "1860 2662 345 / +91 99996 66555" }
  ]},
  { country: "Canada", flag: "🇨🇦", items: [
    { name: "Suicide Crisis Helpline", contact: "Call or text 988" }
  ]},
  { country: "Australia", flag: "🇦🇺", items: [
    { name: "Lifeline", contact: "13 11 14" },
    { name: "Beyond Blue", contact: "1300 22 4636" }
  ]},
  { country: "New Zealand", flag: "🇳🇿", items: [
    { name: "Need to Talk?", contact: "Call or text 1737" }
  ]},
  { country: "Ireland", flag: "🇮🇪", items: [
    { name: "Samaritans", contact: "116 123" },
    { name: "Pieta", contact: "1800 247 247" }
  ]},
  { country: "Germany", flag: "🇩🇪", items: [
    { name: "Telefonseelsorge", contact: "0800 111 0 111 / 0800 111 0 222" }
  ]},
  { country: "France", flag: "🇫🇷", items: [
    { name: "Numéro national prévention suicide", contact: "3114" }
  ]},
  { country: "Spain", flag: "🇪🇸", items: [
    { name: "Línea de atención a la conducta suicida", contact: "024" }
  ]},
  { country: "Italy", flag: "🇮🇹", items: [
    { name: "Telefono Amico", contact: "02 2327 2327" }
  ]},
  { country: "Brazil", flag: "🇧🇷", items: [
    { name: "CVV (Centro de Valorização da Vida)", contact: "188" }
  ]},
  { country: "Japan", flag: "🇯🇵", items: [
    { name: "Yorisoi Hotline", contact: "0120-279-338" },
    { name: "TELL Lifeline", contact: "03-5774-0992" }
  ]},
  { country: "Singapore", flag: "🇸🇬", items: [
    { name: "Samaritans of Singapore (SOS)", contact: "1767 / 1-767" }
  ]},
  { country: "Malaysia", flag: "🇲🇾", items: [
    { name: "Befrienders KL", contact: "03-7627 2929" }
  ]},
  { country: "South Africa", flag: "🇿🇦", items: [
    { name: "SADAG Suicide Crisis Line", contact: "0800 567 567" }
  ]}
];

const DONATE: { name: string; url: string; blurb: string }[] = [
  { name: "GlobalGiving", url: "https://www.globalgiving.org", blurb: "Vetted grassroots projects worldwide." },
  { name: "GoFundMe", url: "https://www.gofundme.com", blurb: "Start or support a personal fundraiser." },
  { name: "UNICEF", url: "https://www.unicef.org/donate", blurb: "Help children survive and thrive." },
  { name: "Save the Children", url: "https://www.savethechildren.org", blurb: "Health, education & protection for kids." },
  { name: "DonorsChoose (education)", url: "https://www.donorschoose.org", blurb: "Fund classroom & education projects." },
  { name: "GiveIndia", url: "https://www.giveindia.org", blurb: "Trusted Indian NGOs & causes." },
  { name: "Ketto", url: "https://www.ketto.org", blurb: "Crowdfunding for medical & social causes (India)." },
  { name: "Milaap", url: "https://milaap.org", blurb: "Crowdfunding for medical, education & more (India)." }
];

const RESOURCES: { name: string; url: string; blurb: string }[] = [
  { name: "WHO — Mental Health", url: "https://www.who.int/health-topics/mental-health", blurb: "Trusted global mental-health information." },
  { name: "Crisis Text Line", url: "https://www.crisistextline.org", blurb: "Free 24/7 text-based crisis support." },
  { name: "RAINN (sexual assault)", url: "https://www.rainn.org", blurb: "Support after sexual assault/abuse (US)." },
  { name: "Childhelp (child abuse)", url: "https://www.childhelp.org", blurb: "Help for child abuse — 1-800-422-4453 (US)." },
  { name: "Child Helpline International", url: "https://childhelplineinternational.org", blurb: "Find a child helpline in your country." },
  { name: "7 Cups (free listeners)", url: "https://www.7cups.com", blurb: "Free emotional support from trained listeners." }
];

export function HopeHub({ userId }: { userId: string; userName: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  void userId;

  const [country, setCountry] = useState("International");
  const [talkRooms, setTalkRooms] = useState<RoomRow[]>([]);
  const [helperRooms, setHelperRooms] = useState<RoomRow[]>([]);
  const [giveRooms, setGiveRooms] = useState<RoomRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [talk, peer, helpers, give] = await Promise.all([
          supabase.rpc("browse_catalog", { p_category_slug: "support", p_subcategory_slug: "sup-talk", p_limit: 20 }),
          supabase.rpc("browse_catalog", { p_category_slug: "support", p_subcategory_slug: "sup-peer", p_limit: 20 }),
          supabase.rpc("browse_catalog", { p_category_slug: "support", p_subcategory_slug: "sup-helpers", p_limit: 20 }),
          supabase.rpc("browse_catalog", { p_category_slug: "support", p_subcategory_slug: "sup-give", p_limit: 20 })
        ]);
        if (cancelled) return;
        setTalkRooms([...(talk.data ?? []), ...(peer.data ?? [])] as RoomRow[]);
        setHelperRooms((helpers.data ?? []) as RoomRow[]);
        setGiveRooms((give.data ?? []) as RoomRow[]);
      } catch {
        if (!cancelled) setError("Couldn't load support rooms — the helplines below still work.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function joinRoom(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      const { error: e } = await supabase.rpc("join_public_room", { p_room_id: id });
      if (e && !e.message.includes("already")) throw e;
      router.push(`/rooms/${id}`);
    } catch (e: any) {
      setError(e?.message ?? "Could not join.");
      setBusy(null);
    }
  }

  const selected = HELPLINES.find((c) => c.country === country);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <section className="surface-glass tint-purple p-5">
        <h1 className="font-display text-2xl font-semibold leading-tight">
          Eight billion people on earth and you feel there&apos;s no one to talk to?
        </h1>
        <p className="mt-2 text-base text-neon-mint">Wrong — we are all here for you. 💙</p>
        <p className="mt-2 text-sm text-white/65">
          Whatever you&apos;re carrying, you don&apos;t have to carry it alone. Reach a
          trained helpline, talk to someone here who&apos;ll listen, lend a hand to
          someone else, or help fund a cause. You matter.
        </p>
      </section>

      {/* Emergency banner */}
      <section className="rounded-2xl border border-neon-red/40 bg-neon-red/10 p-4">
        <p className="text-sm font-semibold text-white">In immediate danger?</p>
        <p className="mt-1 text-sm text-white/75">
          If you or someone else is in danger right now, please call your local
          emergency number (e.g. <span className="text-white">112</span>,{" "}
          <span className="text-white">911</span>, <span className="text-white">999</span>,{" "}
          <span className="text-white">000</span>, <span className="text-white">112/100</span>)
          or go to the nearest emergency room. You deserve immediate help.
        </p>
      </section>

      {/* Helplines */}
      <section className="surface-glass p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Crisis &amp; distress helplines</h2>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white/85 outline-none focus:border-neon-purple/60"
          >
            <option value="International">🌍 International</option>
            {HELPLINES.map((c) => (
              <option key={c.country} value={c.country}>
                {c.flag} {c.country}
              </option>
            ))}
          </select>
        </div>

        {/* Global directories — always shown */}
        <div className="rounded-xl border border-neon-mint/30 bg-neon-mint/5 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-neon-mint">
            🌍 Find a helpline anywhere
          </p>
          <ul className="space-y-1.5">
            {GLOBAL.map((l) => (
              <li key={l.name} className="text-sm">
                <a
                  href={`https://${l.contact.replace(/^https?:\/\//, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-neon-mint hover:underline"
                >
                  {l.name} ↗
                </a>
                {l.note && <span className="block text-[11px] text-white/45">{l.note}</span>}
              </li>
            ))}
          </ul>
        </div>

        {/* Selected country */}
        {selected ? (
          <div className="mt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/45">
              {selected.flag} {selected.country}
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {selected.items.map((l) => (
                <li key={l.name} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                  <p className="text-sm font-medium text-white">{l.name}</p>
                  <p className="text-sm text-neon-blue">{l.contact}</p>
                  {l.note && <p className="text-[11px] text-white/45">{l.note}</p>}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-sm text-white/55">
            Pick your country above, or use <span className="text-neon-mint">Find A Helpline</span> for
            any country in the world.
          </p>
        )}
        <p className="mt-3 text-[10px] leading-relaxed text-white/35">
          Numbers can change — if one doesn&apos;t connect, use Find A Helpline to get
          the current line for your country. These services are free and confidential.
        </p>
      </section>

      {/* Talk to someone now */}
      <RoomList
        title="Talk to someone now"
        subtitle="Free peer-support rooms — be heard, no judgement"
        rooms={talkRooms}
        busy={busy}
        onJoin={joinRoom}
        emptyHref="/rooms"
      />

      {/* Become a helper */}
      <RoomList
        title="Want to help others?"
        subtitle="Lend a caring ear — join the helpers & listeners"
        rooms={helperRooms}
        busy={busy}
        onJoin={joinRoom}
        emptyHref="/rooms"
        accent="mint"
      />

      {/* Give & fundraise */}
      <section className="surface-glass p-4">
        <h2 className="font-display text-lg font-semibold">Give &amp; raise help</h2>
        <p className="mt-0.5 text-[11px] text-white/50">
          Fund a cause, help a child&apos;s education, or rally support for someone in
          need — through trusted platforms or our community rooms.
        </p>
        {giveRooms.length > 0 && (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {giveRooms.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => void joinRoom(r.id)}
                  disabled={!!busy}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-left transition hover:border-neon-purple/40 hover:bg-white/5 disabled:opacity-50"
                >
                  <span className="min-w-0 truncate text-sm text-white/90">{r.name}</span>
                  <span className="shrink-0 rounded-md border border-neon-purple/30 bg-neon-purple/10 px-2 py-0.5 text-[11px] text-neon-purple">
                    {busy === r.id ? "…" : "Open →"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/45">
          Trusted platforms
        </p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DONATE.map((d) => (
            <li key={d.name}>
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 transition hover:border-neon-mint/40 hover:bg-white/5"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-white">{d.name}</span>
                  <span className="shrink-0 text-[11px] text-neon-mint">Open ↗</span>
                </span>
                <span className="mt-0.5 block text-[11px] text-white/55">{d.blurb}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Resources */}
      <section className="surface-glass p-4">
        <h2 className="font-display text-lg font-semibold">More help &amp; resources</h2>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {RESOURCES.map((r) => (
            <li key={r.name}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 transition hover:border-neon-blue/40 hover:bg-white/5"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-white">{r.name}</span>
                  <span className="shrink-0 text-[11px] text-neon-blue">Open ↗</span>
                </span>
                <span className="mt-0.5 block text-[11px] text-white/55">{r.blurb}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {error && (
        <p className="rounded-md bg-neon-red/10 px-3 py-1.5 text-xs text-neon-red">{error}</p>
      )}

      <p className="px-1 text-[10px] leading-relaxed text-white/35">
        Karochat rooms are peer support from real people — caring, but not a
        substitute for professional or emergency help. If you&apos;re in crisis,
        please reach a helpline above. You are not alone, and things can get better.
      </p>
    </div>
  );
}

function RoomList({
  title,
  subtitle,
  rooms,
  busy,
  onJoin,
  emptyHref,
  accent = "purple"
}: {
  title: string;
  subtitle: string;
  rooms: RoomRow[];
  busy: string | null;
  onJoin: (id: string) => void;
  emptyHref: string;
  accent?: "purple" | "mint";
}) {
  return (
    <section className="surface-glass p-4">
      <div className="mb-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="text-[11px] text-white/50">{subtitle}</p>
      </div>
      {rooms.length === 0 ? (
        <a
          href={emptyHref}
          className="block rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-center text-sm text-white/70 hover:bg-white/5"
        >
          Browse rooms →
        </a>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {rooms.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onJoin(r.id)}
                disabled={!!busy}
                className={
                  "flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-left transition hover:bg-white/5 disabled:opacity-50 " +
                  (accent === "mint" ? "hover:border-neon-mint/40" : "hover:border-neon-purple/40")
                }
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-white/90">{r.name}</span>
                  {r.topic && <span className="block truncate text-[11px] text-white/40">{r.topic}</span>}
                </span>
                <span
                  className={
                    "shrink-0 rounded-md border px-2 py-0.5 text-[11px] " +
                    (accent === "mint"
                      ? "border-neon-mint/30 bg-neon-mint/10 text-neon-mint"
                      : "border-neon-purple/30 bg-neon-purple/10 text-neon-purple")
                  }
                >
                  {busy === r.id ? "…" : "Join →"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
