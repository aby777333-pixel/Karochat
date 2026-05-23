"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";
import { BeaconCompose } from "./BeaconCompose";
import { BeaconCard } from "./BeaconCard";
import { HelperSidebar } from "./HelperSidebar";
import { StudentsLobbies } from "./StudentsLobbies";
import { StudentRoomsBrowser } from "./StudentRoomsBrowser";
import { CreateStudentRoom } from "./CreateStudentRoom";
import { VerificationGate } from "./VerificationGate";
import {
  CategoryBrowser,
  type Category,
  type Subcategory
} from "@/app/rooms/CategoryBrowser";

const TIER_BADGE: Record<string, { label: string; color: string }> = {
  student:        { label: "Student",         color: "text-neon-mint border-neon-mint/40 bg-neon-mint/10" },
  senior_student: { label: "Senior Student",  color: "text-neon-blue border-neon-blue/40 bg-neon-blue/10" },
  educator:       { label: "Educator",        color: "text-neon-purple border-neon-purple/40 bg-neon-purple/10" },
  professor:      { label: "Professor",       color: "text-neon-amber border-neon-amber/40 bg-neon-amber/10" },
  domain_expert:  { label: "Domain Expert",   color: "text-neon-red border-neon-red/40 bg-neon-red/10" }
};

export type Verif = {
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
} | null;

type TabId =
  | "lobbies"
  | "catalog"
  | "rooms"
  | "beacons"
  | "kit"
  | "network"
  | "verify";

export function StudentsHome({
  currentUserId,
  verification,
  catalogCategories,
  catalogSubcategories,
  initialTab
}: {
  currentUserId: string;
  verification: Verif;
  catalogCategories?: Category[];
  catalogSubcategories?: Subcategory[];
  initialTab?: TabId;
}) {
  const [tab, setTab] = useState<TabId>(initialTab ?? "lobbies");
  // Wave 20.1 — show the official student catalog (subjects, exams,
  // cohorts, discussion). We exclude the 'students' category itself
  // because its rooms are already surfaced by the Lobbies tab + the
  // user-created student rooms tab — keeping it here would be redundant.
  const catalogCats = (catalogCategories ?? []).filter(
    (c) => c.slug !== "students"
  );
  const catalogSubs = (catalogSubcategories ?? []).filter(
    (s) => s.category_slug !== "students"
  );
  const showCatalogTab = catalogCats.length > 0;
  const [composeOpen, setComposeOpen] = useState(false);
  const isVerified =
    !!verification && verification.status === "verified";
  const badge = verification
    ? TIER_BADGE[verification.badge_tier] ?? TIER_BADGE.student
    : null;

  return (
    <section className="mt-5">
      {/* Status banner */}
      <div className="surface-glass mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {isVerified && badge && verification ? (
            <>
              <span
                className={clsx(
                  "rounded-md border px-2 py-0.5 text-[11px] uppercase tracking-widest",
                  badge.color
                )}
              >
                🎓 {badge.label}
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
            </>
          ) : (
            <>
              <span className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-widest text-white/70">
                👋 Visitor
              </span>
              <span className="text-[11px] text-white/55">
                Lobbies + student rooms are open to everyone. Get verified to
                fire <strong>🆘 Help Beacons</strong> and unlock the helper
                network.
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isVerified && (
            <button
              type="button"
              onClick={() => {
                setTab("verify");
                queueMicrotask(() =>
                  document.getElementById("verify-card")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                  })
                );
              }}
              className="rounded-xl border border-neon-mint/40 bg-neon-mint/10 px-3 py-1.5 text-xs font-semibold text-neon-mint hover:bg-neon-mint/20"
            >
              🎓 Get verified
            </button>
          )}
          {isVerified && (
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="rounded-xl bg-neon-red px-4 py-2 text-sm font-semibold text-white shadow-glow-red hover:bg-neon-red/90"
            >
              🆘 Fire a beacon
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <nav className="surface-glass flex flex-wrap overflow-x-auto px-1 py-1 text-sm">
        {(
          [
            ["lobbies", "🛋️ Lobbies"],
            ...(showCatalogTab
              ? ([["catalog", "📚 Catalog"]] as const)
              : ([] as const)),
            ["rooms",   "🏠 Student rooms"],
            ["beacons", "🆘 Help Beacons"],
            ["kit",     "🧰 Teaching kit"],
            ["network", "👥 Network"],
            ...(isVerified
              ? ([] as const)
              : ([["verify", "🎓 Verify"]] as const))
          ] as const
        ).map(([id, label]) => (
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
          {tab === "lobbies" && (
            <div className="space-y-5">
              <StudentsLobbies />
              <CreateStudentRoom
                hint="Open a new student room and invite your study group. You'll get text, voice, video, screen-share, whiteboard, and the teaching kit."
              />
            </div>
          )}
          {tab === "catalog" && showCatalogTab && (
            isVerified ? (
              <CategoryBrowser
                categories={catalogCats}
                subcategories={catalogSubs}
                hideUserTab
                title="Browse student rooms"
                totalsHint={(c, t) => `${c} categories · ${t} rooms`}
              />
            ) : (
              <VerifyCallout
                onOpenVerify={() => setTab("verify")}
                title="The Karochat student catalog is verified-only"
                body="Subject rooms (AP, IB, A-Level, CBSE…), exam rooms (JEE, NEET, USMLE…), and university cohort rooms unlock once you verify as a student or educator. The common lobbies and the user-created student rooms above stay open to everyone."
              />
            )
          )}
          {tab === "rooms" && (
            <div className="space-y-5">
              {isVerified ? (
                <CreateStudentRoom />
              ) : (
                <VerifyCallout
                  onOpenVerify={() => setTab("verify")}
                  title="Verify to create student rooms"
                  body="Any verified student or educator can spin up a study room and invite friends. Browsing + joining the existing rooms below stays open to everyone."
                />
              )}
              <StudentRoomsBrowser />
            </div>
          )}
          {tab === "verify" && !isVerified && (
            <div id="verify-card">
              <VerificationGate existing={null} currentUserId={currentUserId} />
            </div>
          )}
          {tab === "beacons" && (
            <BeaconsTab
              currentUserId={currentUserId}
              subjects={verification?.subject_affinities ?? []}
              isVerified={isVerified}
              verification={verification}
              onOpenVerify={() => setTab("verify")}
            />
          )}
          {tab === "kit" && <TeachingKitTab />}
          {tab === "network" && <NetworkTab currentUserId={currentUserId} />}
        </div>
        <aside className="space-y-5">
          {isVerified && <HelperSidebar currentUserId={currentUserId} />}

          <PomodoroCard />

          <section className="surface-glass tint-mint p-4">
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              Karo, the study brain
            </p>
            <div className="mt-2 space-y-1.5 text-sm">
              <Link
                href="/students/notes"
                className="block rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/85 hover:bg-white/10"
              >
                📓 My notes
              </Link>
              <Link
                href="/students/squads"
                className="block rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/85 hover:bg-white/10"
              >
                🧠 Study squads
              </Link>
              <Link
                href="/students/session"
                className="block rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/85 hover:bg-white/10"
              >
                🎯 Active session
              </Link>
            </div>
          </section>
        </aside>
      </div>

      {composeOpen && (
        <BeaconCompose
          onClose={() => setComposeOpen(false)}
          defaultSubject={verification?.subject_affinities[0] ?? ""}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
function BeaconsTab({
  currentUserId,
  subjects,
  isVerified,
  verification,
  onOpenVerify
}: {
  currentUserId: string;
  subjects: string[];
  isVerified: boolean;
  verification: Verif;
  onOpenVerify: () => void;
}) {
  void verification;
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [beacons, setBeacons] = useState<any[]>([]);
  const [loading, setLoading] = useState(isVerified);

  useEffect(() => {
    if (!isVerified) {
      setLoading(false);
      return;
    }
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
  }, [supabase, currentUserId, subjects, isVerified]);

  if (!isVerified) {
    return (
      <section
        id="verify-card"
        className="surface-glass tint-mint p-6"
      >
        <h3 className="font-display text-lg font-semibold">
          Get verified to fire Help Beacons
        </h3>
        <p className="mt-2 text-sm text-white/75">
          Help Beacons are a high-trust feature — verified students and
          helpers reach each other directly. Anyone in the lobbies and the
          student rooms can chat freely without verification. Verification
          unlocks:
        </p>
        <ul className="mt-3 space-y-1 text-sm text-white/75">
          <li>🆘 Fire urgent Help Beacons (1:1 audio + whiteboard sessions)</li>
          <li>🧑‍🏫 Show up as a helper for subjects you know</li>
          <li>📅 Book / list office hours</li>
          <li>🛡️ A subject badge on your profile (Student / Senior / Educator / Professor)</li>
        </ul>
        <div className="mt-5">
          <button
            type="button"
            onClick={onOpenVerify}
            className="inline-flex items-center gap-2 rounded-xl bg-neon-mint px-4 py-2 text-sm font-semibold text-ink-900 shadow-glow hover:bg-neon-mint/90"
          >
            Start verification →
          </button>
        </div>
      </section>
    );
  }

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

function TeachingKitTab() {
  return (
    <section className="surface-glass tint-purple p-5">
      <h3 className="font-display text-lg font-semibold">🧰 Teaching kit</h3>
      <p className="mt-1 text-xs text-white/55">
        Tools you can pull into any student room or beacon session.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KitTile
          icon="🖼️"
          title="Shared whiteboard"
          body="Live multi-cursor canvas inside every student room. Open from the room header."
        />
        <KitTile
          icon="🍅"
          title="Pomodoro timer"
          body="Right-hand sidebar — 25 minutes focused, 5 break. Click start, get to work."
        />
        <KitTile
          icon="🎙️"
          title="Voice + video calls"
          body="Click 📞 in any room header. Spatial audio + screen-share supported."
        />
        <KitTile
          icon="🃏"
          title="Flashcards"
          body="Drop a note in /students/notes — it generates flashcards for spaced repetition."
        />
        <KitTile
          icon="📓"
          title="Notes capsule"
          body="Publish a note as a public link that survives 30-90 days."
        />
        <KitTile
          icon="🧠"
          title="Study squads"
          body="Private 2-20 person rooms with shared whiteboard + Pomodoro sync."
        />
        <KitTile
          icon="📅"
          title="Office hours"
          body="(verified educators) List paid or free office-hours slots."
        />
        <KitTile
          icon="🧮"
          title="Equation paste"
          body="Type $\\LaTeX$ between dollar signs in chat to render math live."
        />
      </div>
    </section>
  );
}

function KitTile({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-sm font-semibold text-white">
        {icon} {title}
      </p>
      <p className="mt-1 text-xs text-white/65">{body}</p>
    </div>
  );
}

function NetworkTab({ currentUserId }: { currentUserId: string }) {
  void currentUserId;
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

function VerifyCallout({
  title,
  body,
  onOpenVerify
}: {
  title: string;
  body: string;
  onOpenVerify: () => void;
}) {
  return (
    <section className="surface-glass tint-mint p-6">
      <h3 className="font-display text-lg font-semibold text-white">
        🎓 {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-white/75">{body}</p>
      <ul className="mt-3 space-y-1 text-sm text-white/75">
        <li>📚 Subject + exam + cohort rooms (200+ catalog rooms)</li>
        <li>🆘 Fire and answer Help Beacons</li>
        <li>🛡️ A subject badge on your profile (Student / Senior / Educator / Professor)</li>
        <li>📅 Office hours (verified educators only)</li>
      </ul>
      <div className="mt-5">
        <button
          type="button"
          onClick={onOpenVerify}
          className="inline-flex items-center gap-2 rounded-xl bg-neon-mint px-4 py-2 text-sm font-semibold text-ink-900 shadow-glow hover:bg-neon-mint/90"
        >
          Start verification →
        </button>
      </div>
    </section>
  );
}

function PomodoroCard() {
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [phase, setPhase] = useState<"focus" | "break">("focus");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          // flip phase
          setPhase((p) => (p === "focus" ? "break" : "focus"));
          return phase === "focus" ? 5 * 60 : 25 * 60;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, phase]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  function reset() {
    setRunning(false);
    setPhase("focus");
    setSecondsLeft(25 * 60);
  }

  return (
    <section className="surface-glass tint-amber p-4">
      <p className="text-[10px] uppercase tracking-widest text-white/40">
        🍅 Pomodoro
      </p>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-white">
        {mm}:{ss}
      </p>
      <p className="text-[11px] text-white/55">
        {phase === "focus" ? "Focused study · 25 min" : "Break · 5 min"}
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          onClick={() => setRunning((r) => !r)}
          className="flex-1"
        >
          {running ? "Pause" : "Start"}
        </Button>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/80 hover:bg-white/10"
        >
          ↺
        </button>
      </div>
    </section>
  );
}
