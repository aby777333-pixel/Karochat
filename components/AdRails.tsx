import clsx from "clsx";

/**
 * Adds left + right ad rails around the main content. Visible only on xl+
 * screens so phones and tablets keep the full chat width. Each rail is a
 * sticky 240px column. Real ad units (AdSense / direct / house) can be
 * dropped into the AdSlot children later — for now they're labeled empty
 * cards so it's obvious where they go.
 */
export function AdRails({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("relative mx-auto flex w-full max-w-[1600px] gap-4 px-4 xl:gap-6 xl:px-6", className)}>
      <aside className="sticky top-4 hidden h-[100dvh] w-[200px] shrink-0 flex-col gap-3 py-4 xl:flex" aria-label="Sponsor">
        <AdSlot label="Ad · 200×600" />
        <AdSlot label="Ad · 200×250" />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
      <aside className="sticky top-4 hidden h-[100dvh] w-[200px] shrink-0 flex-col gap-3 py-4 xl:flex" aria-label="Sponsor">
        <AdSlot label="Ad · 200×600" />
        <AdSlot label="Ad · 200×250" />
      </aside>
    </div>
  );
}

function AdSlot({ label }: { label: string }) {
  return (
    <div className="surface-glass flex flex-1 items-center justify-center text-[10px] uppercase tracking-widest text-white/25">
      {label}
    </div>
  );
}
