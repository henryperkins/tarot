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
