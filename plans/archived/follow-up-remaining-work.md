# Follow-Up Questions Feature: Remaining Work

## Summary

**Overall Completion: ~85%**

The core implementation is complete, but there are critical blockers and test failures that must be resolved before the feature is deployable.

---

## Critical Blockers (Must Fix)

### 1. Worker Route Registration Missing

**Priority: P0 - Blocker**

The `/api/reading-followup` endpoint is **not registered** in `src/worker/index.js`. API calls will return 404.

**File:** `src/worker/index.js`

**Changes needed:**

```javascript
// Add import (around line 53)
import * as readingFollowup from '../../functions/api/reading-followup.js';

// Add route (around line 227, before Admin endpoints)
{ pattern: /^\/api\/reading-followup$/, handlers: readingFollowup },
```

**Estimated effort:** 5 minutes

---

### 2. Database Migration Not Applied

**Priority: P0 - Blocker**

Migration `0017_add_follow_up_usage.sql` is pending. The `follow_up_usage` table doesn't exist in production.

**Command:**
```bash
npm run migrations:apply
```

**Estimated effort:** 2 minutes

---

### 3. Unit Tests Failing (10+ failures)

**Priority: P1 - High**

Tests in `tests/readingFollowup.test.mjs` have assertion mismatches with the actual implementation.

**Root Cause:** Test assertions use different format strings than the implementation:
- Tests expect: `'TONE:'`, `'ETHICS:'`, `'CONVERSATION SO FAR:'`
- Implementation uses: `'## TONE'`, `'## ETHICS'`, `'## CONVERSATION SO FAR'`

**Files to fix:** `tests/readingFollowup.test.mjs`

**Specific fixes needed:**

| Line | Test Assertion | Should Be |
|------|----------------|-----------|
| 55 | `systemPrompt.includes('thoughtful tarot reader')` | Keep (correct) |
| 79 | `systemPrompt.includes('TONE:')` | `systemPrompt.includes('## TONE')` |
| 105 | `systemPrompt.includes('JOURNAL CONTEXT:')` | `systemPrompt.includes('## JOURNAL CONTEXT')` |
| 124 | `userPrompt.includes('CONVERSATION SO FAR:')` | `userPrompt.includes('## CONVERSATION SO FAR')` |
| 175 | `systemPrompt.includes('ETHICS:')` | `systemPrompt.includes('## ETHICS')` |

**Also fix journal search mock tests:**
- Line 247: Mock DB `prepare` function isn't being captured correctly
- Line 361: `getRecurringCardPatterns` test expects normalized card names but mock returns unnormalized

**Estimated effort:** 30-45 minutes

---

## High Priority (Should Fix Before Launch)

### 4. E2E Tests Missing

**Priority: P1 - High**

No E2E tests exist for the follow-up feature. Plan specified `e2e/follow-up-questions.spec.js`.

**File to create:** `e2e/follow-up-questions.spec.js`

**Test scenarios needed:**
1. Follow-up section appears after reading completes
2. Clicking suggested question submits and shows response
3. Free-form input submits and shows response
4. Tier limits are enforced (free user blocked after 1)
5. Journal context toggle works for Plus+ users
6. Error states display correctly
7. Mobile responsive behavior

**Reference:** Existing E2E test patterns in `e2e/tarot-reading.spec.js`

**Estimated effort:** 2-3 hours

---

### 5. Feature Flag Configuration

**Priority: P2 - Medium**

No feature flag to control gradual rollout. Plan specified:
- `FEATURE_FOLLOW_UP_ENABLED`
- `FEATURE_FOLLOW_UP_JOURNAL_CONTEXT`

**File:** `wrangler.jsonc` (add to `vars` section)

```jsonc
// Follow-up questions feature flags
"FEATURE_FOLLOW_UP_ENABLED": "true",
"FEATURE_FOLLOW_UP_JOURNAL_CONTEXT": "true"
```

**Also update:** `functions/api/reading-followup.js` to check these flags

```javascript
// Add at top of onRequestPost
if (env.FEATURE_FOLLOW_UP_ENABLED !== 'true') {
  return jsonResponse({ error: 'Feature not available' }, { status: 404 });
}
```

**Estimated effort:** 15-20 minutes

---

## Medium Priority (Post-Launch)

### 6. Missing Single-Export Route Handler

**Priority: P2 - Medium**

The `journal-export/[id].js` file exists but may not be properly routed. The worker already has:
```javascript
{ pattern: /^\/api\/journal-export\/([^/]+)$/, handlers: journalExport, params: ['id'] },
```

This should work, but needs verification that the `id` param is passed correctly to the handler.

**Test:** Manually verify single reading export works:
```bash
curl -X GET "http://localhost:8787/api/journal-export/test-id" -H "Cookie: session=..."
```

**Estimated effort:** 15 minutes to verify

---

### 7. ReadingContext State (Optional)

**Priority: P3 - Low**

The implementation plan suggested adding `followUpHistory` and `followUpExpanded` state to `ReadingContext.jsx`. Currently, `FollowUpSection` manages its own local state.

**Current approach is simpler and works.** This is only needed if:
- Follow-up history needs to persist across component remounts
- Other components need access to follow-up state

**Recommendation:** Skip unless user feedback indicates need

---

## Implementation Order

### Phase 1: Unblock Deploy (30 min)
1. ✅ Add route to `src/worker/index.js`
2. ✅ Apply migration `npm run migrations:apply`

### Phase 2: Fix Tests (45 min)
3. ✅ Fix assertion strings in `tests/readingFollowup.test.mjs`
4. ✅ Fix mock DB capture in journal search tests

### Phase 3: Production Ready (3 hours)
5. ✅ Add feature flags to `wrangler.jsonc`
6. ✅ Add flag checks to API endpoint
7. ✅ Create E2E tests `e2e/follow-up-questions.spec.js`
8. ✅ Manual QA in dev environment

### Phase 4: Deploy (15 min)
9. ✅ Deploy to production `npm run deploy`
10. ✅ Verify in production

---

## Verification Checklist

After completing all work:

- [ ] `npm test` passes (all unit tests green)
- [ ] `npm run test:e2e:integration` passes
- [ ] Dev server shows follow-up section after reading
- [ ] Clicking suggestion triggers API call and shows response
- [ ] Free user limited to 1 follow-up
- [ ] Plus user gets 3 follow-ups with journal toggle
- [ ] Error messages display correctly
- [ ] Mobile layout works

---

## Files Summary

### To Modify
| File | Change |
|------|--------|
| `src/worker/index.js` | Add import + route for reading-followup |
| `tests/readingFollowup.test.mjs` | Fix assertion string formats |
| `wrangler.jsonc` | Add feature flags (optional) |
| `functions/api/reading-followup.js` | Add feature flag check (optional) |

### To Create
| File | Purpose |
|------|---------|
| `e2e/follow-up-questions.spec.js` | E2E test coverage |

### To Run
| Command | Purpose |
|---------|---------|
| `npm run migrations:apply` | Create follow_up_usage table |
| `npm test` | Verify unit tests pass |
| `npm run test:e2e:integration` | Verify E2E tests pass |
| `npm run deploy` | Deploy to production |
