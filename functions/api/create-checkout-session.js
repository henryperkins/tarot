/**
 * Create Stripe Checkout Session Endpoint
 * POST /api/create-checkout-session
 *
 * Creates a Stripe Checkout session for subscription purchases.
 * Requires authentication.
 *
 * Request body:
 *   - tier: 'plus' or 'pro' (required)
 *   - interval: 'monthly' or 'annual' (optional, defaults to 'monthly')
 *   - successUrl: redirect URL on success (optional)
 *   - cancelUrl: redirect URL on cancel (optional)
 *
 * Local testing with Stripe CLI:
 *   stripe listen --forward-to localhost:8787/api/webhooks/stripe
 *
 * Required environment variables:
 *   - STRIPE_SECRET_KEY: Stripe secret key (sk_test_... or sk_live_...)
 *   - STRIPE_PRICE_ID_PLUS: Price ID for Plus monthly (price_...)
 *   - STRIPE_PRICE_ID_PRO: Price ID for Pro monthly (price_...)
 *   - STRIPE_PRICE_ID_PLUS_ANNUAL: Price ID for Plus annual (price_...)
 *   - STRIPE_PRICE_ID_PRO_ANNUAL: Price ID for Pro annual (price_...)
 *   - APP_URL: Base URL of the application (e.g., https://tableu.app)
 */

import { getUserFromRequest } from '../lib/auth.js';
import { jsonResponse, readJsonBody } from '../lib/utils.js';
import { sanitizeRedirectUrl } from '../lib/urlSafety.js';
import { stripeRequest } from '../lib/stripe.js';

/**
 * Get or create a Stripe customer for the user
 * Uses atomic UPDATE to prevent race conditions when concurrent requests
 * attempt to create customers for the same user.
 */
async function getOrCreateCustomer(db, user, secretKey) {
  // If user already has a Stripe customer ID, return it
  if (user.stripe_customer_id) {
    return user.stripe_customer_id;
  }

  // Create a new Stripe customer
  const customer = await stripeRequest('/customers', 'POST', {
    email: user.email,
    name: user.username,
    'metadata[user_id]': user.id,
  }, secretKey);

  // Atomically save the customer ID only if no other request won the race
  // The WHERE clause ensures we only update if stripe_customer_id is still NULL
  const result = await db
    .prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ? AND stripe_customer_id IS NULL')
    .bind(customer.id, user.id)
    .run();

  if (result.meta.changes === 0) {
    // Another request won the race - fetch the winning customer ID
    const updated = await db
      .prepare('SELECT stripe_customer_id FROM users WHERE id = ?')
      .bind(user.id)
      .first();

    if (!updated?.stripe_customer_id) {
      // This shouldn't happen - log and throw
      console.error(`Failed to link Stripe customer for user ${user.id}: race condition resolution failed`);
      throw new Error('Failed to link Stripe customer to account');
    }

    // Note: The customer we created is now orphaned in Stripe.
    // In a production system, you might want to delete it or log for cleanup.
    console.warn(`Race condition: orphaned Stripe customer ${customer.id} for user ${user.id}, using ${updated.stripe_customer_id}`);
    return updated.stripe_customer_id;
  }

  return customer.id;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Validate required environment variables
    if (!env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Payment system not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate user
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return jsonResponse({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.auth_provider === 'api_key') {
      return jsonResponse({ error: 'Session authentication required' }, { status: 401 });
    }

    // Parse request body
    const body = await readJsonBody(request).catch(() => ({}));
    const tier = body?.tier;
    const interval = body?.interval || 'monthly';
    const successUrl = body?.successUrl;
    const cancelUrl = body?.cancelUrl;

    // Validate tier
    const validTiers = ['plus', 'pro'];
    if (!tier || !validTiers.includes(tier)) {
      return new Response(
        JSON.stringify({ error: 'Invalid subscription tier' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate interval
    const validIntervals = ['monthly', 'annual'];
    if (!validIntervals.includes(interval)) {
      return new Response(
        JSON.stringify({ error: 'Invalid billing interval' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the price ID for the selected tier and interval
    const priceIdEnvKey = interval === 'annual'
      ? (tier === 'plus' ? 'STRIPE_PRICE_ID_PLUS_ANNUAL' : 'STRIPE_PRICE_ID_PRO_ANNUAL')
      : (tier === 'plus' ? 'STRIPE_PRICE_ID_PLUS' : 'STRIPE_PRICE_ID_PRO');
    const priceId = env[priceIdEnvKey];

    if (!priceId) {
      console.error(`${priceIdEnvKey} not configured`);
      return new Response(
        JSON.stringify({ error: 'Subscription tier not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateCustomer(env.DB, user, env.STRIPE_SECRET_KEY);

    // Determine URLs
    const finalSuccessUrl = sanitizeRedirectUrl(
      successUrl,
      request,
      env,
      '/account?session_id={CHECKOUT_SESSION_ID}&upgrade=success'
    );
    const finalCancelUrl = sanitizeRedirectUrl(cancelUrl, request, env, '/pricing');

    // Create Checkout Session
    const session = await stripeRequest('/checkout/sessions', 'POST', {
      'customer': customerId,
      'mode': 'subscription',
      'payment_method_types[0]': 'card',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'success_url': finalSuccessUrl,
      'cancel_url': finalCancelUrl,
      'subscription_data[metadata][user_id]': user.id,
      'subscription_data[metadata][tier]': tier,
      // Allow promotion codes
      'allow_promotion_codes': 'true',
      // Collect billing address for tax purposes
      'billing_address_collection': 'auto',
    }, env.STRIPE_SECRET_KEY);

    return jsonResponse({ sessionId: session.id, url: session.url }, { status: 200 });

  } catch (error) {
    console.error('Create checkout session error:', error);
    return jsonResponse(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

/**
 * Get current subscription info
 * GET /api/create-checkout-session
 */
export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return jsonResponse({ error: 'Authentication required' }, { status: 401 });
    }

    return jsonResponse(
      {
        subscription: {
          tier: user.subscription_tier || 'free',
          status: user.subscription_status || 'inactive',
          provider: user.subscription_provider || null
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Get subscription error:', error);
    return jsonResponse({ error: 'Failed to get subscription info' }, { status: 500 });
  }
}
