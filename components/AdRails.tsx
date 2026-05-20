import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";

/**
 * Adds left + right ad rails around the main content. Visible only on xl+
 * screens so phones and tablets keep the full chat width. Each rail is a
 * sticky 200px column with one tall (~200×600) slot and one short (~200×250)
 * slot, in a checker pattern: white-dark on the left, dark-white on the right.
 */

const AD_LINK = "https://www.ghlindiaventures.com";

export function AdRails({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "relative mx-auto flex w-full max-w-[1600px] gap-4 px-4 xl:gap-6 xl:px-6",
        className
      )}
    >
      <aside
        className="sticky top-4 hidden h-[100dvh] w-[200px] shrink-0 flex-col gap-3 py-4 xl:flex"
        aria-label="Sponsor"
      >
        <AdSlot
          tall
          src="/ads/ghl-1.png"
          alt="GHL India Ventures — strategic capital for HNIs"
        />
        <AdSlot
          src="/ads/gioraptor-1.png"
          alt="GIO RAPTOR — AI-powered brokerage infrastructure"
        />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
      <aside
        className="sticky top-4 hidden h-[100dvh] w-[200px] shrink-0 flex-col gap-3 py-4 xl:flex"
        aria-label="Sponsor"
      >
        <AdSlot
          tall
          src="/ads/gioraptor-2.png"
          alt="GIO RAPTOR — modern markets, smarter infrastructure"
        />
        <AdSlot
          src="/ads/ghl-2.png"
          alt="GHL India Ventures — structure creates confidence"
        />
      </aside>
    </div>
  );
}

function AdSlot({
  src,
  alt,
  tall
}: {
  src: string;
  alt: string;
  tall?: boolean;
}) {
  return (
    <Link
      href={AD_LINK}
      target="_blank"
      rel="sponsored noopener noreferrer"
      title={alt}
      aria-label={alt}
      className={clsx(
        "relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-lg transition hover:border-white/20",
        // Roughly match the canonical 200×600 / 200×250 split (~12:5).
        tall ? "flex-[12_1_0%]" : "flex-[5_1_0%]"
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="200px"
        className="object-cover"
        priority={tall}
      />
      <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/55 px-1 text-[8px] uppercase tracking-widest text-white/55 backdrop-blur">
        ad
      </span>
    </Link>
  );
}
