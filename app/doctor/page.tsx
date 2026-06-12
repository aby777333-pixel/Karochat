// Karochat — /doctor hub (v9 Phase 4).
//
// Directory of verified doctors + "ask now" CTA + the caller's recent
// consults. Verified doctors additionally see their tools (queue +
// availability). The not-medical-care banner is non-dismissable.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { DoctorBanner } from "./_components/DoctorBanner";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ask a Doctor · Karochat",
  description:
    "Verified doctors, on Karochat, for free general guidance. Not a substitute for medical care."
};

type Doctor = {
  doctor_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_online: boolean;
  specialty: string | null;
  degree: string | null;
  country: string | null;
  availability: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    timezone: string;
  }>;
};

type Consult = {
  beacon_id: string;
  created_at: string;
  status: string;
  symptom: string;
  doctor_username: string | null;
  doctor_display_name: string | null;
  room_id: string | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function availabilitySummary(slots: Doctor["availability"]): string | null {
  if (!slots || slots.length === 0) return null;
  const days = Array.from(new Set(slots.map((s) => s.day_of_week))).sort();
  const dayStr = days.map((d) => DAYS[d]).join(", ");
  const first = slots[0];
  if (!first) return null;
  return `${dayStr} · ${first.start_time.slice(0, 5)}–${first.end_time.slice(0, 5)} ${first.timezone}`;
}

export default async function DoctorHubPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/doctor");

  const [profileResp, doctorsResp, consultsResp] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, is_verified_doctor, is_admin")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.rpc("list_verified_doctors"),
    supabase.rpc("my_doctor_consults")
  ]);
  const profile = profileResp.data;
  if (!profile?.username) redirect("/onboarding");

  const doctors = (doctorsResp.data ?? []) as Doctor[];
  const consults = ((consultsResp.data ?? []) as Consult[]).slice(0, 5);
  const onlineCount = doctors.filter((d) => d.is_online).length;

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-3 py-6 md:py-8">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/rooms" className="flex min-w-0 items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <Link
          href="/rooms"
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
        >
          ← Rooms
        </Link>
      </header>

      <section className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-neon-blue/80">
            🩺 Ask a Doctor
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-white">
            Real doctors, verified by hand
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Every doctor here uploaded their medical-council registration and
            ID, and an operator checked it against the council registry.{" "}
            {onlineCount > 0
              ? `${onlineCount} online now.`
              : "None online right now — your request waits for the next one."}
          </p>
        </div>
        <Link
          href="/doctor/ask"
          className="shrink-0 rounded-xl bg-neon-blue px-4 py-2.5 text-sm font-semibold text-ink-900 hover:bg-neon-blue/90"
        >
          Ask a doctor now →
        </Link>
      </section>

      <div className="mt-5">
        <DoctorBanner />
      </div>

      {profile.is_verified_doctor && (
        <section className="surface-glass tint-mint mt-5 p-4">
          <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
            👩‍⚕️ Your doctor tools
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href="/doctor/queue"
              className="rounded-xl border border-neon-mint/40 bg-neon-mint/10 px-3 py-2 text-sm text-neon-mint hover:bg-neon-mint/20"
            >
              📥 Incoming requests
            </Link>
            <Link
              href="/doctor/availability"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              🗓 My weekly hours
            </Link>
          </div>
        </section>
      )}

      {consults.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-white/80">
            Your recent requests
          </h2>
          <ul className="mt-2 space-y-2">
            {consults.map((c) => (
              <li
                key={c.beacon_id}
                className="surface-glass flex flex-wrap items-center justify-between gap-2 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white/85">{c.symptom}</p>
                  <p className="mt-0.5 text-[11px] text-white/45">
                    {new Date(c.created_at).toLocaleString()} ·{" "}
                    {c.status === "answered"
                      ? `Dr. ${c.doctor_display_name ?? c.doctor_username}`
                      : c.status}
                  </p>
                </div>
                {c.status === "answered" && c.room_id ? (
                  <Link
                    href={`/rooms/${c.room_id}`}
                    className="shrink-0 rounded-lg border border-neon-mint/40 bg-neon-mint/10 px-3 py-1.5 text-xs text-neon-mint hover:bg-neon-mint/20"
                  >
                    Open chat →
                  </Link>
                ) : c.status === "routing" ? (
                  <span className="shrink-0 rounded-lg border border-neon-blue/30 bg-neon-blue/10 px-3 py-1.5 text-xs text-neon-blue">
                    finding a doctor…
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-white/80">
          Verified doctors {doctors.length > 0 && `(${doctors.length})`}
        </h2>
        {doctors.length === 0 ? (
          <p className="surface-glass mt-2 p-4 text-sm text-white/60">
            No verified doctors yet — be the first.
          </p>
        ) : (
          <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.map((d) => (
              <li key={d.doctor_id} className="surface-glass min-w-0 p-3">
                <div className="flex items-center gap-2.5">
                  {d.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={d.avatar_url}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm">
                      🩺
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      Dr. {d.display_name}
                      <span className="ml-1.5 align-middle text-[10px] text-neon-mint">
                        ✔ verified
                      </span>
                    </p>
                    <p className="truncate text-[11px] text-white/50">
                      {[d.specialty, d.degree, d.country]
                        .filter(Boolean)
                        .join(" · ") || "General guidance"}
                    </p>
                  </div>
                  <span
                    className={
                      "ml-auto h-2.5 w-2.5 shrink-0 rounded-full " +
                      (d.is_online ? "bg-neon-mint" : "bg-white/20")
                    }
                    title={d.is_online ? "online" : "offline"}
                  />
                </div>
                {availabilitySummary(d.availability) && (
                  <p className="mt-2 text-[11px] text-white/45">
                    🗓 {availabilitySummary(d.availability)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface-glass mt-8 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">Are you a doctor?</p>
          <p className="mt-0.5 text-[12px] text-white/55">
            Verify once with your council registration — then help people
            here whenever you have a spare moment.
          </p>
        </div>
        <Link
          href="/doctor/verify"
          className="shrink-0 rounded-xl border border-neon-blue/40 bg-neon-blue/10 px-3 py-2 text-sm text-neon-blue hover:bg-neon-blue/20"
        >
          Get verified →
        </Link>
      </section>
    </main>
  );
}
