# Payment Integration Guide: Stripe & Google Play Store

Type: guide
Status: active background document
Last reviewed: 2026-09-25

Author: Manus AI
Draft date: 2026-09-25

## 1. Introduction

This document records the shipped Stripe integration and a non-production historical Google Play proposal. Stripe is implemented for the web; Google Play is not implemented. The intended architectural principle for any separately reviewed future provider is a **unified subscription backend**, where the Cloudflare Worker remains the single source of truth for a user's subscription status.

This approach ensures that your application logic remains clean and independent of the payment provider. Whether a user subscribes via the website (Stripe) or the Android app (Google Play), the entitlement check will query the same D1 database table.

### Architectural Overview

1.  **Frontend:** The React PWA redirects to Stripe-hosted Checkout via `/api/create-checkout-session` (no Stripe.js dependency). An Android version (packaged as a Trusted Web Activity or native app) would use the Google Play Billing Library if that optional integration is implemented.
2.  **Backend (Cloudflare Worker):**
    - Receives Stripe webhooks today; a Google Play webhook is a planned addition.
    - Updates a central `users` table in the D1 database with the user's current subscription tier and status.
    - All other backend services (e.g., `tarot-reading` API) query this internal database to grant or deny access to features.

## 2. Database Schema Preparation

First, you must update your D1 database schema to track subscription status. Modify the `users` table in a new migration file.

**File: `migrations/0008_add_subscriptions.sql`**

```sql
-- Add subscription-related columns to the users table
ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free';
ALTER TABLE users ADD COLUMN subscription_provider TEXT; -- 'stripe' or 'google_play'
ALTER TABLE users ADD COLUMN subscription_status TEXT; -- 'active', 'canceled', 'past_due', etc.
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;

-- Create an index for the Stripe customer ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
```

## 3. Part 1: Stripe Integration (for Web)

This integration will handle subscriptions initiated from your website.

**Status update (current main):** Stripe integration is already implemented. The backend uses Stripe REST helpers in `functions/lib/stripe.js`, the checkout endpoint lives in `functions/api/create-checkout-session.js`, and the frontend redirects to the returned `session.url` from `src/pages/PricingPage.jsx`.

### Step 1: Create Stripe Products and Prices

1.  Go to your Stripe Dashboard.
2.  Navigate to **Products** and create two products: "Tableu Plus" and "Tableu Pro".
3.  For each product, add a monthly and an annual recurring price. Note all four Price IDs and configure `STRIPE_PRICE_ID_PLUS`, `STRIPE_PRICE_ID_PLUS_ANNUAL`, `STRIPE_PRICE_ID_PRO`, and `STRIPE_PRICE_ID_PRO_ANNUAL`.

### Step 2: Frontend Checkout Redirect (No Stripe.js dependency)

1.  **Checkout Endpoint:** The worker endpoint already exists at `functions/api/create-checkout-session.js`. It expects `{ tier, interval, successUrl, cancelUrl }` and returns `{ url, sessionId }`. `tier` is `plus` or `pro`; `interval` is `monthly` or `annual` and defaults to `monthly`. An authenticated user with an active Stripe subscription is routed to Billing Portal instead of a second checkout.

2.  **Implement the Checkout Redirect in React:**

    ```jsx
    const handleCheckout = async (tier, interval = 'monthly') => {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tier,
          interval,
          successUrl: `${window.location.origin}/account?session_id={CHECKOUT_SESSION_ID}&upgrade=success`,
          cancelUrl: `${window.location.origin}/pricing`
        })
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    };
    ```

### Step 3: Handle Subscriptions with Webhooks

This is the most critical part. Your backend needs to listen for events from Stripe to know when to grant, update, or revoke access.

1.  **Create the Webhook Endpoint:**

    The webhook handler is already implemented in `functions/api/webhooks/stripe.js` using WebCrypto signature verification and the Stripe REST API (no Stripe SDK in the worker). It uses claim-first idempotency: it atomically claims an event before handling it, returns `duplicate: true` for a claimed event, and removes the claim when processing fails so Stripe can retry. Keep `STRIPE_WEBHOOK_SECRET` configured via Wrangler secrets.

2.  **Register the Webhook:**
    - Deploy your worker. Use the Worker URL or a custom domain configured in the Cloudflare Dashboard; route/custom-domain reconciliation is not managed by this repository's `wrangler.jsonc`.
    - In the Stripe Dashboard, go to **Developers > Webhooks**.
    - Click **Add endpoint**, enter the URL, and select the events to listen to (e.g., `customer.subscription.*`, `invoice.payment_succeeded`).
    - Get the **Webhook Signing Secret** and add it to your Cloudflare environment variables as `STRIPE_WEBHOOK_SECRET`.

## 4. Part 2: Google Play Store Integration (Historical Proposal Only)

> **NON-PRODUCTION HISTORICAL PROPOSAL — DO NOT DEPLOY OR COPY AS IMPLEMENTATION GUIDANCE.** The former Digital Goods API and Worker webhook sketches were removed because they were incomplete and unsafe for production. They omitted purchase-token verification and state mapping, Pub/Sub push authentication and delivery validation, acknowledgment and retry handling, current Google Play Billing and Developer API requirements, and Workers runtime constraints. They also made unsafe assumptions about `PaymentResponse.complete()`, Node-only dependencies, and unauthenticated webhook input. No Google Play billing code, purchase-verification route, RTDN endpoint, schema, or entitlement integration exists in this repository.

If Android billing is reconsidered, start a separately reviewed design against current official Google documentation. It must authenticate and verify purchases with Google before granting entitlements, authenticate and validate Pub/Sub deliveries, handle lifecycle and idempotency, map only verified states to internal subscription state, and exercise failure and replay paths in an isolated environment. Do not restore or adapt the removed samples.

## 5. Conclusion

Stripe is shipped for web. If the optional Google Play path is implemented, the unified backend can support web and mobile with one source of truth for user entitlements. Provider-specific webhook handlers keep the core application agnostic and scalable.

---

## References

[1] Stripe. (2025). _Receive Stripe events in your webhook endpoint_. [https://docs.stripe.com/webhooks](https://docs.stripe.com/webhooks)
[2] Google Developers. (2025). _Google Play Developer APIs_. [https://developer.android.com/google/play/developer-api](https://developer.android.com/google/play/developer-api)
[3] Google Developers. (2025). _Real-time developer notifications reference guide_. [https://developer.android.com/google/play/billing/rtdn-reference](https://developer.android.com/google/play/billing/rtdn-reference)
[4] W3C. (2025). _Digital Goods API_. [https://wicg.github.io/digital-goods/](https://wicg.github.io/digital-goods/)
