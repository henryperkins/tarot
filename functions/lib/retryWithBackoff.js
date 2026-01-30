/**
 * Retry utility with exponential backoff for API calls
 * 
 * Provides configurable retry logic with exponential backoff, circuit breaker pattern,
 * and idempotency key support for safe retries.
 */

/**
 * Retry configuration options
 * @typedef {Object} RetryConfig
 * @property {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @property {number} baseDelayMs - Initial delay in milliseconds (default: 1000)
 * @property {number} maxDelayMs - Maximum delay in milliseconds (default: 30000)
 * @property {number} backoffMultiplier - Exponential backoff multiplier (default: 2)
 * @property {number} timeoutMs - Request timeout in milliseconds (default: 60000)
 * @property {number[]} retryableStatuses - HTTP status codes that trigger retry (default: [429, 500, 502, 503, 504])
 * @property {boolean} enableCircuitBreaker - Enable circuit breaker pattern (default: true)
 * @property {number} circuitBreakerThreshold - Failures before opening circuit (default: 5)
 * @property {number} circuitBreakerResetMs - Time before attempting reset (default: 60000)
 */

const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  timeoutMs: 60000,
  retryableStatuses: [429, 500, 502, 503, 504],
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 60000
};

// Circuit breaker state per endpoint
const circuitBreakers = new Map();

/**
 * Generate an idempotency key for safe retries
 * @param {string} requestId - Request ID
 * @param {number} attempt - Attempt number
 * @returns {string} Idempotency key
 */
export function generateIdempotencyKey(requestId, attempt) {
  return `${requestId}-attempt-${attempt}`;
}

/**
 * Get or create circuit breaker for an endpoint
 * @param {string} endpoint - Endpoint identifier
 * @param {RetryConfig} config - Retry configuration
 * @returns {Object} Circuit breaker state
 */
function getCircuitBreaker(endpoint, config) {
  if (!circuitBreakers.has(endpoint)) {
    circuitBreakers.set(endpoint, {
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      failures: 0,
      lastFailure: null,
      successCount: 0
    });
  }
  return circuitBreakers.get(endpoint);
}

/**
 * Check if circuit breaker allows request
 * @param {Object} breaker - Circuit breaker state
 * @param {RetryConfig} config - Retry configuration
 * @returns {boolean} Whether request is allowed
 */
function isCircuitClosed(breaker, config) {
  if (breaker.state === 'CLOSED') return true;
  
  if (breaker.state === 'OPEN') {
    const timeSinceLastFailure = Date.now() - breaker.lastFailure;
    if (timeSinceLastFailure >= config.circuitBreakerResetMs) {
      breaker.state = 'HALF_OPEN';
      breaker.successCount = 0;
      console.log(`[CircuitBreaker] Circuit entering HALF_OPEN for recovery`);
      return true;
    }
    return false;
  }
  
  return true; // HALF_OPEN allows limited requests
}

/**
 * Record success for circuit breaker
 * @param {Object} breaker - Circuit breaker state
 */
function recordSuccess(breaker) {
  if (breaker.state === 'HALF_OPEN') {
    breaker.successCount++;
    if (breaker.successCount >= 3) {
      breaker.state = 'CLOSED';
      breaker.failures = 0;
      console.log(`[CircuitBreaker] Circuit CLOSED after recovery`);
    }
  } else {
    breaker.failures = Math.max(0, breaker.failures - 1);
  }
}

/**
 * Record failure for circuit breaker
 * @param {Object} breaker - Circuit breaker state
 * @param {RetryConfig} config - Retry configuration
 */
function recordFailure(breaker, config) {
  breaker.failures++;
  breaker.lastFailure = Date.now();
  
  if (breaker.failures >= config.circuitBreakerThreshold) {
    breaker.state = 'OPEN';
    console.warn(`[CircuitBreaker] Circuit OPEN after ${breaker.failures} failures`);
  }
}

/**
 * Calculate delay with exponential backoff and jitter
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {RetryConfig} config - Retry configuration
 * @returns {number} Delay in milliseconds
 */
function calculateDelay(attempt, config) {
  // Exponential backoff: baseDelay * (multiplier ^ attempt)
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  
  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  
  // Add jitter (±25%) to prevent thundering herd
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
  
  return Math.max(0, Math.floor(cappedDelay + jitter));
}

/**
 * Check if error is retryable
 * @param {Error} error - Error object
 * @param {RetryConfig} config - Retry configuration
 * @returns {boolean} Whether error is retryable
 */
function isRetryableError(error, config) {
  // Network errors are retryable
  if (error.name === 'TypeError' || error.name === 'FetchError') {
    return true;
  }
  
  // Timeout errors are retryable
  if (error.name === 'AbortError' || error.message?.includes('timeout')) {
    return true;
  }
  
  // Check HTTP status codes
  const statusMatch = error.message?.match(/(\d{3})/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10);
    return config.retryableStatuses.includes(status);
  }
  
  return false;
}

/**
 * Fetch with timeout support
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Execute a function with retry logic and exponential backoff
 * 
 * @param {Function} fn - Async function to execute
 * @param {string} endpoint - Endpoint identifier for circuit breaker
 * @param {string} requestId - Request ID for logging
 * @param {RetryConfig} config - Retry configuration
 * @returns {Promise<any>} Function result
 * @throws {Error} Last error after all retries exhausted
 */
export async function withRetry(fn, endpoint, requestId, config = {}) {
  const mergedConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const breaker = mergedConfig.enableCircuitBreaker 
    ? getCircuitBreaker(endpoint, mergedConfig) 
    : null;
  
  // Check circuit breaker
  if (breaker && !isCircuitClosed(breaker, mergedConfig)) {
    throw new Error(`Circuit breaker OPEN for ${endpoint}. Try again later.`);
  }
  
  let lastError = null;
  
  for (let attempt = 0; attempt <= mergedConfig.maxRetries; attempt++) {
    try {
      console.log(`[${requestId}] Attempt ${attempt + 1}/${mergedConfig.maxRetries + 1} for ${endpoint}`);
      
      const result = await fn(attempt);
      
      // Record success for circuit breaker
      if (breaker) {
        recordSuccess(breaker);
      }
      
      if (attempt > 0) {
        console.log(`[${requestId}] Succeeded on attempt ${attempt + 1} after ${attempt} retries`);
      }
      
      return result;
      
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      const isLastAttempt = attempt >= mergedConfig.maxRetries;
      const shouldRetry = !isLastAttempt && isRetryableError(error, mergedConfig);
      
      if (!shouldRetry) {
        // Record failure for circuit breaker
        if (breaker) {
          recordFailure(breaker, mergedConfig);
        }
        
        console.error(`[${requestId}] Non-retryable error or max retries exceeded:`, error.message);
        throw error;
      }
      
      // Calculate and apply delay
      const delayMs = calculateDelay(attempt, mergedConfig);
      console.warn(`[${requestId}] Attempt ${attempt + 1} failed: ${error.message}. Retrying in ${delayMs}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // Should not reach here, but just in case
  throw lastError || new Error('All retry attempts failed');
}

/**
 * Fetch with retry logic for Azure/Claude APIs
 * 
 * @param {string} url - API URL
 * @param {Object} options - Fetch options
 * @param {string} endpoint - Endpoint identifier
 * @param {string} requestId - Request ID
 * @param {RetryConfig} retryConfig - Retry configuration
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchWithRetry(url, options, endpoint, requestId, retryConfig = {}) {
  return withRetry(
    async (attempt) => {
      // Add idempotency key for safe retries
      const headers = {
        ...options.headers,
        'X-Idempotency-Key': generateIdempotencyKey(requestId, attempt)
      };
      
      const response = await fetchWithTimeout(url, { ...options, headers }, retryConfig.timeoutMs || 60000);
      
      // Handle rate limiting with Retry-After header
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          const delayMs = parseInt(retryAfter, 10) * 1000;
          console.warn(`[${requestId}] Rate limited. Retry-After: ${retryAfter}s`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          throw new Error(`429 Too Many Requests - retry after ${retryAfter}s`);
        }
      }
      
      // Throw for non-OK responses to trigger retry
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errText.slice(0, 200)}`);
      }
      
      return response;
    },
    endpoint,
    requestId,
    retryConfig
  );
}

/**
 * Get circuit breaker status for monitoring
 * @returns {Object} Circuit breaker status map
 */
export function getCircuitBreakerStatus() {
  const status = {};
  for (const [endpoint, breaker] of circuitBreakers) {
    status[endpoint] = {
      state: breaker.state,
      failures: breaker.failures,
      lastFailure: breaker.lastFailure,
      successCount: breaker.successCount
    };
  }
  return status;
}

/**
 * Reset circuit breaker for an endpoint (for testing/emergencies)
 * @param {string} endpoint - Endpoint identifier
 */
export function resetCircuitBreaker(endpoint) {
  if (circuitBreakers.has(endpoint)) {
    circuitBreakers.delete(endpoint);
    console.log(`[CircuitBreaker] Reset circuit for ${endpoint}`);
  }
}
