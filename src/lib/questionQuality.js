/**
 * Question Quality Scoring Utility
 *
 * Analyzes tarot questions and provides quality feedback to help users
 * craft more effective, open-ended questions.
 */

const YES_NO_PATTERNS = [
  /^(will|should|is|are|am|can|does|do)\b.*\?$/i,
  // The phrase itself, so "What does no mean to me?" stays open.
  /\byes\s+or\s+no\b/i
];

// A closed question opens with an auxiliary verb ("Will…", "Should I…"). Many
// people skip the question mark on a phone, so the opener is enough. The
// lookahead keeps contractions ("Can't") and longer words ("Island") out.
const CLOSED_OPENER = /^(?:will|would|should|shall|is|are|am|was|were|can|could|does|do|did|has|have|had)(?![\w'’])/i;

// "How can I…" is an open question even without its question mark.
const OPEN_OPENER = /^(?:how|what|where|why|which|who|when)(?![\w'’])/i;

// Question marks across scripts: ASCII, full-width (CJK), Arabic, Greek,
// Armenian and the reversed mark used in some right-to-left text.
const QUESTION_MARK_END = /[?\uFF1F\u061F\u037E\u055E\u2E2E]\s*$/;

// Wording that asks the cards for a guarantee. Narrower than the scoring
// patterns below, because it drives a visible message.
const FIXED_OUTCOME_PATTERN = /\b(guaranteed|destined|fated|inevitable|for\s+sure|meant\s+to\s+be)\b/i;

const DETERMINISTIC_PATTERNS = [
  /\b(guaranteed|certain|destined|fated|inevitable|for\s+sure)\b/i,
  // "Will we always…", not "How can I stop always…".
  /^(will|would|is|are|am|can|could|does|do|did|should|shall)\b.*\b(always|never|forever)\b/i,
  /\b(will|does)\s+(he|she|they|my|the)\s+(love|come back|return|stay|leave)\b/i
];

const VAGUE_WORDS = [
  'thing', 'stuff', 'something', 'someone', 'anything', 'everything',
  'things', 'issue', 'issues', 'situation', 'problem'
];

const CONCRETE_SUBJECTS = [
  'job', 'career', 'project', 'relationship', 'partner', 'friend', 'family',
  'health', 'home', 'study', 'business', 'team', 'work', 'money', 'finances', 'wellbeing'
];

const TIMEFRAME_WORDS = [
  'today', 'tonight', 'this week', 'this month', 'this year',
  'next week', 'next month', 'next year', 'soon', 'immediately',
  'short-term', 'long-term', 'over the next', 'coming weeks', 'coming months',
  'right now', 'current moment', 'this moment'
];

const REFLECTIVE_VERBS = [
  'how', 'what', 'where', 'when', 'which', 'who',
  'understand', 'explore', 'navigate', 'support', 'learn',
  'transform', 'honor', 'cultivate', 'embrace', 'integrate'
];

const AGENCY_VERBS = [
  'choose', 'shape', 'build', 'create', 'align', 'decide', 'strengthen',
  'clarify', 'balance', 'plan', 'adapt', 'respond', 'participate', 'work with'
];

/**
 * Score a question's quality across multiple dimensions
 * @param {string} question - The question to analyze
 * @returns {Object} Quality metrics and overall score
 */
export function scoreQuestion(question) {
  if (!question || typeof question !== 'string') {
    return {
      openEnded: false,
      specific: false,
      actionable: false,
      length: false,
      concreteSubject: false,
      timeframe: false,
      deterministicLanguage: false,
      score: 0,
      feedback: []
    };
  }

  const trimmed = question.trim();
  const wordCount = trimmed.split(/\s+/).length;

  // Check if question is open-ended (not yes/no)
  const isYesNo = CLOSED_OPENER.test(trimmed) || YES_NO_PATTERNS.some(pattern => pattern.test(trimmed));
  const deterministicLanguage = DETERMINISTIC_PATTERNS.some(pattern => pattern.test(trimmed));
  const openEnded = !isYesNo && (QUESTION_MARK_END.test(trimmed) || OPEN_OPENER.test(trimmed));

  // Check specificity (not too vague, sufficient length)
  const hasVagueWords = VAGUE_WORDS.some(word =>
    new RegExp(`\\b${word}\\b`, 'i').test(trimmed)
  );
  const hasConcreteSubject = CONCRETE_SUBJECTS.some(word =>
    new RegExp(`\\b${word}\\b`, 'i').test(trimmed)
  );
  const specific = !hasVagueWords && wordCount >= 5 && wordCount <= 40;

  // Check if actionable (uses reflective verbs)
  const actionable = REFLECTIVE_VERBS.concat(AGENCY_VERBS).some(verb =>
    new RegExp(`\\b${verb}\\b`, 'i').test(trimmed)
  );

  // Check timeframe context
  const timeframe = TIMEFRAME_WORDS.some(word => trimmed.toLowerCase().includes(word));

  // Check length (not too short or too long) using words for softer grading
  const lengthIdeal = wordCount >= 8 && wordCount <= 30;
  const lengthAcceptable = wordCount >= 6 && wordCount <= 40;
  const length = lengthAcceptable;

  // Calculate overall score (0-100)
  const weights = {
    openEnded: 35,
    specific: 25,
    actionable: 25,
    length: 10,
    contextBonus: 5
  };

  const specificityScore = specific
    ? (hasConcreteSubject ? weights.specific : Math.round(weights.specific * 0.7))
    : (hasConcreteSubject ? Math.round(weights.specific * 0.4) : 0);

  const actionableScore = actionable
    ? weights.actionable
    : Math.round(weights.actionable * 0.35);

  const lengthScore = lengthIdeal
    ? weights.length
    : (lengthAcceptable ? Math.round(weights.length * 0.6) : 0);

  const contextBonus = timeframe ? weights.contextBonus : 0;

  const penalty = deterministicLanguage ? 10 : 0;

  const score = Math.max(0, Math.min(100, Math.round(
    (openEnded ? weights.openEnded : Math.round(weights.openEnded * 0.2)) +
    specificityScore +
    actionableScore +
    lengthScore +
    contextBonus -
    penalty
  )));

  // Generate feedback
  const feedback = [];
  if (!openEnded) {
    feedback.push(isYesNo
      ? 'Try "How" or "What" instead of yes/no questions'
      : 'Try phrasing it as a question that starts with "How" or "What"');
  }
  if (deterministicLanguage) {
    feedback.push('Avoid fate/guarantee wording and focus on guidance you can act on');
  }
  if (!specific && hasVagueWords) {
    feedback.push('Be more specific - what exactly are you exploring?');
  }
  if (specific && !hasConcreteSubject) {
    feedback.push('Name the person, role, or situation to ground the question');
  }
  if (!actionable) {
    feedback.push('Include agency-forward verbs like navigate, align, or cultivate');
  }
  if (!length && wordCount < 6) {
    feedback.push('Add more detail to your question');
  }
  if (!length && wordCount > 40) {
    feedback.push('Try to make your question more concise');
  }
  if (!timeframe) {
    feedback.push('Add a gentle timeframe to focus the reading (e.g., “this month”)');
  }

  return {
    openEnded,
    specific,
    actionable,
    length,
    concreteSubject: hasConcreteSubject,
    timeframe,
    deterministicLanguage,
    score,
    feedback,
    wordCount
  };
}

/**
 * The scoring word lists are English, so grades and word counts only make
 * sense for text written mostly in Latin letters. Arabic, Hebrew, Chinese,
 * Japanese or Korean questions would otherwise get English advice and a
 * "1 word" count.
 *
 * @param {string} question
 * @returns {boolean}
 */
export function isAssessableQuestion(question) {
  if (typeof question !== 'string') return false;
  const letters = question.match(/\p{L}/gu);
  if (!letters) return false;
  const latin = question.match(/\p{Script=Latin}/gu);
  return Boolean(latin) && latin.length / letters.length >= 0.6;
}

/**
 * Ungraded guidance for phrasing a reading cannot answer well.
 *
 * Waits for three words, since "Will I" is still being written, and ignores
 * the question mark, which many people leave off on a phone.
 *
 * @param {string} question
 * @returns {'closed'|'fixed-outcome'|null}
 */
export function getQuestionNudge(question) {
  if (typeof question !== 'string') return null;
  const trimmed = question.trim();
  if (!trimmed || trimmed.split(/\s+/).length < 3) return null;
  if (CLOSED_OPENER.test(trimmed) || YES_NO_PATTERNS.some(pattern => pattern.test(trimmed))) {
    return 'closed';
  }
  if (FIXED_OUTCOME_PATTERN.test(trimmed)) return 'fixed-outcome';
  return null;
}

/**
 * Get a quality level label based on score
 * @param {number} score - Quality score (0-100)
 * @returns {Object} Level info
 */
export function getQualityLevel(score) {
  if (score >= 85) {
    return {
      id: 'excellent',
      label: 'Excellent',
      color: 'emerald'
    };
  }
  if (score >= 65) {
    return {
      id: 'good',
      label: 'Good',
      color: 'green'
    };
  }
  if (score >= 40) {
    return {
      id: 'fair',
      label: 'Fair',
      color: 'amber'
    };
  }
  return {
    id: 'needs-clarity',
    label: 'Needs clarity',
    color: 'orange'
  };
}

/**
 * Get example of an improved version of the question
 * @param {string} question - Original question
 * @param {Object} quality - Quality metrics from scoreQuestion()
 * @returns {string|null} Suggested improvement or null
 */
export function suggestImprovement(question, quality) {
  if (!quality || quality.score >= 85) return null;

  const trimmed = question.trim().replace(/\?$/, '');

  // If yes/no, convert to open-ended
  if (!quality.openEnded) {
    if (/^(will|should|is|are|can)/i.test(trimmed)) {
      return `How can I ${trimmed.replace(/^(will|should|is|are|can)\s+/i, '')}?`;
    }
  }

  // If too vague, suggest adding detail
  if (!quality.specific) {
    return 'Try adding specific details about the situation or timeframe';
  }

  return null;
}
