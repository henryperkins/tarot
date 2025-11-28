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
  // Phone numbers (various formats)
  { pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: '[PHONE]' },
  // Social Security Numbers
  { pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, replacement: '[SSN]' },
  // Credit card numbers (basic)
  { pattern: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g, replacement: '[CARD]' },
  // Dates that might be birthdates (MM/DD/YYYY, DD/MM/YYYY, etc.)
  { pattern: /\b(?:0?[1-9]|1[0-2])[/\-.](?:0?[1-9]|[12]\d|3[01])[/\-.](?:19|20)\d{2}\b/g, replacement: '[DATE]' },
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
  if (options.displayName && typeof options.displayName === 'string') {
    const name = options.displayName.trim();
    if (name.length > 0) {
      try {
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const namePattern = new RegExp(`\\b${escapedName}\\b`, 'gi');
        redacted = redacted.replace(namePattern, '[NAME]');
      } catch {
        // Invalid regex, skip name redaction
      }
    }
  }

  // Apply additional custom patterns
  if (Array.isArray(options.additionalPatterns)) {
    for (const patternStr of options.additionalPatterns) {
      if (typeof patternStr === 'string' && patternStr.trim()) {
        try {
          const escaped = patternStr.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const customPattern = new RegExp(`\\b${escaped}\\b`, 'gi');
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
 * @param {Object} params - Prompt parameters
 * @param {string} params.systemPrompt - The system prompt
 * @param {string} params.userPrompt - The user prompt
 * @param {string} params.response - The LLM response
 * @param {Object} params.redactionOptions - Options for PII redaction
 * @returns {Promise<Object>} Prompt engineering payload
 */
export async function buildPromptEngineeringPayload(params) {
  const { systemPrompt, userPrompt, response, redactionOptions = {} } = params;

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

  // Redact PII from prompts and response
  const redactedSystem = redactPII(safeSystem, redactionOptions);
  const redactedUser = redactPII(safeUser, redactionOptions);
  const redactedResponse = redactPII(safeResponse, redactionOptions);

  // Extract structural features
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
    }
  };
}

/**
 * Determine if prompt storage is enabled
 * @param {Object} env - Environment bindings
 * @returns {boolean} Whether to persist prompts
 */
export function shouldPersistPrompts(env) {
  if (!env) return false;
  
  // Check for explicit enable/disable
  if (env.PERSIST_PROMPTS !== undefined) {
    const value = String(env.PERSIST_PROMPTS).toLowerCase();
    return value === 'true' || value === '1';
  }
  
  // Default to enabled if METRICS_DB is available
  return Boolean(env.METRICS_DB?.put);
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