/**
 * Karo Classifier
 * ---------------
 * Turns a raw beacon question (text + optional voice/image) into a structured
 * BeaconClassification using Claude. Used by the router to decide who to notify.
 *
 * Designed to be injectable — the router takes a `Classifier` interface, so
 * tests stub it with deterministic outputs.
 *
 * Drop path: src/students-network/beacons/classifier.ts
 */

import { BeaconClassification, EducationLevel } from './types';

// ============================================================================
// PUBLIC INTERFACE (the router depends on this)
// ============================================================================

export interface Classifier {
  classify(input: ClassifierInput): Promise<BeaconClassification>;
}

export interface ClassifierInput {
  /** Raw text question from the user. */
  text: string;
  /** Optional voice transcript (pre-transcribed by Whisper before reaching here). */
  voice_transcript?: string;
  /** Optional OCR'd text from an uploaded photo of a problem. */
  image_ocr?: string;
  /** Optional context the user provided. */
  context_note?: string;
  /** Asker's own country + level (helps when the question doesn't specify). */
  asker_country: string;
  asker_level: EducationLevel;
  asker_syllabus: string | null;
}

// ============================================================================
// PRODUCTION IMPLEMENTATION (calls Anthropic API)
// ============================================================================

export class AnthropicClassifier implements Classifier {
  constructor(
    private apiKey: string,
    private model: string = 'claude-haiku-4-5-20251001',
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async classify(input: ClassifierInput): Promise<BeaconClassification> {
    const merged = [
      input.text,
      input.voice_transcript ? `[Voice transcript]: ${input.voice_transcript}` : '',
      input.image_ocr ? `[Problem from photo]: ${input.image_ocr}` : '',
      input.context_note ? `[Asker context]: ${input.context_note}` : '',
    ].filter(Boolean).join('\n\n');

    const systemPrompt = `You are Karo, the routing brain for a global student help network. Your job: parse a student's question into structured metadata so we route it to the right helpers.

CRITICAL RULES:
- Output VALID JSON only, no preamble, no markdown fences.
- Use only the canonical values listed for each field.
- If you can't extract a coherent learning question, set off_topic=true.
- The question may be in any language; normalize subject/topic to English slugs.
- Be conservative with confidence — only above 0.8 if the subject is unambiguous.

SCHEMA:
{
  "subject": "<slug like 'physics' | 'organic-chemistry' | 'calculus' | 'history' | 'macroeconomics' | 'cs-algorithms' | etc>",
  "topic": "<specific topic slug or null>",
  "level": "<one of: class-9-10, class-11-12, undergrad-yr1, undergrad-yr2, undergrad-yr3, undergrad-yr4, masters, phd, exam-prep, professional-cert, unknown>",
  "syllabus": "<syllabus code if inferrable from question (e.g. 'CBSE', 'A-Level-AQA', 'AP', 'JEE-Main', 'NEET', 'USMLE-Step-1', 'CFA-L1') or null>",
  "country": "<ISO alpha-2 if inferrable, else null>",
  "rewritten_question": "<clearer, shorter, well-typed version of the question. Preserve original meaning. Max 240 chars.>",
  "confidence": <number 0-1>,
  "off_topic": <boolean>,
  "off_topic_reason": "<string if off_topic=true, else omit>"
}

If asker context is provided, use it to fill country/level/syllabus when the question doesn't specify.

OFF-TOPIC EXAMPLES:
- Romance/dating asks
- "What's your number"
- General chit-chat with no question
- Asks about Karochat features themselves`;

    const userPrompt = `Asker is in country=${input.asker_country}, level=${input.asker_level}, syllabus=${input.asker_syllabus ?? 'unknown'}.

Question:
${merged}

Output JSON:`;

    const response = await this.fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Anthropic API ${response.status}: ${errBody}`);
    }

    const data = await response.json() as { content: Array<{ type: string; text?: string }> };
    const textBlock = data.content.find(c => c.type === 'text');
    if (!textBlock?.text) throw new Error('Anthropic response had no text block');

    // Strip markdown fences if any slipped through
    const raw = textBlock.text.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
    const parsed = JSON.parse(raw) as Partial<BeaconClassification>;

    return normalize(parsed, input);
  }
}

// ============================================================================
// STUB IMPLEMENTATION (for tests + offline dev)
// ============================================================================

/**
 * Deterministic classifier that uses keyword heuristics. Use for tests + dev
 * without burning Anthropic credits.
 */
export class StubClassifier implements Classifier {
  async classify(input: ClassifierInput): Promise<BeaconClassification> {
    const text = [input.text, input.voice_transcript, input.image_ocr, input.context_note]
      .filter(Boolean).join(' ').toLowerCase();

    // off-topic detection
    if (/your number|whatsapp|instagram|date me|hookup/.test(text)) {
      return normalize({
        subject: 'unknown', topic: null, level: input.asker_level,
        syllabus: input.asker_syllabus, country: input.asker_country,
        rewritten_question: input.text.slice(0, 240),
        confidence: 0.9, off_topic: true,
        off_topic_reason: 'Not a learning question',
      }, input);
    }

    // very rough subject guess
    let subject = 'unknown';
    let topic: string | null = null;
    const subjectMatches: Array<[RegExp, string, string | null]> = [
      [/pythagor|triangle|trigonometry|sine|cosine|tangent/, 'mathematics', 'trigonometry'],
      [/integral|integration|derivative|differentiation|limit|calculus/, 'mathematics', 'calculus'],
      [/algebra|equation|polynomial/, 'mathematics', 'algebra'],
      [/newton|force|momentum|kinematic|mechanic|gravity/, 'physics', 'mechanics'],
      [/quantum|wave function|schrodinger|heisenberg/, 'physics', 'quantum-mechanics'],
      [/electric|magnet|circuit|ohm|kirchhoff/, 'physics', 'electromagnetism'],
      [/photosynth|cell|mitochond|dna|rna|enzyme/, 'biology', 'cell-biology'],
      [/evolution|natural selection|darwin/, 'biology', 'evolution'],
      [/organic|alkene|alkane|benzene|carbonyl/, 'chemistry', 'organic-chemistry'],
      [/periodic|oxidation|reduction|acid|base/, 'chemistry', 'general-chemistry'],
      [/algorithm|big-?o|sorting|graph|tree|dynamic programming|recursion/, 'computer-science', 'algorithms'],
      [/python|javascript|react|sql|database/, 'computer-science', 'programming'],
      [/world war|colonial|industrial revolution|cold war|treaty/, 'history', null],
      [/supply|demand|gdp|inflation|fiscal|monetary/, 'economics', null],
      [/macbeth|shakespeare|hamlet|romeo|essay/, 'english-literature', null],
    ];
    for (const [pattern, s, t] of subjectMatches) {
      if (pattern.test(text)) { subject = s; topic = t; break; }
    }

    return normalize({
      subject, topic,
      level: input.asker_level,
      syllabus: input.asker_syllabus,
      country: input.asker_country,
      rewritten_question: input.text.slice(0, 240),
      confidence: subject === 'unknown' ? 0.3 : 0.7,
      off_topic: false,
    }, input);
  }
}

// ============================================================================
// NORMALIZATION
// ============================================================================

/**
 * Fills in defaults from asker context, validates enum values, clamps fields.
 * Ensures every BeaconClassification leaving the classifier is well-formed.
 */
function normalize(
  raw: Partial<BeaconClassification>,
  input: ClassifierInput,
): BeaconClassification {
  const validLevels: EducationLevel[] = [
    'class-9-10', 'class-11-12', 'undergrad-yr1', 'undergrad-yr2',
    'undergrad-yr3', 'undergrad-yr4', 'masters', 'phd',
    'exam-prep', 'professional-cert', 'unknown',
  ];
  const level: EducationLevel = validLevels.includes(raw.level as EducationLevel)
    ? raw.level as EducationLevel
    : input.asker_level;

  return {
    subject: (raw.subject ?? 'unknown').toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    topic: raw.topic ? raw.topic.toLowerCase().replace(/[^a-z0-9-]/g, '-') : null,
    level,
    syllabus: raw.syllabus ?? input.asker_syllabus ?? null,
    country: raw.country ?? input.asker_country ?? null,
    rewritten_question: (raw.rewritten_question ?? input.text).slice(0, 240),
    confidence: Math.max(0, Math.min(1, raw.confidence ?? 0.5)),
    off_topic: !!raw.off_topic,
    off_topic_reason: raw.off_topic_reason,
  };
}
