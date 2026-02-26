/**
 * Prompt Engineering Utilities
 * 
 * Provides utilities for persisting and analyzing LLM prompts:
 * - Hashing for deduplication and A/B grouping
 * - PII redaction for safe storage
 * - Prompt fingerprinting for pattern analysis
 */

/**
 * Generate a SHA-256 hash of text using Web Crypto API
 * @param {string} text - Text to hash
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function hashText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a short fingerprint for quick comparison
 * Uses first 12 chars of SHA-256 hash
 * @param {string} text - Text to fingerprint
 * @returns {Promise<string>} Short hash fingerprint
 */
export async function fingerprint(text) {
  const hash = await hashText(text);
  return hash.slice(0, 12);
}

/**
 * Common PII patterns to redact
 */
const PII_PATTERNS = [
  // Email addresses
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi, replacement: '[EMAIL]' },
  // Phone numbers - curated patterns from libphonenumber for major regions
  // US/Canada: +1 (XXX) XXX-XXXX or variants
  { pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?:\s*(?:ext\.?|x)\s*\d{1,6})?\b/gi, replacement: '[PHONE]' },
  // UK: +44 XX XXXX XXXX or 0XX XXXX XXXX (various formats)
  { pattern: /(?<=^|[^\d])\+44\s?\d{2}\s?\d{4}\s?\d{4}\b/gi, replacement: '[PHONE]' },
  { pattern: /\b0\d{2}\s?\d{4}\s?\d{4}\b/gi, replacement: '[PHONE]' },
  { pattern: /\b0\d{3}\s?\d{3}\s?\d{4}\b/gi, replacement: '[PHONE]' },
  // France: +33 X XX XX XX XX (9 digits in 5 groups)
  { pattern: /(?<=^|[^\d])\+33\s?\d\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}\b/gi, replacement: '[PHONE]' },
  // Germany: +49 XXX XXXXXXX or +49 XX XXXXXXXX (variable length)
  { pattern: /(?<=^|[^\d])\+49[-.\s]?\d{2,4}[-.\s]?\d{4,8}\b/gi, replacement: '[PHONE]' },
  // Other EU: +XX XXX XXX XXX (Italy, Spain, Netherlands, Belgium, Austria, Switzerland)
  { pattern: /(?<=^|[^\d])\+(?:39|34|31|32|43|41)[-.\s]?\d{2,3}[-.\s]?\d{3}[-.\s]?\d{3,4}\b/gi, replacement: '[PHONE]' },
  // Australia: +61 X XXXX XXXX (with spaces between digit groups)
  { pattern: /(?<=^|[^\d])\+61\s?[2-478]\s?\d{4}\s?\d{4}\b/gi, replacement: '[PHONE]' },
  // Japan: +81-X-XXXX-XXXX (area code 1-4 digits, then 4 digits, then 4 digits)
  { pattern: /(?<=^|[^\d])\+81[-.\s]?\d{1,4}[-.\s]?\d{4}[-.\s]?\d{4}\b/gi, replacement: '[PHONE]' },
  // Generic international: +XX followed by 8-12 digits with separators
  { pattern: /(?<=^|[^\d])\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{0,4}\b/gi, replacement: '[PHONE]' },
  // Social Security Numbers
  { pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, replacement: '[SSN]' },
  // Credit card numbers (basic)
  { pattern: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g, replacement: '[CARD]' },
  // Dates that might be birthdates (MM/DD/YYYY, DD/MM/YYYY, etc.)
  { pattern: /\b(?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])[-/.](?:19|20)\d{2}\b/g, replacement: '[DATE]' },
  // ISO-style dates (YYYY-MM-DD or YYYY/MM/DD)
  { pattern: /\b(19|20)\d{2}[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/g, replacement: '[DATE]' },
  // URLs with potential tracking params
  { pattern: /https?:\/\/[^\s]+/gi, replacement: '[URL]' },
  // IP addresses
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[IP]' },
  // Geographic coordinates (high-precision decimals like 40.7128 or -74.0060)
  { pattern: /\b-?\d{1,3}\.\d{4,}\b/g, replacement: '[COORD]' },
];

const NAME_TOKEN = String.raw`\p{Lu}[\p{L}\p{M}]+(?:[''\-][\p{L}\p{M}]+)*`;
// Lowercase name token: starts with lowercase letter, at least 2 letters total
const LOWERCASE_NAME_TOKEN = String.raw`\p{Ll}[\p{L}\p{M}]+(?:[''\-][\p{L}\p{M}]+)*`;
const NAME_SEQUENCE = `${NAME_TOKEN}(?:\\s+${NAME_TOKEN}){0,2}`;
const HONORIFIC_TOKEN = String.raw`(?:Mr|Mrs|Ms|Mx|Dr|Prof|Sir|Dame|Rev|Fr)`;
const HONORIFIC_NAME_SEQUENCE = String.raw`${HONORIFIC_TOKEN}\.?\s+${NAME_TOKEN}(?:\s+${NAME_TOKEN})?`;
const INITIAL_NAME_SEQUENCE = String.raw`\p{Lu}\.\s+${NAME_TOKEN}(?:\s+${NAME_TOKEN})?`;
// Lowercase name sequence: allows all-lowercase names like "alex" or "jamie smith"
const LOWERCASE_NAME_SEQUENCE = `(?:${LOWERCASE_NAME_TOKEN})(?:\\s+(?:${LOWERCASE_NAME_TOKEN})){0,2}`;
const CAPITALIZED_TOKEN_PATTERN = new RegExp(String.raw`^${NAME_TOKEN}$`, 'u');
const LOWERCASE_TOKEN_PATTERN = new RegExp(String.raw`^${LOWERCASE_NAME_TOKEN}$`, 'u');
const INITIAL_TOKEN_PATTERN = new RegExp(String.raw`^\p{Lu}\.?$`, 'u');
const NAME_HINT_PATTERNS = [
  new RegExp(
    String.raw`\bbetween\s+(${NAME_SEQUENCE})\s+and\s+(${NAME_SEQUENCE})`,
    'giu'
  ),
  new RegExp(
    String.raw`(?:\bme\s+and|\bI\s+and|\band\s+me|\band\s+I|\bbetween|\bwith|\babout|\bregarding|\bmy\s+(?:partner|spouse|friend|mother|father|sister|brother|boss|manager|coworker|colleague|mentor|client|child|son|daughter|ex|roommate))\s+(${NAME_SEQUENCE})`,
    'giu'
  ),
  new RegExp(String.raw`(${NAME_SEQUENCE})\s+and\s+(?:me|I)\b`, 'giu'),
  new RegExp(String.raw`(${NAME_SEQUENCE})['']s\\b`, 'giu')
];
const HONORIFIC_AND_INITIAL_HINT_PATTERNS = [
  new RegExp(String.raw`\b(${HONORIFIC_NAME_SEQUENCE})\b`, 'gu'),
  new RegExp(String.raw`\b(${INITIAL_NAME_SEQUENCE})\b`, 'gu')
];
// Lowercase name patterns for fallback extraction (restrictive to avoid false positives)
const LOWERCASE_NAME_HINT_PATTERNS = [
  // "between alex and jamie" - high confidence name context
  new RegExp(
    String.raw`\bbetween\s+(${LOWERCASE_NAME_SEQUENCE})\s+and\s+(${LOWERCASE_NAME_SEQUENCE})`,
    'giu'
  ),
  // "my partner/friend/etc marcus" - relationship + name
  new RegExp(
    String.raw`\bmy\s+(?:partner|spouse|friend|mother|father|sister|brother|boss|manager|coworker|colleague|mentor|client|child|son|daughter|ex|roommate)\s+(${LOWERCASE_NAME_SEQUENCE})`,
    'giu'
  ),
  // "alex and me/I" - name paired with self-reference
  new RegExp(String.raw`(${LOWERCASE_NAME_SEQUENCE})\s+and\s+(?:me|I)\b`, 'giu'),
  // "me/I and alex" - self-reference paired with name
  new RegExp(String.raw`(?:\bme\s+and|\bI\s+and)\s+(${LOWERCASE_NAME_SEQUENCE})`, 'giu'),
  // "alex's" - possessive form (strong name signal)
  new RegExp(String.raw`\b(${LOWERCASE_NAME_SEQUENCE})['']s\b`, 'giu')
];


const NAME_HINT_BLOCKLIST = new Set([
  'i',
  'me',
  'my',
  'we',
  'us',
  'our',
  'you',
  'your',
  'the',
  'a',
  'an'
]);
const HONORIFIC_BLOCKLIST = new Set(['mr', 'mrs', 'ms', 'mx', 'dr', 'prof', 'sir', 'dame', 'rev', 'fr']);
const MIN_REDACTION_NAME_LENGTH = 2;
const MAX_REDACTION_NAME_HINTS = 24;

function normalizeNameHint(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function trimToCapitalizedSequence(value) {
  const tokens = normalizeNameHint(value).split(' ');
  const kept = [];
  for (const token of tokens) {
    if (CAPITALIZED_TOKEN_PATTERN.test(token)) {
      kept.push(token);
    } else {
      break;
    }
  }
  return kept.join(' ');
}

// Common words that shouldn't be treated as names (expanded for lowercase extraction)
const LOWERCASE_SKIP_WORDS = new Set([
  'my', 'your', 'our', 'their', 'his', 'her', 'its',
  'partner', 'spouse', 'friend', 'mother', 'father', 'sister', 'brother',
  'boss', 'manager', 'coworker', 'colleague', 'mentor', 'client',
  'child', 'son', 'daughter', 'ex', 'roommate',
  // Common verbs/articles/prepositions that end sequences
  'is', 'are', 'was', 'were', 'has', 'have', 'had', 'will', 'would', 'could', 'should',
  'and', 'or', 'but', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'about', 'from', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'can', 'may', 'might', 'must', 'need', 'want', 'like', 'know', 'think',
  'feel', 'see', 'hear', 'say', 'tell', 'ask', 'use', 'find', 'give', 'take',
  'come', 'go', 'make', 'get', 'do', 'be', 'been', 'being', 'this', 'that'
]);

/**
 * Trim and title-case a lowercase name sequence for redaction
 * @param {string} value - Lowercase name sequence
 * @returns {string} Title-cased name for consistent redaction
 */
function trimToLowercaseSequence(value) {
  const tokens = normalizeNameHint(value).split(' ');
  const kept = [];
  let foundName = false;
  for (const token of tokens) {
    if (LOWERCASE_TOKEN_PATTERN.test(token)) {
      const lower = token.toLowerCase();
      // Skip common context words at the start (my, partner, etc.)
      if (!foundName && LOWERCASE_SKIP_WORDS.has(lower)) {
        continue;
      }
      // Stop at common words that indicate end of name sequence
      if (foundName && LOWERCASE_SKIP_WORDS.has(lower)) {
        break;
      }
      foundName = true;
      // Title-case for consistent redaction matching
      kept.push(token.charAt(0).toUpperCase() + token.slice(1));
    } else {
      break;
    }
  }
  return kept.join(' ');
}

function shouldKeepNameHint(value) {
  if (!value) return false;
  const normalized = normalizeNameHint(value);
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  const compact = lower.replace(/\./g, '');
  if (NAME_HINT_BLOCKLIST.has(lower)) return false;
  if (lower.startsWith('the ') || lower.startsWith('a ') || lower.startsWith('an ')) return false;
  if (HONORIFIC_BLOCKLIST.has(compact)) return false;
  if (INITIAL_TOKEN_PATTERN.test(normalized)) return false;
  return true;
}

function extractNameHints(text) {
  if (!text || typeof text !== 'string') return [];

  const hints = new Set();
  // Extract capitalized names
  for (const pattern of NAME_HINT_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const captured = match.slice(1).filter(Boolean);
      captured.forEach((name) => {
        const normalized = trimToCapitalizedSequence(name);
        if (shouldKeepNameHint(normalized)) {
          hints.add(normalized);
        }
      });
    }
  }

  // Extract lowercase names (title-cased for consistent redaction)
  for (const pattern of LOWERCASE_NAME_HINT_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const captured = match.slice(1).filter(Boolean);
      captured.forEach((name) => {
        const normalized = trimToLowercaseSequence(name);
        if (shouldKeepNameHint(normalized)) {
          hints.add(normalized);
        }
      });
    }
  }

  // Extract honorific/initial forms (e.g., "Dr. Smith", "J. Smith")
  for (const pattern of HONORIFIC_AND_INITIAL_HINT_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const normalized = normalizeNameHint(match[1] || '');
      if (shouldKeepNameHint(normalized)) {
        hints.add(normalized);
      }
    }
  }

  return Array.from(hints);
}

function normalizeRedactionName(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length >= MIN_REDACTION_NAME_LENGTH ? normalized : '';
}

function dedupeRedactionNames(candidates = [], limit = MAX_REDACTION_NAME_HINTS) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  const seen = new Set();
  const output = [];
  for (const raw of candidates) {
    const normalized = normalizeRedactionName(raw);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
    if (output.length >= limit) break;
  }
  return output;
}

/**
 * Build redaction options for prompt logging/storage.
 *
 * @param {Object} params - Redaction option inputs
 * @param {Object} params.redactionOptions - Existing redaction options
 * @param {string} params.displayName - Optional display name override
 * @param {string} params.userQuestion - Optional user question for name hint extraction
 * @param {string} params.reflectionsText - Optional reflections for name hint extraction
 * @param {string[]} params.nameHints - Optional explicit name hints (skips extraction when provided)
 * @returns {Object} Sanitized redaction options
 */
export function buildPromptRedactionOptions(params = {}) {
  const {
    redactionOptions = {},
    displayName,
    userQuestion,
    reflectionsText,
    nameHints
  } = params;

  const baseOptions = redactionOptions && typeof redactionOptions === 'object' ? redactionOptions : {};
  const resolvedDisplayName = normalizeRedactionName(
    typeof displayName === 'string' ? displayName : baseOptions.displayName
  );

  const providedNameHints = Array.isArray(nameHints)
    ? nameHints
    : extractNameHints([userQuestion, reflectionsText].filter(Boolean).join('\n'));
  const baseAdditionalNames = Array.isArray(baseOptions.additionalNames) ? baseOptions.additionalNames : [];

  const additionalNames = dedupeRedactionNames(
    [...baseAdditionalNames, ...providedNameHints].filter((entry) => {
      if (!resolvedDisplayName || typeof entry !== 'string') return true;
      return entry.trim().toLowerCase() !== resolvedDisplayName.toLowerCase();
    })
  );

  const nextOptions = { ...baseOptions };
  if (resolvedDisplayName) {
    nextOptions.displayName = resolvedDisplayName;
  } else {
    delete nextOptions.displayName;
  }

  if (additionalNames.length > 0) {
    nextOptions.additionalNames = additionalNames;
  } else {
    delete nextOptions.additionalNames;
  }

  return nextOptions;
}

function buildFlexibleNamePattern(rawName) {
  const escapedName = rawName
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\./g, '\\.?')
    .replace(/\s+/g, '\\s+');

  return new RegExp(
    `(^|[^\\p{L}\\p{N}_])(${escapedName}(?:['’]s)?)(?![\\p{L}\\p{N}_])`,
    'giu'
  );
}

function redactNameWithBoundary(text, rawName) {
  if (typeof rawName !== 'string') return text;
  const name = rawName.trim();
  if (!name) return text;
  try {
    const namePattern = buildFlexibleNamePattern(name);
    return text.replace(namePattern, (_, prefix) => `${prefix}[NAME]`);
  } catch {
    return text;
  }
}

/**
 * Redact PII from text while preserving structure
 * @param {string} text - Text containing potential PII
 * @param {Object} options - Redaction options
 * @param {string} options.displayName - User's display name to redact
 * @param {string[]} options.additionalNames - Additional proper names to redact
 * @param {string[]} options.additionalPatterns - Custom patterns to redact
 * @returns {string} Redacted text
 */
export function redactPII(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  let redacted = text;

  // Apply standard PII patterns
  for (const { pattern, replacement } of PII_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }

  const namesToRedact = new Set();
  if (typeof options.displayName === 'string' && options.displayName.trim()) {
    namesToRedact.add(options.displayName.trim());
  }
  if (Array.isArray(options.additionalNames)) {
    options.additionalNames.forEach((rawName) => {
      if (typeof rawName === 'string' && rawName.trim()) {
        namesToRedact.add(rawName.trim());
      }
    });
  }

  if (namesToRedact.size > 0) {
    for (const name of namesToRedact) {
      redacted = redactNameWithBoundary(redacted, name);
    }
  }

  // Apply additional custom patterns
  // Same Unicode-safe approach: no \b word boundaries
  if (Array.isArray(options.additionalPatterns)) {
    for (const patternStr of options.additionalPatterns) {
      if (typeof patternStr === 'string' && patternStr.trim()) {
        try {
          const escaped = patternStr.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const customPattern = new RegExp(escaped, 'gi');
          redacted = redacted.replace(customPattern, '[REDACTED]');
        } catch {
          // Invalid pattern, skip
        }
      }
    }
  }

  return redacted;
}

/**
 * Extract structural features from a prompt for pattern analysis
 * @param {string} prompt - The prompt text
 * @returns {Object} Structural features
 */
export function extractPromptFeatures(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return {
      length: 0,
      wordCount: 0,
      lineCount: 0,
      sectionCount: 0,
      hasMarkdown: false,
      hasCodeBlock: false,
      hasListItems: false,
      hasTables: false
    };
  }

  const lines = prompt.split('\n');
  const words = prompt.split(/\s+/).filter(w => w.length > 0);
  
  // Count markdown sections (headers)
  const sectionMatches = prompt.match(/^#+\s+/gm);
  const sectionCount = sectionMatches ? sectionMatches.length : 0;

  // Detect structural elements
  const hasMarkdown = /[*_#`]/.test(prompt);
  const hasCodeBlock = /```[\s\S]*?```/.test(prompt);
  const hasListItems = /^[-*+]\s+/m.test(prompt) || /^\d+\.\s+/m.test(prompt);
  const hasTables = /\|[^|]+\|/.test(prompt);

  return {
    length: prompt.length,
    wordCount: words.length,
    lineCount: lines.length,
    sectionCount,
    hasMarkdown,
    hasCodeBlock,
    hasListItems,
    hasTables
  };
}

/**
 * Build a prompt engineering payload for persistence
 *
 * PRIVACY: This function applies multiple layers of protection:
 * 1. PII pattern redaction (email, phone, SSN, etc.)
 * 2. User content stripping (questions, reflections)
 * 3. Display name redaction
 *
 * @param {Object} params - Prompt parameters
 * @param {string} params.systemPrompt - The system prompt
 * @param {string} params.userPrompt - The user prompt
 * @param {string} params.response - The LLM response
 * @param {string} params.userQuestion - The user's question (for name redaction hints)
 * @param {string} params.reflectionsText - The user's reflections (for name redaction hints)
 * @param {string[]} params.nameHints - Optional explicit name hints to redact
 * @param {Object} params.redactionOptions - Options for PII redaction
 * @param {boolean} params.stripUserContent - Whether to strip user questions/reflections (default: true)
 * @returns {Promise<Object>} Prompt engineering payload
 */
export async function buildPromptEngineeringPayload(params) {
  const {
    systemPrompt,
    userPrompt,
    response,
    userQuestion,
    reflectionsText,
    nameHints,
    redactionOptions = {},
    stripUserContent: shouldStripUserContent = true,
    skipPIIRedaction = false
  } = params;

  const safeSystem = systemPrompt || '';
  const safeUser = userPrompt || '';
  const safeResponse = response || '';

  // Generate hashes for the raw prompts (for deduplication)
  const combinedPrompt = `${safeSystem}\n---SEPARATOR---\n${safeUser}`;
  const [promptHash, systemHash, userHash, responseHash] = await Promise.all([
    hashText(combinedPrompt),
    fingerprint(safeSystem),
    fingerprint(safeUser),
    fingerprint(safeResponse)
  ]);

  // Layer 1: Strip user-provided content (questions, reflections)
  // This removes potentially sensitive free-form text before PII pattern matching
  let processedSystem = safeSystem;
  let processedUser = safeUser;
  let processedResponse = safeResponse;

  if (shouldStripUserContent) {
    processedSystem = stripUserPromptContent(processedSystem);
    processedUser = stripUserPromptContent(processedUser);
    processedResponse = stripResponseEchoContent(processedResponse);
  }

  const effectiveRedactionOptions = buildPromptRedactionOptions({
    redactionOptions,
    userQuestion,
    reflectionsText,
    nameHints
  });

  // Layer 2: Redact PII patterns from prompts and response (unless skipped)
  let redactedSystem, redactedUser, redactedResponse;
  if (skipPIIRedaction) {
    redactedSystem = processedSystem;
    redactedUser = processedUser;
    redactedResponse = processedResponse;
  } else {
    redactedSystem = redactPII(processedSystem, effectiveRedactionOptions);
    redactedUser = redactPII(processedUser, effectiveRedactionOptions);
    redactedResponse = redactPII(processedResponse, effectiveRedactionOptions);
  }

  // Extract structural features (from original for accurate metrics)
  const systemFeatures = extractPromptFeatures(safeSystem);
  const userFeatures = extractPromptFeatures(safeUser);
  const responseFeatures = extractPromptFeatures(safeResponse);

  return {
    // Hashes for deduplication and grouping
    hashes: {
      combined: promptHash,
      system: systemHash,
      user: userHash,
      response: responseHash
    },

    // Redacted content (safe to store)
    redacted: {
      systemPrompt: redactedSystem,
      userPrompt: redactedUser,
      response: redactedResponse
    },

    // Structural analysis
    structure: {
      system: systemFeatures,
      user: userFeatures,
      response: responseFeatures
    },

    // Length metrics (quick reference without loading full text)
    lengths: {
      systemPrompt: safeSystem.length,
      userPrompt: safeUser.length,
      response: safeResponse.length,
      total: safeSystem.length + safeUser.length + safeResponse.length
    },

    // Privacy metadata
    privacy: {
      userContentStripped: shouldStripUserContent,
      piiRedacted: !skipPIIRedaction
    }
  };
}

/**
 * Determine if prompt storage is enabled
 *
 * PRIVACY: This defaults to FALSE (opt-in) because prompts may contain
 * user questions, reflections, and other PII. Storage must be explicitly
 * enabled via PERSIST_PROMPTS=true.
 *
 * @param {Object} env - Environment bindings
 * @returns {boolean} Whether to persist prompts
 */
export function shouldPersistPrompts(env) {
  if (!env) return false;

  // Check for explicit enable/disable - must be explicitly enabled
  if (env.PERSIST_PROMPTS !== undefined) {
    const value = String(env.PERSIST_PROMPTS).toLowerCase();
    return value === 'true' || value === '1';
  }

  // Default to DISABLED for privacy - user data should not be stored
  // without explicit consent/configuration
  return false;
}

/**
 * Determine whether unredacted prompt storage is permitted.
 * Defaults to false; only allowed in tests or when explicitly enabled.
 *
 * @param {Object} env - Environment bindings
 * @returns {boolean} Whether unredacted prompt storage may be used
 */
export function shouldAllowUnredactedPromptStorage(env) {
  const effectiveEnv = env || (typeof process !== 'undefined' ? process.env : {});
  const explicitAllow = String(effectiveEnv?.ALLOW_UNREDACTED_PROMPT_STORAGE || '').toLowerCase();
  if (explicitAllow === 'true' || explicitAllow === '1') {
    return true;
  }

  const nodeEnv = String(effectiveEnv?.NODE_ENV || '').toLowerCase();
  return nodeEnv === 'test';
}

function stripCommonUserContent(text) {
  if (!text || typeof text !== 'string') return text || '';

  let result = text;

  // Strip user questions - **Question**: format (multiline support)
  // Matches from **Question**: to the next blank line or next ** header
  result = result.replace(
    /\*\*Question\*\*:\s*["'“”‘’]?[\s\S]*?(?=\n\n|\n\*\*|$)/gi,
    '**Question**: [USER_QUESTION_REDACTED]'
  );

  // Strip user questions - plain "question:", "query:", "asking:" formats
  // Captures the keyword and all subsequent lines until a blank line or new section
  // Uses multiline matching to handle content spanning multiple lines
  result = result.replace(
    /^(question|query|asking)[:\s]+["'“”‘’]?[^\n]*(?:\n(?!\n|\*\*|[A-Z][a-z]+:)[^\n]*)*/gim,
    '[USER_QUESTION_REDACTED]'
  );

  // Strip user reflections - **Querent's Reflections**: format
  // Handles both inline (same line) and newline-separated content
  // Matches until next ** header or blank line
  result = result.replace(
    /\*\*(?:Querent['’]s|User['’]?s?\s*)?\s*Reflections?\*\*:\s*[\s\S]*?(?=\n\n|\n\*\*|$)/gi,
    '**Reflections**: [USER_REFLECTIONS_REDACTED]'
  );

  // Strip inline reflections - *Querent's Reflection: "..."* format
  // Handles straight/smart quotes and nested quotes by redacting the full italic block
  result = result.replace(
    /\*(?:Querent['’]s|User['’]?s?\s*)?\s*Reflection:\s*[\s\S]*?\*/gi,
    '*Reflection: [USER_REFLECTION_REDACTED]*'
  );

  // Strip explicit querent identity directives from personalization sections
  result = result.replace(
    /\*\*Querent Name\*\*:\s*[^\n]*/gi,
    '**Querent Name**: [NAME_REDACTED]'
  );
  result = result.replace(
    /\*\*Name Usage\*\*:\s*[\s\S]*?(?=\n\n|\n\*\*|$)/gi,
    '**Name Usage**: [NAME_USAGE_REDACTED]'
  );

  // Strip displayName-prefixed questions: "Name, you asked: <question>"
  // This handles personalized question formats
  result = result.replace(
    /,\s*you asked:\s*[^\n]+/gi,
    ', you asked: [USER_QUESTION_REDACTED]'
  );

  // Strip onboarding focus areas (can contain sensitive user details)
  result = result.replace(
    /-\s*Focus areas\s*\(from onboarding\)\s*:[^\n]*/gi,
    '- Focus areas (from onboarding): [FOCUS_AREAS_REDACTED]'
  );

  return result;
}

/**
 * Strip user-provided content (questions, reflections) from prompt text for storage.
 * This provides an additional privacy layer beyond PII pattern matching.
 *
 * @param {string} text - Prompt text containing user content
 * @returns {string} Text with user content replaced by placeholders
 */
export function stripUserPromptContent(text) {
  let result = stripCommonUserContent(text);
  if (!result || typeof result !== 'string') return result || '';

  // Strip questions embedded in card position labels
  // Pattern: Outcome — likely path for "<question>" if unchanged
  result = result.replace(
    /Outcome\s*[—–-]\s*likely path for\s*(?!\[USER_QUESTION_REDACTED\])[^\n]*?(\s*if unchanged[^\n]*)/gi,
    (_match, suffix = '') => `Outcome — likely path for [USER_QUESTION_REDACTED]${suffix || ''}`
  );
  result = result.replace(
    /Outcome\s*[—–-]\s*likely path for(?!\s*\[USER_QUESTION_REDACTED\])\s*[^\n]*/gi,
    'Outcome — likely path for [USER_QUESTION_REDACTED]'
  );

  // Pattern: Future — likely trajectory for "<question>" if nothing shifts
  result = result.replace(
    /Future\s*[—–-]\s*likely trajectory for\s*(?!\[USER_QUESTION_REDACTED\])[^\n]*?(\s*if nothing shifts[^\n]*)/gi,
    (_match, suffix = '') => `Future — likely trajectory for [USER_QUESTION_REDACTED]${suffix || ''}`
  );
  result = result.replace(
    /Future\s*[—–-]\s*likely trajectory for(?!\s*\[USER_QUESTION_REDACTED\])\s*[^\n]*/gi,
    'Future — likely trajectory for [USER_QUESTION_REDACTED]'
  );

  return result;
}

/**
 * Strip only direct prompt-echo markers from model responses.
 * Keeps normal narrative phrasing intact (for example Outcome/Future trajectory prose).
 *
 * @param {string} text - Model response text
 * @returns {string} Response text with direct prompt echoes removed
 */
export function stripResponseEchoContent(text) {
  return stripCommonUserContent(text);
}

/**
 * Backward-compatible alias for prompt-style stripping.
 * @deprecated Prefer stripUserPromptContent for prompts and stripResponseEchoContent for responses.
 *
 * @param {string} text - Prompt text containing user content
 * @returns {string} Text with user content replaced by placeholders
 */
export function stripUserContent(text) {
  return stripUserPromptContent(text);
}

/**
 * Extract user question from prompt (for separate storage with different retention)
 * @param {string} userPrompt - The user prompt
 * @returns {string|null} Extracted question or null
 */
export function extractUserQuestion(userPrompt) {
  if (!userPrompt) return null;

  // Look for question patterns in the prompt
  const questionPatterns = [
    /(?:question|query|asking)[:\s]+["']?([^"'\n]+)["']?/i,
    /(?:the querent asks|user asks)[:\s]+["']?([^"'\n]+)["']?/i,
    /\*\*Question\*\*[:\s]+([^\n]+)/i
  ];

  for (const pattern of questionPatterns) {
    const match = userPrompt.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}
