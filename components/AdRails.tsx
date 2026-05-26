import clsx from "clsx";

/**
 * Adds left + right ad rails around the main content. Visible only on xl+
 * screens so phones and tablets keep the full chat width. Each rail is a
 * sticky 200px column with one tall (~200×600) slot and one short (~200×250)
 * slot.
 *
 * Slots are currently EMPTY — sponsor content was cleared per owner request
 * 2026-05-26. The layout / dimensions / aria are preserved so future creatives
 * can be re-added by populating <SponsorSlot src=... alt=... href=... /> (see
 * the legacy snippet in this file's git history, commit prior to 06ab4ab).
 */

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
        aria-label="Sponsor slot (left rail)"
      >
        <EmptySlot tall />
        <EmptySlot />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
      <aside
        className="sticky top-4 hidden h-[100dvh] w-[200px] shrink-0 flex-col gap-3 py-4 xl:flex"
        aria-label="Sponsor slot (right rail)"
      >
        <EmptySlot tall />
        <EmptySlot />
      </aside>
    </div>
  );
}

function EmptySlot({ tall }: { tall?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        "relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]",
        // Roughly match the canonical 200×600 / 200×250 split (~12:5).
        tall ? "flex-[12_1_0%]" : "flex-[5_1_0%]"
      )}
    />
  );
}
