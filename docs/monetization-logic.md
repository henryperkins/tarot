# Monetization Logic Reference

> **Generated:** 2025-12-16
> **Status:** Working implementations marked with ✅, placeholders/planned with ⏳

This document consolidates all monetization-related logic across the Tableu codebase.

---

## Table of Contents

1. [Tier Definitions](#1-tier-definitions)
2. [Database Schema](#2-database-schema)
3. [Backend Enforcement](#3-backend-enforcement)
4. [Frontend Gating](#4-frontend-gating)
5. [Stripe Integration](#5-stripe-integration)
6. [Admin Operations](#6-admin-operations)
7. [Implementation Gaps](#7-implementation-gaps)

---

## 1. Tier Definitions

### Source: `src/contexts/SubscriptionContext.jsx`

```javascript
export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Seeker',
    label: 'Free',
    monthlyReadings: 5,
    monthlyTTS: 3,
    spreads: ['single', 'threeCard', 'fiveCard'],
    cloudJournal: false,
    advancedInsights: false,
    adFree: false,
    apiAccess: false,
    aiQuestions: false,
    graphRAGDepth: 'limited'
  },
  plus: {
    name: 'Enlightened',
    label: 'Plus',
    price: 7.99,
    monthlyReadings: 50,
    monthlyTTS: 50,
    spreads: 'all',
    cloudJournal: true,
    advancedInsights: true,
    adFree: true,
    apiAccess: false,
    aiQuestions: true,
    graphRAGDepth: 'full'
  },
  pro: {
    name: 'Mystic',
    label: 'Pro',
    price: 19.99,
    monthlyReadings: Infinity,
    monthlyTTS: Infinity,
    spreads: 'all+custom',
    cloudJournal: true,
    advancedInsights: true,
    adFree: true,
    apiAccess: true,
    apiCallsPerMonth: 1000,
    aiQuestions: true,
    graphRAGDepth: 'full'
  }
};
```

### Feature Matrix

| Feature | Free | Plus ($7.99/mo) | Pro ($19.99/mo) |
|---------|------|-----------------|-----------------|
| AI Readings/month | 5 | 50 | Unlimited |
| Voice Narrations/month | 3 | 50 | Unlimited |
| Spreads | 3 core | All 6 | All + custom |
| GraphRAG Context | Limited (50%) | Full | Full |
| AI Question Suggestions | ❌ | ✅ | ✅ |
| Cloud Journal Sync | ❌ | ✅ | ✅ |
| Advanced Insights | ❌ | ✅ | ✅ |
| Ad-Free | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ (1,000 calls/mo) |
| Priority Support | ❌ | ❌ | ✅ |

---

## 2. Database Schema

### Source: `migrations/0008_add_subscriptions.sql`

```sql
-- Add subscription-related columns to the users table
ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free';
ALTER TABLE users ADD COLUMN subscription_provider TEXT; -- 'stripe', 'google_play', 'api_key'
ALTER TABLE users ADD COLUMN subscription_status TEXT;   -- 'active', 'canceled', 'past_due', etc.
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;

-- Unique index for Stripe customer lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id
  ON users(stripe_customer_id);
```

### Status Values

| Column | Values | Notes |
|--------|--------|-------|
| `subscription_tier` | `'free'`, `'plus'`, `'pro'` | Defaults to `'free'` |
| `subscription_provider` | `'stripe'`, `'google_play'`, `'api_key'`, `null` | Source of subscription |
| `subscription_status` | `'active'`, `'canceled'`, `'past_due'`, `'incomplete'`, `'unpaid'`, `'paused'`, `'expired'`, `'inactive'` | Stripe status mapping |

---

## 3. Backend Enforcement

### 3.1 TTS Rate Limiting ✅

**File:** `functions/api/tts.js:49-88, 390-445`

```javascript
/**
 * Get TTS limits based on subscription tier
 */
function getTTSLimits(tier) {
  const limits = {
    free: { monthly: 3, premium: false },
    plus: { monthly: 50, premium: true },
    pro: { monthly: Infinity, premium: true }
  };
  return limits[tier] || limits.free;
}

// In onRequestPost:
const user = await getUserFromRequest(request, env);
const tier = user?.subscription_tier || 'free';
const ttsLimits = getTTSLimits(tier);

const rateLimitResult = await enforceTtsRateLimit(env, request, ttsLimits);
if (rateLimitResult?.limited) {
  const errorMessage = rateLimitResult.tierLimited
    ? `You've reached your monthly TTS limit (${ttsLimits.monthly}). Upgrade to Plus or Pro for more.`
    : 'Too many text-to-speech requests. Please wait a few moments and try again.';

  return jsonResponse({
    error: errorMessage,
    tierLimited: rateLimitResult.tierLimited || false,
    currentTier: tier
  }, { status: 429 });
}
```

**Rate Limit Storage:** Uses `RATELIMIT` KV namespace with keys:
- Short-term: `tts-rate:{clientId}:{windowBucket}` (per-minute)
- Monthly: `tts-monthly:{clientId}:{YYYY-MM}` (35-day TTL)

---

### 3.2 AI Question Generation ✅

**File:** `functions/api/generate-question.js:14-18, 284-300`

```javascript
/**
 * Check if user has access to AI question generation.
 * Free tier users get local template fallback; paid tiers get Azure AI.
 */
function canUseAIQuestions(user) {
  if (!user) return false;
  const tier = user.subscription_tier || 'free';
  return tier === 'plus' || tier === 'pro';
}

// In onRequestPost:
const user = await getUserFromRequest(request, env);
const hasAIAccess = canUseAIQuestions(user);

// For free tier, skip Azure AI and use local template directly
if (!hasAIAccess) {
  const question = craftQuestionFromPrompt(prompt, metadata);
  return new Response(JSON.stringify({
    question,
    provider: 'local-template',
    model: null,
    forecast: null,
    tierLimited: true  // Signal to frontend
  }), { status: 200 });
}
```

**Behavior:**
- Free tier → Local deterministic template (`craftQuestionFromPrompt`)
- Plus/Pro → Azure GPT-5 AI generation with ephemeris integration when configured; otherwise falls back to local template (`provider: 'local-fallback'`)

---

### 3.3 GraphRAG Passage Limits ✅

**File:** `functions/lib/graphRAG.js:42-67`

```javascript
/**
 * Determine the number of passages to retrieve based on spread complexity
 * and subscription tier.
 *
 * Tier semantics:
 * - free  → concisely scoped context (roughly half of base passages)
 * - plus  → full base limits
 * - pro   → full base limits (future: could increase beyond base)
 */
export function getPassageCountForSpread(spreadKey, tier = 'plus') {
  const limits = {
    single: 1,        // One-card = 1 passage (focused)
    threeCard: 2,     // Simple spread = 2 passages
    fiveCard: 3,      // Medium spread = 3 passages
    celtic: 5,        // Complex spread = 5 passages
    relationship: 2,
    decision: 3,
    general: 3
  };

  const base = limits[spreadKey] || limits.general;
  const normalizedTier = tier?.toLowerCase() || 'plus';

  // Free users receive a slimmer GraphRAG block
  if (normalizedTier === 'free') {
    return Math.max(1, Math.floor(base / 2));
  }

  return base;
}
```

**Called from:** `functions/api/tarot-reading.js:1152-1155`

```javascript
const tier = options.subscriptionTier || 'free';
const maxPassages = getPassageCountForSpread(spreadKey || 'general', tier);
console.log(`[${requestId}] GraphRAG passage limit: ${maxPassages} (tier: ${tier})`);
```

---

### 3.4 API Key Authentication ✅

**File:** `functions/lib/auth.js:352-368`

```javascript
// API key path (Bearer sk_...)
if (token && token.startsWith('sk_')) {
  const apiKeyRecord = await validateApiKey(env.DB, token);
  if (apiKeyRecord) {
    // API keys are reserved for advanced / Pro-style integrations.
    // Treat them as having an active "pro"-level subscription.
    return {
      id: apiKeyRecord.user_id,
      email: apiKeyRecord.email,
      username: apiKeyRecord.username,
      subscription_tier: 'pro',          // Auto-granted Pro
      subscription_status: 'active',
      subscription_provider: 'api_key',
      stripe_customer_id: null
    };
  }
}
```

---

### 3.5 Reading Limits ⏳ NOT IMPLEMENTED

**Location:** `functions/api/tarot-reading.js`

**Current state:** Logs tier but does NOT enforce monthly reading limits.

```javascript
// Line 517-520 - Logs tier only, no enforcement
const user = await getUserFromRequest(request, env);
const subscriptionTier = user?.subscription_tier || 'free';
console.log(`[${requestId}] User subscription tier: ${subscriptionTier}`);
```

**Required implementation:**
```javascript
// Suggested implementation
async function enforceReadingLimit(env, user) {
  if (!user) return { allowed: true }; // Anonymous users handled separately

  const tier = user.subscription_tier || 'free';
  const limits = { free: 5, plus: 50, pro: Infinity };
  const monthlyLimit = limits[tier];

  if (monthlyLimit === Infinity) return { allowed: true };

  const now = new Date();
  const monthKey = `readings:${user.id}:${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const count = parseInt(await env.RATELIMIT.get(monthKey) || '0');

  if (count >= monthlyLimit) {
    return {
      allowed: false,
      tierLimited: true,
      currentCount: count,
      limit: monthlyLimit
    };
  }

  await env.RATELIMIT.put(monthKey, String(count + 1), { expirationTtl: 35 * 24 * 60 * 60 });
  return { allowed: true };
}
```

---

### 3.6 Spread Access ⏳ NOT IMPLEMENTED

**Frontend definition:** `src/contexts/SubscriptionContext.jsx:105-110`

```javascript
// Helper to check if a spread is available
canUseSpread: (spreadKey) => {
  if (tierConfig.spreads === 'all' || tierConfig.spreads === 'all+custom') {
    return true;
  }
  return Array.isArray(tierConfig.spreads) && tierConfig.spreads.includes(spreadKey);
}
```

**Backend enforcement:** MISSING - would need to be added to `tarot-reading.js`

---

## 4. Frontend Gating

### 4.1 Subscription Context ✅

**File:** `src/contexts/SubscriptionContext.jsx`

```javascript
export function SubscriptionProvider({ children }) {
  const { user } = useAuth();

  const subscription = useMemo(() => {
    const tier = user?.subscription_tier || 'free';
    const status = user?.subscription_status || 'inactive';
    const tierConfig = SUBSCRIPTION_TIERS[tier] || SUBSCRIPTION_TIERS.free;
    const isActive = status === 'active' || tier === 'free';
    const isPaid = tier === 'plus' || tier === 'pro';

    return {
      tier,
      status,
      isActive,
      isPaid,
      config: tierConfig,

      // Feature checks
      canUseAIQuestions: isPaid && isActive,
      canUseTTS: true, // All tiers can use TTS, just with limits
      canUseCloudJournal: isPaid && isActive,
      canUseAdvancedInsights: isPaid && isActive,
      canUseAPI: tier === 'pro' && isActive,
      hasAdFreeExperience: isPaid && isActive,

      // Limits
      monthlyReadingsLimit: tierConfig.monthlyReadings,
      monthlyTTSLimit: tierConfig.monthlyTTS,
      graphRAGDepth: tierConfig.graphRAGDepth,

      // Spread access helper
      canUseSpread: (spreadKey) => {
        if (tierConfig.spreads === 'all' || tierConfig.spreads === 'all+custom') {
          return true;
        }
        return Array.isArray(tierConfig.spreads) && tierConfig.spreads.includes(spreadKey);
      }
    };
  }, [user]);
  // ...
}
```

### 4.2 Feature Gate Hook ✅

**File:** `src/contexts/SubscriptionContext.jsx:168-200`

```javascript
export function useFeatureGate(feature) {
  const { subscription, isAuthenticated } = useSubscription();

  const featureRequirements = {
    aiQuestions: { requiredTier: 'plus', message: 'AI-powered question suggestions' },
    cloudJournal: { requiredTier: 'plus', message: 'Cloud journal sync & backup' },
    advancedInsights: { requiredTier: 'plus', message: 'Advanced reading insights' },
    unlimitedReadings: { requiredTier: 'pro', message: 'Unlimited AI readings' },
    unlimitedTTS: { requiredTier: 'pro', message: 'Unlimited text-to-speech' },
    apiAccess: { requiredTier: 'pro', message: 'API access for developers' },
    customSpreads: { requiredTier: 'pro', message: 'Custom spread layouts' }
  };

  const requirement = featureRequirements[feature];
  // Returns { allowed, requiredTier, upgradeMessage, isAuthenticated }
}
```

### 4.3 UpgradeNudge Component ✅

**File:** `src/components/UpgradeNudge.jsx`

Three variants: `inline`, `banner`, `modal`

```jsx
// Inline usage
<UpgradeNudge
  feature="AI Questions"
  requiredTier="plus"
  variant="inline"
/>

// Feature gate wrapper
<FeatureGate feature="cloudJournal" requiredTier="plus">
  <JournalSyncPanel />
</FeatureGate>
```

### 4.4 Components Using Subscription Context

| Component | Usage |
|-----------|-------|
| `UserMenu.jsx` | Shows tier badge, upgrade link |
| `AccountPage.jsx` | Displays current plan, features list |
| `PricingPage.jsx` | Tier comparison, checkout flow |
| `UpgradeNudge.jsx` | Feature gating UI |

---

## 5. Stripe Integration

### 5.1 Checkout Session Creation ✅

**File:** `functions/api/create-checkout-session.js`

```javascript
export async function onRequestPost(context) {
  const { request, env } = context;

  // Authenticate user
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
  }

  const { tier } = await request.json();

  // Get or create Stripe customer
  const customerId = await getOrCreateCustomer(env.DB, user, env.STRIPE_SECRET_KEY);

  // Create Checkout Session
  const session = await stripeRequest('/checkout/sessions', 'POST', {
    'customer': customerId,
    'mode': 'subscription',
    'payment_method_types[0]': 'card',
    'line_items[0][price]': env[`STRIPE_PRICE_ID_${tier.toUpperCase()}`],
    'line_items[0][quantity]': '1',
    'success_url': `${env.APP_URL}/account?session_id={CHECKOUT_SESSION_ID}`,
    'cancel_url': `${env.APP_URL}/pricing`,
    'subscription_data[metadata][user_id]': user.id,
    'subscription_data[metadata][tier]': tier,
    'allow_promotion_codes': 'true',
    'billing_address_collection': 'auto',
  }, env.STRIPE_SECRET_KEY);

  return new Response(JSON.stringify({ sessionId: session.id, url: session.url }));
}
```

### 5.2 Webhook Handler ✅

**File:** `functions/api/webhooks/stripe.js`

```javascript
// Signature verification with replay attack prevention
async function verifyStripeSignature(payload, signature, secret) {
  // HMAC-SHA256 verification
  // 5-minute timestamp window for replay prevention
}

// Status mapping
function mapSubscriptionStatus(stripeStatus) {
  const statusMap = {
    'active': 'active',
    'trialing': 'active',
    'past_due': 'past_due',
    'canceled': 'canceled',
    'unpaid': 'unpaid',
    'incomplete': 'incomplete',
    'incomplete_expired': 'expired',
    'paused': 'paused'
  };
  return statusMap[stripeStatus] || 'inactive';
}

// Tier extraction with fallback hierarchy
function extractTierFromSubscription(subscription) {
  // 1. Subscription metadata
  if (subscription.metadata?.tier) return subscription.metadata.tier;

  // 2. Price lookup_key
  const lookupKey = subscription.items?.data?.[0]?.price?.lookup_key;
  if (lookupKey?.includes('pro')) return 'pro';
  if (lookupKey?.includes('plus')) return 'plus';

  // 3. Price metadata
  if (item?.price?.metadata?.tier) return item.price.metadata.tier;

  // 4. Amount-based fallback
  const amount = item?.price?.unit_amount;
  if (amount >= 1500) return 'pro';  // $15+
  if (amount >= 500) return 'plus';   // $5+

  return 'plus'; // Default
}

// Handled events
switch (event.type) {
  case 'customer.subscription.created':
  case 'customer.subscription.updated':
    await updateUserSubscription(env.DB, customerId, subscription);
    break;
  case 'customer.subscription.deleted':
    await handleSubscriptionCanceled(env.DB, customerId);
    break;
  case 'invoice.payment_succeeded':
  case 'invoice.payment_failed':
  case 'customer.subscription.trial_will_end':
    // Logged for analytics
    break;
}
```

### 5.3 Required Secrets

```bash
wrangler secret put STRIPE_SECRET_KEY        # sk_test_... or sk_live_...
wrangler secret put STRIPE_WEBHOOK_SECRET    # whsec_...
wrangler secret put STRIPE_PRICE_ID_PLUS     # price_...
wrangler secret put STRIPE_PRICE_ID_PRO      # price_...
```

### 5.4 Customer Portal ⏳ NOT IMPLEMENTED

**Location:** `src/pages/AccountPage.jsx:337`

```jsx
{/* TODO: Add Stripe Customer Portal link when available */}
```

**Required implementation:**
```javascript
// functions/api/create-portal-session.js
export async function onRequestPost({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user?.stripe_customer_id) {
    return new Response(JSON.stringify({ error: 'No subscription found' }), { status: 400 });
  }

  const session = await stripeRequest('/billing_portal/sessions', 'POST', {
    customer: user.stripe_customer_id,
    return_url: `${env.APP_URL}/account`
  }, env.STRIPE_SECRET_KEY);

  return new Response(JSON.stringify({ url: session.url }));
}
```

---

## 6. Admin Operations

### 6.1 Admin API Key Authentication

**File:** `functions/lib/scheduled.js:260-264`

```javascript
const adminKey = env.ADMIN_API_KEY;
if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
  return new Response('Unauthorized', { status: 401 });
}
```

### 6.2 Protected Admin Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/admin/archive` | Manual KV→R2 archival trigger |
| `GET/POST /api/coach-extraction-backfill` | AI extraction backfill for coach suggestions |

---

## 7. Implementation Gaps

### High Priority (P0)

| Feature | Frontend | Backend | Notes |
|---------|----------|---------|-------|
| Reading limits | ✅ Defined | ❌ Missing | Add monthly counter to tarot-reading.js |
| Usage tracking table | N/A | ❌ Missing | Need migration for `usage_tracking` |

### Medium Priority (P1)

| Feature | Frontend | Backend | Notes |
|---------|----------|---------|-------|
| Stripe Customer Portal | ⏳ TODO | ❌ Missing | Add portal session endpoint |
| Spread access enforcement | ✅ `canUseSpread()` | ❌ Missing | Add to tarot-reading.js |
| Webhook idempotency | N/A | ❌ Missing | Track processed event IDs |

### Low Priority (P2)

| Feature | Status | Notes |
|---------|--------|-------|
| Google Play Billing | ❌ Documented only | See `docs/enhanced-monetization.md` |
| Usage dashboard | ❌ Not started | API usage for Pro tier |
| Prompt tier differentiation | ⏳ Placeholder | Different prompt depth per tier |

### Suggested Usage Tracking Migration

```sql
-- migrations/00XX_add_usage_tracking.sql
CREATE TABLE IF NOT EXISTS usage_tracking (
  user_id TEXT NOT NULL,
  month TEXT NOT NULL,            -- '2025-12'
  readings_count INTEGER DEFAULT 0,
  tts_count INTEGER DEFAULT 0,
  api_calls_count INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, month),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_usage_month ON usage_tracking(month);
```

---

## Appendix: File Reference

| File | Contains |
|------|----------|
| `src/contexts/SubscriptionContext.jsx` | Tier definitions, feature flags, hooks |
| `src/components/UpgradeNudge.jsx` | Upgrade UI components |
| `src/pages/PricingPage.jsx` | Pricing page with Stripe checkout |
| `src/pages/AccountPage.jsx` | Account management UI |
| `functions/api/create-checkout-session.js` | Stripe checkout session creation |
| `functions/api/webhooks/stripe.js` | Stripe webhook handler |
| `functions/api/tts.js` | TTS with tier-based rate limiting |
| `functions/api/generate-question.js` | AI questions with tier gating |
| `functions/api/tarot-reading.js` | Main reading endpoint (tier logging, GraphRAG limits) |
| `functions/lib/auth.js` | Session validation with subscription metadata |
| `functions/lib/graphRAG.js` | Tier-based passage limits |
| `migrations/0008_add_subscriptions.sql` | Subscription schema |
| `docs/enhanced-monetization.md` | Strategy documentation |
