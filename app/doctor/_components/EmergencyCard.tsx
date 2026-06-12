// Karochat — emergency override card for the Ask-a-Doctor flow.
//
// Shown the moment the triage classifier fires — above the form, above
// any doctor routing, with no way to suppress it. Pairs the red-flag
// explanation with emergency-services numbers + crisis helplines.

import {
  EMERGENCY_LABELS,
  type EmergencyHit
} from "@/lib/doctor/triage";

type Helpline = {
  id: string;
  country: string;
  kind: string;
  name: string;
  phone: string | null;
  sms: string | null;
  url: string | null;
  hours: string | null;
  notes: string | null;
};

export function EmergencyCard({
  hits,
  helplines
}: {
  hits: EmergencyHit[];
  helplines: Helpline[];
}) {
  if (!hits || hits.length === 0) return null;
  return (
    <section className="rounded-2xl border-2 border-neon-red/60 bg-neon-red/15 p-4 md:p-5">
      <p className="text-[10px] uppercase tracking-widest text-neon-red">
        🚨 This sounds like it could be an emergency
      </p>
      <ul className="mt-2 space-y-1 text-sm font-medium text-white">
        {hits.map((h) => (
          <li key={h.category}>• {EMERGENCY_LABELS[h.category]}</li>
        ))}
      </ul>
      <p className="mt-2 text-[13px] leading-relaxed text-white/85">
        A chat with an online doctor is <strong>too slow</strong> for this.
        Call now — it&apos;s free and they&apos;re trained for exactly this
        moment:
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {helplines.map((h) =>
          h.phone ? (
            <a
              key={h.id}
              href={`tel:${h.phone.replace(/[^\d+]/g, "")}`}
              className="rounded-xl border border-neon-red/50 bg-black/40 px-3 py-2 text-sm font-semibold text-white hover:bg-black/60"
            >
              📞 {h.phone}
              <span className="ml-1.5 text-[11px] font-normal text-white/60">
                {h.name} · {h.country}
              </span>
            </a>
          ) : null
        )}
      </div>
      <p className="mt-3 text-[11px] text-white/55">
        If it turns out to be nothing, that&apos;s a good outcome — nobody
        will be annoyed you called. You can still ask a Karochat doctor
        afterwards.
      </p>
    </section>
  );
}
