/**
 * Rate Limiting Library using Cloudflare KV
 *
 * Implements a fixed-window rate limiting algorithm.
 */

const DEFAULT_WINDOW = 60; // 1 minute
const DEFAULT_LIMIT = 60;  // 60 requests per minute

/**
 * Check if a request exceeds the rate limit
 * @param {KVNamespace} kv - Cloudflare KV binding (RATELIMIT)
 * @param {string} identifier - Unique identifier (IP, User ID, or API Key ID)
 * @param {string} type - Rate limit type (e.g., 'api', 'auth', 'tts')
 * @param {number} [limit] - Max requests per window
 * @param {number} [windowSeconds] - Window size in seconds
 * @returns {Promise<{success: boolean, limit: number, remaining: number, reset: number}>}
 */
export async function checkRateLimit(kv, identifier, type = 'general', limit = DEFAULT_LIMIT, windowSeconds = DEFAULT_WINDOW) {
  if (!kv) {
    console.warn('Rate limiting KV not bound. Skipping check.');
    return { success: true, limit, remaining: limit, reset: 0 };
  }

  const now = Math.floor(Date.now() / 1000);
  const windowKey = Math.floor(now / windowSeconds);
  const key = `ratelimit:${type}:${identifier}:${windowKey}`;
  
  // Calculate time until next window
  const reset = (windowKey + 1) * windowSeconds;

  try {
    // Increment counter
    const { value } = await kv.getWithMetadata(key);
    const currentCount = value ? parseInt(value) : 0;
    
    if (currentCount >= limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        reset
      };
    }

    // Atomic increment is not supported directly in KV without Durable Objects,
    // but for rate limiting, eventual consistency is usually acceptable.
    // Or we can use `put` blindly if we trust the read.
    // A safer approach in KV for strict counting requires DO, but we'll use simple KV put with expiration.
    
    const newCount = currentCount + 1;
    
    // Set new count with expiration (window size + buffer)
    await kv.put(key, newCount.toString(), { expiration: reset + 10 });

    return {
      success: true,
      limit,
      remaining: limit - newCount,
      reset
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    // Fail open to prevent blocking valid traffic on infrastructure errors
    return { success: true, limit, remaining: 1, reset };
  }
}

/**
 * Helper to generate rate limit headers
 * @param {object} result - Result from checkRateLimit
 * @returns {object} Headers object
 */
export function getRateLimitHeaders(result) {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString()
  };
}
