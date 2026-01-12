/**
 * Centralized Stripe REST API utilities
 *
 * Stripe SDK is not available in Cloudflare Workers by default.
 * We use the Stripe REST API directly for compatibility.
 */

export const STRIPE_API_BASE = 'https://api.stripe.com/v1';

/**
 * Make a request to the Stripe API
 *
 * @param {string} endpoint - API endpoint (e.g., '/customers', '/checkout/sessions')
 * @param {string} method - HTTP method
 * @param {Record<string, string> | null} body - Request body as key-value pairs
 * @param {string} secretKey - Stripe secret key
 * @returns {Promise<any>} Parsed JSON response
 * @throws {Error} If the API returns an error response
 */
export async function stripeRequest(endpoint, method, body, secretKey) {
  const response = await fetch(`${STRIPE_API_BASE}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Stripe API error');
  }

  return data;
}
