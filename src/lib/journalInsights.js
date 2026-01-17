import { computeJournalStats, REVERSED_PATTERN } from '../../shared/journal/stats.js';
import { getTimestamp } from '../../shared/journal/utils.js';
import { buildThemeQuestion, normalizeThemeLabel } from './themeText.js';
import { safeStorage } from './safeStorage.js';
import { MAJOR_ARCANA } from '../data/majorArcana.js';

export { computeJournalStats, REVERSED_PATTERN };

const JOURNAL_INSIGHTS_STORAGE_KEY_PREFIX = 'tarot_journal_insights';
const SHARE_TOKEN_STORAGE_KEY = 'tarot_journal_share_tokens';
const COACH_RECOMMENDATION_KEY_PREFIX = 'tarot_coach_recommendation';
const COACH_STATS_SNAPSHOT_KEY_PREFIX = 'tarot_coach_stats_snapshot';
const COACH_RECOMMENDATION_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get user-scoped storage key to prevent data leakage across accounts
 * @param {string} prefix - Key prefix
 * @param {string|null} userId - User ID or null for anonymous
 * @returns {string} Scoped storage key
 */
function getScopedKey(prefix, userId) {
  if (!userId) return `${prefix}_anon`;
  return `${prefix}_${userId}`;
}

// Legacy key for backwards compatibility (will be migrated on first access)
const LEGACY_JOURNAL_INSIGHTS_KEY = 'tarot_journal_insights';

function normalizeCoachRecommendation(recommendation) {
  if (!recommendation || typeof recommendation !== 'object') return recommendation;

  const normalized = { ...recommendation };

  if (typeof normalized.customFocus === 'string') {
    const cleanedFocus = normalizeThemeLabel(normalized.customFocus) || normalized.customFocus.trim();
    normalized.customFocus = cleanedFocus || normalized.customFocus;
  }

  if (typeof normalized.question === 'string') {
    const themeMatch = normalized.question.match(/^How can I explore (?:the theme of )?(.+?) more deeply\??$/i);
    if (themeMatch) {
      const cleanedTheme = normalizeThemeLabel(themeMatch[1]) || themeMatch[1].trim();
      normalized.question = buildThemeQuestion(cleanedTheme);
      if (!normalized.customFocus) {
        normalized.customFocus = cleanedTheme;
      }
      if (cleanedTheme && typeof normalized.source === 'string' && normalized.source.startsWith('theme:')) {
        normalized.source = `theme:${cleanedTheme}`;
      }
    }
  }

  return normalized;
}

export function buildCardInsightPayload(card) {
  if (!card?.name) return null;
  return {
    name: card.name,
    isReversed: REVERSED_PATTERN.test(card?.orientation),
    image: card.image || null
  };
}

/**
 * Persist journal insights to user-scoped localStorage
 * @param {Array} entries - Journal entries
 * @param {string|null} userId - User ID for scoping (null for anonymous)
 * @returns {{ payload: Object|null, error: Error|null }}
 */
export function persistJournalInsights(entries, userId = null) {
  if (!safeStorage.isAvailable) {
    return { payload: null, error: new Error('localStorage not available') };
  }
  const storageKey = getScopedKey(JOURNAL_INSIGHTS_STORAGE_KEY_PREFIX, userId);
  const stats = computeJournalStats(entries);
  if (!stats) {
    safeStorage.removeItem(storageKey);
    return { payload: null, error: null };
  }
  const payload = {
    stats,
    userId: userId || null,
    updatedAt: Date.now()
  };
  try {
    safeStorage.setItem(storageKey, JSON.stringify(payload));
    return { payload, error: null };
  } catch (error) {
    console.warn('Unable to persist journal insights:', error);
    return { payload: null, error };
  }
}

/**
 * Clear journal insights cache for a specific user
 * @param {string|null} userId - User ID to clear (null for anonymous)
 */
export function clearJournalInsightsCache(userId = null) {
  if (!safeStorage.isAvailable) return;
  try {
    const storageKey = getScopedKey(JOURNAL_INSIGHTS_STORAGE_KEY_PREFIX, userId);
    safeStorage.removeItem(storageKey);
    // Clear legacy unscoped cache key (safety: avoid cross-account leakage).
    safeStorage.removeItem(LEGACY_JOURNAL_INSIGHTS_KEY);
    // Also clear coach recommendation for this user
    const coachKey = getScopedKey(COACH_RECOMMENDATION_KEY_PREFIX, userId);
    safeStorage.removeItem(coachKey);
    const statsKey = getScopedKey(COACH_STATS_SNAPSHOT_KEY_PREFIX, userId);
    safeStorage.removeItem(statsKey);
  } catch (error) {
    console.warn('Unable to clear journal insights cache:', error);
  }
}

/**
 * Load stored journal insights for a user
 * @param {string|null} userId - User ID for scoping (null for anonymous)
 * @returns {Object|null} Stored insights or null
 */
export function loadStoredJournalInsights(userId = null) {
  if (!safeStorage.isAvailable) return null;
  try {
    const storageKey = getScopedKey(JOURNAL_INSIGHTS_STORAGE_KEY_PREFIX, userId);
    let raw = safeStorage.getItem(storageKey);

    // Legacy migration: only migrate unscoped data into the anonymous bucket.
    // Never auto-assign legacy data to an authenticated userId, since the legacy
    // cache could have been written by a different account on shared devices.
    if (!raw && !userId) {
      const legacyRaw = safeStorage.getItem(LEGACY_JOURNAL_INSIGHTS_KEY);
      if (legacyRaw) {
        try {
          safeStorage.setItem(storageKey, legacyRaw);
          safeStorage.removeItem(LEGACY_JOURNAL_INSIGHTS_KEY);
          raw = legacyRaw;
        } catch (e) {
          console.warn('Failed to migrate legacy insights:', e);
        }
      }
    }

    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.stats) return null;
    if (userId && parsed.userId !== userId) {
      return null;
    }
    if (!userId && typeof parsed.userId === 'string') {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('Unable to load journal insights cache:', error);
    return null;
  }
}

/**
 * Load coach stats snapshot for a user
 * @param {string|null} userId - User ID for scoping (null for anonymous)
 * @returns {Object|null} Stored stats snapshot or null
 */
export function loadCoachStatsSnapshot(userId = null) {
  if (!safeStorage.isAvailable) return null;
  try {
    const storageKey = getScopedKey(COACH_STATS_SNAPSHOT_KEY_PREFIX, userId);
    const raw = safeStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.stats) return null;
    return parsed;
  } catch (error) {
    console.warn('Unable to load coach stats snapshot:', error);
    return null;
  }
}

/**
 * Persist coach stats snapshot for a user
 * @param {Object} stats - Stats to persist
 * @param {Object} meta - Metadata
 * @param {string|null} userId - User ID for scoping (null for anonymous)
 */
export function persistCoachStatsSnapshot(stats, meta = {}, userId = null) {
  if (!safeStorage.isAvailable) return;
  try {
    const storageKey = getScopedKey(COACH_STATS_SNAPSHOT_KEY_PREFIX, userId);
    if (!stats) {
      safeStorage.removeItem(storageKey);
      return;
    }
    const payload = {
      stats,
      userId: userId || null,
      meta: {
        filtersActive: Boolean(meta.filtersActive),
        filterLabel: meta.filterLabel || null,
        entryCount: typeof meta.entryCount === 'number' ? meta.entryCount : null,
        totalEntries: typeof meta.totalEntries === 'number' ? meta.totalEntries : null
      },
      updatedAt: Date.now()
    };
    safeStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (error) {
    console.warn('Unable to persist coach stats snapshot:', error);
  }
}

export function buildJournalCsv(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const header = [
    'Timestamp',
    'Spread',
    'Spread Key',
    'Question',
    'Cards',
    'Context',
    'Provider',
    'Deck',
    'Session Seed',
    'Reflections',
    'Themes',
    'Narrative'
  ];

  const escapeCsv = (value) => {
    if (value === null || value === undefined) return '""';
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const formatCards = (cards = []) => {
    if (!Array.isArray(cards) || cards.length === 0) return '';
    return cards
      .map(card => {
        const pos = card?.position || '';
        const name = card?.name || card?.card || '';
        const orientation = card?.orientation || '';
        return `${pos}: ${name}${orientation ? ` (${orientation})` : ''}`;
      })
      .join(' | ');
  };

  const rows = entries.map((entry) => {
    const timestamp = entry?.ts ? new Date(entry.ts).toISOString() : '';
    const spread = entry?.spread || entry?.spreadName || '';
    const spreadKey = entry?.spreadKey || '';
    const question = entry?.question || '';
    const cards = formatCards(entry?.cards);
    const context = entry?.context || '';
    const provider = entry?.provider || '';
    const deck = entry?.deckId || entry?.deckStyle || '';
    const sessionSeed = entry?.sessionSeed || '';
    const reflections = entry?.reflections || '';
    const themes = entry?.themes || '';
    const narrative = entry?.personalReading || '';

    return [
      timestamp,
      spread,
      spreadKey,
      question,
      cards,
      context,
      provider,
      deck,
      sessionSeed,
      reflections,
      themes,
      narrative
    ].map(escapeCsv).join(',');
  });
  return `${header.join(',')}
${rows.join('\n')}`;
}

/**
 * Save coach recommendation for a user
 * @param {Object} recommendation - Recommendation to save
 * @param {string|null} userId - User ID for scoping (null for anonymous)
 */
export function saveCoachRecommendation(recommendation, userId = null) {
  if (!safeStorage.isAvailable) return;
  try {
    const storageKey = getScopedKey(COACH_RECOMMENDATION_KEY_PREFIX, userId);
    if (!recommendation) {
      safeStorage.removeItem(storageKey);
      return;
    }
    const normalized = normalizeCoachRecommendation(recommendation);
    const payload = {
      ...normalized,
      userId: userId || null,
      updatedAt: Date.now()
    };
    safeStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (error) {
    console.warn('Unable to save coach recommendation:', error);
  }
}

/**
 * Load coach recommendation for a user
 * @param {string|null} userId - User ID for scoping (null for anonymous)
 * @returns {Object|null} Stored recommendation or null
 */
export function loadCoachRecommendation(userId = null) {
  if (!safeStorage.isAvailable) return null;
  try {
    const storageKey = getScopedKey(COACH_RECOMMENDATION_KEY_PREFIX, userId);
    const raw = safeStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.updatedAt && (Date.now() - parsed.updatedAt) > COACH_RECOMMENDATION_TTL) {
      safeStorage.removeItem(storageKey);
      return null;
    }
    return normalizeCoachRecommendation(parsed);
  } catch (error) {
    console.warn('Unable to load coach recommendation:', error);
    return null;
  }
}

// ============================================================================
// Coach Suggestions from Narrative "Gentle Next Steps"
// ============================================================================

const GENTLE_NEXT_STEPS_HEADING_PATTERN = /^#{2,4}\s*gentle next steps\b.*$/im;
const MARKDOWN_HEADING_PATTERN = /^#{2,4}\s+\S+/m;
const MARKDOWN_LIST_ITEM_PATTERN = /^\s*(?:[-*]|\d+\.)\s+(.+?)\s*$/gm;

const NEXT_STEPS_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'can',
  'for',
  'from',
  'have',
  'if',
  'in',
  'into',
  'is',
  'it',
  'just',
  'like',
  'may',
  'maybe',
  'more',
  'most',
  'not',
  'of',
  'on',
  'or',
  'our',
  'out',
  'so',
  'that',
  'the',
  'their',
  'then',
  'this',
  'to',
  'too',
  'try',
  'up',
  'we',
  'what',
  'when',
  'where',
  'who',
  'why',
  'with',
  'you',
  'your',
]);

const NEXT_STEPS_IMPERATIVE_VERBS = new Set([
  'ask',
  'breathe',
  'build',
  'call',
  'choose',
  'clarify',
  'commit',
  'create',
  'decide',
  'define',
  'draft',
  'focus',
  'forgive',
  'ground',
  'honor',
  'identify',
  'journal',
  'let',
  'limit',
  'listen',
  'make',
  'name',
  'notice',
  'offer',
  'pause',
  'plan',
  'practice',
  'protect',
  'reach',
  'reflect',
  'release',
  'rest',
  'return',
  'schedule',
  'set',
  'simplify',
  'speak',
  'start',
  'take',
  'try',
  'write',
]);

function stripMarkdownInline(text) {
  return String(text || '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/[*_]{1,3}/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function normalizeNextStepsPhrase(text) {
  let phrase = stripMarkdownInline(text)
    .replace(/\s+/g, ' ')
    .replace(/[.:\u2014-]+$/, '')
    .trim();

  phrase = phrase.replace(/^(?:if you can|if possible|if you feel able)\s*[,:\u2014-]?\s*/i, '');
  phrase = phrase.replace(/^(?:try(?: to)?|consider)\s+(.+)$/i, '$1');

  phrase = phrase
    .replace(/\byou are\b/gi, 'I am')
    .replace(/\byou're\b/gi, "I'm")
    .replace(/\byou have\b/gi, 'I have')
    .replace(/\byou've\b/gi, "I've")
    .replace(/\byourself\b/gi, 'myself')
    .replace(/\byours\b/gi, 'mine')
    .replace(/\byour\b/gi, 'my')
    .replace(/\byou\b/gi, 'I')
    .replace(/\s+/g, ' ')
    .trim();

  return phrase;
}

function toGerund(verb) {
  const cleaned = String(verb || '').toLowerCase();
  if (!cleaned) return '';
  if (cleaned.endsWith('ing')) return cleaned;
  if (cleaned.endsWith('ie')) return `${cleaned.slice(0, -2)}ying`;
  if (cleaned.endsWith('e') && !cleaned.endsWith('ee')) return `${cleaned.slice(0, -1)}ing`;
  const consonantVowelConsonant = cleaned.length >= 3
    && !/[aeiou]$/.test(cleaned)
    && /[aeiou][^aeiou]$/.test(cleaned)
    && !/[wxy]$/.test(cleaned);
  if (consonantVowelConsonant) {
    const last = cleaned.slice(-1);
    return `${cleaned}${last}ing`;
  }
  return `${cleaned}ing`;
}

function looksLikeQuestion(text) {
  if (!text) return false;
  const normalized = text.trim();
  if (!normalized.endsWith('?')) return false;
  return /^(what|how|why|when|where|who|which)\b/i.test(normalized);
}

function looksLikeImperative(phrase) {
  const words = phrase.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  const first = words[0].replace(/[^\p{L}\p{N}'-]/gu, '').toLowerCase();
  const second = words[1].replace(/[^\p{L}\p{N}'-]/gu, '').toLowerCase();
  if (!first) return false;

  if (NEXT_STEPS_IMPERATIVE_VERBS.has(first)) return true;

  const determiners = new Set(['a', 'an', 'the', 'my', 'this', 'that', 'these', 'those', 'one', 'two', 'three']);
  return determiners.has(second);
}

function lowerFirst(text) {
  if (!text) return '';
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function extractGentleNextSteps(markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) return [];
  const headingMatch = GENTLE_NEXT_STEPS_HEADING_PATTERN.exec(markdown);
  if (!headingMatch) return [];

  const afterHeading = markdown.slice(headingMatch.index + headingMatch[0].length);
  const nextHeadingMatch = MARKDOWN_HEADING_PATTERN.exec(afterHeading);
  const section = (nextHeadingMatch ? afterHeading.slice(0, nextHeadingMatch.index) : afterHeading).trim();

  const items = [];
  let match;
  while ((match = MARKDOWN_LIST_ITEM_PATTERN.exec(section)) !== null) {
    const item = stripMarkdownInline(match[1]);
    if (item) items.push(item);
  }

  if (items.length > 0) return items;

  const fallbackLine = section.split('\n').map(line => stripMarkdownInline(line)).find(Boolean);
  return fallbackLine ? [fallbackLine] : [];
}

export function buildNextStepsIntentionQuestion(stepText) {
  const phrase = normalizeNextStepsPhrase(stepText);
  if (!phrase) return '';
  if (looksLikeQuestion(phrase)) return phrase;

  const normalized = phrase.replace(/[.!]+$/, '').trim();
  if (!normalized) return '';

  const words = normalized.split(/\s+/).filter(Boolean);
  let topic = normalized;
  if (looksLikeImperative(normalized)) {
    const firstWord = words[0].replace(/[^\p{L}\p{N}'-]/gu, '');
    if (firstWord) {
      const rest = words.slice(1).join(' ');
      topic = `${toGerund(firstWord)}${rest ? ` ${rest}` : ''}`;
    }
  }

  topic = lowerFirst(topic).replace(/[.]+$/, '').trim();
  if (!topic) return '';
  return `What would be a gentle next step for me around ${topic}?`;
}

function tokenizeForScoring(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .map(token => token.replace(/^[-']+|[-']+$/g, ''))
    .filter(token => token.length >= 3 && !NEXT_STEPS_STOPWORDS.has(token));
}

export function computeNextStepsCoachSuggestion(entries, options = {}) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const maxEntries = typeof options.maxEntries === 'number' ? Math.max(1, options.maxEntries) : 3;

  const sortedByRecency = entries
    .map((entry) => ({ entry, ts: getTimestamp(entry) }))
    .filter(({ ts }) => typeof ts === 'number' && !Number.isNaN(ts))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, maxEntries);

  const stepCandidates = [];
  sortedByRecency.forEach(({ entry }, index) => {
    const rawNarrative = entry?.personalReading;
    if (typeof rawNarrative !== 'string' || !rawNarrative.trim()) return;
    const steps = extractGentleNextSteps(rawNarrative);
    if (!steps.length) return;
    const recencyWeight = 1 + ((maxEntries - 1 - index) * 0.15);
    steps.forEach((step) => {
      const cleaned = normalizeNextStepsPhrase(step);
      if (!cleaned) return;
      stepCandidates.push({ step: cleaned, weight: recencyWeight });
    });
  });

  if (stepCandidates.length === 0) return null;

  const tokenWeights = new Map();
  stepCandidates.forEach(({ step, weight }) => {
    tokenizeForScoring(step).forEach((token) => {
      tokenWeights.set(token, (tokenWeights.get(token) || 0) + weight);
    });
  });

  let best = null;
  stepCandidates.forEach((candidate) => {
    const uniqueTokens = Array.from(new Set(tokenizeForScoring(candidate.step)));
    const score = uniqueTokens.reduce((acc, token) => acc + (tokenWeights.get(token) || 0), 0) + candidate.weight;
    if (!best || score > best.score) {
      best = { ...candidate, score };
    }
  });

  const question = buildNextStepsIntentionQuestion(best?.step);
  if (!question) return null;

  return {
    source: 'nextSteps',
    text: question,
    question,
    spread: 'threeCard',
  };
}

function computeExtractedStepsCoachSuggestionFromSorted(sortedByRecency, maxEntries) {
  if (!Array.isArray(sortedByRecency) || sortedByRecency.length === 0) return null;

  const stepCandidates = [];

  sortedByRecency.forEach(({ entry }, index) => {
    const steps = entry?.extractedSteps;
    if (!Array.isArray(steps) || steps.length === 0) return;

    const recencyWeight = 1 + ((maxEntries - 1 - index) * 0.15);
    steps.forEach((step) => {
      const cleaned = normalizeNextStepsPhrase(step);
      if (!cleaned) return;
      stepCandidates.push({ step: cleaned, weight: recencyWeight });
    });
  });

  if (stepCandidates.length === 0) return null;

  const tokenWeights = new Map();
  stepCandidates.forEach(({ step, weight }) => {
    tokenizeForScoring(step).forEach((token) => {
      tokenWeights.set(token, (tokenWeights.get(token) || 0) + weight);
    });
  });

  let best = null;
  stepCandidates.forEach((candidate) => {
    const uniqueTokens = Array.from(new Set(tokenizeForScoring(candidate.step)));
    const score = uniqueTokens.reduce((acc, token) => acc + (tokenWeights.get(token) || 0), 0) + candidate.weight;
    if (!best || score > best.score) {
      best = { ...candidate, score };
    }
  });

  const question = buildNextStepsIntentionQuestion(best?.step);
  if (!question) return null;

  return {
    source: 'extractedSteps',
    text: question,
    question,
    spread: 'threeCard',
  };
}

// ============================================================================
// Embedding-based Coach Suggestions (uses pre-computed AI data)
// ============================================================================

/**
 * Compute cosine similarity between two embedding vectors.
 * @param {number[]} a - First embedding vector
 * @param {number[]} b - Second embedding vector
 * @returns {number} Cosine similarity (-1 to 1)
 */
function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 0 ? dot / denominator : 0;
}

/**
 * Cluster steps by semantic similarity using pre-computed embeddings.
 *
 * @param {Array<{text: string, weight: number}>} steps - Steps with recency weights
 * @param {number[][]} embeddings - Corresponding embedding vectors
 * @param {number} threshold - Similarity threshold for clustering (0-1)
 * @returns {Array<{steps: string[], indices: number[], score: number, theme: string}>}
 */
function clusterStepsByEmbedding(steps, embeddings, threshold = 0.75) {
  if (!Array.isArray(steps) || !Array.isArray(embeddings) || steps.length !== embeddings.length) {
    return [];
  }

  const clusters = [];
  const assigned = new Set();

  for (let i = 0; i < steps.length; i++) {
    if (assigned.has(i)) continue;

    const cluster = {
      steps: [steps[i].text],
      indices: [i],
      weights: [steps[i].weight]
    };
    assigned.add(i);

    // Find similar steps
    for (let j = i + 1; j < steps.length; j++) {
      if (assigned.has(j)) continue;

      const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
      if (similarity >= threshold) {
        cluster.steps.push(steps[j].text);
        cluster.indices.push(j);
        cluster.weights.push(steps[j].weight);
        assigned.add(j);
      }
    }

    clusters.push(cluster);
  }

  // Score clusters by total weight (size + recency)
  clusters.forEach(cluster => {
    cluster.score = cluster.weights.reduce((sum, w) => sum + w, 0);
    // Use the shortest step as the theme (often the most distilled phrasing)
    cluster.theme = cluster.steps.reduce((a, b) => a.length <= b.length ? a : b);
  });

  // Sort by score descending
  clusters.sort((a, b) => b.score - a.score);

  return clusters;
}

/**
 * Compute coach suggestion using pre-extracted steps and embeddings.
 * Falls back to text-based heuristic if extraction data is unavailable.
 *
 * This function is called client-side on journal load. It uses data that
 * was pre-computed on the server when each reading was saved, enabling
 * semantic clustering without AI inference on every page load.
 *
 * @param {Array} entries - Journal entries (should have extractedSteps and stepEmbeddings)
 * @param {Object} options - Options
 * @param {number} [options.maxEntries=5] - Maximum entries to consider
 * @param {number} [options.similarityThreshold=0.75] - Embedding similarity threshold
 * @returns {Object|null} Coach suggestion or null
 */
export function computeCoachSuggestionWithEmbeddings(entries, options = {}) {
  if (!Array.isArray(entries) || entries.length === 0) return null;

  const maxEntries = typeof options.maxEntries === 'number' ? Math.max(1, options.maxEntries) : 5;
  const similarityThreshold = typeof options.similarityThreshold === 'number'
    ? Math.max(0, Math.min(1, options.similarityThreshold))
    : 0.75;

  // Sort by recency and take top entries
  const sortedByRecency = entries
    .map((entry) => ({ entry, ts: getTimestamp(entry) }))
    .filter(({ ts }) => typeof ts === 'number' && !Number.isNaN(ts))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, maxEntries);

  const extractedStepsFallback = computeExtractedStepsCoachSuggestionFromSorted(sortedByRecency, maxEntries);

  // Gather pre-computed steps and embeddings
  const allSteps = [];
  const allEmbeddings = [];
  let hasEmbeddingData = false;

  sortedByRecency.forEach(({ entry }, index) => {
    const steps = entry?.extractedSteps;
    const embeddings = entry?.stepEmbeddings;

    // Check if this entry has valid pre-computed data
    if (Array.isArray(steps) && Array.isArray(embeddings) && steps.length > 0 && embeddings.length === steps.length) {
      hasEmbeddingData = true;
      const recencyWeight = 1 + ((maxEntries - 1 - index) * 0.15);

      steps.forEach((stepText, i) => {
        if (typeof stepText === 'string' && stepText.trim()) {
          allSteps.push({ text: stepText.trim(), weight: recencyWeight });
          allEmbeddings.push(embeddings[i]);
        }
      });
    }
  });

  // Fall back to heuristic if no embedding data available
  if (!hasEmbeddingData || allSteps.length < 2) {
    return extractedStepsFallback || computeNextStepsCoachSuggestion(entries, { maxEntries });
  }

  // Cluster by embedding similarity
  const clusters = clusterStepsByEmbedding(allSteps, allEmbeddings, similarityThreshold);

  if (clusters.length === 0) {
    return extractedStepsFallback || computeNextStepsCoachSuggestion(entries, { maxEntries });
  }

  const topCluster = clusters[0];

  // Generate question from the theme
  const question = buildNextStepsIntentionQuestion(topCluster.theme);
  if (!question) {
    return extractedStepsFallback || computeNextStepsCoachSuggestion(entries, { maxEntries });
  }

  return {
    source: 'embeddings',
    text: question,
    question,
    theme: topCluster.theme,
    relatedSteps: topCluster.steps,
    clusterSize: topCluster.steps.length,
    spread: topCluster.steps.length > 2 ? 'threeCard' : 'single',
  };
}

export function exportJournalEntriesToCsv(entries, filename = 'tarot-journal.csv') {
  if (typeof document === 'undefined') return false;
  const csv = buildJournalCsv(entries);
  if (!csv) return false;
  // CSV export is local-only; no share token needed
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

// ============================================================================
// Markdown Export (for Obsidian, Notion, and other note-taking apps)
// ============================================================================

/**
 * Format a timestamp for markdown display.
 * @param {number} ts - Timestamp in milliseconds
 * @returns {string} Formatted date string
 */
function formatMarkdownDate(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Format a timestamp for YAML frontmatter (ISO date only).
 * @param {number} ts - Timestamp in milliseconds
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
function formatFrontmatterDate(ts) {
  if (!ts) return '';
  return new Date(ts).toISOString().split('T')[0];
}

/**
 * Build markdown for a single journal entry.
 *
 * @param {Object} entry - Journal entry object
 * @param {Object} options - Export options
 * @param {boolean} [options.frontmatter=true] - Include YAML frontmatter for Obsidian/Logseq
 * @param {boolean} [options.includeNarrative=true] - Include AI-generated narrative
 * @param {boolean} [options.includeReflections=true] - Include user reflections
 * @param {boolean} [options.includeThemes=true] - Include theme analysis
 * @returns {string} Markdown formatted entry
 */
export function buildEntryMarkdown(entry, options = {}) {
  if (!entry) return '';

  const {
    frontmatter = true,
    includeNarrative = true,
    includeReflections = true,
    includeThemes = true
  } = options;

  const lines = [];
  const spread = entry.spread || entry.spreadName || 'Reading';
  const cards = Array.isArray(entry.cards) ? entry.cards : [];

  // YAML Frontmatter (for Obsidian/Logseq)
  if (frontmatter) {
    lines.push('---');
    lines.push(`date: ${formatFrontmatterDate(entry.ts)}`);
    lines.push(`spread: "${spread}"`);
    if (entry.spreadKey) {
      lines.push(`spread_key: ${entry.spreadKey}`);
    }
    lines.push(`context: ${entry.context || 'general'}`);
    if (cards.length > 0) {
      const cardNames = cards.map(c => `"${c.name}"`).join(', ');
      lines.push(`cards: [${cardNames}]`);
    }
    lines.push('tags: [tarot, reading]');
    if (entry.deckId) {
      lines.push(`deck: ${entry.deckId}`);
    }
    lines.push('---');
    lines.push('');
  }

  // Title
  lines.push(`# ${spread}`);
  lines.push(`*${formatMarkdownDate(entry.ts)}*`);
  lines.push('');

  // Context badge
  if (entry.context) {
    lines.push(`**Context:** ${entry.context.charAt(0).toUpperCase() + entry.context.slice(1)}`);
    lines.push('');
  }

  // Question/Intention
  if (entry.question) {
    lines.push('## Question');
    lines.push('');
    lines.push(`> ${entry.question}`);
    lines.push('');
  }

  // Cards Drawn
  if (cards.length > 0) {
    lines.push('## Cards Drawn');
    lines.push('');
    cards.forEach(card => {
      const orientation = card.orientation === 'Reversed' ? ' ↺' : '';
      const position = card.position ? `**${card.position}:** ` : '';
      lines.push(`- ${position}${card.name}${orientation}`);
    });
    lines.push('');
  }

  // Key Themes
  if (includeThemes && entry.themes) {
    const themes = entry.themes;
    const themeLines = [];

    if (themes.suitFocus) themeLines.push(`- ${themes.suitFocus}`);
    if (themes.elementalBalance) themeLines.push(`- ${themes.elementalBalance}`);
    if (themes.archetypeDescription) themeLines.push(`- ${themes.archetypeDescription}`);
    if (themes.reversalDescription?.name) themeLines.push(`- ${themes.reversalDescription.name}`);
    if (themes.timingProfile) themeLines.push(`- Timing: ${themes.timingProfile}`);

    if (themeLines.length > 0) {
      lines.push('## Key Themes');
      lines.push('');
      lines.push(...themeLines);
      lines.push('');
    }
  }

  // Reading Narrative
  if (includeNarrative && entry.personalReading) {
    lines.push('## Reading');
    lines.push('');
    lines.push(entry.personalReading);
    lines.push('');
  }

  // User Reflections
  if (includeReflections && entry.reflections) {
    const reflections = typeof entry.reflections === 'object' ? entry.reflections : {};
    const reflectionEntries = Object.entries(reflections).filter(([, v]) => v && String(v).trim());

    if (reflectionEntries.length > 0) {
      lines.push('## My Reflections');
      lines.push('');
      reflectionEntries.forEach(([position, text]) => {
        lines.push(`**${position}:** ${text}`);
        lines.push('');
      });
    }
  }

  return lines.join('\n');
}

/**
 * Build markdown for multiple journal entries.
 *
 * @param {Array} entries - Array of journal entries
 * @param {Object} options - Export options (passed to buildEntryMarkdown)
 * @returns {string} Markdown formatted journal
 */
export function buildJournalMarkdown(entries, options = {}) {
  if (!Array.isArray(entries) || entries.length === 0) return '';

  // Sort entries by timestamp (newest first)
  const sorted = [...entries].sort((a, b) => (b.ts || 0) - (a.ts || 0));

  return sorted
    .map(entry => buildEntryMarkdown(entry, options))
    .join('\n---\n\n');
}

/**
 * Export journal entries to a markdown file download.
 *
 * @param {Array} entries - Array of journal entries
 * @param {string} [filename='tarot-journal.md'] - Download filename
 * @param {Object} [options] - Export options (passed to buildJournalMarkdown)
 * @returns {boolean} True if export started successfully
 */
export function exportJournalEntriesToMarkdown(entries, filename = 'tarot-journal.md', options = {}) {
  if (typeof document === 'undefined') return false;
  const markdown = buildJournalMarkdown(entries, options);
  if (!markdown) return false;

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

export async function copyJournalEntriesToClipboard(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return false;
  const csv = buildJournalCsv(entries);
  if (!csv) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(csv);
      return true;
    }
  } catch (error) {
    console.warn('Unable to copy journal CSV to clipboard:', error);
  }
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = csv;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    console.warn('Unable to copy journal CSV via fallback:', error);
    return false;
  }
}

/**
 * Copy a journal snapshot summary to clipboard or share sheet.
 * @param {Object} stats - Journal statistics
 * @param {Object} options - Options
 * @param {string} options.scopeLabel - Human-readable scope label (e.g., "This month", "All time")
 * @param {number} options.entryCount - Number of entries in the export
 * @returns {Promise<boolean>} Success status
 */
export async function copyJournalShareSummary(stats, options = {}) {
  if (!stats) return false;
  const { scopeLabel, entryCount } = options;

  const summaryLines = ['Tableu Journal Snapshot'];

  // Add scope information if provided
  if (scopeLabel) {
    const scopeLine = typeof entryCount === 'number'
      ? `Scope: ${scopeLabel} (${entryCount} entries)`
      : `Scope: ${scopeLabel}`;
    summaryLines.push(scopeLine);
  }

  summaryLines.push(
    `Entries: ${stats.totalReadings}`,
    `Cards logged: ${stats.totalCards}`,
    `Reversal rate: ${stats.reversalRate}%`
  );

  if (Array.isArray(stats.frequentCards) && stats.frequentCards.length > 0) {
    const top = stats.frequentCards.map(card => `${card.name} (${card.count}x)`).join(', ');
    summaryLines.push(`Top cards: ${top}`);
  }

  if (Array.isArray(stats.recentThemes) && stats.recentThemes.length > 0) {
    summaryLines.push(`Themes: ${stats.recentThemes.join('; ')}`);
  }

  const summary = summaryLines.join('\n');

  try {
    if (navigator?.share) {
      await navigator.share({ text: summary, title: 'Tableu Journal Snapshot' });
      return true;
    }
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(summary);
      return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = summary;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    console.warn('Unable to share journal summary:', error);
    return false;
  }
}

function formatDeckLabel(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/[A-Z]/.test(trimmed) || trimmed.includes(' ')) return trimmed;
  return trimmed
    .split(/[-_]/g)
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
    .join(' ');
}

export async function copyJournalEntrySummary(entry) {
  if (!entry) return false;
  const contextLabel = formatContextName(entry.context);
  const deckLabel = formatDeckLabel(
    entry.deckName || entry.deckLabel || entry.deck || entry.deckId || entry.deckStyle
  );
  const lines = [
    `Spread: ${entry.spread || entry.spreadName || 'Reading'}`,
    entry.question ? `Question: ${entry.question}` : null,
    `Cards: ${(entry.cards || []).map(card => `${card.name}${card.orientation ? ` (${card.orientation})` : ''}`).join(', ')}`,
    contextLabel ? `Context: ${contextLabel}` : null,
    deckLabel ? `Deck: ${deckLabel}` : null,
    entry.ts ? `When: ${new Date(entry.ts).toLocaleString()}` : null
  ].filter(Boolean);
  const text = lines.join('\n');
  try {
    if (navigator?.share) {
      await navigator.share({ text, title: 'Tarot reading snapshot' });
      return true;
    }
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    console.warn('Unable to share entry snapshot:', error);
    return false;
  }
}

// ============================================================================
// Preference Drift Analysis (Phase 5.3)
// ============================================================================
// Compares user's stated focus areas with actual reading contexts
// to surface emerging interests they might want to add to their profile.

/**
 * Map focus areas (from onboarding) to reading context categories.
 * This allows comparing what users said they care about vs what they
 * actually read about.
 */
const FOCUS_TO_CONTEXT = {
  love: 'love',
  career: 'career',
  self_worth: 'self',
  healing: 'wellbeing',
  creativity: 'career', // approximate mapping
  spirituality: 'spiritual'
};

/**
 * Compute preference drift between stated focus areas and actual reading contexts.
 *
 * @param {Array} entries - Journal entries with context field
 * @param {Array} currentFocusAreas - User's stated focus areas from onboarding
 * @returns {Object|null} Drift analysis or null if insufficient data
 */
export function computePreferenceDrift(entries, currentFocusAreas = []) {
  // Guard against empty/invalid inputs
  if (!Array.isArray(entries) || entries.length === 0) return null;
  if (!Array.isArray(currentFocusAreas) || currentFocusAreas.length === 0) return null;

  // Map focus areas to expected contexts
  const expectedContexts = new Set(
    currentFocusAreas
      .map(f => FOCUS_TO_CONTEXT[f])
      .filter(Boolean)
  );

  // Count actual contexts from entries
  const actualContextCounts = {};
  entries.forEach(entry => {
    const ctx = entry?.context;
    if (ctx && typeof ctx === 'string') {
      actualContextCounts[ctx] = (actualContextCounts[ctx] || 0) + 1;
    }
  });

  // Find drift: contexts user reads about but didn't select as focus
  const driftContexts = Object.entries(actualContextCounts)
    .filter(([ctx]) => !expectedContexts.has(ctx))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Get top actual contexts for comparison
  const actualTopContexts = Object.entries(actualContextCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([context, count]) => ({ context, count }));

  return {
    expectedContexts: Array.from(expectedContexts),
    actualTopContexts,
    driftContexts: driftContexts.map(([context, count]) => ({ context, count })),
    hasDrift: driftContexts.length > 0
  };
}

/**
 * Format a context name for display (capitalize first letter).
 * @param {string} context - Raw context string
 * @returns {string} Formatted context name
 */
export function formatContextName(context) {
  if (!context || typeof context !== 'string') return '';
  return context.charAt(0).toUpperCase() + context.slice(1);
}

// ============================================================================
// Major Arcana Utilities for Unified Journey
// ============================================================================

/**
 * Check if a card name is a Major Arcana card.
 * @param {string} cardName - Card name to check
 * @returns {{ isMajor: boolean, number: number | null, name: string | null }}
 */
function identifyMajorArcana(cardName) {
  if (!cardName || typeof cardName !== 'string') {
    return { isMajor: false, number: null, name: null };
  }

  const normalizedName = cardName.toLowerCase().trim();

  for (const major of MAJOR_ARCANA) {
    if (normalizedName === major.name.toLowerCase() ||
        normalizedName.includes(major.name.toLowerCase())) {
      return { isMajor: true, number: major.number, name: major.name };
    }
  }

  return { isMajor: false, number: null, name: null };
}

/**
 * Compute Major Arcana frequency map from journal entries.
 * Returns an array suitable for heatmap visualization.
 *
 * @param {Array} entries - Journal entries
 * @returns {Array<{ cardNumber: number; name: string; count: number }>}
 */
export function computeMajorArcanaMapFromEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  // Initialize counts for all Major Arcana
  const counts = new Map();
  MAJOR_ARCANA.forEach(major => {
    counts.set(major.number, { cardNumber: major.number, name: major.name, count: 0 });
  });

  // Count appearances
  entries.forEach(entry => {
    const cards = Array.isArray(entry?.cards)
      ? entry.cards
      : (() => {
          try {
            return entry?.cards_json ? JSON.parse(entry.cards_json) : [];
          } catch {
            return [];
          }
        })();

    cards.forEach(card => {
      const cardName = card?.name || card?.card || '';
      const { isMajor, number } = identifyMajorArcana(cardName);

      if (isMajor && number !== null) {
        const existing = counts.get(number);
        if (existing) {
          existing.count += 1;
        }
      }
    });
  });

  return Array.from(counts.values());
}

/**
 * Compute reading streak (consecutive days with readings) from entries.
 *
 * Counts backwards from today. Missing readings break the streak, EXCEPT:
 * - Today (i === 0) is given a "grace period" — if no reading today, we check
 *   from yesterday. This prevents losing a streak at midnight before the user
 *   has had a chance to do their daily reading.
 *
 * Example: If today is Dec 10 with no reading, but Dec 9, 8, 7 all have readings,
 * the streak is 3 (not 0).
 *
 * Note: This may differ from backend `currentStreak` calculations. When displaying
 * streak values, prefer server data for authenticated unfiltered views.
 *
 * @param {Array} entries - Journal entries (should have ts or created_at field)
 * @returns {number} Current streak in days (0 if no consecutive days found)
 */
export function computeStreakFromEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return 0;
  }

  // Extract dates and normalize to day boundaries
  const readingDates = new Set();

  entries.forEach(entry => {
    const timestamp = entry?.ts || (entry?.created_at ? entry.created_at * 1000 : null);
    if (!timestamp) return;

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return;

    // Normalize to YYYY-MM-DD
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    readingDates.add(dateKey);
  });

  if (readingDates.size === 0) return 0;

  // Check streak from today backwards
  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) { // Check up to a year
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);

    const dateKey = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;

    if (readingDates.has(dateKey)) {
      streak += 1;
    } else if (i === 0) {
      // No reading today is OK - check from yesterday
      continue;
    } else {
      // Gap found - streak ends
      break;
    }
  }

  return streak;
}

/**
 * Compute "virtual" badges for cards appearing 3+ times in entries.
 * These are not persisted to D1, just computed for filtered views.
 *
 * @param {Array} entries - Journal entries
 * @returns {Array<{ card_name: string; count: number; earned_at: number; badge_type: string }>}
 */
export function computeBadgesFromEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  // Count card appearances
  const cardCounts = new Map();

  entries.forEach(entry => {
    const cards = Array.isArray(entry?.cards)
      ? entry.cards
      : (() => {
          try {
            return entry?.cards_json ? JSON.parse(entry.cards_json) : [];
          } catch {
            return [];
          }
        })();

    cards.forEach(card => {
      const cardName = card?.name || card?.card || '';
      if (!cardName) return;

      const existing = cardCounts.get(cardName) || { count: 0, lastSeen: 0 };
      existing.count += 1;

      const ts = entry?.ts || (entry?.created_at ? entry.created_at * 1000 : 0);
      if (ts > existing.lastSeen) {
        existing.lastSeen = ts;
      }

      cardCounts.set(cardName, existing);
    });
  });

  // Filter to cards with 3+ appearances and format as badges
  const badges = [];

  cardCounts.forEach((data, cardName) => {
    if (data.count >= 3) {
      badges.push({
        card_name: cardName,
        count: data.count,
        earned_at: data.lastSeen,
        badge_type: 'fire', // Streak badge type
        badge_key: `streak_${cardName.toLowerCase().replace(/\s+/g, '_')}`,
      });
    }
  });

  // Sort by count descending, then by earned_at descending
  badges.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return (b.earned_at || 0) - (a.earned_at || 0);
  });

  return badges;
}

/**
 * Generate a journey story prose narrative from entries.
 * Returns null when insufficient data (< 3 entries).
 *
 * @param {Array} entries - Journal entries
 * @param {Object} options - Generation options
 * @param {Object} options.precomputedStats - Optional precomputed stats (avoid recomputing)
 * @returns {string|null} Journey story prose or null
 */
export function generateJourneyStory(entries, options = {}) {
  if (!Array.isArray(entries) || entries.length < 3) {
    return null;
  }

  // For now, return null - full implementation TBD
  // This would ideally use an LLM to generate prose, but we can
  // add a template-based version later

  // Placeholder: compute basic stats for a simple narrative
  const stats = options.precomputedStats || computeJournalStats(entries);
  if (!stats) return null;

  const topCard = stats.frequentCards?.[0];
  // Clone before sorting to avoid mutating shared stats
  const topContext = stats.contextBreakdown
    ? [...stats.contextBreakdown].sort((a, b) => b.count - a.count)[0]
    : undefined;
  const themes = stats.recentThemes || [];

  if (!topCard && !topContext && themes.length === 0) {
    return null;
  }

  // Build a simple template-based story
  const parts = [];

  if (stats.totalReadings >= 3) {
    parts.push(`Over ${stats.totalReadings} readings, your journey has been taking shape.`);
  }

  if (topCard) {
    parts.push(`${topCard.name} has appeared ${topCard.count} time${topCard.count > 1 ? 's' : ''}, suggesting it holds particular significance for you right now.`);
  }

  if (topContext) {
    const contextName = topContext.name.charAt(0).toUpperCase() + topContext.name.slice(1);
    parts.push(`Your readings have centered on ${contextName.toLowerCase()} matters, signaling where your energy flows.`);
  }

  if (themes.length > 0) {
    const themeText = themes.slice(0, 2).join(' and ');
    parts.push(`Themes of ${themeText.toLowerCase()} weave through your recent readings.`);
  }

  if (parts.length < 2) {
    return null; // Not enough content for a meaningful story
  }

  return parts.join(' ');
}

// Export key prefixes for external clear operations (e.g., logout)
export {
  JOURNAL_INSIGHTS_STORAGE_KEY_PREFIX,
  SHARE_TOKEN_STORAGE_KEY,
  COACH_RECOMMENDATION_KEY_PREFIX,
  getScopedKey
};
