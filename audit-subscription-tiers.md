I reviewed the tier logic and enforcement across server and client. Here's the audit focused on reading generation, TTS, journal exports, follow-ups, and Stripe idempotency, with where checks live and any bypass/race notes.

**Tier Model**
- Tier definitions and limits live in `shared/monetization/subscription.js` (free: 5 readings/3 TTS; plus: 50/50; pro: unlimited; spreads free vs all vs all+custom).
- Server-side tier context is normalized in `functions/lib/entitlements.js` using effectiveTier (inactive paid -> free) for gating.

**Reading Generation**
- Server enforcement: `functions/api/tarot-reading.js` gates spreads by `subscription.config.spreads` and returns 403 via `buildTierLimitedPayload` for locked spreads; monthly quotas are enforced via `functions/lib/readingLimits.js`.
- Tier-aware "depth" is applied server-side: symbol annotations and GraphRAG passage counts depend on `subscriptionTier` in `functions/lib/spreadAnalysisOrchestrator.js` and `functions/lib/graphRAG.js` (free gets a smaller passage block).
- Client checks (non-authoritative): spread locks and fallback spread selection in `src/components/SpreadSelector.jsx` and `src/hooks/useTarotState.js`.
- Bypass/race notes: anonymous quota uses KV fallback with optimistic locking in `functions/lib/readingLimits.js` (possible off-by-one on concurrent requests); DB/KV failures fail open; spoofable IP headers are only a concern outside Cloudflare.

**TTS**
- Server enforcement: `/api/tts` and `/api/tts-hume` use tier-based monthly limits + per-minute rate limit in `functions/api/tts.js`, `functions/api/tts-hume.js`, and `functions/lib/ttsLimits.js`; API-key usage is Pro-only via `functions/lib/apiUsage.js`.
- Client checks (non-authoritative): UI messaging for tier limits in `src/lib/audio.js` and usage display in account UI.
- Bypass: `/api/speech-token` in `functions/api/speech-token.js` has no auth or tier checks; any caller can obtain Azure Speech tokens and synthesize speech directly via the client SDK in `src/lib/audioSpeechSDK.js`, bypassing monthly TTS limits and usage tracking.

**Journal Exports**
- Server export endpoint `/api/journal-export` only checks authentication in `functions/api/journal-export/index.js` (no tier gate), so any authenticated user can export server-stored entries.
- Cloud journal CRUD is gated (Plus+) in `functions/api/journal.js`, `functions/api/journal/[id].js`, `functions/api/journal-summary.js`, and `functions/api/journal/followups.js`, which limits free users from creating server entries in the first place.
- Client exports are local-only and available regardless of tier via `src/pages/AccountPage.jsx` and `src/lib/journalInsights.js`.

**Follow-Up Conversations**
- Server enforcement: `functions/api/reading-followup.js` requires auth and enforces per-reading/per-day quotas (free 1/3, plus 3/15, pro 10/50) via D1 reservations; journal context and persistence are Plus+ only.
- Client checks (non-authoritative): follow-up limits and journal-context toggle in `src/components/FollowUpChat.jsx`.
- Bypass note: per-reading limit is keyed on `requestId || sessionSeed`, so a client could reset the per-reading counter by changing identifiers, but daily limits still apply.

**Stripe Idempotency & Race Safety**
- Webhook idempotency uses an atomic claim-first pattern in `functions/api/webhooks/stripe.js` (`INSERT OR IGNORE` into `processed_webhook_events`) with cleanup in `functions/lib/scheduled.js` and migration `migrations/0012_add_webhook_idempotency.sql`.
- On processing failures, the webhook removes the claim to allow Stripe retries; if the claim step fails due to DB errors, processing continues (possible duplicate emails on `invoice.payment_failed`).
- Checkout uses atomic customer linking and portal redirection for active subscriptions in `functions/api/create-checkout-session.js`; race conditions can create orphaned Stripe customers but don't corrupt user tier state.

**Key Bypass/Gap Summary**
- `functions/api/speech-token.js` is the main path to unmetered TTS; it's unauthenticated and untiered.
- `/api/journal-export` lacks tier checks; any authenticated user with stored entries can export.
- Anonymous KV-based quotas can be exceeded under concurrency and fail open on storage errors.

If you want follow-ups, the most relevant next steps would be:
1) Decide whether Azure Speech SDK usage should be tier-gated and/or counted, then add auth + usage checks to `functions/api/speech-token.js`.
2) Decide whether server exports should be Plus+ and add `isEntitled` checks to `functions/api/journal-export/index.js`.
3) Consider tightening anonymous quotas by preferring D1 for guest tracking or enforcing stricter KV locking.
