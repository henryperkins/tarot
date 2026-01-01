import { timingSafeEqual } from '../../lib/crypto.js';
import { isProductionEnvironment } from '../../lib/environment.js';

/**
 * Stripe Webhook Handler
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events for subscription lifecycle management.
 * Updates user subscription status in the D1 database.
 *
 * ============================================================================
 * LOCAL DEVELOPMENT WITH STRIPE CLI
 * ============================================================================
 *
 * 1. Install the Stripe CLI:
 *    brew install stripe/stripe-cli/stripe  # macOS
 *    # or download from https://stripe.com/docs/stripe-cli
 *
 * 2. Login to your Stripe account:
 *    stripe login
 *
 * 3. Forward webhooks to your local server:
 *    stripe listen --forward-to localhost:8787/api/webhooks/stripe
 *
 * 4. The CLI will display a webhook signing secret (whsec_...).
 *    Set this as STRIPE_WEBHOOK_SECRET in your .dev.vars file.
 *
 * 5. Test specific events:
 *    stripe trigger customer.subscription.created
 *    stripe trigger customer.subscription.updated
 *    stripe trigger customer.subscription.deleted
 *    stripe trigger invoice.payment_succeeded
 *    stripe trigger invoice.payment_failed
 *
 * ============================================================================
 * PRODUCTION SETUP
 * ============================================================================
 *
 * 1. Go to Stripe Dashboard > Developers > Webhooks
 * 2. Click "Add endpoint"
 * 3. Enter your production URL: https://your-app.pages.dev/api/webhooks/stripe
 * 4. Select events to listen to:
 *    - customer.subscription.created
 *    - customer.subscription.updated
 *    - customer.subscription.deleted
 *    - invoice.payment_succeeded
 *    - invoice.payment_failed
 * 5. Copy the signing secret and set it as STRIPE_WEBHOOK_SECRET
 *
 * Required environment variables:
 *   - STRIPE_SECRET_KEY: Stripe secret key
 *   - STRIPE_WEBHOOK_SECRET: Webhook signing secret (whsec_...)
 */

/**
 * Verify Stripe webhook signature
 * @see https://stripe.com/docs/webhooks/signatures
 */
async function verifyStripeSignature(payload, signature, secret) {
  if (!signature || !secret) {
    return false;
  }

  const crypto = globalThis.crypto;
  if (!crypto?.subtle) {
    console.error('WebCrypto API not available for Stripe signature verification');
    return false;
  }

  const parts = signature.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
  // Stripe can include multiple v1= signatures during secret rotation
  // We should accept if ANY of them match
  const v1Signatures = parts
    .filter(p => p.startsWith('v1='))
    .map(p => p.slice(3));

  if (!timestamp || v1Signatures.length === 0) {
    return false;
  }

  // Check timestamp is within 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    console.warn('Stripe webhook timestamp too old');
    return false;
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signedPayload)
  );
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Use timing-safe comparison and accept if any v1 signature matches
  // This supports Stripe's secret rotation where multiple signatures may be present
  return v1Signatures.some(sig => timingSafeEqual(expectedSignature, sig));
}

/**
 * Map Stripe subscription status to our internal status
 */
function mapSubscriptionStatus(stripeStatus) {
  const statusMap = {
    'active': 'active',
    'trialing': 'trialing',
    'past_due': 'past_due',
    'canceled': 'canceled',
    'unpaid': 'unpaid',
    'incomplete': 'incomplete',
    'incomplete_expired': 'expired',
    'paused': 'paused'
  };
  return statusMap[stripeStatus] || 'inactive';
}

/**
 * Extract tier from price lookup_key or metadata
 */
function extractTierFromSubscription(subscription) {
  // Check subscription metadata first
  if (subscription.metadata?.tier) {
    return subscription.metadata.tier;
  }

  // Check price lookup_key
  const item = subscription.items?.data?.[0];
  const lookupKey = item?.price?.lookup_key;
  if (lookupKey) {
    if (lookupKey.includes('pro')) return 'pro';
    if (lookupKey.includes('plus')) return 'plus';
  }

  // Check price metadata
  if (item?.price?.metadata?.tier) {
    return item.price.metadata.tier;
  }

  // Fallback: derive from price amount (optional, for backwards compatibility)
  const amount = item?.price?.unit_amount;
  if (amount) {
    // $19.99 = 1999 cents -> pro, $7.99 = 799 cents -> plus
    if (amount >= 1500) return 'pro';
    if (amount >= 500) return 'plus';
  }

  return 'plus'; // Default to plus if we can't determine
}

/**
 * Update user subscription in database
 */
async function updateUserSubscription(db, customerId, subscription) {
  const tier = extractTierFromSubscription(subscription);
  const status = mapSubscriptionStatus(subscription.status);

  console.log(`Updating subscription for customer ${customerId}: tier=${tier}, status=${status}`);

  const result = await db
    .prepare(`
      UPDATE users
      SET subscription_tier = ?,
          subscription_status = ?,
          subscription_provider = 'stripe'
      WHERE stripe_customer_id = ?
    `)
    .bind(tier, status, customerId)
    .run();

  if (result.meta.changes === 0) {
    console.warn(`No user found with stripe_customer_id: ${customerId}`);
    return false;
  }

  return true;
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCanceled(db, customerId) {
  console.log(`Canceling subscription for customer ${customerId}`);

  const result = await db
    .prepare(`
      UPDATE users
      SET subscription_tier = 'free',
          subscription_status = 'canceled'
      WHERE stripe_customer_id = ?
    `)
    .bind(customerId)
    .run();

  return result.meta.changes > 0;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Get the raw body for signature verification
    const payload = await request.text();
    const signature = request.headers.get('stripe-signature');

    // Verify webhook signature
    if (env.STRIPE_WEBHOOK_SECRET) {
      const isValid = await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);
      if (!isValid) {
        console.error('Invalid Stripe webhook signature');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Fail closed in production - missing secret is a configuration error
      if (isProductionEnvironment(env)) {
        console.error('STRIPE_WEBHOOK_SECRET not configured in production - rejecting webhook');
        return new Response(
          JSON.stringify({ error: 'Webhook configuration error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      // In development without webhook secret, log a warning but allow
      console.warn('STRIPE_WEBHOOK_SECRET not set - dev mode, skipping signature verification');
    }

    // Parse the event
    const event = JSON.parse(payload);
    console.log(`Received Stripe webhook: ${event.type} (${event.id})`);

    // Idempotency: Use claim-first pattern to prevent race conditions
    // INSERT OR IGNORE atomically claims the event; if it already exists, changes=0
    // This is safer than SELECT-then-INSERT which can race under concurrent delivery
    let _eventClaimed = false;
    try {
      const claim = await env.DB.prepare(`
        INSERT OR IGNORE INTO processed_webhook_events
        (provider, event_id, event_type, processed_at)
        VALUES (?, ?, ?, ?)
      `).bind('stripe', event.id, event.type, Date.now()).run();

      if (claim.meta.changes === 0) {
        // Another worker already claimed this event
        console.log(`[Stripe Webhook] Duplicate event ignored: ${event.id} (${event.type})`);
        return new Response(
          JSON.stringify({ received: true, duplicate: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      _eventClaimed = true;
    } catch (err) {
      // If idempotency claim fails, log but continue processing
      // Better to potentially double-process than to fail silently
      console.warn(`[Stripe Webhook] Idempotency claim failed (continuing): ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        await updateUserSubscription(env.DB, customerId, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        await handleSubscriptionCanceled(env.DB, customerId);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        // Log successful payment - could be used for analytics or credits
        console.log(`Payment succeeded for customer ${invoice.customer}: $${(invoice.amount_paid / 100).toFixed(2)}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.warn(`Payment failed for customer ${invoice.customer}`);
        // Could trigger notification to user or grace period handling
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object;
        console.log(`Trial ending soon for customer ${subscription.customer}`);
        // Could trigger notification to user
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Note: Event was already recorded for idempotency before processing (claim-first pattern)
    // If processing failed and we want Stripe to retry, we could delete the claim here:
    // if (eventClaimed && processingFailed) {
    //   await env.DB.prepare('DELETE FROM processed_webhook_events WHERE provider = ? AND event_id = ?')
    //     .bind('stripe', event.id).run();
    // }

    // Acknowledge receipt of the event
    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Stripe webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook handler failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle GET request - return webhook status (for health checks)
 */
export async function onRequestGet() {
  return new Response(
    JSON.stringify({
      status: 'ok',
      message: 'Stripe webhook endpoint is active',
      supportedEvents: [
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.payment_succeeded',
        'invoice.payment_failed',
        'customer.subscription.trial_will_end'
      ]
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
