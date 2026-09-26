# Monetization Logic Reference

Type: reference
Status: active reference
Last reviewed: 2026-09-25

This document consolidates the monetization behavior implemented in the current Tableu codebase.

It is the canonical reference for implemented monetization behavior. For rollout sequencing and open work, see `./monetization-gaps-and-plan.md`.

See `./monetization-gaps-and-plan.md` for rollout notes and backlog context.

> Note: Avoid referencing this document by line number; prefer section headings (for example, “3.5 Reading Limits”). File line ranges in this doc are approximate and may drift.

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

### Source: `shared/monetization/subscription.js`

```javascript
export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Seeker',
    label: 'Free',
    trialDays: 0,
    annual: null,
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
    trialDays: 0,
    annual: 79.99,
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
    trialDays: 0,
    annual: 199.99,
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

`all+custom` is retained as a runtime compatibility label. The shipped user catalog contains six built-in spreads; custom spread creation is not a shipped user feature.

### Feature Matrix

| Feature | Free | Plus ($7.99/mo) | Pro ($19.99/mo) |
|---------|------|-----------------|-----------------|
| AI Readings/month | 5 | 50 | Unlimited |
| Voice Narrations/month | 3 | 50 | Unlimited |
| Spreads | 3 core | All 6 built-in | All 6 built-in (custom not shipped) |
| GraphRAG Context | Reduced (min 1; roughly half of base passages) | Full | Full |
| AI Question Suggestions | ❌ | ✅ | ✅ |
| Cloud Journal Sync | ❌ (local journal) | ✅ | ✅ |
| Server journal export | ❌ (local export available) | ✅ | ✅ |
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
| `subscription_status` | `'active'`, `'trialing'`, `'canceled'`, `'past_due'`, `'incomplete'`, `'unpaid'`, `'paused'`, `'expired'`, `'inactive'` | Stored status mapping; `trialing` retains paid access |

### Usage Tracking ✅

**Source:** `migrations/0011_add_usage_tracking.sql`

- Table: `usage_tracking` (primary key: `user_id`, `month`)
- Month format: `YYYY-MM` (UTC calendar month)
- Used for: monthly quota enforcement and the shipped Account usage meters (readings, authenticated TTS, Pro API calls)

### Processed Webhook Events ✅

**Source:** `migrations/0012_add_webhook_idempotency.sql`

- Table: `processed_webhook_events` (primary key: `provider`, `event_id`)
- Used for: Stripe webhook idempotency + duplicate suppression
- Retention: scheduled cleanup deletes events older than 7 days (`functions/lib/scheduled.js`)

---

## 3. Backend Enforcement

> Note: Backend and frontend gating now share an “effective tier” concept: inactive paid subscriptions behave as Free for entitlements. Active paid statuses include `active`, `trialing`, and `past_due` (grace period). Ensure Stripe webhook status mapping stays aligned with these semantics.

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
const subscription = getSubscriptionContext(user);
const tier = subscription.effectiveTier;
const ttsLimits = getTTSLimits(tier);

const rateLimitResult = await enforceTtsRateLimit(env, request, user, ttsLimits);
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

**Rate Limit Storage:**
- Short-term: `RATELIMIT` KV (`tts-rate:{clientId}:{windowBucket}`), per-minute, per IP.
- Monthly:
  - Authenticated users: D1 `usage_tracking.tts_count` (per user, UTC month).
  - Anonymous fallback: `RATELIMIT` KV (`tts-monthly:{clientId}:{YYYY-MM}`), per IP, UTC month.

---

### 3.2 AI Question Generation ✅

**File:** `functions/api/generate-question.js:14-18, 284-300`

```javascript
// In onRequestPost:
const user = await getUserFromRequest(request, env);
const subscription = getSubscriptionContext(user);
const hasAIAccess = subscription.effectiveTier === 'plus' || subscription.effectiveTier === 'pro';

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
- Free tier → deterministic local template (`craftQuestionFromPrompt`, `provider: 'local-template'`).
- Plus/Pro → native OpenAI Responses when `OPENAI_API_KEY` is configured (`provider: 'openai-native'`), otherwise Azure Responses when the Azure configuration is present (`provider: 'azure-gpt5'`).
- Paid generation falls back to the deterministic local generator when no provider is configured or the provider call fails (`provider: 'local-fallback'`).

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
      return {
        id: apiKeyRecord.user_id,
        email: apiKeyRecord.email,
        username: apiKeyRecord.username,
        subscription_tier: apiKeyRecord.subscription_tier || 'free',
        subscription_status: apiKeyRecord.subscription_status || 'inactive',
        subscription_provider: apiKeyRecord.subscription_provider || null,
        stripe_customer_id: apiKeyRecord.stripe_customer_id || null,
        auth_provider: 'api_key' // other providers: google, apple, session
      };
    }
}
```

**Security note (Phase 2):** API keys no longer auto-grant Pro. Entitlements derive from the owning user’s current subscription tier/status, so a downgraded/canceled user cannot keep Pro access via a previously minted key.

---

### 3.5 Reading Limits ✅

**File:** `functions/api/tarot-reading.js`

**Behavior (Phase 1):**
- Free: 5/month, Plus: 50/month, Pro: unlimited
- Enforcement uses D1 `usage_tracking` with calendar month (UTC) keyed by `(user_id, YYYY-MM)`
- Anonymous users are enforced via KV (`RATELIMIT`) per IP/month when available (best-effort)
- On limit exceeded: returns 429 with `tierLimited`, `currentTier`, `limit`, `used`, `resetAt`
- On D1 tracking errors: interactive users fail open and the request is allowed; API keys and service tokens fail closed with a retry response so machine traffic cannot become unmetered.

```javascript
const readingLimitResult = await enforceReadingLimit(env, request, user, subscription, requestId);
if (!readingLimitResult.allowed) {
  return jsonResponse({
    error: readingLimitResult.message,
    tierLimited: true,
    currentTier: subscriptionTier,
    accountTier: subscription.tier,
    currentStatus: subscription.status,
    limit: readingLimitResult.limit,
    used: readingLimitResult.used,
    resetAt: readingLimitResult.resetAt
  }, { status: 429 });
}
```

---

### 3.6 Spread Access ✅

**Frontend definition:** `src/contexts/SubscriptionContext.jsx`

```javascript
// Helper to check if a spread is available
canUseSpread: (spreadKey) => {
  if (tierConfig.spreads === 'all' || tierConfig.spreads === 'all+custom') {
    return true;
  }
  return Array.isArray(tierConfig.spreads) && tierConfig.spreads.includes(spreadKey);
}
```

**Backend enforcement:** `functions/api/tarot-reading.js`

- Requests for the six built-in spreads are validated against the known catalog and enforced server-side based on the user’s effective tier:
  - Free: `single`, `threeCard`, `fiveCard`
  - Plus/Pro: all 6 built-in spreads (adds `relationship`, `decision`, `celtic`)
- An explicit `custom` key remains a backend compatibility path, but custom spread creation is not a shipped user-facing feature.

---

### 3.7 Cloud Journal Sync ✅ ENFORCED

**Files:** `functions/api/journal.js`, `functions/api/journal/[id].js`, `functions/api/journal-summary.js`

**Current state:** Journal list/save/delete/summary endpoints require Plus/Pro entitlements (effective tier).

**Notes:**
- Frontend (`src/hooks/useJournal.js`) uses local journal storage for Free users (even when authenticated) and supports local→cloud migration after upgrading.
- Server export (`functions/api/journal-export/index.js`) requires an effective Plus/Pro entitlement.
- Free users retain client-side local journal exports (`src/lib/journalInsights.js` and `src/lib/pdfExport.js`); those exports do not use the server export endpoint.

---

### 3.8 API Key Issuance ✅

**Files:** `functions/api/keys/index.js`, `functions/api/keys/[id].js`

**Current state:**
- `GET /api/keys` and `POST /api/keys` require Pro entitlements (`active`/`trialing`/`past_due`).
- `DELETE /api/keys/:id` is allowed for any authenticated user (cleanup after downgrade).
- API key usage is Pro-only and metered at 1,000 calls/month (D1 `usage_tracking.api_calls_count`).

**List/create behavior (Phase 1):**
- Requires authenticated session
- Requires `subscription_tier === 'pro'` and `subscription_status` in `['active', 'trialing', 'past_due']`
- Unauthorized: 403 with `tierLimited: true` and `requiredTier: 'pro'`

---

## 4. Frontend Gating

### 4.1 Subscription Context ✅

**File:** `src/contexts/SubscriptionContext.jsx`

```javascript
export function SubscriptionProvider({ children }) {
  const { user } = useAuth();

  const subscription = useMemo(() => {
    const tier = normalizeTier(user?.subscription_tier);
    const status = normalizeStatus(user?.subscription_status);
    const effectiveTier = getEffectiveTier({ tier, status });
    const tierConfig = getTierConfig(effectiveTier);
    const isActive = isSubscriptionActive({ tier, status });

    return {
      tier,
      status,
      effectiveTier,
      isActive,
      config: tierConfig,

      // Feature checks
      canUseAIQuestions: hasTierAtLeast(effectiveTier, 'plus'),
      canUseTTS: true, // All tiers can use TTS, just with limits
      canUseCloudJournal: hasTierAtLeast(effectiveTier, 'plus'),
      canUseAdvancedInsights: hasTierAtLeast(effectiveTier, 'plus'),
      canUseAPI: effectiveTier === 'pro',
      hasAdFreeExperience: hasTierAtLeast(effectiveTier, 'plus'),

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

`customSpreads` remains a compatibility-only feature-gate entry in code; no user-facing custom spread builder is shipped.

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
| `AccountPage.jsx` | Displays current plan, usage meter, billing portal link |
| `PricingPage.jsx` | Tier comparison, checkout flow |
| `UpgradeNudge.jsx` | Feature gating UI |

---

## 5. Stripe Integration

### 5.1 Checkout Session Creation ✅

**File:** `functions/api/create-checkout-session.js`

```javascript
const body = await readJsonBody(request);
const { tier, interval = 'monthly', successUrl, cancelUrl } = body;
const priceIdEnvKey = interval === 'annual'
  ? (tier === 'plus' ? 'STRIPE_PRICE_ID_PLUS_ANNUAL' : 'STRIPE_PRICE_ID_PRO_ANNUAL')
  : (tier === 'plus' ? 'STRIPE_PRICE_ID_PLUS' : 'STRIPE_PRICE_ID_PRO');

if (user.stripe_customer_id) {
  const subscription = await fetchLatestStripeSubscription(user.stripe_customer_id, env.STRIPE_SECRET_KEY);
  if (subscription && isActive(mapStatus(subscription.status))) {
    const portalSession = await callStripe('/billing_portal/sessions', 'POST', {
      customer: user.stripe_customer_id,
      return_url: sanitizeUrl(cancelUrl, request, env, '/account')
    }, env.STRIPE_SECRET_KEY);
    return toJson({ url: portalSession.url, flow: 'portal' });
  }
}

const priceId = env[priceIdEnvKey];
const session = await callStripe('/checkout/sessions', 'POST', {
  customer: await getOrCreateCustomer(env.DB, user, env.STRIPE_SECRET_KEY, callStripe),
  mode: 'subscription',
  'line_items[0][price]': priceId,
  'line_items[0][quantity]': '1',
  'success_url': sanitizeUrl(successUrl, request, env, '/account'),
  'cancel_url': sanitizeUrl(cancelUrl, request, env, '/pricing')
}, env.STRIPE_SECRET_KEY);

return toJson({ sessionId: session.id, url: session.url });
```

The endpoint accepts only `plus`/`pro` and `monthly`/`annual`; active Stripe customers are routed to the Billing Portal instead of receiving a second checkout session. Machine credentials cannot create checkout or portal sessions.

### 5.2 Webhook Handler ✅

**File:** `functions/api/webhooks/stripe.js`

**Idempotency (claim-first):**
- The handler verifies the Stripe signature and parses the event before claiming it.
- It atomically claims `(provider='stripe', event_id=event.id)` with `INSERT OR IGNORE` before handling the event.
- A duplicate claim returns `{ received: true, duplicate: true }`.
- If handling fails after a claim, the handler deletes the claim and returns 500 so Stripe can retry.
- If the claim query itself fails, the handler logs the error and continues; this avoids silently dropping a webhook.

```javascript
const claim = await env.DB.prepare(`
  INSERT OR IGNORE INTO processed_webhook_events
  (provider, event_id, event_type, processed_at)
  VALUES (?, ?, ?, ?)
`).bind('stripe', event.id, event.type, Date.now()).run();

if (claim.meta.changes === 0) {
  return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
}
```

`mapStripeStatus` preserves `trialing` as an active status. `extractTierFromSubscription` checks price lookup keys, price metadata, interval-aware amount thresholds, and only then legacy subscription metadata, so monthly/annual and portal changes converge correctly.

### 5.3 Required Secrets

```bash
wrangler secret put STRIPE_SECRET_KEY             # sk_test_... or sk_live_...
wrangler secret put STRIPE_WEBHOOK_SECRET         # whsec_...
wrangler secret put STRIPE_PRICE_ID_PLUS          # Plus monthly price_...
wrangler secret put STRIPE_PRICE_ID_PLUS_ANNUAL   # Plus annual price_...
wrangler secret put STRIPE_PRICE_ID_PRO           # Pro monthly price_...
wrangler secret put STRIPE_PRICE_ID_PRO_ANNUAL    # Pro annual price_...
```

### 5.4 Customer Portal ✅

**Backend:** `functions/api/create-portal-session.js`

- `POST /api/create-portal-session` returns `{ url }` for a Stripe Billing Portal session
- Requires an authenticated interactive user with `stripe_customer_id`
- Checkout also routes an already-active Stripe subscription to the portal instead of creating another subscription

**Frontend:** `src/pages/AccountPage.jsx`

- Paid users see a “Manage Billing” button that opens the Stripe-hosted portal and returns to `/account`

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
| `POST /api/admin/archive` | Manual KV→D1 archival trigger |
| `GET/POST /api/coach-extraction-backfill` | AI extraction backfill for coach suggestions |

### 6.3 Scheduled Maintenance ✅

**File:** `functions/lib/scheduled.js`

- Deletes expired sessions from D1 (daily)
- Deletes Stripe webhook events older than 7 days from `processed_webhook_events` (daily; handles missing table gracefully pre-migration)

---

## 7. Implementation Gaps

### High Priority (P0)

| Feature | Frontend | Backend | Notes |
|---------|----------|---------|-------|
| Anonymous reading quota | N/A | ✅ Implemented | Enforced via `RATELIMIT` KV per IP/month (best-effort) |

### Medium Priority (P1)

| Feature | Frontend | Backend | Notes |
|---------|----------|---------|-------|
| Cloud Journal sync | ✅ Defined | ✅ Implemented | Journal list/save/delete/summary require Plus/Pro entitlements |
| API call limits | ✅ Defined (Pro: 1,000/mo) | ✅ Implemented | Metered for API-key requests via D1 `usage_tracking.api_calls_count` |
| Spread access enforcement | ✅ Defined | ✅ Implemented | Enforced server-side in `functions/api/tarot-reading.js` |
| Usage tracking for TTS/API calls | ✅ Defined | ✅ Implemented | Authenticated users are metered in D1; anonymous TTS uses KV |

### Low Priority (P2)

| Feature | Status | Notes |
|---------|--------|-------|
| Google Play Billing | ❌ Documented only | See `./enhanced-monetization.md` |
| Usage dashboard | ✅ Shipped | Account shows readings, authenticated TTS, and API calls; historical charts remain optional |
| Custom spread builder | ❌ Not shipped | The `custom` backend path is compatibility-only |
| Prompt tier differentiation | ⏳ Placeholder | Different prompt depth per tier |

### Implemented D1 migrations ✅

- `migrations/0011_add_usage_tracking.sql`
- `migrations/0012_add_webhook_idempotency.sql`

---

## Appendix: File Reference

| File | Contains |
|------|----------|
| `shared/monetization/subscription.js` | Canonical tier config + active status semantics |
| `src/contexts/SubscriptionContext.jsx` | Frontend tier helpers (effective tier) |
| `src/components/UpgradeNudge.jsx` | Upgrade UI components |
| `src/pages/PricingPage.jsx` | Pricing page with Stripe checkout |
| `src/pages/AccountPage.jsx` | Account management UI |
| `functions/api/create-checkout-session.js` | Stripe checkout session creation |
| `functions/api/create-portal-session.js` | Stripe Billing Portal session creation |
| `functions/api/webhooks/stripe.js` | Stripe webhook handler |
| `functions/api/usage.js` | Usage status endpoint (readings/TTS/API calls) |
| `functions/api/tts.js` | TTS with tier-based rate limiting |
| `functions/api/generate-question.js` | AI questions with tier gating |
| `functions/api/tarot-reading.js` | Main reading endpoint (tier logging, GraphRAG limits) |
| `functions/api/journal.js` | Cloud journal API (Plus/Pro-gated) |
| `functions/api/keys/index.js` | API key list/create |
| `functions/api/keys/[id].js` | API key revoke |
| `functions/lib/auth.js` | Session validation with subscription metadata |
| `functions/lib/entitlements.js` | Backend entitlement helpers (effective tier) |
| `functions/lib/usageTracking.js` | D1 usage counter helpers |
| `functions/lib/apiUsage.js` | Pro API call limit enforcement |
| `functions/lib/graphRAG.js` | Tier-based passage limits |
| `migrations/0004_add_api_keys.sql` | API key schema |
| `migrations/0008_add_subscriptions.sql` | Subscription schema |
| `migrations/0011_add_usage_tracking.sql` | Usage tracking schema |
| `migrations/0012_add_webhook_idempotency.sql` | Webhook idempotency schema |
| `docs/monetization/enhanced-monetization.md` | Platform expansion strategy |
