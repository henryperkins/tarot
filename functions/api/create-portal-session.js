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
import { stripeRequest } from '../lib/stripe.js';

const defaultDeps = {
  getUserFromRequest,
  jsonResponse,
  readJsonBody,
  sanitizeRedirectUrl,
  stripeRequest
};

export async function onRequestPost(context, deps = defaultDeps) {
  const { request, env } = context;
  const {
    getUserFromRequest: getUser,
    jsonResponse: toJson,
    readJsonBody: readBody,
    sanitizeRedirectUrl: sanitizeUrl,
    stripeRequest: callStripe
  } = deps;

  try {
    if (!env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY not configured');
      return toJson({ error: 'Payment system not configured', code: 'STRIPE_NOT_CONFIGURED' }, { status: 500 });
    }

    const user = await getUser(request, env);
    if (!user) {
      return toJson({ error: 'Authentication required', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    if (user.auth_provider === 'api_key') {
      return toJson({ error: 'Session authentication required', code: 'SESSION_REQUIRED' }, { status: 401 });
    }

    if (!user.stripe_customer_id) {
      return toJson({ error: 'No Stripe customer found for this account', code: 'NO_STRIPE_CUSTOMER' }, { status: 400 });
    }

    const body = await readBody(request).catch(() => ({}));
    const requestedReturnUrl = typeof body.returnUrl === 'string' ? body.returnUrl.trim() : '';

    const returnUrl = sanitizeUrl(requestedReturnUrl, request, env, '/account');

    const session = await callStripe(
      '/billing_portal/sessions',
      'POST',
      {
        customer: user.stripe_customer_id,
        return_url: returnUrl
      },
      env.STRIPE_SECRET_KEY
    );

    return toJson({ url: session.url }, { status: 200 });
  } catch (error) {
    console.error('Create portal session error:', error);
    return toJson(
      { error: error.message || 'Failed to create portal session', code: 'PORTAL_ERROR' },
      { status: 500 }
    );
  }
}
