**Phase 1 Implementation Complete ✅**

Summary of Changes

| File                                        | Change                                                   |
|---------------------------------------------|----------------------------------------------------------|
| migrations/0011_add_usage_tracking.sql      | Created - Usage tracking table for monthly quotas        |
| migrations/0012_add_webhook_idempotency.sql | Created - Webhook event tracking for idempotency         |
| functions/api/keys/index.js                 | Modified - Added Pro tier gate for GET and POST          |
| functions/api/keys/[id].js                  | Modified - Allow any authed user to revoke a key         |
| functions/api/tarot-reading.js              | Modified - Added reading limit enforcement               |
| functions/api/webhooks/stripe.js            | Modified - Added idempotency check and event recording   |
| functions/lib/scheduled.js                  | Modified - Added webhook event cleanup (7-day retention) |

---

Implementation Details

1. API Key Gating (Security Fix)

- `GET /api/keys` and `POST /api/keys` require Pro entitlements (tier + active status)
- `DELETE /api/keys/:id` is allowed for any authenticated user (so downgraded users can revoke keys)
- Active statuses: `active`, `trialing`, `past_due` (grace period)
- Returns 403 with `tierLimited: true` for unauthorized users

2. Reading Limits

- Free: 5/month, Plus: 50/month, Pro: Unlimited
- Uses D1 `usage_tracking` table with calendar month (UTC)
- Fails open on DB error (doesn't block users)
- Anonymous users: enforced via KV per IP (best-effort), when `RATELIMIT` is bound
- Returns 429 with `tierLimited`, `limit`, `used`, `resetAt`

3. Webhook Idempotency

- Checks `processed_webhook_events` before processing
- Records `event.id` after successful processing
- Returns `{ received: true, duplicate: true }` for duplicates
- Fails gracefully (continues if DB check fails)

4. Scheduled Cleanup

- Deletes webhook events older than 7 days (Stripe retries for 3 days)
- Runs daily with existing archival tasks
- Handles missing table gracefully (pre-migration)

---

Deployment Steps

```bash
# 1. Apply migrations FIRST (before code deployment)
wrangler d1 execute tarot-db --remote --file=migrations/0011_add_usage_tracking.sql
wrangler d1 execute tarot-db --remote --file=migrations/0012_add_webhook_idempotency.sql

# 2. Deploy code
npm run deploy

# 3. Verify (optional)
# Test API key creation as free user - should get 403
# Test reading limit by making 6 readings as free user - 6th should get 429
```

---

Testing Checklist

| Test                               | Expected Result                |
|------------------------------------|--------------------------------|
| Free user calls POST /api/keys     | 403 with tierLimited: true     |
| Free user calls GET /api/keys      | 403 with tierLimited: true     |
| Pro user calls POST /api/keys      | 201 with API key               |
| Free user makes 6th reading        | 429 with limit: 5, used: 5     |
| Plus user makes 51st reading       | 429 with limit: 50, used: 50   |
| Pro user makes unlimited readings  | Always 200                     |
| Same Stripe webhook sent twice     | Second returns duplicate: true |

---

What's NOT in Phase 1 (Future Work)

- API key tier derivation - ✅ Phase 2 (API key auth now derives entitlements from the owning user)
- Cloud journal gating - ✅ Implemented (Phase 4)
- Spread access enforcement - ✅ Implemented (Phase 4)
- Customer Portal - ✅ Phase 3 (Stripe Billing Portal)
- Usage dashboard - ✅ Phase 3/4 (readings + TTS + API calls)

---

**Phase 2 Implementation Complete ✅**

Summary of Changes

| File                       | Change                                                                  |
|----------------------------|-------------------------------------------------------------------------|
| functions/lib/apiKeys.js   | Modified - API key validation now returns owning user subscription data |
| functions/lib/auth.js      | Modified - API key auth derives tier/status from owning user            |
| tests/auth.apiKeyTierDerivation.test.mjs | Created - Validates tier derivation + safe fallback          |

Implementation Details

- API keys no longer auto-grant Pro when used; `subscription_tier`/`subscription_status` come from the owning `users` row.
- On pre-subscription schema (missing columns), the system falls back safely (defaults to Free/Inactive).

Deployment Steps

```bash
# No migrations required for Phase 2
npm run deploy
```

---

**Phase 3 Implementation Complete ✅**

Summary of Changes

| File                                | Change                                                   |
|-------------------------------------|----------------------------------------------------------|
| functions/api/create-portal-session.js | Created - Stripe Billing Portal session endpoint        |
| functions/api/usage.js              | Created - Usage status endpoint for Account UI           |
| src/pages/AccountPage.jsx           | Modified - Added Manage Billing + usage meter UI         |
| src/worker/index.js                 | Modified - Wired Stripe + billing + usage routes         |

Implementation Details

1. Customer Portal (Stripe Billing Portal)

- Added `POST /api/create-portal-session` to create a Billing Portal session
- Account page now shows a “Manage Billing” button for paid users
- Redirects to Stripe-hosted portal; returns to `/account` after completion

2. Usage Dashboard (Account)

- Added `GET /api/usage` to fetch monthly usage from D1 `usage_tracking` (readings + TTS + API calls)
- Account page shows usage meters and reset date (rendered in UTC)
- Handles missing table gracefully (pre-migration)

Deployment Steps

```bash
# No migrations required for Phase 3
npm run deploy
```

---

**Phase 4 Implementation Complete ✅**

Summary of Changes

| File                                | Change                                                   |
|-------------------------------------|----------------------------------------------------------|
| functions/api/tarot-reading.js       | Enforced spread access + anonymous quota (KV) + atomic D1 counters |
| functions/api/journal.js            | Gated cloud journal endpoints to Plus/Pro                |
| functions/api/journal/[id].js       | Gated journal deletion to Plus/Pro                       |
| functions/api/journal-summary.js    | Gated journal summaries to Plus/Pro                      |
| functions/api/generate-question.js  | Uses effective tier/status + enforces API key call limits |
| functions/api/tts.js                | Uses effective tier/status + D1 metering for authed users + API key call limits |
| functions/api/usage.js              | Returns readings/TTS/API call usage; API key calls are metered |
| functions/api/create-checkout-session.js | Hardened redirect URLs + require session auth        |
| functions/api/create-portal-session.js   | Hardened return URL (same-origin allowlist) + session auth |
| functions/lib/entitlements.js       | Centralized tier/status normalization (effective tier)    |
| functions/lib/usageTracking.js      | Shared D1 usage helpers (atomic increment/decrement)      |
| functions/lib/apiUsage.js           | Pro API call limit enforcement (1000/mo)                  |
| functions/lib/urlSafety.js          | Redirect URL sanitization helper                          |
| functions/lib/clientId.js           | Shared IP/client identifier helper                        |
| shared/monetization/subscription.js | Shared tier config + active status semantics              |
| src/contexts/SubscriptionContext.jsx| Uses shared tier config + active statuses (`active`, `trialing`, `past_due`) |
| src/hooks/useJournal.js             | Uses local journal for Free (even when authed); supports local→cloud migration |
| src/pages/AccountPage.jsx           | Shows readings + TTS + API call usage; UTC reset display  |

Implementation Details

1. Tier/status alignment

- Frontend + backend share a single tier config (`shared/monetization/subscription.js`)
- “Active” paid access includes `active`, `trialing`, and `past_due` (grace period)
- Backend feature checks use **effective tier** (inactive paid behaves as Free for entitlements)

2. Spread + quota enforcement (backend)

- `tarot-reading` enforces spread availability by tier (Free: 3 core spreads; Plus/Pro: all 6)
- Anonymous users are limited via `RATELIMIT` KV per IP/month (best-effort)
- Authenticated users use D1 `usage_tracking` with an atomic upsert to avoid race conditions

3. Cloud journal gating

- Journal list/save/delete/summary endpoints require Plus/Pro entitlements
- Free users (even when logged in) use local journal storage and can migrate after upgrading

4. Pro API access

- API key requests require Pro entitlements and are metered at 1,000 API calls/month (D1 `usage_tracking.api_calls_count`)

Deployment Steps

```bash
# Apply migrations (if not already applied)
wrangler d1 execute tarot-db --remote --file=migrations/0011_add_usage_tracking.sql
wrangler d1 execute tarot-db --remote --file=migrations/0012_add_webhook_idempotency.sql

# Deploy
npm run deploy
```

---

**Monetization gaps (current state)**  
(Canonical reference: `docs/monetization-logic.md` — see §3 “Backend Enforcement” and §7 “Implementation Gaps”.)

- **Prompt tier differentiation is a placeholder** — no tier-based prompt depth/advanced layers (see `docs/monetization-logic.md` §7).
- **Google Play Billing is documentation-only** — no purchase verification + RTDN handling (see `docs/monetization-logic.md` §7).

---

**Comprehensive implementation plan**

1) **Decisions & specs (lock behavior before coding)**
- Define “active” entitlement rules: ✅ `active`/`trialing`/`past_due` are treated as active across frontend + backend.
- Define what “monthly” means: ✅ calendar month in UTC (D1 `usage_tracking.month`).
- Decide whether **free users must be authenticated** for quota: ✅ no; guest quota is enforced via KV per IP/month.
- Decide whether “AI Question Suggestions” is quality-gated or access-gated: ✅ quality-gated (free gets local fallback; paid gets Azure when configured).
- Decide how to handle existing free users’ cloud journal data: still a product decision (today: journal endpoints are gated to Plus/Pro; export remains available).

2) **Centralize entitlements (avoid drift)**
- ✅ Shared tier config now lives in `shared/monetization/subscription.js` and is used by both frontend + backend.
- ✅ Backend helpers in `functions/lib/entitlements.js` normalize tier/status and compute **effective tier**.

3) **Data layer (D1 migrations + minimal APIs)**
- Add `usage_tracking` and `processed_webhook_events` tables (✅ Phase 1).
- (If doing Google Play) add tables for purchase tokens / subscriptions mapping (provider, productId, expiry, status, user_id).

4) **Backend enforcement (MVP = cannot bypass via API)**
- **Reading quota**: ✅ enforced early with atomic D1 upsert + guest KV fallback.
- **Spread access**: ✅ enforced server-side by tier in `functions/api/tarot-reading.js`.
- **Cloud journal**: ✅ `journal.js`, `journal/[id].js`, and `journal-summary.js` require Plus/Pro entitlements (export remains auth-only).
- **API keys**:
  - Gate `/api/keys/*` to Pro (and active/trialing/past_due) (✅ Phase 1).
  - Fix API-key auth so entitlements derive from the owning user’s current subscription (✅ Phase 2), or enforce revocation when subscription downgrades (optional hardening).
- **API call limits**: meter per month (per user or per key, pick one), enforce `apiCallsPerMonth` for Pro, and expose a “usage status” endpoint for the UI.
- **API call limits**: ✅ enforced for API-key requests at 1,000/mo (per user) via D1 `usage_tracking.api_calls_count`.
- **TTS alignment (optional hardening)**: ✅ authenticated users are metered in D1; anonymous users still use IP-based KV.

5) **Stripe completeness**
- Add `/api/create-portal-session` and wire AccountPage to it (✅ Phase 3).
- Implement webhook idempotency using `processed_webhook_events` (✅ Phase 1).
- Expand webhook handling as needed (e.g., ensure downgrades/cancellations always converge to the correct internal state); add monitoring logs/alerts for unknown tiers/statuses.

6) **Google Play (optional phase, if shipping Android billing)**
- Implement purchase verification endpoint + RTDN webhook (`/api/webhooks/google`), map Play states to internal `subscription_status`, and keep `users` as source of truth.
- Add secure Pub/Sub push auth and environment configuration.

7) **Frontend UX & surfaces**
- Add usage meters and “reset date” to Account (✅ Phase 3 for readings; expand later for TTS/API calls).
- Handle 403/429 tier-limit errors globally with UpgradeNudge + deep link to pricing/checkout.
- Add Customer Portal button for paid users (✅ Phase 3).
- (If offering API access) build Pro-only API key management UI.

8) **Testing, rollout, and ops**
- Add unit tests for entitlement logic + usage tracking increments + webhook idempotency.
- Add API tests for: reading limit reached, spread blocked, journal blocked, API key blocked, API call limit reached.
- Roll out behind a feature flag if needed; run migrations; monitor quota errors, upgrade conversions, and webhook failure rates.
