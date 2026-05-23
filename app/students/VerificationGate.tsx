"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DIAL_CODES,
  dialCodeForIso,
  dialCodeLabel,
  type DialCodeEntry
} from "@/lib/dialCodes";

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
  // Wave 20.11 — surfaced by get_my_verification so the pending state can
  // show "we sent a link to …" with sent-at timestamps. All optional so
  // legacy rows (pre-0040) still render cleanly.
  verification_method?: string | null;
  guardian_email?: string | null;
  guardian_phone?: string | null;
  consent_token?: string | null;
  consent_email_sent_at?: string | null;
  consent_phone_sent_at?: string | null;
  consent_confirmed_at?: string | null;
  consent_confirmed_via?: string | null;
} | null;

// Channel result returned by /api/students/verify/send. Mirrored from
// app/api/students/verify/send/route.ts.
type SendChannel = {
  attempted: boolean;
  ok: boolean;
  skipped?: boolean;
  reason?: string;
};
type SendResponse = {
  status: "verified" | "pending";
  email: SendChannel;
  sms: SendChannel;
  error?: string;
};

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
    hint: "Photo of your ID card + 'valid until' date. Reviewed within 6 hours."
  },
  {
    value: "result_upload",
    label: "Recent result / marksheet",
    hint: "For self-studiers prepping for exams. Upload the marksheet + the exam/result date."
  },
  {
    value: "guardian_consent",
    label: "Parent / Guardian consent (no school email needed)",
    hint:
      "Most schools don't issue email — give us a parent's email AND phone. We text + email them a one-time consent link. Required for 13-17."
  }
];

// Strip anything outside [A-Za-z0-9_.-] so the upload path stays safe to
// embed in a URL and predictable in the bucket listing.
function sanitizeName(name: string): string {
  const clean = name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 80);
  return clean.length > 0 ? clean : "upload";
}

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
  // Guardian phone is split into a dial-code picker + the local number.
  // We combine them as `+<code> <number>` on submit.
  const [dialIso, setDialIso] = useState<string>(existing?.country ?? "IN");
  const [guardianPhoneLocal, setGuardianPhoneLocal] = useState("");
  const [subjects, setSubjects] = useState<string[]>(
    existing?.subject_affinities ?? []
  );
  const [dob, setDob] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // After a successful submit we flip this so the user gets immediate
  // feedback even before router.refresh() rehydrates the server props.
  const [submitted, setSubmitted] = useState(false);
  // Wave 20.11 — captures the response from /api/students/verify/send so
  // the post-submit panel can show per-channel status (sent / skipped /
  // failed) and the operator can see right away whether Resend / Twilio
  // are configured.
  const [send, setSend] = useState<SendResponse | null>(null);
  const [resending, setResending] = useState(false);
  // Wave 20.12 — id_upload / result_upload now require a photo + date.
  // The file is uploaded to the private 'student-verifications' bucket;
  // we keep only the storage path in state and pass it into
  // start_verification via verification_metadata.
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [idExpiry, setIdExpiry] = useState("");
  const [marksheetFile, setMarksheetFile] = useState<File | null>(null);
  const [resultDate, setResultDate] = useState("");
  const [uploading, setUploading] = useState(false);
  // Geo defaults — fetched from /api/geo on mount so first-time visitors
  // get their own country pre-selected in both the COUNTRY select and
  // the dial-code picker. Skipped when the user already has a saved
  // verification (their stored values win).
  useEffect(() => {
    if (existing) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/geo", { cache: "no-store" });
        if (!resp.ok) return;
        const data = (await resp.json()) as { country?: string | null };
        const detected = data.country?.toUpperCase();
        if (cancelled || !detected) return;
        // Only seed if the user hasn't already picked something themselves.
        setCountry((cur) => (cur === "IN" ? detected : cur));
        setDialIso((cur) => (cur === "IN" ? detected : cur));
      } catch {
        // Geo is best-effort; navigator.language is the final fallback.
        try {
          const lang = (navigator.language ?? "").split("-")[1]?.toUpperCase();
          if (lang && lang.length === 2) {
            setCountry((cur) => (cur === "IN" ? lang : cur));
            setDialIso((cur) => (cur === "IN" ? lang : cur));
          }
        } catch {
          // ignore
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [existing]);

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
    // Diagnostic — surface the click in devtools so we can tell whether
    // the handler ran at all when users report "nothing happened".
    // eslint-disable-next-line no-console
    console.info("[verify] submit clicked", { dob, method, country, level });
    try {
      if (!dob) throw new Error("Date of birth is required. Pick it from the calendar above.");
      if (method === "guardian_consent") {
        if (!guardianEmail.trim()) {
          throw new Error("Guardian email is required for the guardian-consent path.");
        }
      }
      // Compose E.164 guardian phone from picker + local number.
      const dialEntry = dialCodeForIso(dialIso);
      const cleanedLocal = guardianPhoneLocal.replace(/[^\d]/g, "");
      const fullGuardianPhone =
        dialEntry && cleanedLocal
          ? `+${dialEntry.code}${cleanedLocal}`
          : "";
      if (method === "guardian_consent" && !fullGuardianPhone) {
        throw new Error("Guardian phone is required for the guardian-consent path.");
      }
      const meta: Record<string, any> = {};
      if (method === "edu_email") meta.edu_email = eduEmail;
      if (method === "guardian_consent") {
        meta.guardian_email = guardianEmail;
        meta.guardian_phone = fullGuardianPhone;
        meta.guardian_phone_iso = dialIso;
      }

      // Wave 20.12 — id_upload / result_upload need a photo + date.
      // Validate locally first, then upload to the private
      // 'student-verifications' bucket under <user-id>/ so the storage
      // RLS policy lets the write through. We pass the storage path to
      // start_verification via metadata so the admin queue can mint a
      // signed URL for review.
      if (method === "id_upload") {
        if (!idCardFile) throw new Error("Pick a photo of your ID card.");
        if (idCardFile.size > 5 * 1024 * 1024)
          throw new Error("ID photo is over the 5 MB limit.");
        if (!idExpiry) throw new Error("Enter the ID's 'valid until' date.");
        if (new Date(idExpiry) <= new Date())
          throw new Error("ID expiry date must be in the future.");
        setUploading(true);
        try {
          const path = `${currentUserId}/id-${Date.now()}-${sanitizeName(idCardFile.name)}`;
          const { error: upErr } = await supabase.storage
            .from("student-verifications")
            .upload(path, idCardFile, {
              cacheControl: "3600",
              upsert: false,
              contentType: idCardFile.type || "image/jpeg"
            });
          if (upErr) throw new Error(`ID upload failed: ${upErr.message}`);
          meta.id_card_url = path;
          meta.id_expiry_date = idExpiry;
        } finally {
          setUploading(false);
        }
      }
      if (method === "result_upload") {
        if (!marksheetFile) throw new Error("Pick a photo of your marksheet / result.");
        if (marksheetFile.size > 5 * 1024 * 1024)
          throw new Error("Marksheet photo is over the 5 MB limit.");
        if (!resultDate) throw new Error("Enter the exam / result date.");
        if (new Date(resultDate) > new Date())
          throw new Error("Result date can't be in the future.");
        setUploading(true);
        try {
          const path = `${currentUserId}/result-${Date.now()}-${sanitizeName(marksheetFile.name)}`;
          const { error: upErr } = await supabase.storage
            .from("student-verifications")
            .upload(path, marksheetFile, {
              cacheControl: "3600",
              upsert: false,
              contentType: marksheetFile.type || "image/jpeg"
            });
          if (upErr) throw new Error(`Marksheet upload failed: ${upErr.message}`);
          meta.marksheet_url = path;
          meta.result_date = resultDate;
        } finally {
          setUploading(false);
        }
      }
      const payload = {
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
          method === "guardian_consent" ? fullGuardianPhone : null,
        p_dob: dob
      };
      // eslint-disable-next-line no-console
      console.info("[verify] calling start_verification", payload);
      const { data, error } = await supabase.rpc("start_verification", payload);
      if (error) {
        // eslint-disable-next-line no-console
        console.error("[verify] RPC error", error);
        const detail = [error.message, error.details, error.hint, error.code]
          .filter(Boolean)
          .join(" · ");
        throw new Error(detail || "Verification RPC failed.");
      }
      // eslint-disable-next-line no-console
      console.info("[verify] start_verification ok · row id", data);

      // Wave 20.11 — actually dispatch the email + SMS (or no-op for
      // auto-verify methods). The route returns enough detail for the
      // panel below to say "we sent to … at hh:mm" or "couldn't reach …".
      setSubmitted(true);
      try {
        const resp = await fetch("/api/students/verify/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}"
        });
        const json = (await resp.json().catch(() => null)) as
          | SendResponse
          | null;
        // eslint-disable-next-line no-console
        console.info("[verify] dispatch result", json);
        if (json) setSend(json);
      } catch (sendErr) {
        // eslint-disable-next-line no-console
        console.warn("[verify] dispatch fetch failed", sendErr);
        setSend({
          status: "pending",
          email: { attempted: false, ok: false, reason: "dispatch fetch failed" },
          sms: { attempted: false, ok: false, reason: "dispatch fetch failed" }
        });
      }
      router.refresh();
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[verify] caught", e);
      setErr(
        e?.message
          ? `${e.message}`
          : "Could not submit. Open the browser console (Ctrl+Shift+I → Console) to see the full error and share it back."
      );
    } finally {
      setBusy(false);
    }
  }

  // Wave 20.11 / 20.12 — after a successful submit, branch on the
  // method + dispatch response:
  //   • edu_email + guardian_consent  → "check your inbox / phone" panel
  //   • id_upload + result_upload     → "in the review queue" panel
  //   • (legacy auto-verify path)     → "you're in" panel
  if (submitted) {
    if (method === "id_upload" || method === "result_upload") {
      return <PendingReviewPanel method={method} />;
    }
    const dispatchStatus = send?.status ?? "verified";
    if (dispatchStatus === "verified") {
      return (
        <section className="surface-glass tint-mint mt-6 p-7 sm:p-9">
          <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
            ✓ Verified — welcome to the Students Network
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-white">
            You&apos;re in. Loading your area…
          </h2>
          <p className="mt-2 text-sm text-white/70">
            Lobbies, the catalog, student rooms, Help Beacons, and the
            teaching kit are unlocking now. If this screen doesn&apos;t flip
            in a few seconds, refresh the page.
          </p>
        </section>
      );
    }
    return (
      <PendingSentPanel
        method={method}
        guardianEmail={guardianEmail}
        guardianPhone={(() => {
          const d = dialCodeForIso(dialIso);
          const cleaned = guardianPhoneLocal.replace(/[^\d]/g, "");
          return d && cleaned ? `+${d.code}${cleaned}` : "";
        })()}
        eduEmail={eduEmail}
        send={send}
        resending={resending}
        onResend={async () => {
          setResending(true);
          try {
            const resp = await fetch("/api/students/verify/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}"
            });
            const json = (await resp.json().catch(() => null)) as
              | SendResponse
              | null;
            if (json) setSend(json);
          } finally {
            setResending(false);
          }
        }}
      />
    );
  }

  if (existing?.status === "pending") {
    // Server-rendered pending state — happens when the user lands back on
    // /students with a row that hasn't been confirmed yet. Surfaces the
    // same "check your inbox" panel, hydrated from get_my_verification.
    const needsClick = existing.verification_method === "edu_email"
      || existing.verification_method === "guardian_consent";
    if (needsClick) {
      return (
        <PendingSentPanel
          method={existing.verification_method ?? null}
          guardianEmail={existing.guardian_email ?? ""}
          guardianPhone={existing.guardian_phone ?? ""}
          eduEmail=""
          send={{
            status: "pending",
            email: {
              attempted: !!existing.consent_email_sent_at,
              ok: !!existing.consent_email_sent_at,
              reason: existing.consent_email_sent_at
                ? `Sent ${new Date(existing.consent_email_sent_at).toLocaleString()}`
                : undefined
            },
            sms: {
              attempted: !!existing.consent_phone_sent_at,
              ok: !!existing.consent_phone_sent_at,
              reason: existing.consent_phone_sent_at
                ? `Sent ${new Date(existing.consent_phone_sent_at).toLocaleString()}`
                : undefined
            }
          }}
          resending={resending}
          onResend={async () => {
            setResending(true);
            try {
              const resp = await fetch("/api/students/verify/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}"
              });
              const json = (await resp.json().catch(() => null)) as
                | SendResponse
                | null;
              if (json) setSend(json);
            } finally {
              setResending(false);
            }
          }}
        />
      );
    }
    // Legacy fallback (id_upload / result_upload — manual review queue).
    return (
      <section className="surface-glass tint-amber mt-6 p-7 sm:p-9">
        <p className="text-[10px] uppercase tracking-widest text-neon-amber/70">
          ⏳ Verification pending review
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-white">
          Your upload is in the review queue.
        </h2>
        <p className="mt-2 text-sm text-white/70">
          ID and result uploads are reviewed by a human and usually
          processed within 6 hours.
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

        {method === "id_upload" && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-white/50">
                ID card photo (5 MB max)
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,application/pdf"
                onChange={(e) => setIdCardFile(e.target.files?.[0] ?? null)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-white/80 file:hover:bg-white/20"
              />
              {idCardFile && (
                <p className="mt-1 truncate text-[11px] text-white/45">
                  {idCardFile.name} · {Math.round(idCardFile.size / 1024)} KB
                </p>
              )}
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-white/50">
                ID valid until
              </label>
              <input
                type="date"
                value={idExpiry}
                min={new Date(Date.now() + 24 * 3600 * 1000)
                  .toISOString()
                  .slice(0, 10)}
                onChange={(e) => setIdExpiry(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
              />
              <p className="mt-1 text-[11px] text-white/35">
                Future date — expired IDs are rejected.
              </p>
            </div>
            <p className="sm:col-span-2 text-[11px] text-white/45">
              Stored privately; only the operator sees this. Reviewed within 6
              hours.
            </p>
          </div>
        )}

        {method === "result_upload" && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-white/50">
                Marksheet / result photo (5 MB max)
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,application/pdf"
                onChange={(e) => setMarksheetFile(e.target.files?.[0] ?? null)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-white/80 file:hover:bg-white/20"
              />
              {marksheetFile && (
                <p className="mt-1 truncate text-[11px] text-white/45">
                  {marksheetFile.name} ·{" "}
                  {Math.round(marksheetFile.size / 1024)} KB
                </p>
              )}
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-white/50">
                Exam / result date
              </label>
              <input
                type="date"
                value={resultDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setResultDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
              />
              <p className="mt-1 text-[11px] text-white/35">
                When the result was issued. Cannot be in the future.
              </p>
            </div>
            <p className="sm:col-span-2 text-[11px] text-white/45">
              Stored privately; only the operator sees this. Reviewed within 6
              hours.
            </p>
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
              <div className="mt-1 flex gap-1.5">
                <select
                  value={dialIso}
                  onChange={(e) => setDialIso(e.target.value)}
                  aria-label="Country dial code"
                  title={(() => {
                    const d = dialCodeForIso(dialIso);
                    return d ? `${d.flag} +${d.code} ${d.name}` : "Country code";
                  })()}
                  className="w-[6.5rem] shrink-0 truncate rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-sm text-white outline-none focus:border-neon-mint/40"
                >
                  {DIAL_CODES.map((d) => (
                    <option key={d.iso} value={d.iso}>
                      {dialCodeLabel(d)}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  value={guardianPhoneLocal}
                  onChange={(e) =>
                    setGuardianPhoneLocal(e.target.value.slice(0, 20))
                  }
                  placeholder="98xxxxxxxx"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
                />
              </div>
              {(() => {
                const d = dialCodeForIso(dialIso);
                const cleaned = guardianPhoneLocal.replace(/[^\d]/g, "");
                if (!d || !cleaned) return null;
                return (
                  <p className="mt-1 text-[11px] text-white/45">
                    Will send to <span className="font-mono">+{d.code} {cleaned}</span>
                  </p>
                );
              })()}
            </div>
            <p className="sm:col-span-2 mt-0 text-[11px] text-white/45">
              We send a one-time consent link to <em>both</em> email and phone.
              Your parent / guardian taps either to confirm. Required for
              anyone under 18.
            </p>
          </div>
        )}

        {err && (
          <div className="mt-3 rounded-xl border border-neon-red/40 bg-neon-red/10 p-3">
            <p className="text-[10px] uppercase tracking-widest text-neon-red/80">
              Verification couldn&apos;t complete
            </p>
            <p className="mt-1 break-words text-sm text-neon-red">{err}</p>
            <p className="mt-2 text-[11px] text-white/55">
              Tip — open the browser console (Ctrl+Shift+I → Console tab) and
              paste anything starting with{" "}
              <code className="rounded bg-white/10 px-1">[verify]</code> back
              so we can see what blew up.
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="rounded-xl bg-neon-mint px-4 py-2 text-sm font-medium text-ink-900 hover:bg-neon-mint/90 disabled:opacity-60"
          >
            {uploading
              ? "Uploading…"
              : busy
              ? "Submitting…"
              : "Submit verification"}
          </button>
          <p className="text-[11px] text-white/45 self-center">
            Edu-email and guardian-consent paths send a one-time
            confirmation link — tap it from the inbox / phone to finish.
            ID and result uploads enter the review queue.
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

// -----------------------------------------------------------------------
// Wave 20.11 — post-submit "check your inbox / phone" panel.
// -----------------------------------------------------------------------

function redactEmail(addr: string | null | undefined): string {
  if (!addr) return "—";
  const at = addr.indexOf("@");
  if (at <= 0) return addr;
  const name = addr.slice(0, at);
  const domain = addr.slice(at);
  if (name.length <= 2) return `${name[0] ?? ""}•${domain}`;
  return `${name.slice(0, 2)}•••${name.slice(-1)}${domain}`;
}

function redactPhone(num: string | null | undefined): string {
  if (!num) return "—";
  const cleaned = num.replace(/[^\d+]/g, "");
  if (cleaned.length <= 4) return cleaned;
  return `${cleaned.slice(0, cleaned.length - 4).replace(/\d/g, "•")}${cleaned.slice(-4)}`;
}

function channelBadge(c: SendChannel | undefined): {
  text: string;
  className: string;
} {
  if (!c || !c.attempted) {
    return {
      text: "not sent",
      className: "border-white/10 bg-white/5 text-white/45"
    };
  }
  if (c.skipped) {
    return {
      text: "provider not configured",
      className: "border-neon-amber/40 bg-neon-amber/10 text-neon-amber"
    };
  }
  if (c.ok) {
    return {
      text: "sent",
      className: "border-neon-mint/40 bg-neon-mint/10 text-neon-mint"
    };
  }
  return {
    text: "failed",
    className: "border-neon-red/40 bg-neon-red/10 text-neon-red"
  };
}

function PendingSentPanel({
  method,
  guardianEmail,
  guardianPhone,
  eduEmail,
  send,
  resending,
  onResend
}: {
  method: string | null;
  guardianEmail: string;
  guardianPhone: string;
  eduEmail: string;
  send: SendResponse | null;
  resending: boolean;
  onResend: () => void;
}) {
  const isGuardian = method === "guardian_consent";
  const emailRecipient = isGuardian ? guardianEmail : eduEmail;
  const phoneRecipient = isGuardian ? guardianPhone : "";
  const emailBadge = channelBadge(send?.email);
  const smsBadge = channelBadge(send?.sms);

  const anyProviderMissing =
    (send?.email?.skipped && send?.email?.attempted) ||
    (send?.sms?.skipped && send?.sms?.attempted);

  return (
    <section className="surface-glass tint-mint mt-6 p-7 sm:p-9">
      <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
        ⏳ Almost done — confirm the link we just sent
      </p>
      <h2 className="mt-1 font-display text-2xl font-semibold text-white">
        {isGuardian
          ? "We've messaged your parent / guardian."
          : "Check your inbox to finish verifying."}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-white/75">
        {isGuardian
          ? "They'll see a one-time link in their email and phone. Either tap unlocks your Students Network access — you don't need both."
          : "Tap the confirm button in the email we just sent. Your Students Network access unlocks the moment you do."}
      </p>

      <div className="mt-5 space-y-2">
        {/* Email row */}
        {emailRecipient && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-white/40">
                Email
              </p>
              <p className="truncate text-sm text-white/85">
                {redactEmail(emailRecipient)}
              </p>
              {send?.email?.reason && (
                <p className="mt-0.5 truncate text-[11px] text-white/45">
                  {send.email.reason}
                </p>
              )}
            </div>
            <span
              className={clsx(
                "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest",
                emailBadge.className
              )}
            >
              {emailBadge.text}
            </span>
          </div>
        )}

        {/* SMS row — only for guardian path */}
        {isGuardian && phoneRecipient && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-white/40">
                SMS
              </p>
              <p className="truncate text-sm text-white/85 font-mono">
                {redactPhone(phoneRecipient)}
              </p>
              {send?.sms?.reason && (
                <p className="mt-0.5 truncate text-[11px] text-white/45">
                  {send.sms.reason}
                </p>
              )}
            </div>
            <span
              className={clsx(
                "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest",
                smsBadge.className
              )}
            >
              {smsBadge.text}
            </span>
          </div>
        )}
      </div>

      {anyProviderMissing && (
        <p className="mt-3 rounded-xl border border-neon-amber/30 bg-neon-amber/5 px-3 py-2 text-[11px] text-neon-amber/90">
          One of the providers (Resend for email or Twilio for SMS) isn&apos;t
          configured on this deployment yet. The operator needs to set the
          relevant env vars on Netlify and redeploy — your row is saved and
          will confirm the moment a link is tapped.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onResend}
          disabled={resending}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/85 hover:bg-white/10 disabled:opacity-60"
        >
          {resending ? "Resending…" : "Resend link"}
        </button>
        <p className="self-center text-[11px] text-white/45">
          Didn&apos;t arrive in a minute? Check spam, or tap resend.
        </p>
      </div>
    </section>
  );
}

// Wave 20.12 — id_upload / result_upload land here while the operator
// reviews the photo + date. No-op for legacy auto-verify rows; those
// keep their existing "you're in" panel.
function PendingReviewPanel({ method }: { method: string }) {
  const label =
    method === "id_upload"
      ? "Student ID upload"
      : method === "result_upload"
      ? "Marksheet / result upload"
      : "Verification";
  return (
    <section className="surface-glass tint-amber mt-6 p-7 sm:p-9">
      <p className="text-[10px] uppercase tracking-widest text-neon-amber/70">
        ⏳ In the review queue
      </p>
      <h2 className="mt-1 font-display text-2xl font-semibold text-white">
        Your {label} is in for review.
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-white/75">
        The operator confirms the photo and date — usually within 6 hours.
        You&apos;ll see the Students Network unlock the moment your row is
        approved.
      </p>
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-[13px] leading-relaxed text-white/75">
        <p className="font-medium text-white">What we have</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Your photo upload, stored privately in our verification bucket.</li>
          <li>The date you supplied (ID expiry or exam / result date).</li>
          <li>Your country, education level, and subject affinities — used
          to route Help Beacons once you&apos;re in.</li>
        </ul>
      </div>
      <p className="mt-4 text-[11px] text-white/45">
        Need to change something? Resubmit the form — the previous pending
        row gets replaced.
      </p>
    </section>
  );
}
