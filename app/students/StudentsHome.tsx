"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { BeaconCompose } from "./BeaconCompose";
import { BeaconCard } from "./BeaconCard";
import { HelperSidebar } from "./HelperSidebar";

const TIER_BADGE: Record<string, { label: string; color: string }> = {
  student:        { label: "Student",         color: "text-neon-mint border-neon-mint/40 bg-neon-mint/10" },
  senior_student: { label: "Senior Student",  color: "text-neon-blue border-neon-blue/40 bg-neon-blue/10" },
  educator:       { label: "Educator",        color: "text-neon-purple border-neon-purple/40 bg-neon-purple/10" },
  professor:      { label: "Professor",       color: "text-neon-amber border-neon-amber/40 bg-neon-amber/10" },
  domain_expert:  { label: "Domain Expert",   color: "text-neon-red border-neon-red/40 bg-neon-red/10" }
};

type Verif = {
  id: string;
  status: string;
  country: string;
  education_level: string;
  syllabus: string | null;
  institution: string | null;
  badge_tier: string;
  subject_affinities: string[];
  is_minor: boolean;
  verified_at: string | null;
  expires_at: string | null;
};

type TabId = "beacons" | "rooms" | "discover" | "network";

export function StudentsHome({
  currentUserId,
  verification
}: {
  currentUserId: string;
  verification: Verif;
}) {
  const [tab, setTab] = useState<TabId>("beacons");
  const [composeOpen, setComposeOpen] = useState(false);
  const badge = TIER_BADGE[verification.badge_tier] ?? TIER_BADGE.student;

  return (
    <section className="mt-5">
      {/* Tier banner */}
      <div className="surface-glass mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={clsx(
              "rounded-md border px-2 py-0.5 text-[11px] uppercase tracking-widest",
              badge?.color
            )}
          >
            🎓 {badge?.label ?? verification.badge_tier}
          </span>
          <span className="text-[11px] text-white/55">
            {verification.country} · {verification.education_level}
            {verification.syllabus ? ` · ${verification.syllabus}` : ""}
            {verification.institution ? ` · ${verification.institution}` : ""}
          </span>
          {verification.is_minor && (
            <span className="rounded-md border border-neon-amber/40 bg-neon-amber/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-neon-amber">
              🛡 minor mode — recording on
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setComposeOpen(true)}
          className="rounded-xl bg-neon-red px-4 py-2 text-sm font-semibold text-white shadow-glow-red hover:bg-neon-red/90"
        >
          🆘 Fire a beacon
        </button>
      </div>

      {/* Sub-tabs */}
      <nav className="surface-glass flex overflow-x-auto px-1 py-1 text-sm">
        {([
          ["beacons",  "🔔 Beacons"],
          ["rooms",    "📚 My Rooms"],
          ["discover", "🌍 Discover"],
          ["network",  "👥 Network"]
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={clsx(
              "rounded-lg px-3 py-1.5 transition",
              tab === id
                ? "bg-white/10 text-white"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div>
          {tab === "beacons"  && <BeaconsTab currentUserId={currentUserId} subjects={verification.subject_affinities} />}
          {tab === "rooms"    && <RoomsTab  />}
          {tab === "discover" && <DiscoverTab />}
          {tab === "network"  && <NetworkTab currentUserId={currentUserId} />}
        </div>
        <aside className="space-y-5">
          <HelperSidebar currentUserId={currentUserId} />

          <section className="surface-glass tint-mint p-4">
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              Karo, the study brain
            </p>
            <div className="mt-2 space-y-1.5 text-sm">
              <button className="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-left text-white/85 hover:bg-white/10">
                🍅 Karo, study with me (25-min Pomodoro)
              </button>
              <Link href="/students/notes" className="block rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/85 hover:bg-white/10">
                📓 My notes
              </Link>
              <Link href="/students/squads" className="block rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/85 hover:bg-white/10">
                🧠 Study squads
              </Link>
            </div>
          </section>
        </aside>
      </div>

      {composeOpen && (
        <BeaconCompose
          onClose={() => setComposeOpen(false)}
          defaultSubject={verification.subject_affinities[0] ?? ""}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
function BeaconsTab({
  currentUserId,
  subjects
}: {
  currentUserId: string;
  subjects: string[];
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [beacons, setBeacons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("help_beacons")
        .select("*")
        .in("status", ["routing", "answered"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled) {
        setBeacons((data ?? []).filter((b) => b.asker_profile_id === currentUserId || subjects.includes(b.subject)));
        setLoading(false);
      }
    })();
    const channel = supabase
      .channel("beacons-feed")
      .on("postgres_changes",
          { event: "*", schema: "public", table: "help_beacons" },
          (payload) => {
            const b = (payload.new ?? payload.old) as any;
            if (!b) return;
            setBeacons((prev) => {
              const without = prev.filter((x) => x.id !== b.id);
              if (payload.eventType === "DELETE") return without;
              if (b.status === "expired" || b.status === "cancelled") return without;
              if (b.asker_profile_id === currentUserId || subjects.includes(b.subject)) {
                return [b, ...without];
              }
              return without;
            });
          })
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, currentUserId, subjects]);

  if (loading) return <p className="text-sm text-white/45">Loading beacons…</p>;
  if (beacons.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/55">
        No live beacons matching your subjects right now. Try firing one of
        your own — Karo will route it.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {beacons.map((b) => (
        <BeaconCard key={b.id} beacon={b} currentUserId={currentUserId} />
      ))}
    </ul>
  );
}

function RoomsTab() {
  return (
    <section className="surface-glass p-5">
      <p className="text-[10px] uppercase tracking-widest text-white/40">
        My subject + cohort rooms
      </p>
      <p className="mt-2 text-sm text-white/70">
        Subject rooms in your syllabus, your cohort rooms, and your study
        squads will surface here.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/rooms"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
        >
          Browse all rooms →
        </Link>
        <Link
          href="/students/squads"
          className="rounded-lg border border-neon-mint/40 bg-neon-mint/10 px-3 py-1.5 text-xs text-neon-mint hover:bg-neon-mint/20"
        >
          🧠 My study squads →
        </Link>
      </div>
    </section>
  );
}

function DiscoverTab() {
  return (
    <section className="surface-glass p-5">
      <p className="text-[10px] uppercase tracking-widest text-white/40">
        Discover by country + level + exam
      </p>
      <p className="mt-2 text-sm text-white/70">
        Drill into syllabuses, exams (JEE / NEET / SAT / MCAT / CFA…),
        institutions, and interdisciplinary fields. We seeded ~500 subject
        rooms at launch and add more as helpers verify.
      </p>
      <p className="mt-2 text-[11px] text-white/45">
        Use the catalog tree on the main /rooms page for the full structure;
        Students-only filtering lands in the next iteration.
      </p>
    </section>
  );
}

function NetworkTab({ currentUserId }: { currentUserId: string }) {
  return (
    <section className="surface-glass p-5">
      <p className="text-[10px] uppercase tracking-widest text-white/40">
        People
      </p>
      <ul className="mt-3 space-y-2 text-sm text-white/85">
        <li>👤 People you&apos;ve helped — coming as you complete sessions.</li>
        <li>🤝 Your helpers — coming as helpers help you.</li>
        <li>🧭 Find a study buddy — Karo matches by subject+level+time-of-day.</li>
        <li>🧑‍🏫 Verified professors directory.</li>
      </ul>
      <p className="mt-3 text-[11px] text-white/45">
        Network surfaces unlock once you&apos;ve participated in 1+ Help
        Beacon session.
      </p>
    </section>
  );
}
