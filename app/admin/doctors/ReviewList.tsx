"use client";

// Karochat — admin doctor-verification review list (v9 Phase 4).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type Application = {
  verification_id: string;
  applicant_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  country: string;
  degree: string | null;
  specialty: string | null;
  council_name: string | null;
  council_registration_number: string | null;
  registration_evidence_url: string | null;
  id_evidence_url: string | null;
  selfie_with_id_url: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  status: string;
  reviewer_note: string | null;
  created_at: string;
  verified_at: string | null;
  expires_at: string | null;
};

function EvidenceLink({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return <span className="text-[12px] text-white/30">{label}: none</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-lg border border-neon-blue/30 bg-neon-blue/10 px-2.5 py-1 text-[12px] text-neon-blue hover:bg-neon-blue/20"
    >
      📄 {label}
    </a>
  );
}

function ApplicationCard({ app }: { app: Application }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"verified" | "rejected" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [decided, setDecided] = useState<string | null>(null);

  async function decide(decision: "verified" | "rejected") {
    if (decision === "rejected" && !note.trim()) {
      setErr("Add a note so the applicant knows what to fix.");
      return;
    }
    setBusy(decision);
    setErr(null);
    const { error } = await supabase.rpc("admin_review_medical_verification", {
      p_verification_id: app.verification_id,
      p_decision: decision,
      p_note: note.trim() || null
    });
    setBusy(null);
    if (error) {
      setErr(error.message);
      return;
    }
    setDecided(decision);
    router.refresh();
  }

  if (decided) {
    return (
      <li className="surface-glass p-3 text-sm text-white/60">
        {decided === "verified" ? "✔ Verified" : "✖ Rejected"} —{" "}
        {app.display_name} (@{app.username})
      </li>
    );
  }

  return (
    <li className="surface-glass min-w-0 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-white">
          {app.display_name}{" "}
          <span className="font-normal text-white/50">@{app.username}</span>
        </p>
        <span className="rounded-sm border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-white/55">
          {app.country}
        </span>
        <span className="ml-auto text-[11px] text-white/40">
          {new Date(app.created_at).toLocaleString()}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-2">
        <div>
          <dt className="inline text-white/45">Council: </dt>
          <dd className="inline text-white/85">{app.council_name ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline text-white/45">Reg #: </dt>
          <dd className="inline font-mono text-white/85">
            {app.council_registration_number ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="inline text-white/45">Degree: </dt>
          <dd className="inline text-white/85">{app.degree ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline text-white/45">Specialty: </dt>
          <dd className="inline text-white/85">{app.specialty ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="inline text-white/45">Insurance: </dt>
          <dd className="inline text-white/85">
            {app.insurance_provider
              ? `${app.insurance_provider} · ${app.insurance_policy_number ?? "no policy #"}`
              : "none declared"}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <EvidenceLink
          href={app.registration_evidence_url}
          label="Registration cert"
        />
        <EvidenceLink href={app.id_evidence_url} label="Government ID" />
        <EvidenceLink href={app.selfie_with_id_url} label="Selfie with ID" />
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 500))}
        rows={2}
        placeholder="Reviewer note (required for rejection — shown to the applicant)"
        className="mt-3 w-full resize-y rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[13px] outline-none placeholder:text-white/30 focus:border-neon-blue/40"
      />
      {err && <p className="mt-1 text-[12px] text-neon-red">{err}</p>}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => decide("verified")}
          disabled={busy !== null}
          className="rounded-xl bg-neon-mint px-3.5 py-1.5 text-sm font-medium text-ink-900 hover:bg-neon-mint/90 disabled:opacity-60"
        >
          {busy === "verified" ? "Verifying…" : "✔ Verify (1 year)"}
        </button>
        <button
          type="button"
          onClick={() => decide("rejected")}
          disabled={busy !== null}
          className="rounded-xl border border-neon-red/40 bg-neon-red/10 px-3.5 py-1.5 text-sm text-neon-red hover:bg-neon-red/20 disabled:opacity-60"
        >
          {busy === "rejected" ? "Rejecting…" : "✖ Reject"}
        </button>
      </div>
    </li>
  );
}

export function ReviewList({
  pending,
  recent
}: {
  pending: Application[];
  recent: Application[];
}) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-semibold text-white/80">
          Pending {pending.length > 0 && `(${pending.length})`}
        </h2>
        {pending.length === 0 ? (
          <p className="surface-glass mt-2 p-4 text-sm text-white/55">
            Queue is clear. 🎉
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {pending.map((a) => (
              <ApplicationCard key={a.verification_id} app={a} />
            ))}
          </ul>
        )}
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white/80">
            Recently reviewed
          </h2>
          <ul className="mt-2 space-y-1.5">
            {recent.map((a) => (
              <li
                key={a.verification_id}
                className="surface-glass flex flex-wrap items-center justify-between gap-2 p-2.5 text-[13px]"
              >
                <span className="min-w-0 flex-1 truncate text-white/70">
                  {a.display_name} (@{a.username}) — {a.council_name}
                </span>
                <span
                  className={
                    "shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] uppercase tracking-widest " +
                    (a.status === "verified"
                      ? "border border-neon-mint/40 bg-neon-mint/10 text-neon-mint"
                      : "border border-neon-red/40 bg-neon-red/10 text-neon-red")
                  }
                >
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
