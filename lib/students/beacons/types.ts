/**
 * Karochat Help Beacon Router — Core Types
 * -----------------------------------------
 * Shared types for the 4-phase Karo-routed beacon system.
 *
 * Drop path: src/students-network/beacons/types.ts
 */

// ============================================================================
// CLASSIFICATION
// ============================================================================

/** Karo's structured interpretation of a raw beacon question. */
export interface BeaconClassification {
  /** Canonical subject slug. e.g. 'physics', 'organic-chemistry', 'calculus' */
  subject: string;
  /** Specific topic if Karo can extract it. e.g. 'newtons-laws', 'integration-by-parts' */
  topic: string | null;
  /** Education level — must be normalized. */
  level: EducationLevel;
  /** Detected syllabus if Karo can infer it. */
  syllabus: string | null;
  /** Country (ISO alpha-2) if inferrable; else null. */
  country: string | null;
  /** Karo's cleaned version of the question (clearer than user's original). */
  rewritten_question: string;
  /** Confidence in classification, 0-1. Below 0.5 → ask user to refine. */
  confidence: number;
  /** True if Karo couldn't extract a coherent learning question. */
  off_topic: boolean;
  /** If off_topic, why. */
  off_topic_reason?: string;
}

export type EducationLevel =
  | 'class-9-10'
  | 'class-11-12'
  | 'undergrad-yr1'
  | 'undergrad-yr2'
  | 'undergrad-yr3'
  | 'undergrad-yr4'
  | 'masters'
  | 'phd'
  | 'exam-prep'
  | 'professional-cert'
  | 'unknown';

// ============================================================================
// BEACON
// ============================================================================

export type BeaconUrgency = 'casual' | 'urgent' | 'live';
export type BeaconStatus = 'routing' | 'answered' | 'expired' | 'cancelled';

export interface Beacon {
  id: string;
  asker_profile_id: string;
  raw_question_text: string;
  raw_question_voice_url: string | null;
  raw_question_image_url: string | null;
  context_note: string | null;
  urgency: BeaconUrgency;
  classification: BeaconClassification;
  status: BeaconStatus;
  routing_phase: 1 | 2 | 3 | 4;
  answered_by_profile_id: string | null;
  session_id: string | null;
  created_at: Date;
  answered_at: Date | null;
  expired_at: Date | null;
}

// ============================================================================
// HELPER (candidate)
// ============================================================================

export type BadgeTier =
  | 'student'           // 🟢 basic verified
  | 'senior_student'    // 🔵 yr3+ undergrad, masters, phd
  | 'educator'          // 🟣 school teacher / coaching instructor / TA
  | 'professor'         // 🟡 university faculty
  | 'domain_expert';    // 🔴 verified pro with subject expertise

/** A verified user who may receive beacons. */
export interface Helper {
  profile_id: string;
  badge_tier: BadgeTier;
  country: string;                    // ISO alpha-2
  current_education_level: EducationLevel;
  syllabus: string | null;
  /** Subjects the helper has self-attested expertise in. */
  subject_affinities: string[];
  /** Online presence. */
  is_online: boolean;
  /** Beacons currently visible in their sidebar — capped at 5 in router logic. */
  active_beacon_count: number;
  /** Helper-set Do-Not-Disturb until timestamp. */
  dnd_until: Date | null;
  /** Pause beacon visibility globally. */
  beacons_paused: boolean;
  /** Aggregate rating from previous sessions (asker ratings of this helper). */
  avg_rating: number | null;
  /** Number of beacon sessions accepted historically. */
  sessions_completed: number;
  /** Ghost count in trailing 7 days (accepted but never joined). */
  ghosts_last_7d: number;
  /** Subject → number of past 4+ star sessions in that subject. */
  past_helpful_sessions_by_subject: Record<string, number>;
}

// ============================================================================
// ROUTING DECISION
// ============================================================================

export interface ScoredHelper {
  helper: Helper;
  score: number;          // 0-100
  reasons: string[];      // human-readable scoring trace, for debugging
  phase: 1 | 2 | 3 | 4;   // earliest phase this helper qualifies for
}

export interface RoutingPhaseResult {
  phase: 1 | 2 | 3 | 4;
  helpers_targeted: ScoredHelper[];
  duration_ms: number;
}

export type BeaconOutcome =
  | { kind: 'answered'; helper_profile_id: string; phase: 1 | 2 | 3 | 4; total_duration_ms: number }
  | { kind: 'expired'; total_duration_ms: number; phases_completed: number }
  | { kind: 'cancelled'; total_duration_ms: number };

// ============================================================================
// EVENTS (emitted via Supabase realtime or other transport)
// ============================================================================

export type BeaconEvent =
  | { type: 'classification_started'; beacon_id: string; at: Date }
  | { type: 'classification_completed'; beacon_id: string; classification: BeaconClassification; at: Date }
  | { type: 'classification_rejected'; beacon_id: string; reason: string; at: Date }
  | { type: 'phase_started'; beacon_id: string; phase: 1 | 2 | 3 | 4; helpers_count: number; at: Date }
  | { type: 'helper_notified'; beacon_id: string; helper_profile_id: string; phase: 1 | 2 | 3 | 4; at: Date }
  | { type: 'helper_accepted'; beacon_id: string; helper_profile_id: string; phase: 1 | 2 | 3 | 4; at: Date }
  | { type: 'helper_passed'; beacon_id: string; helper_profile_id: string; at: Date }
  | { type: 'beacon_answered'; beacon_id: string; helper_profile_id: string; session_id: string; at: Date }
  | { type: 'beacon_expired'; beacon_id: string; at: Date }
  | { type: 'karo_fallback_offered'; beacon_id: string; at: Date };

// ============================================================================
// CONFIG (tunable)
// ============================================================================

export interface BeaconRouterConfig {
  phase_1_duration_ms: number;   // default 30_000 — Tier 1: profs + domain experts + educators
  phase_2_duration_ms: number;   // default 30_000 — adds senior students with prior subject success
  phase_3_duration_ms: number;   // default 60_000 — opens to all verified students same-level+
  phase_4_duration_ms: number;   // default 3_540_000 (59 min) — open to all online verified students globally
  karo_fallback_after_ms: number; // default 3_600_000 (1 h) — Karo offers itself as fallback
  max_helpers_per_phase: number;  // default 20 — cap on simultaneous notifications per phase
  max_active_beacons_per_helper: number; // default 5
  syllabus_cognates: Record<string, string[]>; // syllabus → list of close cognate syllabuses
}

export const DEFAULT_CONFIG: BeaconRouterConfig = {
  phase_1_duration_ms: 30_000,
  phase_2_duration_ms: 30_000,
  phase_3_duration_ms: 60_000,
  phase_4_duration_ms: 3_540_000,
  karo_fallback_after_ms: 3_600_000,
  max_helpers_per_phase: 20,
  max_active_beacons_per_helper: 5,
  syllabus_cognates: {
    // India boards heavily overlap
    'CBSE': ['ICSE', 'TN-State-Board', 'MH-State-Board', 'KA-PUC', 'KL-Board'],
    'ICSE': ['CBSE'],
    // International cognates
    'A-Level-AQA': ['A-Level-OCR', 'A-Level-Edexcel', 'AP', 'IB-HL', 'Abitur', 'CBSE'],
    'A-Level-OCR': ['A-Level-AQA', 'A-Level-Edexcel', 'AP', 'IB-HL'],
    'A-Level-Edexcel': ['A-Level-AQA', 'A-Level-OCR', 'AP', 'IB-HL'],
    'AP': ['A-Level-AQA', 'A-Level-OCR', 'A-Level-Edexcel', 'IB-HL', 'CBSE'],
    'IB-HL': ['AP', 'A-Level-AQA', 'A-Level-OCR', 'A-Level-Edexcel', 'CBSE'],
    'IB-SL': ['AP', 'CBSE'],
    'Abitur': ['A-Level-AQA', 'IB-HL'],
    // Exam prep
    'JEE-Main': ['JEE-Advanced', 'CBSE', 'ICSE'],
    'JEE-Advanced': ['JEE-Main', 'CBSE'],
    'NEET': ['CBSE', 'ICSE'],
    'USMLE-Step-1': ['MBBS-IN', 'PLAB', 'MCAT'],
    'CFA-L1': ['CFA-L2', 'CFA-L3', 'FRM-P1'],
    'CFA-L2': ['CFA-L1', 'CFA-L3', 'FRM-P2'],
  },
};
