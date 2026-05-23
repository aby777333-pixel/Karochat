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

// Wave 19.13 — now starts at primary so 13-year-olds aren't locked out.
const LEVELS = [
  { value: "primary",           label: "Class 1-5 / Elementary / Primary" },
  { value: "middle",            label: "Class 6-8 / Middle school / Year 6-8" },
  { value: "class-9-10",        label: "Class 9-10 / GCSE / 8e-9e" },
  { value: "class-11-12",       label: "Class 11-12 / A-Level / 10e-12e" },
  { value: "undergrad-yr1",     label: "Undergrad — Year 1" },
  { value: "undergrad-yr2",     label: "Undergrad — Year 2" },
  { value: "undergrad-yr3",     label: "Undergrad — Year 3" },
  { value: "undergrad-yr4",     label: "Undergrad — Year 4" },
  { value: "masters",           label: "Master's" },
  { value: "phd",               label: "PhD / Doctoral candidate" },
  { value: "exam-prep",         label: "Exam prep (JEE / NEET / SAT / MCAT / CFA…)" },
  { value: "professional-cert", label: "Professional cert (CFA / CA / USMLE / Bar…)" }
];

// Significantly expanded — covers school boards, college entrance,
// professional exams across the major sending countries.
const COMMON_SYLLABUSES: { value: string; label: string; country?: string }[] = [
  // INDIA — boards
  { country: "IN", value: "CBSE",         label: "CBSE (India)" },
  { country: "IN", value: "ICSE",         label: "ICSE (India)" },
  { country: "IN", value: "ISC",          label: "ISC (India · 11-12)" },
  { country: "IN", value: "NIOS",         label: "NIOS (India · open school)" },
  // INDIA — state boards
  { country: "IN", value: "Maharashtra-HSC", label: "Maharashtra HSC" },
  { country: "IN", value: "TN-HSC",       label: "Tamil Nadu HSC" },
  { country: "IN", value: "Karnataka-PUC", label: "Karnataka PUC" },
  { country: "IN", value: "Kerala-HSE",   label: "Kerala HSE" },
  { country: "IN", value: "UP-Board",     label: "UP Board" },
  { country: "IN", value: "WB-HS",        label: "West Bengal HS" },
  // INDIA — entrance / olympiads
  { country: "IN", value: "JEE-Main",     label: "JEE Main" },
  { country: "IN", value: "JEE-Advanced", label: "JEE Advanced" },
  { country: "IN", value: "NEET",         label: "NEET" },
  { country: "IN", value: "BITSAT",       label: "BITSAT" },
  { country: "IN", value: "KVPY",         label: "KVPY" },
  { country: "IN", value: "NTSE",         label: "NTSE" },
  { country: "IN", value: "CUET",         label: "CUET (UG)" },
  { country: "IN", value: "CAT",          label: "CAT (MBA)" },
  { country: "IN", value: "GATE",         label: "GATE" },
  { country: "IN", value: "UPSC-CSE",     label: "UPSC Civil Services" },
  // UK
  { country: "UK", value: "GCSE",         label: "GCSE" },
  { country: "UK", value: "IGCSE",        label: "IGCSE (Cambridge)" },
  { country: "UK", value: "A-Level-AQA",  label: "A-Level (AQA)" },
  { country: "UK", value: "A-Level-OCR",  label: "A-Level (OCR)" },
  { country: "UK", value: "A-Level-Edexcel", label: "A-Level (Edexcel)" },
  { country: "UK", value: "A-Level-CIE",  label: "A-Level (Cambridge CIE)" },
  { country: "UK", value: "BTEC",         label: "BTEC" },
  { country: "UK", value: "UCAT",         label: "UCAT (medicine)" },
  { country: "UK", value: "BMAT",         label: "BMAT (medicine)" },
  // US
  { country: "US", value: "AP",           label: "AP (US)" },
  { country: "US", value: "SAT",          label: "SAT" },
  { country: "US", value: "ACT",          label: "ACT" },
  { country: "US", value: "MCAT",         label: "MCAT" },
  { country: "US", value: "USMLE-Step-1", label: "USMLE Step 1" },
  { country: "US", value: "GRE",          label: "GRE" },
  { country: "US", value: "GMAT",         label: "GMAT" },
  { country: "US", value: "LSAT",         label: "LSAT" },
  { country: "US", value: "CFA-L1",       label: "CFA Level 1" },
  { country: "US", value: "CPA",          label: "CPA (US)" },
  // CANADA
  { country: "CA", value: "OSSD",         label: "OSSD (Ontario)" },
  { country: "CA", value: "BC-Diploma",   label: "BC Diploma" },
  { country: "CA", value: "CAEL",         label: "CAEL" },
  // AUSTRALIA / NZ
  { country: "AU", value: "HSC-NSW",      label: "HSC (NSW)" },
  { country: "AU", value: "VCE",          label: "VCE (Victoria)" },
  { country: "AU", value: "QCE",          label: "QCE (Queensland)" },
  { country: "AU", value: "ATAR",         label: "ATAR" },
  { country: "NZ", value: "NCEA",         label: "NCEA (NZ)" },
  // SINGAPORE / MY / TH / VN / PH / ID
  { country: "SG", value: "O-Level-SG",   label: "O-Level (Singapore)" },
  { country: "SG", value: "A-Level-SG",   label: "A-Level (Singapore)" },
  { country: "SG", value: "Polytechnic-SG", label: "Polytechnic (SG)" },
  { country: "MY", value: "SPM",          label: "SPM (Malaysia)" },
  { country: "MY", value: "STPM",         label: "STPM (Malaysia)" },
  { country: "TH", value: "GAT-PAT",      label: "GAT/PAT (Thailand)" },
  { country: "TH", value: "O-NET",        label: "O-NET (Thailand)" },
  { country: "PH", value: "UPCAT",        label: "UPCAT (Philippines)" },
  { country: "PH", value: "DOST-SEI",     label: "DOST-SEI (Philippines)" },
  { country: "ID", value: "UTBK-SNBT",    label: "UTBK-SNBT (Indonesia)" },
  { country: "VN", value: "THPTQG",       label: "THPTQG (Vietnam)" },
  // EAST ASIA
  { country: "JP", value: "Common-Test",  label: "Common Test (Japan)" },
  { country: "JP", value: "Eiken",        label: "Eiken (Japan English)" },
  { country: "KR", value: "Suneung",      label: "Suneung / CSAT (Korea)" },
  { country: "CN", value: "Gaokao",       label: "Gaokao (China)" },
  { country: "CN", value: "HSK",          label: "HSK (Chinese)" },
  // EUROPE
  { country: "DE", value: "Abitur",       label: "Abitur (Germany)" },
  { country: "FR", value: "Baccalaureat", label: "Baccalauréat (France)" },
  { country: "FR", value: "Parcoursup",   label: "Parcoursup (France)" },
  { country: "ES", value: "Bachillerato", label: "Bachillerato (Spain)" },
  { country: "ES", value: "EvAU",         label: "EvAU / Selectividad (Spain)" },
  { country: "IT", value: "Maturita",     label: "Esame di Maturità (Italy)" },
  { country: "NL", value: "Eindexamen",   label: "Eindexamen (Netherlands)" },
  { country: "SE", value: "Hogskoleprovet", label: "Högskoleprovet (Sweden)" },
  { country: "PL", value: "Matura",       label: "Matura (Poland)" },
  { country: "PT", value: "Exames-PT",    label: "Exames Nacionais (Portugal)" },
  // BRAZIL / LATAM
  { country: "BR", value: "ENEM",         label: "ENEM (Brazil)" },
  { country: "BR", value: "FUVEST",       label: "FUVEST (Brazil)" },
  { country: "MX", value: "COMIPEMS",     label: "COMIPEMS (Mexico HS)" },
  { country: "MX", value: "EXANI-II",     label: "EXANI-II (Mexico UG)" },
  { country: "AR", value: "UBA-CBC",      label: "UBA CBC (Argentina)" },
  { country: "CL", value: "PAES",         label: "PAES (Chile)" },
  { country: "CO", value: "ICFES-Saber11", label: "ICFES Saber 11 (Colombia)" },
  // AFRICA / MENA
  { country: "ZA", value: "NSC-Matric",   label: "Matric / NSC (South Africa)" },
  { country: "NG", value: "WAEC",         label: "WAEC (Nigeria)" },
  { country: "NG", value: "JAMB",         label: "JAMB (Nigeria)" },
  { country: "KE", value: "KCSE",         label: "KCSE (Kenya)" },
  { country: "EG", value: "Thanawya-Amma", label: "Thanawya Amma (Egypt)" },
  // GULF
  { country: "AE", value: "EmSAT",        label: "EmSAT (UAE)" },
  { country: "SA", value: "GAT-SAAT",     label: "GAT + SAAT (Saudi Arabia)" },
  // PAKISTAN / BANGLADESH / IRAN / TURKEY
  { country: "PK", value: "FSc",          label: "FSc / Intermediate (Pakistan)" },
  { country: "PK", value: "ECAT-MCAT-PK", label: "ECAT / MCAT (Pakistan)" },
  { country: "BD", value: "HSC-BD",       label: "HSC (Bangladesh)" },
  { country: "BD", value: "SSC-BD",       label: "SSC (Bangladesh)" },
  { country: "IR", value: "Konkur",       label: "Konkur (Iran)" },
  { country: "TR", value: "TYT-AYT",      label: "TYT / AYT (Turkey)" },
  // International — country-agnostic
  { value: "IB-HL",     label: "IB Higher Level" },
  { value: "IB-SL",     label: "IB Standard Level" },
  { value: "IB-MYP",    label: "IB MYP (middle years)" },
  { value: "IB-PYP",    label: "IB PYP (primary years)" },
  { value: "IGCSE",     label: "IGCSE (Cambridge — global)" },
  { value: "Cambridge-PrimaryChecks", label: "Cambridge Primary Checkpoints" },
  { value: "Olympiad-Math",  label: "Math Olympiad" },
  { value: "Olympiad-Phys",  label: "Physics Olympiad" },
  { value: "Olympiad-Chem",  label: "Chemistry Olympiad" },
  { value: "Olympiad-Bio",   label: "Biology Olympiad" },
  { value: "Olympiad-Info",  label: "Informatics Olympiad (IOI)" }
];

const SUBJECTS = [
  "physics","mathematics","calculus","algebra","trigonometry","geometry",
  "chemistry","organic-chemistry","biology","cell-biology",
  "computer-science","algorithms","programming","data-structures",
  "economics","macroeconomics","microeconomics",
  "history","geography","english-literature","languages",
  "law","accounting","finance","statistics",
  "medicine","anatomy","physiology","biochemistry","pharmacology",
  "engineering","mechanical-engineering","electrical-engineering",
  "philosophy","psychology","sociology","political-science",
  "art","music","drama","design","robotics","environment"
];

// Wave 19.13 — guardian_consent is the recommended path for under-18s
// who don't have a school email. It now requires BOTH parent email and
// parent phone for verification.
const METHODS = [
  {
    value: "edu_email",
    label: "Edu email",
    hint: "name@school.edu, name@ac.in, name@ac.uk — one-time code (instant)."
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
    label: "Parent / Guardian consent (no school email needed)",
    hint:
      "Most schools don't issue email — give us a parent's email AND phone. We text + email them a one-time consent link. Required for 13-17."
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
  const [level, setLevel] = useState(existing?.education_level ?? "class-9-10");
  const [syllabus, setSyllabus] = useState(existing?.syllabus ?? "");
  const [institution, setInstitution] = useState(existing?.institution ?? "");
  const [method, setMethod] = useState("guardian_consent");
  const [eduEmail, setEduEmail] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [subjects, setSubjects] = useState<string[]>(
    existing?.subject_affinities ?? []
  );
  const [dob, setDob] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // After a successful submit we flip this so the user gets immediate
  // feedback even before router.refresh() rehydrates the server props.
  const [submitted, setSubmitted] = useState(false);

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
      if (method === "guardian_consent") {
        meta.guardian_email = guardianEmail;
        meta.guardian_phone = guardianPhone;
      }
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
        p_guardian_phone:
          method === "guardian_consent" ? guardianPhone : null,
        p_dob: dob
      });
      if (error) throw error;
      setSubmitted(true);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Could not submit.");
    } finally {
      setBusy(false);
    }
  }

  if (submitted || existing?.status === "pending") {
    // submitted may fire before the router.refresh() rehydrates the
    // server props with the new verification row, so existing can still
    // be null for a beat — fall back to the values we already have on
    // the form (everything in this branch came from user input).
    const isMinorView = existing?.is_minor ?? (
      dob ? (new Date().getFullYear() - new Date(dob).getFullYear()) < 18 : false
    );
    const guardianFlow = method === "guardian_consent";
    return (
      <section className="surface-glass tint-amber mt-6 p-7 sm:p-9">
        <p className="text-[10px] uppercase tracking-widest text-neon-amber/70">
          ✓ Submission received · verification pending
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-white">
          {guardianFlow
            ? "We've sent your guardian a consent link."
            : "We're reviewing your verification."}
        </h2>
        <p className="mt-2 text-sm text-white/70">
          {guardianFlow || isMinorView
            ? "Because you're under 18, we wait for your guardian's consent. They got an email + a text — once they tap the link, your verification activates automatically."
            : "Edu-email codes verify instantly. ID and result uploads take up to 6 hours."}
        </p>
        <p className="mt-3 text-[11px] text-white/45">
          Country: {existing?.country ?? country} · Level:{" "}
          {existing?.education_level ?? level}
          {(existing?.syllabus ?? syllabus)
            ? ` · ${existing?.syllabus ?? syllabus}`
            : ""}
        </p>
        <p className="mt-3 text-[11px] text-white/45">
          You can leave this page — we&apos;ll surface a notification when
          your verification activates.
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
    <section className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
      {/* main form */}
      <div className="surface-glass min-w-0 p-6">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          Verify to join (13+ only)
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

        {/* Country + Level + Syllabus — stacks on narrow widths, two cols
            at sm, three at lg, so the constrained tab column stays
            readable. The selects are min-w-0 + bg-black/30 so the dark
            dropdown items match the form's surface. */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="min-w-0">
            <label className="block text-[11px] uppercase tracking-widest text-white/50">
              Country
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mt-1 w-full min-w-0 truncate rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-white outline-none focus:border-neon-mint/40"
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className="block text-[11px] uppercase tracking-widest text-white/50">
              Education level
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="mt-1 w-full min-w-0 truncate rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-white outline-none focus:border-neon-mint/40"
            >
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <label className="block text-[11px] uppercase tracking-widest text-white/50">
              Syllabus / exam (optional)
            </label>
            <select
              value={syllabus}
              onChange={(e) => setSyllabus(e.target.value)}
              className="mt-1 w-full min-w-0 truncate rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-white outline-none focus:border-neon-mint/40"
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
          placeholder="e.g. IIT Madras, Harvard College, Delhi Public School, your local primary school"
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
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-white/50">
                Parent / guardian email
              </label>
              <input
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value.slice(0, 200))}
                placeholder="parent@example.com"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-white/50">
                Parent / guardian phone
              </label>
              <input
                type="tel"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value.slice(0, 30))}
                placeholder="+91 98xxxxxxxx"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
              />
            </div>
            <p className="sm:col-span-2 mt-0 text-[11px] text-white/45">
              We send a one-time consent link to <em>both</em> email and phone.
              Your parent / guardian taps either to confirm. Required for
              anyone under 18.
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
            Most edu-email submissions verify automatically; uploads + guardian
            consent take up to 6 hours.
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
          For minors (13-17): sessions auto-record, no cross-age DMs, parent
          digest. Read the full safety notes after verifying.
        </p>
      </aside>
    </section>
  );
}
