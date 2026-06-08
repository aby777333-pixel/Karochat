// Karochat — hard-line flagged-content detector.
//
// IMPORTANT: this only targets the Charter's hard lines — sexual content
// involving MINORS and TERRORISM / mass-violence planning. It deliberately
// does NOT flag profanity, kink, or adult/sex-positive language between
// consenting adults (the Charter protects that). Heuristic, not perfect —
// it warns + logs; it is not a substitute for human review.

const MINORS: RegExp[] = [
  /\bchild\s*porn/i,
  /\bchild\s*sex\b/i,
  /\bkiddie\s*porn/i,
  /\bc\.?p\.?\b(?=[\s\S]*\b(porn|pic|vid|child|kid|minor|teen)\b)/i,
  /\b(pre[-\s]?teen)\b[\s\S]{0,20}\b(sex|nude|naked|porn|pic|hot)\b/i,
  /\b(under[-\s]?age|underage)\b[\s\S]{0,20}\b(sex|nude|naked|porn|pic)\b/i,
  /\b(minor|kid|child|teen)\b[\s\S]{0,20}\b(nude|naked|porn)\b/i,
  /\b(nude|naked|porn)\b[\s\S]{0,20}\b(minor|kid|child|underage|preteen)\b/i,
  /\b(loli|lolicon|shota)\b/i,
  /\bjailbait\b/i,
  /\bpedophil/i
];

const TERROR: RegExp[] = [
  /\b(make|build|making|building|how to make|how to build)\b[\s\S]{0,30}\b(bomb|explosive|ied|napalm|nerve gas|pipe bomb)\b/i,
  /\bpipe\s*bomb\b/i,
  /\bsuicide\s*(bomb|vest|attack)\b/i,
  /\bmass\s*(shooting|killing|murder)\b/i,
  /\b(plan|planning|plotting)\b[\s\S]{0,30}\b(attack|massacre|terror|bombing)\b/i,
  /\bbehead/i
];

export type FlagCategory = "minors" | "terror";

export function flagCategory(text: string): FlagCategory | null {
  const t = text || "";
  if (MINORS.some((r) => r.test(t))) return "minors";
  if (TERROR.some((r) => r.test(t))) return "terror";
  return null;
}

export function flagWarning(cat: FlagCategory): string {
  const base =
    "This was NOT sent. The attempt has been logged with your IP address and device. Karochat has zero tolerance here — genuine violations are blacklisted and reported to law enforcement.";
  return cat === "minors"
    ? "⚠ This looks like it may involve sexual content about a minor — a hard line on Karochat. " + base
    : "⚠ This looks like it may involve terrorism or planning violence — a hard line on Karochat. " + base;
}

/** Fire-and-forget: log a flagged attempt to /api/flag (captures IP server-side). */
export function reportFlag(category: FlagCategory, snippet: string, roomId?: string) {
  try {
    void fetch("/api/flag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, snippet: snippet.slice(0, 500), room_id: roomId ?? null })
    });
  } catch {
    /* ignore */
  }
}
