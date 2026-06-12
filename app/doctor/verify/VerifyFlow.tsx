"use client";

// Karochat — doctor verification form (v9 Phase 4).
//
// Uploads evidence to the private medical-evidence bucket under the
// caller's folder (storage paths, not URLs — the admin queue mints
// signed URLs), then calls submit_medical_verification.

import { useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Existing = {
  id: string;
  status: string;
  reviewer_note: string | null;
  specialty: string | null;
  council_name: string | null;
  created_at: string;
  verified_at: string | null;
  expires_at: string | null;
} | null;

const COUNTRIES = [
  ["IN", "India"],
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["AE", "UAE"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["SG", "Singapore"],
  ["OTHER", "Other"]
] as const;

function FileField({
  label,
  required,
  file,
  onPick,
  disabled
}: {
  label: string;
  required?: boolean;
  file: File | null;
  onPick: (f: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="min-w-0">
      <label className="block text-[10px] uppercase tracking-widest text-white/45">
        {label} {required && <span className="text-neon-red">*</span>}
      </label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="mt-1 w-full truncate rounded-xl border border-dashed border-white/20 bg-black/30 px-3 py-2 text-left text-sm text-white/70 hover:border-neon-blue/40 disabled:opacity-60"
      >
        {file ? `📎 ${file.name}` : "Choose photo or PDF…"}
      </button>
    </div>
  );
}

export function VerifyFlow({
  userId,
  isGuest,
  existing
}: {
  userId: string;
  isGuest: boolean;
  existing: Existing;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [country, setCountry] = useState("IN");
  const [degree, setDegree] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [councilName, setCouncilName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [insurer, setInsurer] = useState("");
  const [policyNo, setPolicyNo] = useState("");
  const [regFile, setRegFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [reapplying, setReapplying] = useState(false);

  async function uploadEvidence(file: File, slug: string): Promise<string> {
    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
    const path = `${userId}/${slug}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("medical-evidence")
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false
      });
    if (error) throw new Error(`${slug} upload failed: ${error.message}`);
    return path;
  }

  async function submit() {
    if (!councilName.trim() || !regNumber.trim()) {
      setErr("Council name and registration number are required.");
      return;
    }
    if (!regFile || !idFile) {
      setErr("Registration certificate and government ID uploads are required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const [regPath, idPath, selfiePath] = await Promise.all([
        uploadEvidence(regFile, "registration"),
        uploadEvidence(idFile, "id"),
        selfieFile ? uploadEvidence(selfieFile, "selfie") : Promise.resolve("")
      ]);
      const { error } = await supabase.rpc("submit_medical_verification", {
        p_country: country,
        p_degree: degree,
        p_specialty: specialty,
        p_council_name: councilName,
        p_council_registration_number: regNumber,
        p_registration_evidence_url: regPath,
        p_id_evidence_url: idPath,
        p_selfie_with_id_url: selfiePath,
        p_insurance_provider: insurer,
        p_insurance_policy_number: policyNo
      });
      if (error) throw new Error(error.message);
      setDone(true);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  if (isGuest) {
    return (
      <section className="surface-glass p-5 text-sm text-white/75">
        Guests can&apos;t apply for verification — sign in with a full
        account first.
      </section>
    );
  }

  if (done) {
    return (
      <section className="surface-glass tint-mint p-5">
        <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
          ✅ Application received
        </p>
        <p className="mt-2 text-sm text-white/80">
          An operator will check your registration against the council
          registry — usually within a day or two. You&apos;ll see the result
          here and on the doctor hub.
        </p>
      </section>
    );
  }

  // Status panels for an existing application.
  if (existing && !reapplying) {
    if (existing.status === "verified") {
      return (
        <section className="surface-glass tint-mint p-5">
          <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
            ✔ You&apos;re a verified doctor
          </p>
          <p className="mt-2 text-sm text-white/80">
            {existing.council_name} · verified{" "}
            {existing.verified_at &&
              new Date(existing.verified_at).toLocaleDateString()}
            {existing.expires_at &&
              ` · renews ${new Date(existing.expires_at).toLocaleDateString()}`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/doctor/queue"
              className="rounded-xl border border-neon-mint/40 bg-neon-mint/10 px-3 py-2 text-sm text-neon-mint hover:bg-neon-mint/20"
            >
              📥 See incoming requests
            </a>
            <a
              href="/doctor/availability"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              🗓 Set weekly hours
            </a>
          </div>
        </section>
      );
    }
    if (existing.status === "pending") {
      return (
        <section className="surface-glass tint-amber p-5">
          <p className="text-[10px] uppercase tracking-widest text-neon-amber/80">
            ⏳ Application under review
          </p>
          <p className="mt-2 text-sm text-white/80">
            Submitted {new Date(existing.created_at).toLocaleString()}. An
            operator is checking your registration — no action needed.
          </p>
        </section>
      );
    }
    if (existing.status === "rejected") {
      return (
        <section className="surface-glass tint-red p-5">
          <p className="text-[10px] uppercase tracking-widest text-neon-red/80">
            ✖ Application rejected
          </p>
          {existing.reviewer_note && (
            <p className="mt-2 text-sm text-white/80">
              Reviewer note: {existing.reviewer_note}
            </p>
          )}
          <button
            type="button"
            onClick={() => setReapplying(true)}
            className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Apply again
          </button>
        </section>
      );
    }
    // expired → fall through to the form
  }

  return (
    <section className="surface-glass min-w-0 space-y-4 p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="block text-[10px] uppercase tracking-widest text-white/45">
            Country of registration <span className="text-neon-red">*</span>
          </label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            disabled={busy}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-blue/40"
          >
            {COUNTRIES.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label className="block text-[10px] uppercase tracking-widest text-white/45">
            Degree
          </label>
          <input
            value={degree}
            onChange={(e) => setDegree(e.target.value.slice(0, 80))}
            disabled={busy}
            placeholder="e.g. MBBS, MD"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/40"
          />
        </div>
        <div className="min-w-0">
          <label className="block text-[10px] uppercase tracking-widest text-white/45">
            Specialty
          </label>
          <input
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value.slice(0, 80))}
            disabled={busy}
            placeholder="e.g. dermatology, general"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/40"
          />
        </div>
        <div className="min-w-0">
          <label className="block text-[10px] uppercase tracking-widest text-white/45">
            Medical council <span className="text-neon-red">*</span>
          </label>
          <input
            value={councilName}
            onChange={(e) => setCouncilName(e.target.value.slice(0, 120))}
            disabled={busy}
            placeholder="e.g. National Medical Commission"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/40"
          />
        </div>
        <div className="min-w-0 sm:col-span-2">
          <label className="block text-[10px] uppercase tracking-widest text-white/45">
            Council registration number <span className="text-neon-red">*</span>
          </label>
          <input
            value={regNumber}
            onChange={(e) => setRegNumber(e.target.value.slice(0, 80))}
            disabled={busy}
            placeholder="exactly as it appears in the registry"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/40"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FileField
          label="Registration certificate"
          required
          file={regFile}
          onPick={setRegFile}
          disabled={busy}
        />
        <FileField
          label="Government ID"
          required
          file={idFile}
          onPick={setIdFile}
          disabled={busy}
        />
        <FileField
          label="Selfie holding your ID (optional)"
          file={selfieFile}
          onPick={setSelfieFile}
          disabled={busy}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="block text-[10px] uppercase tracking-widest text-white/45">
            Indemnity insurance provider
          </label>
          <input
            value={insurer}
            onChange={(e) => setInsurer(e.target.value.slice(0, 120))}
            disabled={busy}
            placeholder="recommended — e.g. IMA, MDU"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-blue/40"
          />
        </div>
        <div className="min-w-0">
          <label className="block text-[10px] uppercase tracking-widest text-white/45">
            Policy number
          </label>
          <input
            value={policyNo}
            onChange={(e) => setPolicyNo(e.target.value.slice(0, 80))}
            disabled={busy}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-blue/40"
          />
        </div>
      </div>

      {err && (
        <p className="rounded-lg border border-neon-red/30 bg-neon-red/10 px-3 py-2 text-[12px] text-neon-red">
          {err}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="rounded-xl bg-neon-blue px-4 py-2 text-sm font-medium text-ink-900 hover:bg-neon-blue/90 disabled:opacity-60"
      >
        {busy ? "Uploading…" : "Submit for review →"}
      </button>
      <p className="text-[11px] text-white/40">
        By submitting you confirm the documents are yours and consent to an
        operator checking them against the public council registry.
      </p>
    </section>
  );
}
