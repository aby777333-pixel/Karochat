"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Existing = {
  id: string;
  status: string;
  country: string;
  education_level: string;
  syllabus: string | null;
  institution: string | null;
  badge_tier: string;
  subject_affinities: string[];
  is_minor: boolean;
} | null;

const COUNTRIES = [
  "IN","US","UK","CA","AU","DE","FR","BR","MX","JP","KR","CN","ID","PH","TH",
  "VN","PK","BD","TR","ZA","NG","KE","EG","AE","SA","IR","ES","IT","NL","SE",
  "PL","AR","CL","CO","SG","MY","NZ","IE","BE","CH","AT","PT","DK","NO","FI"
];

const LEVELS = [
  { value: "class-9-10",       label: "Class 9-10 / GCSE / 8e-9e" },
  { value: "class-11-12",      label: "Class 11-12 / A-Level / 10e-12e" },
  { value: "undergrad-yr1",    label: "Undergrad — Year 1" },
  { value: "undergrad-yr2",    label: "Undergrad — Year 2" },
  { value: "undergrad-yr3",    label: "Undergrad — Year 3" },
  { value: "undergrad-yr4",    label: "Undergrad — Year 4" },
  { value: "masters",          label: "Master's" },
  { value: "phd",              label: "PhD / Doctoral candidate" },
  { value: "exam-prep",        label: "Exam prep (JEE / NEET / SAT / MCAT / CFA…)" },
  { value: "professional-cert", label: "Professional cert (CFA / CA / USMLE / Bar…)" }
];

const COMMON_SYLLABUSES: { value: string; label: string; country?: string }[] = [
  { country: "IN", value: "CBSE",         label: "CBSE (India)" },
  { country: "IN", value: "ICSE",         label: "ICSE (India)" },
  { country: "IN", value: "JEE-Main",     label: "JEE Main" },
  { country: "IN", value: "JEE-Advanced", label: "JEE Advanced" },
  { country: "IN", value: "NEET",         label: "NEET" },
  { country: "UK", value: "A-Level-AQA",  label: "A-Level (AQA)" },
  { country: "UK", value: "A-Level-OCR",  label: "A-Level (OCR)" },
  { country: "UK", value: "A-Level-Edexcel", label: "A-Level (Edexcel)" },
  { country: "US", value: "AP",           label: "AP (US)" },
  { country: "US", value: "USMLE-Step-1", label: "USMLE Step 1" },
  { country: "US", value: "MCAT",         label: "MCAT" },
  { country: "US", value: "SAT",          label: "SAT" },
  { country: "US", value: "CFA-L1",       label: "CFA Level 1" },
  { value: "IB-HL", label: "IB Higher Level" },
  { value: "IB-SL", label: "IB Standard Level" },
  { country: "DE", value: "Abitur",       label: "Abitur (DE)" }
];

const SUBJECTS = [
  "physics","mathematics","calculus","algebra","trigonometry",
  "chemistry","organic-chemistry","biology","cell-biology",
  "computer-science","algorithms","programming","data-structures",
  "economics","macroeconomics","microeconomics",
  "history","geography","english-literature",
  "law","accounting","finance","statistics",
  "medicine","anatomy","physiology","biochemistry","pharmacology",
  "engineering","mechanical-engineering","electrical-engineering",
  "philosophy","psychology","sociology","political-science"
];

const METHODS = [
  {
    value: "edu_email",
    label: "Edu email",
    hint: "name@school.edu, name@ac.in, name@ac.uk — one-time code."
  },
  {
    value: "id_upload",
    label: "Student ID upload",
    hint: "Photo of your ID card + selfie. Reviewed within 6 hours."
  },
  {
    value: "result_upload",
    label: "Recent result / marksheet",
    hint: "For self-studiers prepping for exams (JEE / NEET / SAT…)."
  },
  {
    value: "guardian_consent",
    label: "Guardian consent (16-17 only)",
    hint: "Sends a one-time link to your parent/guardian."
  }
];

export function VerificationGate({
  existing,
  currentUserId
}: {
  existing: Existing;
  currentUserId: string;
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [country, setCountry] = useState(existing?.country ?? "IN");
  const [level, setLevel] = useState(existing?.education_level ?? "class-11-12");
  const [syllabus, setSyllabus] = useState(existing?.syllabus ?? "");
  const [institution, setInstitution] = useState(existing?.institution ?? "");
  const [method, setMethod] = useState("edu_email");
  const [eduEmail, setEduEmail] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [subjects, setSubjects] = useState<string[]>(
    existing?.subject_affinities ?? []
  );
  const [dob, setDob] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleSubject(s: string) {
    setSubjects((prev) =>
      prev.includes(s)
        ? prev.filter((x) => x !== s)
        : prev.length < 8
        ? [...prev, s]
        : prev
    );
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      if (!dob) throw new Error("Date of birth is required.");
      const meta: Record<string, any> = {};
      if (method === "edu_email") meta.edu_email = eduEmail;
      if (method === "guardian_consent") meta.guardian_email = guardianEmail;
      const { error } = await supabase.rpc("start_verification", {
        p_country: country,
        p_education_level: level,
        p_syllabus: syllabus || null,
        p_institution: institution || null,
        p_method: method,
        p_metadata: meta,
        p_subjects: subjects,
        p_guardian_email:
          method === "guardian_consent" ? guardianEmail : null,
        p_dob: dob
      });
      if (error) throw error;
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Could not submit.");
    } finally {
      setBusy(false);
    }
  }

  if (existing?.status === "pending") {
    return (
      <section className="surface-glass tint-amber mt-6 p-7 sm:p-9">
        <p className="text-[10px] uppercase tracking-widest text-neon-amber/70">
          ⏳ Verification pending
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-white">
          We&apos;re reviewing your verification.
        </h2>
        <p className="mt-2 text-sm text-white/70">
          {existing.is_minor
            ? "Because you're 16-17, we also wait for your guardian's consent. They got an email."
            : "Edu-email codes verify instantly. ID and result uploads take up to 6 hours."}
        </p>
        <p className="mt-3 text-[11px] text-white/45">
          Country: {existing.country} · Level: {existing.education_level}
          {existing.syllabus ? ` · ${existing.syllabus}` : ""}
        </p>
      </section>
    );
  }

  if (existing?.status === "rejected") {
    return (
      <section className="surface-glass tint-red mt-6 p-7 sm:p-9">
        <p className="text-[10px] uppercase tracking-widest text-neon-red/70">
          ✕ Verification rejected
        </p>
        <p className="mt-2 text-sm text-white/80">
          Our reviewers couldn&apos;t confirm your details. You can resubmit
          below.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
      {/* main form */}
      <div className="surface-glass p-6">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          Verify to join (16+ only)
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-white">
          Tell us who you&apos;re studying as.
        </h2>

        {/* DOB */}
        <label className="mt-5 block text-[11px] uppercase tracking-widest text-white/50">
          Date of birth
        </label>
        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          className="mt-1 w-full max-w-xs rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
        />
        <p className="mt-1 text-[11px] text-white/35">
          Used only to age-gate the network. Never shown publicly.
        </p>

        {/* Country + Level + Syllabus */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-white/50">
              Country
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none"
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-white/50">
              Education level
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none"
            >
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-white/50">
              Syllabus / exam (optional)
            </label>
            <select
              value={syllabus}
              onChange={(e) => setSyllabus(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none"
            >
              <option value="">— pick if it applies —</option>
              {COMMON_SYLLABUSES.filter(
                (s) => !s.country || s.country === country
              ).map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Institution */}
        <label className="mt-5 block text-[11px] uppercase tracking-widest text-white/50">
          Institution (school / college / university)
        </label>
        <input
          value={institution}
          onChange={(e) => setInstitution(e.target.value.slice(0, 120))}
          placeholder="e.g. IIT Madras, Harvard College, Delhi Public School"
          className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
        />

        {/* Subject affinity */}
        <label className="mt-5 block text-[11px] uppercase tracking-widest text-white/50">
          Subjects you study / are strong at (pick up to 8)
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUBJECTS.map((s) => {
            const active = subjects.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSubject(s)}
                className={clsx(
                  "rounded-full border px-2.5 py-1 text-[11px] transition",
                  active
                    ? "border-neon-mint/60 bg-neon-mint/15 text-neon-mint"
                    : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10"
                )}
              >
                {s.replace(/-/g, " ")}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[11px] text-white/35">
          These train Karo&apos;s beacon routing. You can change them later.
        </p>

        {/* Method */}
        <p className="mt-5 text-[11px] uppercase tracking-widest text-white/50">
          Verification method
        </p>
        <div className="mt-2 space-y-1.5">
          {METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMethod(m.value)}
              className={clsx(
                "block w-full rounded-xl border px-3 py-2 text-left transition",
                method === m.value
                  ? "border-neon-mint/60 bg-neon-mint/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              )}
            >
              <p className="text-sm text-white">{m.label}</p>
              <p className="text-[11px] text-white/55">{m.hint}</p>
            </button>
          ))}
        </div>

        {method === "edu_email" && (
          <div className="mt-3">
            <label className="block text-[11px] uppercase tracking-widest text-white/50">
              Your edu email
            </label>
            <input
              value={eduEmail}
              onChange={(e) => setEduEmail(e.target.value.slice(0, 200))}
              placeholder="name@institution.edu"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
            />
          </div>
        )}

        {method === "guardian_consent" && (
          <div className="mt-3">
            <label className="block text-[11px] uppercase tracking-widest text-white/50">
              Guardian / parent email
            </label>
            <input
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value.slice(0, 200))}
              placeholder="parent@example.com"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
            />
            <p className="mt-1 text-[11px] text-white/45">
              They&apos;ll get a one-time link to confirm. Required if
              you&apos;re 16 or 17.
            </p>
          </div>
        )}

        {err && (
          <p className="mt-3 text-xs text-neon-red">{err}</p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !dob}
            className="rounded-xl bg-neon-mint px-4 py-2 text-sm font-medium text-ink-900 hover:bg-neon-mint/90 disabled:opacity-60"
          >
            {busy ? "Submitting…" : "Submit verification"}
          </button>
          <p className="text-[11px] text-white/45 self-center">
            Most edu-email submissions verify automatically; uploads take up to 6 hours.
          </p>
        </div>
      </div>

      {/* sidebar — what it unlocks */}
      <aside className="surface-glass tint-mint p-5">
        <p className="text-[10px] uppercase tracking-widest text-neon-mint/70">
          What verification unlocks
        </p>
        <ul className="mt-3 space-y-2.5 text-sm text-white/85">
          <li>🆘 Fire Help Beacons — Karo routes to people who can answer.</li>
          <li>👥 Join cohort + subject rooms by syllabus.</li>
          <li>🧠 Build a Study Squad of 2-20 to study with regularly.</li>
          <li>📓 Saved notes + Karo summaries + flashcards.</li>
          <li>🪟 Professor office hours (free + paid).</li>
          <li>🤝 Mentor-finder + study-buddy matching.</li>
        </ul>
        <p className="mt-4 text-[11px] text-white/55">
          For 16-17 minors: sessions auto-record, no cross-age DMs, parent
          digest. Read the full safety notes after verifying.
        </p>
      </aside>
    </section>
  );
}
