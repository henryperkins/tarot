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
  // Phone numbers (various formats, optional extension)
  { pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?:\s*(?:ext\.?|x)\s*\d{1,6})?\b/gi, replacement: '[PHONE]' },
  // Social Security Numbers
  { pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, replacement: '[SSN]' },
  // Credit card numbers (basic)
  { pattern: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g, replacement: '[CARD]' },
  // Dates that might be birthdates (MM/DD/YYYY, DD/MM/YYYY, etc.)
  { pattern: /\b(?:0?[1-9]|1[0-2])[/\-.](?:0?[1-9]|[12]\d|3[01])[/\-.](?:19|20)\d{2}\b/g, replacement: '[DATE]' },
  // ISO-style dates (YYYY-MM-DD or YYYY/MM/DD)
  { pattern: /\b(19|20)\d{2}[-/\.](0?[1-9]|1[0-2])[-/\.](0?[1-9]|[12]\d|3[01])\b/g, replacement: '[DATE]' },
  // URLs with potential tracking params
  { pattern: /https?:\/\/[^\s]+/gi, replacement: '[URL]' },
  // IP addresses
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[IP]' },
];

/**
 * Redact PII from text while preserving structure
 * @param {string} text - Text containing potential PII
 * @param {Object} options - Redaction options
 * @param {string} options.displayName - User's display name to redact
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

  // Redact display name if provided
  // Use Unicode-aware boundaries so we avoid over-redacting substrings (e.g., "Ana" in "analysis")
  // while still matching names with diacritics or non-Latin scripts that \b would miss.
  if (options.displayName && typeof options.displayName === 'string') {
    const name = options.displayName.trim();
    if (name.length > 0) {
      try {
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const namePattern = new RegExp(
          `(^|[^\\p{L}\\p{N}_])(${escapedName}(?:['’]s)?)(?![\\p{L}\\p{N}_])`,
          'giu'
        );
        redacted = redacted.replace(namePattern, (_, prefix) => `${prefix}[NAME]`);
      } catch {
        // Invalid regex, skip name redaction
      }
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
 * @param {Object} params.redactionOptions - Options for PII redaction
 * @param {boolean} params.stripUserContent - Whether to strip user questions/reflections (default: true)
 * @returns {Promise<Object>} Prompt engineering payload
 */
export async function buildPromptEngineeringPayload(params) {
  const {
    systemPrompt,
    userPrompt,
    response,
    redactionOptions = {},
    stripUserContent: shouldStripUserContent = true
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
    processedSystem = stripUserContent(processedSystem);
    processedUser = stripUserContent(processedUser);
    processedResponse = stripUserContent(processedResponse);
  }

  // Layer 2: Redact PII patterns from prompts and response
  const redactedSystem = redactPII(processedSystem, redactionOptions);
  const redactedUser = redactPII(processedUser, redactionOptions);
  const redactedResponse = redactPII(processedResponse, redactionOptions);

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
      piiRedacted: true
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
 * Strip user-provided content (questions, reflections) from prompts for storage
 * This provides an additional privacy layer beyond PII pattern matching
 *
 * PRIVACY: This function handles multiple patterns where user content appears:
 * 1. Explicit question fields (single and multi-line)
 * 2. Reflections sections (both inline and newline-separated)
 * 3. Questions embedded in card labels (Outcome/Future positions)
 *
 * @param {string} text - Prompt text containing user content
 * @returns {string} Text with user content replaced by placeholders
 */
export function stripUserContent(text) {
  if (!text || typeof text !== 'string') return text || '';

  let result = text;

  // Strip user questions - **Question**: format (multiline support)
  // Matches from **Question**: to the next blank line or next ** header
  result = result.replace(
    /\*\*Question\*\*:\s*["']?[\s\S]*?(?=\n\n|\n\*\*|$)/gi,
    '**Question**: [USER_QUESTION_REDACTED]'
  );

  // Strip user questions - plain "question:", "query:", "asking:" formats
  // Captures the keyword and all subsequent lines until a blank line or new section
  // Uses multiline matching to handle content spanning multiple lines
  result = result.replace(
    /^(question|query|asking)[:\s]+["']?[^\n]*(?:\n(?!\n|\*\*|[A-Z][a-z]+:)[^\n]*)*/gim,
    '[USER_QUESTION_REDACTED]'
  );

  // Strip user reflections - **Querent's Reflections**: format
  // Handles both inline (same line) and newline-separated content
  // Matches until next ** header or blank line
  result = result.replace(
    /\*\*(?:Querent['']s|User['']?s?\s*)?\s*Reflections?\*\*:\s*[\s\S]*?(?=\n\n|\n\*\*|$)/gi,
    '**Reflections**: [USER_REFLECTIONS_REDACTED]'
  );

  // Strip inline reflections - *Querent's Reflection: "..."* format
  // Handles both straight quotes and smart quotes, and both ASCII and curly apostrophes
  result = result.replace(
    /\*(?:Querent['']s|User['']?s?\s*)?\s*Reflection:\s*[""][^""]*[""]\*/gi,
    '*Reflection: [USER_REFLECTION_REDACTED]*'
  );

  // Strip questions embedded in card position labels
  // Pattern: Outcome — likely path for "<question>" if unchanged
  result = result.replace(
    /Outcome\s*[—–-]\s*likely path for\s*[""][^""]*[""]/gi,
    'Outcome — likely path for [USER_QUESTION_REDACTED]'
  );

  // Pattern: Future — likely trajectory for "<question>" if nothing shifts
  result = result.replace(
    /Future\s*[—–-]\s*likely trajectory for\s*[""][^""]*[""]/gi,
    'Future — likely trajectory for [USER_QUESTION_REDACTED]'
  );

  // Strip displayName-prefixed questions: "Name, you asked: <question>"
  // This handles personalized question formats
  result = result.replace(
    /,\s*you asked:\s*[^\n]+/gi,
    ', you asked: [USER_QUESTION_REDACTED]'
  );

  return result;
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
