/**
 * Shared HTTP helpers for Cloudflare Pages Functions.
 * Avoids duplicating boilerplate across tarot-reading and TTS endpoints.
 */

/**
 * Safely parse a JSON body from a Request. Returns an empty object when the
 * payload is empty and throws when the body cannot be parsed.
 *
 * @param {Request} request
 * @returns {Promise<Record<string, any>>}
 */
export async function readJsonBody(request) {
  if (!request) return {};

  const contentLength = request.headers?.get('content-length');
  if (contentLength === '0') {
    return {};
  }

  const text = await request.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON payload.');
  }
}

/**
 * JSON convenience wrapper for Cloudflare Responses.
 *
 * @param {unknown} data
 * @param {ResponseInit} [init]
 */
export function jsonResponse(data, init = {}) {
  const normalizedInit = typeof init === 'number'
    ? { status: init }
    : (init || {});
  return new Response(JSON.stringify(data), {
    ...normalizedInit,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(normalizedInit.headers || {})
    }
  });
}

/**
 * Convert ArrayBuffer/Uint8Array to base64 safely for large payloads.
 *
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {string}
 */
export function arrayBufferToBase64(buffer) {
  if (!buffer) return '';

  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  if (typeof btoa === 'function') {
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  throw new Error('Base64 encoding is not supported in this environment.');
}

/**
 * Build a stable UTC date key (YYYY-MM-DD) for usage limits.
 *
 * @param {Date} [date]
 * @returns {string}
 */
export function getUtcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * Build a daily usage key for a feature/user pair.
 *
 * @param {Object} options
 * @param {string} options.feature
 * @param {string|number} options.userId
 * @param {string} [options.keyPrefix='media_usage']
 * @param {Date} [options.date]
 * @returns {{ key: string, dateKey: string }}
 */
export function buildDailyUsageKey({ feature, userId, keyPrefix = 'media_usage', date = new Date() }) {
  const dateKey = getUtcDateKey(date);
  const key = `${keyPrefix}:${feature}:${userId}:${dateKey}`;
  return { key, dateKey };
}

/**
 * Seconds until the next UTC day boundary for a given date key.
 *
 * @param {string} dateKey
 * @param {Date} [now]
 * @returns {number}
 */
export function getSecondsUntilUtcDayEndFromKey(dateKey, now = new Date()) {
  if (!dateKey || typeof dateKey !== 'string') {
    return getSecondsUntilUtcDayEnd(now);
  }
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) {
    return getSecondsUntilUtcDayEnd(now);
  }
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const seconds = Math.ceil((nextDay.getTime() - now.getTime()) / 1000);
  return Math.max(60, seconds);
}

/**
 * Seconds until the next UTC day boundary.
 *
 * @param {Date} [date]
 * @returns {number}
 */
export function getSecondsUntilUtcDayEnd(date = new Date()) {
  const nextDay = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1
  ));
  const seconds = Math.ceil((nextDay.getTime() - date.getTime()) / 1000);
  return Math.max(60, seconds);
}

/**
 * Check and increment a per-user daily usage counter in KV.
 *
 * @param {Object} env
 * @param {Object} options
 * @param {string} options.feature
 * @param {string|number} options.userId
 * @param {number} options.limit
 * @param {string} [options.keyPrefix='media_usage']
 * @returns {Promise<{allowed: boolean, remaining: number|null, limit: number|null, resetsAt: string|null, count: number|null}>}
 */
export async function checkAndIncrementDailyUsage(env, {
  feature,
  userId,
  limit,
  keyPrefix = 'media_usage'
}) {
  if (!env?.METRICS_DB?.get || !env?.METRICS_DB?.put || !feature || !userId || !Number.isFinite(limit)) {
    return {
      allowed: true,
      remaining: null,
      limit: Number.isFinite(limit) ? limit : null,
      resetsAt: null,
      count: null,
      key: null,
      dateKey: null
    };
  }

  const now = new Date();
  const { key, dateKey } = buildDailyUsageKey({ feature, userId, keyPrefix, date: now });
  let count = 0;

  try {
    const stored = await env.METRICS_DB.get(key);
    if (stored) {
      count = Number.parseInt(stored, 10) || 0;
    }
  } catch (err) {
    console.warn(`[usage:${feature}] Failed to read usage counter: ${err.message}`);
  }

  if (count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      resetsAt: new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1
      )).toISOString(),
      count,
      key,
      dateKey
    };
  }

  const nextCount = count + 1;
  try {
    await env.METRICS_DB.put(key, String(nextCount), {
      expirationTtl: getSecondsUntilUtcDayEnd(now)
    });
  } catch (err) {
    console.warn(`[usage:${feature}] Failed to persist usage counter: ${err.message}`);
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - nextCount),
    limit,
    resetsAt: new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1
    )).toISOString(),
    count: nextCount,
    key,
    dateKey
  };
}

/**
 * Decrement a per-user daily usage counter in KV.
 *
 * @param {Object} env
 * @param {Object} options
 * @param {string} [options.key]
 * @param {string} [options.feature]
 * @param {string|number} [options.userId]
 * @param {string} [options.dateKey]
 * @param {string} [options.keyPrefix='media_usage']
 * @returns {Promise<boolean>}
 */
export async function decrementDailyUsage(env, {
  key,
  feature,
  userId,
  dateKey,
  keyPrefix = 'media_usage'
}) {
  if (!env?.METRICS_DB?.get || !env?.METRICS_DB?.put) return false;
  let resolvedKey = key;
  let resolvedDateKey = dateKey;

  if (!resolvedKey) {
    if (!feature || !userId) return false;
    const derived = buildDailyUsageKey({
      feature,
      userId,
      keyPrefix,
      date: resolvedDateKey ? new Date(`${resolvedDateKey}T00:00:00.000Z`) : new Date()
    });
    resolvedKey = derived.key;
    resolvedDateKey = derived.dateKey;
  }

  try {
    const stored = await env.METRICS_DB.get(resolvedKey);
    if (!stored) return false;
    const count = Number.parseInt(stored, 10) || 0;
    if (count <= 0) return false;
    const nextCount = count - 1;
    if (nextCount <= 0 && typeof env.METRICS_DB.delete === 'function') {
      await env.METRICS_DB.delete(resolvedKey);
      return true;
    }
    await env.METRICS_DB.put(resolvedKey, String(Math.max(0, nextCount)), {
      expirationTtl: getSecondsUntilUtcDayEndFromKey(resolvedDateKey || getUtcDateKey(new Date()))
    });
    return true;
  } catch (err) {
    console.warn(`[usage] Failed to decrement usage counter: ${err.message}`);
    return false;
  }
}

/**
 * Derive the external base URL for a request, respecting proxy headers.
 * Falls back to the request URL's protocol/host when headers are absent.
 *
 * @param {Request} request
 * @returns {string} Base URL (e.g., https://example.com)
 */
export function getBaseUrl(request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get('X-Forwarded-Proto');
  const cfVisitor = request.headers.get('CF-Visitor');
  const isHttps =
    forwardedProto === 'https' ||
    cfVisitor?.includes('"scheme":"https"') ||
    url.protocol === 'https:';

  const protocol = isHttps ? 'https:' : url.protocol;
  return `${protocol}//${url.host}`;
}

// Re-export safeJsonParse from canonical shared location.
// Note: The shared version defaults to silent=true. Workers code that wants warnings
// should explicitly pass { silent: false }.
export { safeJsonParse } from '../../shared/utils.js';

/**
 * Build CORS headers that support credentials when an Origin is provided.
 * Falls back to wildcard (*) when no Origin is present.
 *
 * @param {Request} request - The incoming request to extract Origin from
 * @param {Object} [options] - Optional configuration
 * @param {string} [options.methods='GET, POST, PUT, OPTIONS'] - Allowed HTTP methods
 * @param {string} [options.headers='Content-Type, Authorization'] - Allowed request headers
 * @returns {Record<string, string>} CORS headers object
 *
 * @example
 * const corsHeaders = buildCorsHeaders(request);
 * return new Response(data, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
 *
 * @example
 * // With custom methods
 * const corsHeaders = buildCorsHeaders(request, { methods: 'POST, OPTIONS' });
 */
export function buildCorsHeaders(request, options = {}) {
  const origin = request.headers.get('Origin');
  const methods = options.methods || 'GET, POST, PUT, OPTIONS';
  const allowedHeaders = options.headers || 'Content-Type, Authorization';

  const base = {
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': allowedHeaders
  };

  if (origin) {
    return {
      ...base,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin'
    };
  }

  return {
    ...base,
    'Access-Control-Allow-Origin': '*'
  };
}

/**
 * Sanitize text with configurable options.
 * Consolidates various sanitization patterns used across TTS and prompt handling.
 *
 * @param {string} text - Input text to sanitize
 * @param {Object} [options] - Configuration options
 * @param {number} [options.maxLength] - Maximum length (truncates if exceeded)
 * @param {boolean} [options.addEllipsis=false] - Add "..." when truncating
 * @param {boolean} [options.stripMarkdown=false] - Remove markdown/bracket chars (#*_`>|[]{}<>)
 * @param {boolean} [options.stripControlChars=false] - Remove Unicode control characters
 * @param {boolean} [options.collapseWhitespace=true] - Collapse multiple spaces/newlines to single space
 * @returns {string} Sanitized text
 *
 * @example
 * // Simple TTS sanitization (length limit only)
 * sanitizeText(text, { maxLength: 4000 })
 *
 * @example
 * // Prompt-safe sanitization
 * sanitizeText(userInput, { maxLength: 500, stripMarkdown: true, stripControlChars: true })
 *
 * @example
 * // With ellipsis on truncation
 * sanitizeText(text, { maxLength: 100, addEllipsis: true, stripMarkdown: true })
 */
export function sanitizeText(text, options = {}) {
  const {
    maxLength = null,
    addEllipsis = false,
    stripMarkdown = false,
    stripControlChars = false,
    collapseWhitespace = true,
    filterInstructions = false
  } = options;

  if (typeof text !== 'string') return '';

  let result = text;

  // Strip Unicode control characters (Cc category) if requested
  if (stripControlChars) {
    result = result.replace(/\p{Cc}/gu, ' ');
  }

  // Strip markdown/bracket characters if requested
  if (stripMarkdown) {
    result = result.replace(/[#*_`>|[\]{}<>]/g, ' ');
  }

  // Filter prompt injection patterns if requested
  // Removes common patterns used to override system instructions
  if (filterInstructions) {
    result = filterInstructionPatterns(result);
  }

  // Collapse whitespace (newlines, multiple spaces) to single space
  if (collapseWhitespace) {
    result = result.replace(/\s+/g, ' ');
  }

  result = result.trim();

  // Apply length limit
  if (maxLength && result.length > maxLength) {
    result = result.slice(0, maxLength).trim();
    if (addEllipsis) {
      result += '...';
    }
  }

  return result;
}

/**
 * Patterns that indicate prompt injection attempts.
 * These are filtered from user input to prevent instruction override attacks.
 */
const INSTRUCTION_OVERRIDE_PATTERNS = [
  // Direct instruction overrides
  /ignore\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|system|developer)\s+(?:instructions?|prompts?|rules?|guidelines?)/gi,
  /disregard\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|system|developer)\s+(?:instructions?|prompts?|rules?|guidelines?)/gi,
  /forget\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|system|developer)\s+(?:instructions?|prompts?|rules?|guidelines?)/gi,
  /override\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|system|developer)\s+(?:instructions?|prompts?|rules?|guidelines?)/gi,

  // Role/persona injection
  /you\s+are\s+now\s+(?:a\s+)?(?:different|new|evil|unrestricted)/gi,
  /pretend\s+(?:you(?:'re|\s+are)\s+)?(?:a\s+)?(?:different|new|evil|unrestricted)/gi,
  /act\s+as\s+(?:if\s+)?(?:you(?:'re|\s+are)\s+)?(?:a\s+)?(?:different|new)/gi,

  // System prompt extraction
  /(?:reveal|show|display|print|output)\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions?|rules?)/gi,
  /what\s+(?:are\s+)?your\s+(?:system\s+)?(?:instructions?|rules?|guidelines?)/gi,

  // Jailbreak patterns
  /\bdan\s+mode\b/gi,
  /\bjailbreak\b/gi,
  /\bdeveloper\s+mode\b/gi,
  /\bunrestricted\s+mode\b/gi,

  // Boundary markers that might confuse the model
  /```\s*system\b/gi,
  /\[system\]/gi,
  /\[developer\]/gi,
  /<\s*system\s*>/gi
];

/**
 * Common confusable character mappings (homoglyphs).
 * Maps visually similar characters to their ASCII equivalents.
 * Based on Unicode confusables used in security contexts.
 */
const CONFUSABLE_MAP = {
  // Cyrillic → Latin
  '\u0430': 'a', // Cyrillic small a
  '\u0435': 'e', // Cyrillic small ie
  '\u043E': 'o', // Cyrillic small o
  '\u0440': 'p', // Cyrillic small er
  '\u0441': 'c', // Cyrillic small es
  '\u0443': 'y', // Cyrillic small u
  '\u0445': 'x', // Cyrillic small ha
  '\u0456': 'i', // Cyrillic small byelorussian-ukrainian i
  '\u0410': 'A', // Cyrillic capital A
  '\u0412': 'B', // Cyrillic capital Ve
  '\u0415': 'E', // Cyrillic capital Ie
  '\u041A': 'K', // Cyrillic capital Ka
  '\u041C': 'M', // Cyrillic capital Em
  '\u041D': 'H', // Cyrillic capital En
  '\u041E': 'O', // Cyrillic capital O
  '\u0420': 'P', // Cyrillic capital Er
  '\u0421': 'C', // Cyrillic capital Es
  '\u0422': 'T', // Cyrillic capital Te
  '\u0425': 'X', // Cyrillic capital Ha
  '\u0427': 'Y', // Cyrillic capital Che (resembles Y)
  // Greek → Latin
  '\u0391': 'A', // Greek capital Alpha
  '\u0392': 'B', // Greek capital Beta
  '\u0395': 'E', // Greek capital Epsilon
  '\u0396': 'Z', // Greek capital Zeta
  '\u0397': 'H', // Greek capital Eta
  '\u0399': 'I', // Greek capital Iota
  '\u039A': 'K', // Greek capital Kappa
  '\u039C': 'M', // Greek capital Mu
  '\u039D': 'N', // Greek capital Nu
  '\u039F': 'O', // Greek capital Omicron
  '\u03A1': 'P', // Greek capital Rho
  '\u03A4': 'T', // Greek capital Tau
  '\u03A5': 'Y', // Greek capital Upsilon
  '\u03A7': 'X', // Greek capital Chi
  '\u03B1': 'a', // Greek small alpha
  '\u03B5': 'e', // Greek small epsilon
  '\u03B9': 'i', // Greek small iota
  '\u03BF': 'o', // Greek small omicron
  '\u03C1': 'p', // Greek small rho
  '\u03C5': 'u', // Greek small upsilon
  '\u03C7': 'x', // Greek small chi
};

// Build regex for confusable replacement
const CONFUSABLE_REGEX = new RegExp('[' + Object.keys(CONFUSABLE_MAP).join('') + ']', 'g');

/**
 * Normalize text to prevent Unicode homoglyph and obfuscation attacks.
 * Applies NFKC normalization, confusable mapping, and strips invisible characters.
 *
 * @param {string} text - Input text
 * @returns {string} Normalized text safe for pattern matching
 */
export function normalizeUnicodeForPatternMatch(text) {
  if (!text || typeof text !== 'string') return '';

  // Step 1: NFD decomposition to separate base chars from combining marks
  // This allows us to strip accents that were added to letters
  let result = text.normalize('NFD');

  // Step 2: Remove combining diacritical marks (accents added to previous char)
  // Must happen AFTER NFD but BEFORE NFKC to catch pre-combined accented chars
  result = result.replace(/[\u0300-\u036F]/g, ''); // Combining Diacritical Marks
  result = result.replace(/[\u1AB0-\u1AFF]/g, ''); // Combining Diacritical Marks Extended
  result = result.replace(/[\u1DC0-\u1DFF]/g, ''); // Combining Diacritical Marks Supplement
  result = result.replace(/[\u20D0-\u20FF]/g, ''); // Combining Diacritical Marks for Symbols
  result = result.replace(/[\uFE20-\uFE2F]/g, ''); // Combining Half Marks

  // Step 3: NFKC normalization for compatibility characters
  // Converts lookalike chars (e.g., Roman numeral 'ⅰ' → 'i', fullwidth 'Ａ' → 'A')
  result = result.normalize('NFKC');

  // Step 4: Replace known confusable characters (Cyrillic/Greek lookalikes)
  result = result.replace(CONFUSABLE_REGEX, char => CONFUSABLE_MAP[char] || char);

  // Step 5: Replace zero-width characters with space (preserves word boundaries)
  // then collapse multiple spaces. This handles cases where invisible chars are
  // used to join/separate words in ways that evade pattern matching.
  result = result.replace(/[\u200B-\u200F\uFEFF\u00AD\u2060\u180E\u2028\u2029]/g, ' ');
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}

/**
 * Filter prompt injection patterns from user input.
 * Replaces matched patterns with neutral placeholder text.
 *
 * @param {string} text - User input text
 * @returns {string} Filtered text with injection patterns removed
 */
export function filterInstructionPatterns(text) {
  if (!text || typeof text !== 'string') return '';

  // Normalize Unicode to catch homoglyph attacks (e.g., Cyrillic 'о' → Latin 'o')
  let result = normalizeUnicodeForPatternMatch(text);

  for (const pattern of INSTRUCTION_OVERRIDE_PATTERNS) {
    result = result.replace(pattern, '[filtered]');
    pattern.lastIndex = 0; // Reset global regex state
  }

  return result;
}
