# Tarot Reading API Fixes Plan

## Executive Summary

This plan addresses several issues identified in `functions/api/tarot-reading.js` and related files:

1. **Critical Bug**: Reading reservation leakage on 503 backend failure
2. **Minor Issue**: Hardcoded spread tier messaging (fragile but correct)
3. **Privacy Risk**: Telemetry PII leakage in enhancement sections
4. **Design Decision**: Crisis check behavior documentation needed

---

## Issue 1: Reading Reservation Leakage (Critical)

### Problem

When all narrative backends fail, the function returns a 503 response **without releasing the reading reservation**. This causes users to lose a monthly reading even though they received nothing.

### Code Location

[`functions/api/tarot-reading.js`](../functions/api/tarot-reading.js:957-962)

```javascript
if (!reading) {
  console.error(`[${requestId}] All narrative backends failed.`, backendErrors);
  return jsonResponse(
    { error: 'All narrative providers are currently unavailable. Please try again shortly.' },
    { status: 503 }
  );
}
```

### Root Cause

- `readingReservation` is set at line 726 after [`enforceReadingLimit()`](../functions/api/tarot-reading.js:711) passes
- [`releaseReadingReservation()`](../functions/api/tarot-reading.js:94) is **only called in the catch block** at line 1185
- The 503 return is a normal return (not a throw), so the catch doesn't execute

### Impact

- Users are charged a reading against their monthly limit
- They receive no actual reading (only an error message)
- They cannot retry without losing another reading slot

### Fix

Add `releaseReadingReservation()` call before the 503 return:

```javascript
if (!reading) {
  console.error(`[${requestId}] All narrative backends failed.`, backendErrors);
  // Release reservation - user shouldn't be charged for infrastructure failure
  await releaseReadingReservation(env, readingReservation);
  return jsonResponse(
    { error: 'All narrative providers are currently unavailable. Please try again shortly.' },
    { status: 503 }
  );
}
```

### Security Consideration

Refunding on failure opens a potential attack vector where an attacker could:
1. Intentionally trigger backend failures
2. Get free attempts without being counted

**Mitigation**: Only refund on clear infrastructure failures (503), NOT on:
- Safety gate blocks (crisis detection)
- Evaluation gate blocks
- Quality gate failures

The current code structure already handles this correctly because:
- Crisis check returns a safe-fallback reading (not an error) - line 793
- Evaluation gate blocked readings return a safe-fallback (not an error) - line 1040

---

## Issue 2: Spread Tier Messaging (Minor - Fragile)

### Problem

The `requiredTier` message is hardcoded rather than computed from tier configuration:

```javascript
const requiredTier = ['relationship', 'decision', 'celtic'].includes(requestedSpreadKey) ? 'plus' : 'pro';
```

### Current Tier Configuration

From [`shared/monetization/subscription.js`](../shared/monetization/subscription.js:1-44):

| Tier | Spreads Config | Spreads Available |
|------|---------------|-------------------|
| free | `['single', 'threeCard', 'fiveCard']` | single, threeCard, fiveCard |
| plus | `'all'` | All predefined spreads (includes relationship, decision, celtic) |
| pro | `'all+custom'` | All spreads + custom spreads |

### Current State: CORRECT but FRAGILE

The hardcoded logic **is currently correct**:
- `relationship`, `decision`, `celtic` → requires `plus`
- Any other denied spread → would be custom → requires `pro`

But it's fragile because:
1. If new spreads are added to `SPREAD_NAME_MAP`, the message won't auto-update
2. If tier configs change, the logic won't adapt

### Recommended Fix

Compute `requiredTier` dynamically:

```javascript
function computeRequiredTierForSpread(spreadKey) {
  const { SUBSCRIPTION_TIERS, TIER_ORDER } = await import('../../shared/monetization/subscription.js');
  
  // Find the lowest tier that includes this spread
  const tiers = ['free', 'plus', 'pro'];
  for (const tier of tiers) {
    const config = SUBSCRIPTION_TIERS[tier];
    const spreadsConfig = config?.spreads;
    
    if (spreadsConfig === 'all' || spreadsConfig === 'all+custom') {
      return tier;
    }
    if (Array.isArray(spreadsConfig) && spreadsConfig.includes(spreadKey)) {
      return tier;
    }
  }
  
  // Default to pro (for custom spreads or unknown)
  return 'pro';
}
```

### Priority: Low

The current code works correctly. This is a maintainability improvement, not a bug fix.

---

## Issue 3: Telemetry PII Leakage (Privacy Risk)

### Problem

Enhancement section text is stored in metrics **without PII redaction**:

```javascript
const enhancementSections = (narrativePayload.narrativeEnhancements || []).map((section, index) => ({
  name: section?.metadata?.name || section?.metadata?.type || `section-${index + 1}`,
  type: section?.metadata?.type || null,
  text: trimForTelemetry(section?.text, 500),  // NOT REDACTED!
  validation: section?.validation || null
}));
```

This is then stored in `metricsPayload` at line 987 and persisted to `METRICS_DB` at line 1131.

### Impact

Generated narratives may contain:
- User-provided reflections embedded in the reading
- User's display name (personalized readings)
- User's question context
- Any PII mentioned in user input that gets reflected in output

### Fix Options

**Option A: Apply PII redaction (Recommended)**

```javascript
import { redactPII } from '../lib/promptEngineering.js';

const enhancementSections = (narrativePayload.narrativeEnhancements || []).map((section, index) => ({
  name: section?.metadata?.name || section?.metadata?.type || `section-${index + 1}`,
  type: section?.metadata?.type || null,
  text: redactPII(trimForTelemetry(section?.text, 500), {
    displayName: personalization?.displayName
  }),
  validation: section?.validation || null
}));
```

**Option B: Strip text entirely, keep only metadata**

```javascript
const enhancementSections = (narrativePayload.narrativeEnhancements || []).map((section, index) => ({
  name: section?.metadata?.name || section?.metadata?.type || `section-${index + 1}`,
  type: section?.metadata?.type || null,
  textLength: section?.text?.length || 0,
  textHash: await fingerprint(section?.text || ''),  // For deduplication without content
  validation: section?.validation || null
}));
```

**Option C: Opt-in telemetry storage**

Only store detailed enhancement telemetry when explicitly enabled:

```javascript
const shouldStoreEnhancementText = env.STORE_ENHANCEMENT_TEXT === 'true';

const enhancementSections = (narrativePayload.narrativeEnhancements || []).map((section, index) => ({
  name: section?.metadata?.name || section?.metadata?.type || `section-${index + 1}`,
  type: section?.metadata?.type || null,
  ...(shouldStoreEnhancementText ? {
    text: redactPII(trimForTelemetry(section?.text, 500), { displayName: personalization?.displayName })
  } : {
    textLength: section?.text?.length || 0
  }),
  validation: section?.validation || null
}));
```

### Recommendation

Use **Option A** (apply PII redaction) as the minimum fix. It balances debugging utility with privacy protection.

---

## Issue 4: KV Anonymous Quota (Known Limitation)

### Problem

The anonymous user quota uses KV which is not atomic:

```javascript
const existing = await env.RATELIMIT.get(key);
const currentCount = existing ? Number(existing) || 0 : 0;
// ... check limit ...
await env.RATELIMIT.put(key, String(nextCount), { ... });
```

Parallel requests can race and exceed the limit.

### Impact

Anonymous users could get slightly more than their quota by making concurrent requests.

### Status: Expected Behavior

This is a known limitation of KV. Options:
1. **Accept as soft limit** (current approach) - adequate for most use cases
2. **Move to Durable Objects** - for strict enforcement but higher cost/complexity
3. **Use atomic KV operations** - not available in Workers KV

### Recommendation

Document this as a "soft limit" in the codebase. The current approach is acceptable given:
- Anonymous users have low limits (5/month for free tier)
- The window for exploitation is small
- Strict enforcement adds complexity without significant benefit

---

## Issue 5: Crisis Check Behavior (Design Decision)

### Problem

When crisis signals are detected, the function:
1. Returns a safe-fallback reading (not an error)
2. **Does NOT release the reservation**

This means crisis-triggered readings count toward the user's monthly limit.

### Current Flow

```
Line 711: enforceReadingLimit() → reservation set
Line 726: readingReservation = result.reservation
Line 751: detectCrisisSignals()
Line 793-815: Crisis detected → return safe-fallback (reservation NOT released)
```

### Is This Intentional?

**Arguments FOR counting crisis readings:**
- Prevents abuse via crisis keywords to get unlimited attempts
- User did receive a response (even if generic)
- Consistent with "safety first" principle

**Arguments AGAINST counting crisis readings:**
- User didn't get a real reading
- May discourage users in genuine crisis from seeking help
- Could be perceived as unfair

### Recommendation

**Keep current behavior (count toward limit)** but:
1. Add code comment explaining the design decision
2. Consider logging crisis events separately for monitoring
3. Document in user-facing FAQ if needed

---

## Implementation Order

1. **Critical (Do First)**: Fix reservation leakage on 503
2. **High Priority**: Fix telemetry PII leakage
3. **Low Priority**: Improve spread tier messaging
4. **Documentation**: Crisis check behavior, KV quota limitation

## Testing Requirements

### Reservation Release Test

```javascript
// tests/tarot-reading.test.mjs
describe('Reading reservation release', () => {
  it('should release reservation on 503 backend failure', async () => {
    // Mock all backends to fail
    // Verify decrementUsageCounter is called
    // Verify response is 503
  });
  
  it('should NOT release reservation on successful reading', async () => {
    // Mock successful backend
    // Verify decrementUsageCounter is NOT called
    // Verify reading is returned
  });
  
  it('should NOT release reservation on crisis detection', async () => {
    // Trigger crisis detection
    // Verify decrementUsageCounter is NOT called
    // Verify safe-fallback is returned
  });
});
```

---

## Summary

| Issue | Severity | Status | Fix Complexity |
|-------|----------|--------|----------------|
| Reservation leakage on 503 | Critical | Confirmed | Simple (1 line) |
| Telemetry PII leakage | High | Confirmed | Simple (import + wrap) |
| Spread tier messaging | Low | Fragile but correct | Moderate (new function) |
| KV quota non-atomic | Info | Known limitation | N/A (document only) |
| Crisis check behavior | Info | Design decision | N/A (document only) |