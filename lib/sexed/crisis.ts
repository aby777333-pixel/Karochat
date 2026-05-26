// Karochat — sex-ed crisis keyword classifier.
//
// Cheap, fast, regex-based first-pass on a user question. When it
// detects high-risk phrasing (suicide / self-harm / sexual violence /
// child abuse / immediate danger), the Karo Q&A route returns helpline
// info BEFORE any generated answer — so the model never gets the
// chance to soften or sidestep the routing.
//
// This is intentionally over-eager: false positives surface a helpline
// banner, which is the right failure mode. The model is still allowed
// to answer the underlying question.

export type CrisisCategory =
  | "suicide"
  | "self_harm"
  | "sexual_violence"
  | "domestic_violence"
  | "child_abuse"
  | "lgbtq_youth";

export type CrisisHit = {
  category: CrisisCategory;
  matched: string;
};

// Each pattern is checked against a normalised lowercase question.
// Patterns deliberately mix English + transliterated Hindi/Hinglish.
const PATTERNS: Array<{ category: CrisisCategory; rx: RegExp }> = [
  // Suicide / suicidal ideation
  {
    category: "suicide",
    rx: /\b(kill myself|end my life|end it all|take my (?:own )?life|don'?t want to (?:be alive|live)|want to die|wanna die|want to be dead|suicide|suicidal|jump off|hang myself|overdose|od myself|attempt(ed)? suicide|atmahatya|khudkushi|jaan dena)\b/i
  },
  // Self-harm
  {
    category: "self_harm",
    rx: /\b(cut(ting)? myself|self[- ]?harm|self[- ]?injur|burn(ed|ing)? myself|hurt myself|punish myself)\b/i
  },
  // Sexual violence / rape
  {
    category: "sexual_violence",
    rx: /\b(rape[d]?|sexually? assault|forced me|forced sex|made me have sex|coerced me|molest(ed|ation)?|grope[d]?|stalking me|sextort|nude(?:s)? leak|leaked? my (?:photos|nudes|pictures)|revenge porn|ncii|balatkar|chedchad)\b/i
  },
  // Domestic violence
  {
    category: "domestic_violence",
    rx: /\b(beat(s|ing)? me|hit(s|ting)? me|abus(ed?|ive) (?:husband|boyfriend|partner|wife|girlfriend|family)|domestic violence|household violence|controlling partner|won'?t let me leave)\b/i
  },
  // Child abuse / minor in danger
  {
    category: "child_abuse",
    rx: /\b(((he|she|they|my (?:dad|father|mom|mother|uncle|aunt|brother|sister|cousin|teacher|tutor|coach|grandfather|grandmother)) (?:touched|abus(ed)?|assault(ed)?)\s+me))|((i'?m|i am) (?:[0-9]|1[0-7])\s*(?:and|but).*(?:touched|abused|hurt))|grooming me|asked me (?:to send|for) nude|pocso/i
  },
  // LGBTQ youth in distress
  {
    category: "lgbtq_youth",
    rx: /\b((parents|family|dad|mom|father|mother) (?:found out|know|will kill me|throwing me out|kicked me out|disowned).*(gay|lesbian|trans|queer|bi(?:sexual)?))|(?:gay|lesbian|trans|queer) and (?:no one knows|scared|terrified|alone)/i
  }
];

export function detectCrisis(rawQuestion: string): CrisisHit[] {
  if (!rawQuestion) return [];
  const q = rawQuestion.toLowerCase();
  const hits: CrisisHit[] = [];
  for (const { category, rx } of PATTERNS) {
    const m = q.match(rx);
    if (m) hits.push({ category, matched: m[0] });
  }
  // De-dup by category (one hit per category is enough).
  const seen = new Set<CrisisCategory>();
  return hits.filter((h) => {
    if (seen.has(h.category)) return false;
    seen.add(h.category);
    return true;
  });
}

// Map a detected crisis category to the helpline kinds we want to
// surface from list_helplines_for.
export function helplineKindsFor(hits: CrisisHit[]): string[] {
  const kinds = new Set<string>();
  for (const h of hits) {
    if (h.category === "suicide" || h.category === "self_harm") {
      kinds.add("suicide");
      kinds.add("mental_health");
      kinds.add("general_distress");
    } else if (h.category === "sexual_violence") {
      kinds.add("sexual_violence");
    } else if (h.category === "domestic_violence") {
      kinds.add("domestic_violence");
      kinds.add("sexual_violence");
    } else if (h.category === "child_abuse") {
      kinds.add("child_abuse");
      kinds.add("sexual_violence");
    } else if (h.category === "lgbtq_youth") {
      kinds.add("lgbtq_youth");
      kinds.add("general_distress");
    }
  }
  return Array.from(kinds);
}
