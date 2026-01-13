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
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {})
    }
  });
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
    collapseWhitespace = true
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
