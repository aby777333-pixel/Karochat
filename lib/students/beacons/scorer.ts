/**
 * Helper Scorer
 * -------------
 * Pure functions that take a beacon's classification + a candidate helper
 * and return:
 *   (a) whether the helper qualifies for any phase, and
 *   (b) a score 0-100 used to rank within a phase.
 *
 * No I/O. Easy to unit-test.
 *
 * Drop path: src/students-network/beacons/scorer.ts
 */

import {
  BeaconClassification, BeaconRouterConfig, EducationLevel,
  Helper, ScoredHelper,
} from './types';

// ============================================================================
// LEVEL ORDERING (higher = more advanced)
// ============================================================================

const LEVEL_ORDER: Record<EducationLevel, number> = {
  'class-9-10':       1,
  'class-11-12':      2,
  'exam-prep':        2.5,  // sits between school + undergrad
  'undergrad-yr1':    3,
  'undergrad-yr2':    4,
  'undergrad-yr3':    5,
  'undergrad-yr4':    6,
  'masters':          7,
  'phd':              8,
  'professional-cert': 6,   // varies; treat as roughly undergrad-final
  'unknown':          0,
};

// ============================================================================
// PHASE QUALIFICATION
// ============================================================================

/**
 * The earliest phase this helper qualifies for given the beacon.
 * Returns null if the helper cannot receive this beacon at all.
 *
 * Phase 1 (0-30s):  professors + domain experts + educators in same subject + matching syllabus/cognate
 * Phase 2 (30-60s): + senior students with 4+ star history in subject
 * Phase 3 (1-2min): + all verified students at same-or-higher level in same subject
 * Phase 4 (2min+):  + all online verified students globally in the subject area
 */
export function qualifyHelperForPhase(
  helper: Helper,
  classification: BeaconClassification,
  config: BeaconRouterConfig,
): 1 | 2 | 3 | 4 | null {
  // Gate 0: helper must be online, not paused, not DND, under active beacon cap
  if (!helper.is_online) return null;
  if (helper.beacons_paused) return null;
  if (helper.dnd_until && helper.dnd_until > new Date()) return null;
  if (helper.active_beacon_count >= config.max_active_beacons_per_helper) return null;

  // Gate 0.5: ghost penalty. 3+ ghosts in 7d = 24h cooldown (caller is expected
  // to filter these out before calling us, but defense-in-depth)
  if (helper.ghosts_last_7d >= 3) return null;

  // Subject match required across all phases. If unknown, only domain_expert/professor pass.
  const subjectMatches = helper.subject_affinities.includes(classification.subject);
  const isExpertOrProf = helper.badge_tier === 'professor' || helper.badge_tier === 'domain_expert';

  if (!subjectMatches && !isExpertOrProf) return null;

  const helperLevel = LEVEL_ORDER[helper.current_education_level];
  const askerLevel = LEVEL_ORDER[classification.level];

  // Helper must be at same-or-higher level for peer phases.
  // Professors/experts are exempt from the level-gate (they always qualify subject-wise).
  const meetsLevel = isExpertOrProf || helperLevel >= askerLevel;
  if (!meetsLevel) return null;

  // Syllabus match check (used in earlier phases for closer routing)
  const syllabusMatches = matchesSyllabus(helper.syllabus, classification.syllabus, config);

  // ----------------------------------------------------------------
  // Phase 1: Tier 1 helpers — profs + domain experts + educators
  // ----------------------------------------------------------------
  if (helper.badge_tier === 'professor' || helper.badge_tier === 'domain_expert') {
    return 1;  // syllabus is bonus, not required, for top-tier
  }
  if (helper.badge_tier === 'educator' && subjectMatches) {
    // Educators get phase 1 only if syllabus matches AND country matches
    if (syllabusMatches && helper.country === classification.country) return 1;
    return 2;
  }

  // ----------------------------------------------------------------
  // Phase 2: senior_student with 4+ star history in this subject
  // ----------------------------------------------------------------
  if (helper.badge_tier === 'senior_student') {
    const priorWins = helper.past_helpful_sessions_by_subject[classification.subject] ?? 0;
    if (priorWins >= 1) return 2;  // any prior 4+ star session in subject promotes to phase 2
    return 3;
  }

  // ----------------------------------------------------------------
  // Phase 3: any verified student at same-or-higher level + subject
  // ----------------------------------------------------------------
  if (helper.badge_tier === 'student' && subjectMatches) {
    return 3;
  }

  // ----------------------------------------------------------------
  // Phase 4: anyone verified, online, in subject area
  // ----------------------------------------------------------------
  if (subjectMatches) return 4;
  return null;
}

// ============================================================================
// SCORING (within phase)
// ============================================================================

/**
 * Score 0-100 for ranking helpers within a phase.
 * Higher score = better match. Top N helpers (per config.max_helpers_per_phase)
 * are notified in each phase.
 *
 * Composition:
 *   30 pts — badge tier
 *   20 pts — syllabus match (exact > cognate > none)
 *   15 pts — country match
 *   15 pts — past helpful sessions in this subject
 *   10 pts — historical rating (avg_rating)
 *    5 pts — currently low-load (active_beacon_count = 0)
 *    5 pts — sessions completed (experience)
 */
export function scoreHelper(
  helper: Helper,
  classification: BeaconClassification,
  config: BeaconRouterConfig,
): ScoredHelper | null {
  const phase = qualifyHelperForPhase(helper, classification, config);
  if (phase === null) return null;

  let score = 0;
  const reasons: string[] = [];

  // Badge tier
  const tierPoints: Record<string, number> = {
    'professor': 30,
    'domain_expert': 30,
    'educator': 25,
    'senior_student': 18,
    'student': 10,
  };
  const tp = tierPoints[helper.badge_tier] ?? 0;
  score += tp;
  reasons.push(`tier:${helper.badge_tier}=+${tp}`);

  // Syllabus
  if (helper.syllabus && classification.syllabus) {
    if (helper.syllabus === classification.syllabus) {
      score += 20; reasons.push(`syllabus-exact=+20`);
    } else if (isCognate(helper.syllabus, classification.syllabus, config)) {
      score += 12; reasons.push(`syllabus-cognate=+12`);
    }
  }

  // Country
  if (helper.country === classification.country) {
    score += 15; reasons.push(`country=+15`);
  }

  // Subject history
  const subjectWins = helper.past_helpful_sessions_by_subject[classification.subject] ?? 0;
  const subjectPts = Math.min(15, subjectWins * 3);
  score += subjectPts;
  if (subjectPts) reasons.push(`prior-${classification.subject}-wins:${subjectWins}=+${subjectPts}`);

  // Rating
  if (helper.avg_rating != null) {
    // map 1-5 stars → 0-10 pts (4.0=+5, 5.0=+10, 3.0=0, <3=-5 penalty)
    const ratingPts = Math.round((helper.avg_rating - 3) * 5);
    score += ratingPts;
    if (ratingPts) reasons.push(`rating:${helper.avg_rating.toFixed(1)}=${ratingPts >= 0 ? '+' : ''}${ratingPts}`);
  }

  // Low load bonus
  if (helper.active_beacon_count === 0) {
    score += 5; reasons.push(`idle=+5`);
  }

  // Experience
  const expPts = Math.min(5, Math.floor(helper.sessions_completed / 20));
  score += expPts;
  if (expPts) reasons.push(`exp:${helper.sessions_completed}=+${expPts}`);

  // Clamp 0-100
  score = Math.max(0, Math.min(100, score));

  return { helper, score, reasons, phase };
}

// ============================================================================
// HELPERS
// ============================================================================

function matchesSyllabus(
  helperSyllabus: string | null,
  beaconSyllabus: string | null,
  config: BeaconRouterConfig,
): boolean {
  if (!helperSyllabus || !beaconSyllabus) return false;
  if (helperSyllabus === beaconSyllabus) return true;
  return isCognate(helperSyllabus, beaconSyllabus, config);
}

function isCognate(a: string, b: string, config: BeaconRouterConfig): boolean {
  return (config.syllabus_cognates[a]?.includes(b) ?? false)
    || (config.syllabus_cognates[b]?.includes(a) ?? false);
}

/**
 * Given a pool of candidates, rank them by score and return the top N
 * who qualify for `phase` or earlier.
 *
 * Helpers qualifying for an earlier phase are excluded from later phases
 * (they were already notified in their earliest phase).
 */
export function rankHelpersForPhase(
  candidates: Helper[],
  classification: BeaconClassification,
  phase: 1 | 2 | 3 | 4,
  alreadyNotified: Set<string>,
  config: BeaconRouterConfig,
): ScoredHelper[] {
  const scored = candidates
    .filter(h => !alreadyNotified.has(h.profile_id))
    .map(h => scoreHelper(h, classification, config))
    .filter((s): s is ScoredHelper => s !== null && s.phase === phase);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, config.max_helpers_per_phase);
}
