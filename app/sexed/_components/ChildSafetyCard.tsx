// Karochat — child-safety & counter-terror notice + international reporting.
// Pure presentational. Shown on the Sex ed surfaces. No client JS.

type Contact = { region: string; flag: string; items: { label: string; href?: string }[] };

const REPORT: Contact[] = [
  {
    region: "Karochat",
    flag: "🛡️",
    items: [
      { label: "report@karochat.co", href: "mailto:report@karochat.co" },
      { label: "safety@karochat.co", href: "mailto:safety@karochat.co" },
      { label: "In-app: tap ⚠ Report on any user, room or message" }
    ]
  },
  {
    region: "Global",
    flag: "🌍",
    items: [
      { label: "INHOPE — find a hotline", href: "https://www.inhope.org/EN/our-members" },
      { label: "INTERPOL", href: "https://www.interpol.int/Crimes/Crimes-against-children" },
      { label: "Europol — report a crime", href: "https://www.europol.europa.eu/report-a-crime" }
    ]
  },
  {
    region: "India",
    flag: "🇮🇳",
    items: [
      { label: "Childline — 1098", href: "tel:1098" },
      { label: "Cyber Crime — 1930", href: "tel:1930" },
      { label: "cybercrime.gov.in", href: "https://cybercrime.gov.in" },
      { label: "NCPCR POCSO e-Box", href: "https://ncpcr.gov.in/index1.php?lang=1&level=1&sublinkid=1546&lid=1556" }
    ]
  },
  {
    region: "USA",
    flag: "🇺🇸",
    items: [
      { label: "NCMEC CyberTipline — 1-800-843-5678", href: "tel:18008435678" },
      { label: "report.cybertip.org", href: "https://report.cybertip.org" },
      { label: "FBI tips — tips.fbi.gov", href: "https://tips.fbi.gov" }
    ]
  },
  {
    region: "UK",
    flag: "🇬🇧",
    items: [
      { label: "IWF — report.iwf.org.uk", href: "https://report.iwf.org.uk" },
      { label: "CEOP", href: "https://www.ceop.police.uk/safety-centre" },
      { label: "Anti-Terrorist Hotline — 0800 789 321", href: "tel:0800789321" }
    ]
  },
  {
    region: "Canada",
    flag: "🇨🇦",
    items: [{ label: "Cybertip.ca", href: "https://www.cybertip.ca" }]
  },
  {
    region: "Australia",
    flag: "🇦🇺",
    items: [
      { label: "eSafety — esafety.gov.au", href: "https://www.esafety.gov.au/report" },
      { label: "ACCCE", href: "https://www.accce.gov.au/report" }
    ]
  }
];

export function ChildSafetyCard() {
  return (
    <section className="surface-glass mt-6 rounded-2xl border border-neon-red/40 bg-neon-red/[0.06] p-5">
      <p className="text-[10px] uppercase tracking-widest text-neon-red">
        🚫 Zero tolerance — minors & terror
      </p>
      <h2 className="mt-1 font-display text-lg font-semibold text-white">
        Crimes against minors and acts of terror are reported to the police.
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-white/85">
        Karochat has <span className="font-semibold text-white">absolutely zero tolerance</span> for
        any sexual content or behaviour involving anyone under 18, and for any content that promotes,
        plans, or glorifies terrorism or mass violence. These are hard lines in our People&apos;s
        Charter. Such accounts and content are removed immediately and permanently — and we
        <span className="font-semibold text-white"> log and retain the offender&apos;s IP address,
        device and account data, blacklist them, and hand that information to the relevant
        law-enforcement authorities.</span> There is no anonymity and no second chance for this.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-white/70">
        If you see it, report it. If a child is in immediate danger, call your local emergency number
        (112 / 911 / 999 / 100) first.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT.map((c) => (
          <div key={c.region} className="rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
              {c.flag} {c.region}
            </p>
            <ul className="mt-1.5 space-y-1 text-[12px]">
              {c.items.map((it) => (
                <li key={it.label}>
                  {it.href ? (
                    <a
                      href={it.href}
                      target={it.href.startsWith("http") ? "_blank" : undefined}
                      rel="noreferrer"
                      className="text-neon-blue underline-offset-2 hover:underline"
                    >
                      {it.label}
                    </a>
                  ) : (
                    <span className="text-white/65">{it.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
