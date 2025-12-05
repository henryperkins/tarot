# Payment Integration Guide: Stripe & Google Play Store

**Author:** Manus AI
**Date:** December 05, 2025

## 1. Introduction

This document provides a specific, actionable guide for integrating both Stripe (for web) and Google Play Store billing into the Tableu application. The core architectural principle is to create a **unified subscription backend**, where your Cloudflare Worker acts as the single source of truth for a user's subscription status, regardless of the payment platform.

This approach ensures that your application logic remains clean and independent of the payment provider. Whether a user subscribes via the website (Stripe) or the Android app (Google Play), the entitlement check will query the same D1 database table.

### Architectural Overview

1.  **Frontend:** The React PWA will use Stripe.js for web payments. An Android version (packaged as a Trusted Web Activity or native app) will use the Google Play Billing Library.
2.  **Backend (Cloudflare Worker):**
    - Receives webhook notifications from both Stripe and Google Play.
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

### Step 1: Create Stripe Products and Prices

1.  Go to your Stripe Dashboard.
2.  Navigate to **Products** and create two new products: "Tableu Plus" and "Tableu Pro".
3.  For each product, add a recurring price. Note the **Price ID** (e.g., `price_123abc...`) for each.

### Step 2: Frontend Checkout with React & Stripe.js

1.  **Install Dependencies:**

    ```bash
    npm install @stripe/react-stripe-js @stripe/stripe-js
    ```

2.  **Create a Checkout Endpoint:** Create a new Cloudflare Pages Function that creates a Stripe Checkout Session.

    **File: `functions/api/create-checkout-session.js`**

    ```javascript
    import { Stripe } from "stripe";
    import { validateSession } from "../lib/auth"; // Your existing auth library

    export async function onRequestPost(context) {
      const { request, env } = context;
      const user = await validateSession(env.DB, request.headers.get("Cookie"));
      if (!user) {
        return new Response("Unauthorized", { status: 401 });
      }

      const { priceId } = await request.json();
      const stripe = new Stripe(env.STRIPE_SECRET_KEY);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        success_url: `${env.APP_URL}/account?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.APP_URL}/pricing`,
        customer: user.stripe_customer_id, // Associate checkout with existing customer
      });

      return new Response(JSON.stringify({ id: session.id }));
    }
    ```

3.  **Implement the Checkout Button in React:**

    ```jsx
    // src/components/PricingPage.jsx
    import { loadStripe } from "@stripe/stripe-js";

    const stripePromise = loadStripe("YOUR_STRIPE_PUBLISHABLE_KEY");

    const handleCheckout = async (priceId) => {
      const stripe = await stripePromise;
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const session = await response.json();
      await stripe.redirectToCheckout({ sessionId: session.id });
    };
    ```

### Step 3: Handle Subscriptions with Webhooks

This is the most critical part. Your backend needs to listen for events from Stripe to know when to grant, update, or revoke access.

1.  **Create the Webhook Endpoint:**

    **File: `functions/api/webhooks/stripe.js`**

    ```javascript
    import { Stripe } from "stripe";

    export async function onRequestPost(context) {
      const { request, env } = context;
      const stripe = new Stripe(env.STRIPE_SECRET_KEY);
      const signature = request.headers.get("stripe-signature");

      let event;
      try {
        const body = await request.text();
        event = stripe.webhooks.constructEvent(
          body,
          signature,
          env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
      }

      // Handle the event
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          const subscription = event.data.object;
          await updateUserSubscription(env.DB, subscription);
          break;
        case "invoice.payment_succeeded":
          // Optional: handle successful payments, e.g., grant API credits
          break;
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      return new Response(null, { status: 200 });
    }

    async function updateUserSubscription(db, subscription) {
      const tier = subscription.items.data[0].price.lookup_key; // Assumes you set lookup_keys in Stripe
      await db
        .prepare(
          "UPDATE users SET subscription_tier = ?, subscription_status = ?, subscription_provider = ? WHERE stripe_customer_id = ?"
        )
        .bind(tier, subscription.status, "stripe", subscription.customer)
        .run();
    }
    ```

2.  **Register the Webhook:**
    - Deploy your function. The URL will be `https://your-app.pages.dev/api/webhooks/stripe`.
    - In the Stripe Dashboard, go to **Developers > Webhooks**.
    - Click **Add endpoint**, enter the URL, and select the events to listen to (e.g., `customer.subscription.*`, `invoice.payment_succeeded`).
    - Get the **Webhook Signing Secret** and add it to your Cloudflare environment variables as `STRIPE_WEBHOOK_SECRET`.

## 4. Part 2: Google Play Store Integration

Since Tableu is a PWA, the recommended path for Android is to use a **Trusted Web Activity (TWA)** to wrap your existing web app. However, Google Play policy requires using Google Play Billing for digital goods. The most robust solution is to use the **Digital Goods API** in conjunction with the Play Billing API.

### Step 1: Frontend (PWA) - Digital Goods API

The Digital Goods API allows your web app (running inside the TWA) to communicate with the Google Play Billing service on the device.

1.  **Check for Service Availability:**

    ```javascript
    // In your React app
    const service = await window.getDigitalGoodsService(
      "https://play.google.com/billing"
    );
    if (!service) {
      // Digital Goods API not available. Default to Stripe flow.
      return;
    }
    ```

2.  **Fetch Product Details & Initiate Purchase:**

    ```javascript
    const skus = ["plus_tier_monthly", "pro_tier_monthly"]; // Your SKU IDs from Play Console
    const details = await service.getDetails(skus);

    const handlePurchase = async (sku) => {
      const paymentMethodData = [
        { supportedMethods: "https://play.google.com/billing", data: { sku } },
      ];
      const request = new PaymentRequest(paymentMethodData);
      const response = await request.show();
      const { purchaseToken } = response.details;

      // IMPORTANT: Send this purchaseToken to your backend for verification!
      await fetch("/api/verify-google-purchase", {
        method: "POST",
        body: JSON.stringify({ purchaseToken }),
      });

      await response.complete("success");
    };
    ```

### Step 2: Backend (Cloudflare Worker) - Verification & RTDNs

Your backend must verify the `purchaseToken` and listen for real-time notifications from Google to manage the subscription lifecycle.

1.  **Set up Google Cloud Pub/Sub for RTDNs:**

    - In your Google Cloud project, create a new Pub/Sub topic (e.g., `play-billing-notifications`).
    - In the Google Play Console, go to **Monetization > Monetization setup** and enter the topic name.
    - Create a push subscription for the topic, pointing to a new webhook endpoint in your Cloudflare Worker (e.g., `https://your-app.pages.dev/api/webhooks/google`).

2.  **Create the Google Webhook Endpoint:**

    **File: `functions/api/webhooks/google.js`**

    ```javascript
    import { google } from "googleapis";

    export async function onRequestPost(context) {
      const { request, env } = context;
      const { message } = await request.json();

      if (!message) {
        return new Response("Bad Request", { status: 400 });
      }

      const decodedData = JSON.parse(
        Buffer.from(message.data, "base64").toString("utf-8")
      );
      const { purchaseToken, notificationType } =
        decodedData.subscriptionNotification;

      // Verify the purchase token with the Google Play Developer API
      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON),
        scopes: ["https://www.googleapis.com/auth/androidpublisher"],
      });
      const publisher = google.androidpublisher({ version: "v3", auth });

      const result = await publisher.purchases.subscriptions.get({
        packageName: env.ANDROID_PACKAGE_NAME,
        subscriptionId: "YOUR_SUBSCRIPTION_ID_FROM_PLAY_CONSOLE",
        token: purchaseToken,
      });

      // Update your D1 database based on the result and notificationType
      // e.g., map notificationType (e.g., 2 for RENEWED) to your internal status
      await updateUserSubscriptionFromGoogle(env.DB, result.data);

      return new Response(null, { status: 200 });
    }
    ```

3.  **Secure the Endpoint:** Configure your Pub/Sub push subscription to use an authenticated service account to ensure only Google can call your webhook.

## 5. Conclusion

By implementing this dual-platform strategy with a unified backend, you can effectively monetize Tableu across both web and mobile while maintaining a single, manageable source of truth for user entitlements. The key is to abstract the payment provider logic into dedicated webhook handlers, allowing the core of your application to remain agnostic and scalable.

---

## References

[1] Stripe. (2025). _Receive Stripe events in your webhook endpoint_. [https://docs.stripe.com/webhooks](https://docs.stripe.com/webhooks)
[2] Google Developers. (2025). _Google Play Developer APIs_. [https://developer.android.com/google/play/developer-api](https://developer.android.com/google/play/developer-api)
[3] Google Developers. (2025). _Real-time developer notifications reference guide_. [https://developer.android.com/google/play/billing/rtdn-reference](https://developer.android.com/google/play/billing/rtdn-reference)
[4] W3C. (2025). _Digital Goods API_. [https://wicg.github.io/digital-goods/](https://wicg.github.io/digital-goods/)
