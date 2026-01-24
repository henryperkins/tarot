import { timingSafeEqual } from '../../lib/crypto.js';
import { isProductionEnvironment } from '../../lib/environment.js';
import { mapStripeStatus, extractTierFromSubscription } from '../../lib/stripe.js';
import { sendEmail } from '../../lib/emailService.js';

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
 * Resolve a user by Stripe customer ID or subscription metadata.
 * Links stripe_customer_id when missing and metadata is present.
 * @returns {{ user: object | null, source?: string, reason?: string }}
 */
async function resolveUserFromSubscription(db, customerId, subscription, requestId) {
  const userByCustomer = await db
    .prepare('SELECT id, stripe_customer_id, subscription_tier FROM users WHERE stripe_customer_id = ?')
    .bind(customerId)
    .first();

  if (userByCustomer) {
    return { user: userByCustomer, source: 'stripe_customer_id' };
  }

  const metadataUserId = subscription?.metadata?.user_id;
  const fallbackUserId = typeof metadataUserId === 'string'
    ? metadataUserId.trim()
    : (metadataUserId ? String(metadataUserId) : '');

  if (!fallbackUserId) {
    console.error(`[${requestId}] [stripe] No user found with stripe_customer_id: ${customerId}. Missing subscription metadata user_id. Subscription ID: ${subscription.id}`);
    return { user: null, reason: 'missing_metadata_user_id' };
  }

  const fallbackUser = await db
    .prepare('SELECT id, stripe_customer_id, subscription_tier FROM users WHERE id = ?')
    .bind(fallbackUserId)
    .first();

  if (!fallbackUser) {
    console.error(`[${requestId}] [stripe] No user found for subscription metadata user_id: ${fallbackUserId}. Customer: ${customerId}. Subscription ID: ${subscription.id}`);
    return { user: null, reason: 'missing_user' };
  }

  if (fallbackUser.stripe_customer_id && fallbackUser.stripe_customer_id !== customerId) {
    console.error(`[${requestId}] [stripe] Stripe customer mismatch for user ${fallbackUser.id}: existing ${fallbackUser.stripe_customer_id}, event ${customerId}. Subscription ID: ${subscription.id}`);
    return { user: null, reason: 'customer_mismatch' };
  }

  if (!fallbackUser.stripe_customer_id) {
    const linkResult = await db
      .prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ? AND stripe_customer_id IS NULL')
      .bind(customerId, fallbackUser.id)
      .run();

    if (linkResult.meta.changes === 0) {
      const refreshed = await db
        .prepare('SELECT stripe_customer_id FROM users WHERE id = ?')
        .bind(fallbackUser.id)
        .first();

      if (!refreshed?.stripe_customer_id) {
        console.error(`[${requestId}] [stripe] Failed to link Stripe customer ${customerId} to user ${fallbackUser.id}. Subscription ID: ${subscription.id}`);
        return { user: null, reason: 'link_failed' };
      }

      if (refreshed.stripe_customer_id !== customerId) {
        console.error(`[${requestId}] [stripe] Stripe customer mismatch for user ${fallbackUser.id}: existing ${refreshed.stripe_customer_id}, event ${customerId}. Subscription ID: ${subscription.id}`);
        return { user: null, reason: 'customer_mismatch' };
      }
    }
  }

  console.log(`[${requestId}] [stripe] Linked Stripe customer ${customerId} to user ${fallbackUser.id} via subscription metadata`);
  return { user: { ...fallbackUser, stripe_customer_id: customerId }, source: 'subscription_metadata' };
}

/**
 * Update user subscription in database
 * @returns {{ success: boolean, userNotFound?: boolean, reason?: string }} Result with reason
 */
async function updateUserSubscription(db, customerId, subscription, requestId) {
  const tier = extractTierFromSubscription(subscription);
  if (!tier) {
    console.warn(`[${requestId}] [stripe] Could not determine tier from subscription - check Stripe price configuration. Subscription ID: ${subscription.id}`);
  }
  const status = mapStripeStatus(subscription.status);

  const resolved = await resolveUserFromSubscription(db, customerId, subscription, requestId);
  if (!resolved.user) {
    return { success: false, userNotFound: true, reason: resolved.reason };
  }

  const resolvedTier = tier || resolved.user.subscription_tier || 'free';

  console.log(`[${requestId}] [stripe] Updating subscription for customer ${customerId}: tier=${resolvedTier}, status=${status}`);

  const result = await db
    .prepare(`
      UPDATE users
      SET subscription_tier = ?,
          subscription_status = ?,
          subscription_provider = 'stripe'
      WHERE id = ?
    `)
    .bind(resolvedTier, status, resolved.user.id)
    .run();

  if (result.meta.changes === 0) {
    console.error(`[${requestId}] [stripe] Failed to update subscription for customer ${customerId}. Subscription ID: ${subscription.id}`);
    return { success: false, userNotFound: true, reason: 'update_failed' };
  }

  return { success: true };
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCanceled(db, customerId, subscription, requestId) {
  console.log(`[${requestId}] [stripe] Canceling subscription for customer ${customerId}`);

  const resolved = await resolveUserFromSubscription(db, customerId, subscription, requestId);
  if (!resolved.user) {
    return { success: false, userNotFound: true, reason: resolved.reason };
  }

  const result = await db
    .prepare(`
      UPDATE users
      SET subscription_tier = 'free',
          subscription_status = 'canceled',
          subscription_provider = 'stripe'
      WHERE id = ?
    `)
    .bind(resolved.user.id)
    .run();

  return result.meta.changes > 0 ? { success: true } : { success: false, reason: 'update_failed' };
}

/**
 * Get user by Stripe customer ID
 */
async function getUserByCustomerId(db, customerId) {
  const result = await db
    .prepare('SELECT id, email, username, subscription_tier FROM users WHERE stripe_customer_id = ?')
    .bind(customerId)
    .first();
  return result;
}

/**
 * Send payment failure notification email
 */
async function sendPaymentFailureEmail(env, user, invoice, requestId) {
  if (!user?.email) {
    console.warn(`[${requestId}] [stripe] Cannot send payment failure email: no user email`);
    return;
  }

  const amount = (invoice.amount_due / 100).toFixed(2);
  const tierName = user.subscription_tier === 'pro' ? 'Mystic (Pro)' : 'Enlightened (Plus)';
  const appUrl = env.APP_URL || 'https://tableu.app';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; }
    .content { background: #fafafa; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px; }
    .alert { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
    .alert-title { color: #dc2626; font-weight: 600; margin-bottom: 8px; }
    .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Payment Issue with Your Subscription</h1>
    </div>
    <div class="content">
      <div class="alert">
        <div class="alert-title">Payment Failed</div>
        <p style="margin: 0;">We couldn't process your payment of <strong>$${amount}</strong> for your ${tierName} subscription.</p>
      </div>

      <p>Hi${user.username ? ` ${user.username}` : ''},</p>

      <p>We attempted to charge your payment method but the transaction was declined. This could happen for several reasons:</p>
      <ul>
        <li>Insufficient funds</li>
        <li>Expired card</li>
        <li>Card issuer declined the transaction</li>
      </ul>

      <p>To keep your ${tierName} benefits active, please update your payment method:</p>

      <p style="text-align: center; margin: 24px 0;">
        <a href="${appUrl}/account" class="button">Update Payment Method</a>
      </p>

      <p>If you don't update your payment within the next few days, your subscription may be paused and you'll lose access to premium features.</p>

      <div class="footer">
        <p>Questions? Reply to this email or contact support.</p>
        <p style="color: #9ca3af; font-size: 12px;">Tableu - Your personal tarot companion</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const result = await sendEmail(env, {
    to: user.email,
    subject: `⚠️ Payment failed for your Tableu subscription`,
    html,
  });

  if (result.success) {
    console.log(`[${requestId}] [stripe] Payment failure email sent to ${user.email}`);
  } else {
    console.error(`[${requestId}] [stripe] Failed to send payment failure email: ${result.error}`);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestId = crypto.randomUUID();

  // Track state for idempotency cleanup in catch block
  let idempotencyClaimSucceeded = false;
  let processingSucceeded = false;
  let event = null;

  try {
    // Get the raw body for signature verification
    const payload = await request.text();
    const signature = request.headers.get('stripe-signature');

    // Verify webhook signature
    if (env.STRIPE_WEBHOOK_SECRET) {
      const isValid = await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);
      if (!isValid) {
        console.error(`[${requestId}] [stripe] Invalid webhook signature`);
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Fail closed in production - missing secret is a configuration error
      if (isProductionEnvironment(env)) {
        console.error(`[${requestId}] [stripe] STRIPE_WEBHOOK_SECRET not configured in production - rejecting webhook`);
        return new Response(
          JSON.stringify({ error: 'Webhook configuration error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      // In development without webhook secret, log a warning but allow
      console.warn(`[${requestId}] [stripe] STRIPE_WEBHOOK_SECRET not set - dev mode, skipping signature verification`);
    }

    // Parse the event
    event = JSON.parse(payload);
    console.log(`[${requestId}] [stripe] Received webhook: ${event.type} (${event.id})`);

    // Idempotency: Use claim-first pattern to prevent race conditions
    // INSERT OR IGNORE atomically claims the event; if it already exists, changes=0
    // This is safer than SELECT-then-INSERT which can race under concurrent delivery
    try {
      const claim = await env.DB.prepare(`
        INSERT OR IGNORE INTO processed_webhook_events
        (provider, event_id, event_type, processed_at)
        VALUES (?, ?, ?, ?)
      `).bind('stripe', event.id, event.type, Date.now()).run();

      if (claim.meta.changes === 0) {
        // Another worker already claimed this event
        console.log(`[${requestId}] [stripe] Duplicate event ignored: ${event.id} (${event.type})`);
        return new Response(
          JSON.stringify({ received: true, duplicate: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      idempotencyClaimSucceeded = true;
    } catch (err) {
      // If idempotency claim fails due to DB error (not duplicate), log but continue processing
      // Better to potentially double-process than to fail silently
      console.warn(`[${requestId}] [stripe] Idempotency claim failed (continuing): ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const updateResult = await updateUserSubscription(env.DB, customerId, subscription, requestId);
        if (!updateResult.success) {
          throw new Error(`Subscription update failed: ${updateResult.reason || 'unknown'}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const cancelResult = await handleSubscriptionCanceled(env.DB, customerId, subscription, requestId);
        if (!cancelResult.success) {
          throw new Error(`Subscription cancellation failed: ${cancelResult.reason || 'unknown'}`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        // Log successful payment - could be used for analytics or credits
        console.log(`[${requestId}] [stripe] Payment succeeded for customer ${invoice.customer}: $${(invoice.amount_paid / 100).toFixed(2)}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.warn(`[${requestId}] [stripe] Payment failed for customer ${invoice.customer}: $${(invoice.amount_due / 100).toFixed(2)}`);

        // Send notification email to user
        const failedUser = await getUserByCustomerId(env.DB, invoice.customer);
        if (failedUser) {
          await sendPaymentFailureEmail(env, failedUser, invoice, requestId);
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object;
        console.log(`[${requestId}] [stripe] Trial ending soon for customer ${subscription.customer}`);
        // Could trigger notification to user
        break;
      }

      default:
        console.log(`[${requestId}] [stripe] Unhandled event type: ${event.type}`);
    }

    processingSucceeded = true;

    // Acknowledge receipt of the event
    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[${requestId}] [stripe] Webhook error:`, error);

    // If we claimed the event but processing failed, remove the claim to allow retry
    // This prevents the "marked as processed but never completed" scenario
    if (idempotencyClaimSucceeded && !processingSucceeded) {
      try {
        await env.DB.prepare(`
          DELETE FROM processed_webhook_events
          WHERE provider = ? AND event_id = ?
        `).bind('stripe', event?.id).run();
        console.log(`[${requestId}] [stripe] Removed idempotency claim for failed event ${event?.id} to allow retry`);
      } catch (cleanupErr) {
        console.error(`[${requestId}] [stripe] Failed to remove idempotency claim: ${cleanupErr.message}`);
      }
    }

    // Return 500 so Stripe will retry the webhook
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
