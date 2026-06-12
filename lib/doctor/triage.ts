// Karochat — Ask-a-Doctor emergency triage classifier (v9 Phase 4).
//
// Cheap, fast, regex-based first-pass on a symptom description. When it
// detects red-flag phrasing (chest pain / stroke signs / can't breathe /
// overdose / anaphylaxis / heavy bleeding / suicidal intent), the ask
// flow surfaces emergency-services numbers BEFORE the request is routed
// to any doctor — and the routing itself carries the emergency flag so
// it can never be suppressed downstream.
//
// Same philosophy as lib/sexed/crisis.ts: intentionally over-eager.
// A false positive shows an emergency banner above the form, which is
// the right failure mode. The user can still continue to a doctor.

export type EmergencyCategory =
  | "cardiac"
  | "breathing"
  | "stroke"
  | "bleeding_trauma"
  | "poisoning_overdose"
  | "anaphylaxis"
  | "pregnancy_emergency"
  | "suicide_self_harm";

export type EmergencyHit = {
  category: EmergencyCategory;
  matched: string;
};

// Checked against the normalised lowercase symptom text.
// Patterns mix English + transliterated Hindi/Hinglish where natural.
const PATTERNS: Array<{ category: EmergencyCategory; rx: RegExp }> = [
  // Cardiac red flags
  {
    category: "cardiac",
    rx: /\b(chest (?:pain|pressure|tightness|heaviness)|crushing (?:pain|feeling)|pain (?:radiating|spreading) (?:to|down) (?:my )?(?:left )?(?:arm|jaw|shoulder)|heart attack|seene (?:me|mein) dard)\b/i
  },
  // Breathing emergencies
  {
    category: "breathing",
    rx: /\b(can'?t breathe|cannot breathe|struggling to breathe|gasping|choking|turning blue|lips (?:are )?(?:blue|purple)|severe asthma attack|saans nahi)\b/i
  },
  // Stroke (FAST signs)
  {
    category: "stroke",
    rx: /\b(face (?:is )?droop(?:ing)?|slurr(?:ed|ing) (?:my )?speech|can'?t (?:move|feel) (?:my )?(?:arm|leg|face|one side)|one side (?:of my body )?(?:is )?(?:numb|weak|paralyzed|paralysed)|sudden(?:ly)? (?:can'?t|cannot) (?:see|speak|talk)|worst headache of my life|stroke)\b/i
  },
  // Heavy bleeding / major trauma
  {
    category: "bleeding_trauma",
    rx: /\b(bleeding (?:a lot|heavily|won'?t stop|everywhere)|blood (?:won'?t|will not) stop|coughing (?:up )?blood|vomit(?:ing|ed) blood|deep (?:cut|wound)|stab(?:bed)?|gunshot|hit by a (?:car|bike|truck)|fell from|broke[n]? (?:my )?(?:skull|neck|spine|back)|unconscious|passed out and|seizure (?:won'?t|will not) stop|khoon (?:nahi ruk|bahut))\b/i
  },
  // Poisoning / overdose
  {
    category: "poisoning_overdose",
    rx: /\b(overdose|od'?d|took (?:too many|a lot of|all the) (?:pills|tablets|medicines?)|swallowed (?:poison|bleach|cleaner|chemical)|rat poison|drank (?:phenyl|acid|kerosene)|zeher)\b/i
  },
  // Anaphylaxis / severe allergic reaction
  {
    category: "anaphylaxis",
    rx: /\b(throat (?:is )?(?:closing|swelling|tight)|tongue (?:is )?swelling|anaphyla(?:xis|ctic)|severe allergic reaction|hives (?:all over|everywhere) and|face swelling (?:up|fast))\b/i
  },
  // Pregnancy emergencies
  {
    category: "pregnancy_emergency",
    rx: /\b(pregnan(?:t|cy).{0,40}(?:heavy bleeding|severe pain|water broke|no movement|baby (?:isn'?t|is not|stopped) moving)|(?:heavy bleeding|severe cramps).{0,40}pregnan(?:t|cy)|ectopic|miscarr(?:y|iage|ying) (?:right now|heavily))\b/i
  },
  // Suicidal intent / self-harm (route to crisis lines, not just 112)
  {
    category: "suicide_self_harm",
    rx: /\b(kill myself|end my life|end it all|take my (?:own )?life|want to die|wanna die|suicide|suicidal|cut(ting)? myself|self[- ]?harm|hurt myself|atmahatya|khudkushi|jaan dena)\b/i
  }
];

export function detectEmergency(rawText: string): EmergencyHit[] {
  if (!rawText) return [];
  const t = rawText.toLowerCase();
  const hits: EmergencyHit[] = [];
  for (const { category, rx } of PATTERNS) {
    const m = t.match(rx);
    if (m) hits.push({ category, matched: m[0] });
  }
  const seen = new Set<EmergencyCategory>();
  return hits.filter((h) => {
    if (seen.has(h.category)) return false;
    seen.add(h.category);
    return true;
  });
}

// Helpline kinds to pull from list_helplines_for alongside the
// emergency-services numbers.
export function emergencyHelplineKindsFor(hits: EmergencyHit[]): string[] {
  const kinds = new Set<string>(["medical_emergency"]);
  for (const h of hits) {
    if (h.category === "suicide_self_harm") {
      kinds.add("suicide");
      kinds.add("mental_health");
    }
    if (h.category === "poisoning_overdose") {
      kinds.add("suicide");
    }
  }
  return Array.from(kinds);
}

// Human-readable one-liner per category for the emergency banner.
export const EMERGENCY_LABELS: Record<EmergencyCategory, string> = {
  cardiac: "Chest pain can be a heart attack — minutes matter.",
  breathing: "Trouble breathing is an emergency right now.",
  stroke: "These are stroke warning signs — call immediately.",
  bleeding_trauma: "Severe bleeding or major injury needs an ambulance.",
  poisoning_overdose: "A possible overdose or poisoning can't wait.",
  anaphylaxis: "A severe allergic reaction can close your airway fast.",
  pregnancy_emergency: "Pregnancy emergencies need a hospital, not a chat.",
  suicide_self_harm: "You deserve immediate, human support."
};
