/**
 * Question Quality Scoring Utility
 *
 * Analyzes tarot questions and provides quality feedback to help users
 * craft more effective, open-ended questions.
 */

const YES_NO_PATTERNS = [
  /\b(will|should|is|are|am|can|does|do)\s+.*\?$/i,
  /\b(yes|no)\b.*\?$/i
];

const VAGUE_WORDS = [
  'thing', 'stuff', 'something', 'someone', 'anything', 'everything',
  'things', 'issue', 'issues', 'situation', 'problem'
];

const REFLECTIVE_VERBS = [
  'how', 'what', 'where', 'when', 'which', 'who',
  'understand', 'explore', 'navigate', 'support', 'learn',
  'transform', 'honor', 'cultivate', 'embrace', 'integrate'
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
      score: 0,
      feedback: []
    };
  }

  const trimmed = question.trim();
  const wordCount = trimmed.split(/\s+/).length;

  // Check if question is open-ended (not yes/no)
  const isYesNo = YES_NO_PATTERNS.some(pattern => pattern.test(trimmed));
  const openEnded = !isYesNo && trimmed.endsWith('?');

  // Check specificity (not too vague, sufficient length)
  const hasVagueWords = VAGUE_WORDS.some(word =>
    new RegExp(`\\b${word}\\b`, 'i').test(trimmed)
  );
  const specific = !hasVagueWords && wordCount >= 5 && wordCount <= 30;

  // Check if actionable (uses reflective verbs)
  const actionable = REFLECTIVE_VERBS.some(verb =>
    new RegExp(`\\b${verb}\\b`, 'i').test(trimmed)
  );

  // Check length (not too short or too long)
  const length = trimmed.length >= 20 && trimmed.length <= 150;

  // Calculate overall score (0-100)
  const weights = {
    openEnded: 35,
    specific: 25,
    actionable: 25,
    length: 15
  };

  const score = Math.round(
    (openEnded ? weights.openEnded : 0) +
    (specific ? weights.specific : 0) +
    (actionable ? weights.actionable : 0) +
    (length ? weights.length : 0)
  );

  // Generate feedback
  const feedback = [];
  if (!openEnded) {
    feedback.push('Try "How" or "What" instead of yes/no questions');
  }
  if (!specific && hasVagueWords) {
    feedback.push('Be more specific - what exactly are you exploring?');
  }
  if (!actionable) {
    feedback.push('Frame as an exploration: "How can I..." or "What do I need..."');
  }
  if (!length && trimmed.length < 20) {
    feedback.push('Add more detail to your question');
  }
  if (!length && trimmed.length > 150) {
    feedback.push('Try to make your question more concise');
  }

  return {
    openEnded,
    specific,
    actionable,
    length,
    score,
    feedback,
    wordCount
  };
}

/**
 * Get a quality level label based on score
 * @param {number} score - Quality score (0-100)
 * @returns {Object} Level info
 */
export function getQualityLevel(score) {
  if (score >= 85) {
    return {
      label: 'Excellent',
      color: 'emerald',
      emoji: '✨'
    };
  }
  if (score >= 65) {
    return {
      label: 'Good',
      color: 'green',
      emoji: '👍'
    };
  }
  if (score >= 40) {
    return {
      label: 'Fair',
      color: 'amber',
      emoji: '💡'
    };
  }
  return {
    label: 'Needs work',
    color: 'orange',
    emoji: '🔧'
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
