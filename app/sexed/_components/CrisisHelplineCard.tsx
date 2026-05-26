// Karochat — crisis helpline card for sex-ed pages.
//
// Server component. Renders a non-dismissable panel of helplines for a
// given country + kind set. Used at top of /sexed and as a sidebar on
// /sexed/ask.

type Helpline = {
  id: string;
  country: string;
  kind: string;
  name: string;
  phone: string | null;
  sms: string | null;
  url: string | null;
  hours: string | null;
  languages: string[] | null;
  notes: string | null;
};

const KIND_LABEL: Record<string, string> = {
  suicide: "Suicide / crisis",
  sexual_violence: "Sexual violence",
  domestic_violence: "Domestic violence",
  child_abuse: "Child safety",
  lgbtq_youth: "LGBTQ youth",
  general_distress: "Distress",
  mental_health: "Mental health"
};

export function CrisisHelplineCard({
  helplines,
  compact
}: {
  helplines: Helpline[];
  compact?: boolean;
}) {
  if (!helplines || helplines.length === 0) return null;
  return (
    <section
      className={
        "surface-glass tint-red " +
        (compact ? "p-4" : "p-5")
      }
    >
      <p className="text-[10px] uppercase tracking-widest text-neon-red/80">
        🆘 If anything here applies to you right now
      </p>
      <p className="mt-1 text-sm leading-relaxed text-white/80">
        These services are free, confidential, and trained for this.
        It&apos;s OK to call even if you&apos;re not sure it&apos;s &quot;serious enough&quot;.
      </p>
      <ul className="mt-3 space-y-2 text-[13px]">
        {helplines.map((h) => (
          <li
            key={h.id}
            className="rounded-lg border border-white/10 bg-black/30 p-2.5"
          >
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-semibold text-white">{h.name}</span>
              <span className="rounded-sm border border-white/15 bg-white/5 px-1 text-[10px] uppercase tracking-widest text-white/55">
                {KIND_LABEL[h.kind] ?? h.kind}
              </span>
              <span className="text-[11px] text-white/45">
                {h.country}
                {h.hours ? ` · ${h.hours}` : ""}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
              {h.phone && (
                <a
                  href={`tel:${h.phone.replace(/[^\d+]/g, "")}`}
                  className="text-neon-mint hover:underline"
                >
                  📞 {h.phone}
                </a>
              )}
              {h.sms && h.sms !== h.phone && (
                <a
                  href={`sms:${h.sms}`}
                  className="text-neon-blue hover:underline"
                >
                  💬 Text {h.sms}
                </a>
              )}
              {h.url && (
                <a
                  href={h.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neon-blue hover:underline"
                >
                  ↗ Visit
                </a>
              )}
            </div>
            {h.notes && (
              <p className="mt-1 text-[11px] text-white/55">{h.notes}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
