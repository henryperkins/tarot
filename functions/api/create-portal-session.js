/**
 * Create Stripe Customer Portal Session Endpoint
 * POST /api/create-portal-session
 *
 * Creates a Stripe Billing Portal session for subscription management.
 * Requires authentication.
 *
 * Required environment variables:
 *   - STRIPE_SECRET_KEY: Stripe secret key (sk_test_... or sk_live_...)
 *   - APP_URL: Base URL of the application (optional)
 */

import { getUserFromRequest } from '../lib/auth.js';
import { jsonResponse, readJsonBody } from '../lib/utils.js';
import { sanitizeRedirectUrl } from '../lib/urlSafety.js';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

async function stripeRequest(endpoint, method, body, secretKey) {
  const response = await fetch(`${STRIPE_API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body ? new URLSearchParams(body).toString() : undefined
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Stripe API error');
  }

  return data;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    if (!env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY not configured');
      return jsonResponse({ error: 'Payment system not configured' }, { status: 500 });
    }

    const user = await getUserFromRequest(request, env);
    if (!user) {
      return jsonResponse({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.auth_provider === 'api_key') {
      return jsonResponse({ error: 'Session authentication required' }, { status: 401 });
    }

    if (!user.stripe_customer_id) {
      return jsonResponse({ error: 'No Stripe customer found for this account' }, { status: 400 });
    }

    const body = await readJsonBody(request).catch(() => ({}));
    const requestedReturnUrl = typeof body.returnUrl === 'string' ? body.returnUrl.trim() : '';

    const returnUrl = sanitizeRedirectUrl(requestedReturnUrl, request, env, '/account');

    const session = await stripeRequest(
      '/billing_portal/sessions',
      'POST',
      {
        customer: user.stripe_customer_id,
        return_url: returnUrl
      },
      env.STRIPE_SECRET_KEY
    );

    return jsonResponse({ url: session.url }, { status: 200 });
  } catch (error) {
    console.error('Create portal session error:', error);
    return jsonResponse(
      { error: error.message || 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
