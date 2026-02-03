# Strategic Roadmap: Leveraging Existing Features for Retention & Revenue Growth

**Document Type:** Strategic Planning  
**Version:** 1.0  
**Date:** February 2, 2026  
**Audience:** Product, Engineering, and Business Leadership

---

## Executive Summary

Tableu has developed three sophisticated technical capabilities that, when strategically leveraged together, create a powerful flywheel for user retention and revenue growth:

1. **Archetype Journey Analytics** — Server-side card tracking, streaks, badges, and backfill infrastructure
2. **Stripe Subscription Integration** — Three-tier monetization with entitlement enforcement
3. **Personalized Coaching Tools** — AI-powered suggestions derived from journal patterns and semantic analysis

This roadmap evaluates each capability's current state, identifies synergies, and proposes a phased approach to maximize their combined impact on key business metrics: **Monthly Active Users (MAU)**, **7-/30-day retention**, **Free-to-Paid conversion**, and **Average Revenue Per User (ARPU)**.

---

## Part 1: Capability Assessment

### 1.1 Archetype Journey Analytics

**Current State:**
| Component | Implementation | Maturity |
|-----------|----------------|----------|
| Card appearance tracking | `card_appearances` table via `/api/archetype-journey/track` | ✅ Production |
| Monthly streak detection | `archetype_badges` table, automated 3x thresholds | ✅ Production |
| Backfill API | `/api/archetype-journey-backfill` — truly idempotent reconstruction | ✅ Production |
| Current streak computation | Consecutive reading-day calculations | ✅ Production |
| Major Arcana heatmap | Aggregated frequency per user | ✅ Production |
| Trend analytics | 6-month historical view | ✅ Production |
| Backfill diagnostics | `needsBackfill` detection, UI prompt support | ✅ Production |

**Technical Strengths:**
- **Idempotent backfill** — Users upgrading to Plus/Pro instantly gain historical insights without data loss
- **D1-based persistence** — Server-side analytics survive device changes, enabling true "cloud journal" value prop
- **Monthly bucketing** — Efficient queries via `year_month` partitioning
- **Badge gamification** — Intrinsic reward loop for recurring engagement

**Retention Leverage Points:**
- Streaks create daily habit loops (2+ consecutive days triggers coaching relevance)
- Badge unlocks (3x card appearances per month) deliver achievement moments
- Backfill prompt on first load converts historical users into engaged analytics users

---

### 1.2 Stripe Subscription Integration

**Current State:**
| Component | Implementation | Maturity |
|-----------|----------------|----------|
| Three-tier model | Free (Seeker), Plus (Enlightened), Pro (Mystic) | ✅ Production |
| Checkout sessions | `/api/create-checkout-session` with promo code support | ✅ Production |
| Billing portal | `/api/create-portal-session` for self-service management | ✅ Production |
| Webhook idempotency | `processed_webhook_events` table prevents duplicates | ✅ Production |
| Tier extraction | `extractTierFromSubscription()` handles monthly/annual/portal changes | ✅ Production |
| Usage tracking | `monthly_usage` table with atomic increment/decrement | ✅ Production |
| Entitlement enforcement | Reading limits, TTS limits, API call limits per tier | ✅ Production |
| Restore purchases | `/api/subscription/restore` with rate limiting | ✅ Production |

**Pricing Structure:**
| Tier | Monthly | Annual | Key Entitlements |
|------|---------|--------|-----------------|
| Free | $0 | — | 5 readings/mo, 3 TTS/mo, basic spreads, local journal |
| Plus | $7.99 | $79.99 | 50 readings/mo, 50 TTS/mo, all spreads, cloud journal, AI questions, full GraphRAG |
| Pro | $19.99 | $199.99 | Unlimited readings/TTS, custom spreads, API access (1,000 calls/mo), full features |

**Revenue Leverage Points:**
- **Trial-less model** — Direct conversion paths reduce friction for ready buyers
- **Promotion codes** — Seasonal/referral campaigns via Stripe's native promo system
- **Annual pricing** — ~17% discount incentivizes longer commitments (improved LTV)
- **Usage metering** — Transparent limits create upgrade triggers at natural friction points

---

### 1.3 Personalized Coaching Tools

**Current State:**
| Component | Implementation | Maturity |
|-----------|----------------|----------|
| Guided Intention Coach | `GuidedIntentionCoach.jsx` — topic/timeframe/depth wizard | ✅ Production |
| Creative Question AI | `/api/generate-question` — LLM-powered personalized questions | ✅ Production (Plus+) |
| Coach Suggestions | `CoachSuggestion.jsx` — journal-derived recommendations | ✅ Production |
| Theme detection | `recentThemes`, `themeSignals` from narrative extraction | ✅ Production |
| Preference drift | `computePreferenceDrift()` — focus area deviation detection | ✅ Production |
| Embedding clustering | `cosineSimilarity()` — semantic grouping of "Gentle Next Steps" | ✅ Production |
| Signal priority system | `COACH_SOURCE_PRIORITY` — drift > badge > topCard > theme > context | ✅ Production |
| Journal insights persistence | User-scoped localStorage with TTL | ✅ Production |

**Personalization Signal Sources:**
1. **Preference drift** — User's actual reading contexts vs. stated focus areas
2. **Streak badges** — Cards appearing 3+ times in a month
3. **Top cards** — Most frequently drawn cards
4. **Major Arcana patterns** — Dominant archetype themes
5. **Extracted "Gentle Next Steps"** — Parsed from AI narratives
6. **Embedding-based clustering** — Semantic similarity of extracted steps

**Retention Leverage Points:**
- Personalized suggestions create "aha" moments demonstrating app value
- Drift detection surfaces emerging interests before users articulate them
- "Gentle Next Steps" coaching bridges reading-to-action gap

---

## Part 2: Strategic Synergies

### The Retention-Revenue Flywheel

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│    ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐     │
│    │  Archetype       │     │  Personalized    │     │  Subscription    │     │
│    │  Journey         │────►│  Coaching        │────►│  Conversion      │     │
│    │  Analytics       │     │  Suggestions     │     │  Triggers        │     │
│    └────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘     │
│             │                        │                        │               │
│             │  Streaks & badges      │  "Your journey shows"  │  Upgrade      │
│             │  fuel coaching         │  demonstrates value    │  prompts at   │
│             │  priority              │  of data sync          │  paywall      │
│             │                        │                        │               │
│             ▼                        ▼                        ▼               │
│    ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐     │
│    │  Daily           │◄───┤  "Gentle Next    │◄───┤  Cloud Journal   │     │
│    │  Engagement      │     │  Step" Habit     │     │  + Full Insights │     │
│    │  Loop            │     │  Reinforcement   │     │  Unlock          │     │
│    └──────────────────┘     └──────────────────┘     └──────────────────┘     │
│                                                                                 │
│    ◄────────────────────── NETWORK EFFECTS ──────────────────────────►        │
│                                                                                 │
│    More readings → richer data → better coaching → higher retention → more    │
│    readings → stronger upgrade value proposition                               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Key Synergy Opportunities

| Synergy | Components | Business Impact |
|---------|------------|-----------------|
| **Badge-gated coaching** | Journey badges → Coach priority boost | Streak badges unlock "Your recurring archetype" coaching, creating reward for consistency |
| **Backfill-to-conversion** | Backfill prompt → Plus upgrade | New users see "Unlock X months of journal insights" driving immediate upgrade consideration |
| **Drift-to-reading** | Preference drift → Reading CTA | "We noticed you've been exploring [career] — try a focused reading" converts passive to active users |
| **Usage meter nudges** | Limit enforcement → Contextual upgrade | "3 of 5 readings used — upgrade for unlimited" at natural friction points |
| **Cloud sync value proof** | Journey analytics → Device switch | Users who see stats on both mobile/desktop understand the cloud journal value |

---

## Part 3: Prioritized Initiatives

### Phase 1: Quick Wins (4-6 weeks)

#### Initiative 1.1: Backfill-Driven Upgrade Funnel
**Objective:** Convert existing free users with journal history to Plus via backfill value prop

**Implementation:**
- Surface `needsBackfill: true` prominently in Reading Journey UI
- Add "Unlock Your History" card showing: "We found X journal entries. See patterns across N months of readings."
- Gate full backfill visualization behind Plus (show "3 of X cards" teaser for free)
- Track conversion rate from backfill prompt → checkout session

**Success Metrics:**
- Backfill-prompted checkout sessions: +15% of upgrade sessions
- 7-day retention for users who complete backfill: +20% vs. control

**Technical Requirements:**
- Add `backfillCardCount` estimate to backfill detection (count distinct cards without executing backfill)
- Create `BackfillUpgradePrompt.jsx` component with tiered messaging

---

#### Initiative 1.2: Streak-Powered Engagement Loops
**Objective:** Increase DAU/MAU ratio via streak visibility and coaching integration

**Implementation:**
- Add prominent streak counter to home screen (existing `currentStreak` data)
- Trigger push/email notification at streak milestones (3, 7, 14, 30 days)
- Integrate streak into coach priority: `streak >= 2` boosts "streak check-in" suggestion
- Create "streak endangered" notification if user misses a day after 3+ streak

**Success Metrics:**
- Users with 7+ day streaks: 2x higher 30-day retention
- DAU/MAU ratio improvement: +5 percentage points

**Technical Requirements:**
- Add `lastReadingDate` to user profile API
- Implement notification service integration (plus permission request flow)
- Add streak-at-risk detection to scheduled job

---

#### Initiative 1.3: Contextual Upgrade Triggers
**Objective:** Improve free-to-paid conversion by timing upgrade prompts at value moments

**Implementation:**
- Track "upgrade trigger events":
  - Hitting reading limit (current)
  - Viewing trend data that would be richer with full history
  - Attempting to access AI question generation
  - Trying to share journal entry (Plus feature)
- A/B test upgrade modal copy variants:
  - Generic: "Upgrade to Plus for unlimited readings"
  - Contextual: "You've discovered [The Moon] 4 times. With Plus, you'll see your full archetype map."

**Success Metrics:**
- Contextual modal CTR: +40% vs. generic modal
- Checkout session → purchase completion rate maintained above 60%

**Technical Requirements:**
- Extend `buildTierLimitedPayload()` to include contextual data
- Create `ContextualUpgradeModal.jsx` with variant support

---

### Phase 2: High-Impact Features (2-3 months)

#### Initiative 2.1: Archetype Journey Achievements System
**Objective:** Create a comprehensive gamification layer driving long-term engagement

**Implementation:**
- Expand badge types beyond 3x monthly streaks:
  - **Collection badges**: "Discover 22 Major Arcana" (progress tracked)
  - **Consistency badges**: "30-day streak", "Read in all 4 seasons"
  - **Exploration badges**: "Use all spread types", "Read in multiple contexts"
  - **Depth badges**: "10 follow-up questions asked"
- Create achievement showcase page linked from profile
- Add shareable achievement cards (social proof / referral vector)

**Success Metrics:**
- Users with 5+ badges: 3x higher retention at 90 days
- Achievement share-to-referral conversion: 2% of shares result in new signups

**Technical Requirements:**
- Extend `archetype_badges` schema with new badge types
- Create `AchievementsShowcase.jsx` component
- Implement badge detection service (batch job or trigger-based)
- Add Open Graph meta for shareable achievement cards

---

#### Initiative 2.2: Predictive Coaching Recommendations
**Objective:** Leverage ML to surface high-relevance coaching at optimal moments

**Implementation:**
- Build "coaching relevance score" combining:
  - Days since last reading
  - Current streak status
  - Unresolved preference drift
  - Recent badge unlocks
  - Upcoming calendar triggers (Monday morning, full moon, etc.)
- Create "Your moment for reflection" notification with personalized question
- Test AI-generated "weekly theme summary" delivered via email to Plus+ users

**Success Metrics:**
- Push notification → reading completion rate: 25%+
- Weekly summary email open rate: 40%+, click-through: 15%+

**Technical Requirements:**
- Implement scoring function in `computeCoachingRelevance()`
- Build notification queueing service with batching
- Create email template system with personalization tokens

---

#### Initiative 2.3: Pro Tier API-Driven Integrations
**Objective:** Unlock Pro tier value through ecosystem integrations

**Implementation:**
- Document public API with card frequency, theme detection, reading history endpoints
- Create "Journaling Apps" integration guide (Notion, Obsidian, Day One)
- Build "Daily Card" widget API for custom dashboards
- Partner with astrology apps for cross-user personalization

**Success Metrics:**
- Pro tier monthly active API users: 30% of Pro subscribers
- API-integrated Pro retention: +15% vs. non-API Pro users

**Technical Requirements:**
- Extend API rate limiting to support burst patterns
- Create OpenAPI spec and interactive documentation
- Build example integration templates (JavaScript, Python SDKs)

---

### Phase 3: Platform Evolution (6-12 months)

#### Initiative 3.1: Community Features (Social Proof Flywheel)
**Objective:** Transform individual practice into community experience

**Implementation:**
- Anonymous "Community Trends" dashboard:
  - "Most drawn card this week across all users"
  - "This month's collective theme"
- Optional "Practice Circle" feature (Plus+):
  - Small group mutual reading shares
  - Group streaks and challenges
- Referral program with tiered rewards:
  - 1 referral: 1 free month Plus
  - 5 referrals: lifetime 20% discount

**Success Metrics:**
- Referral-driven signups: 15% of new users
- Practice Circle participants: 10% of Plus users, with 2x retention

---

#### Initiative 3.2: Predictive Analytics Premium (Pro+)
**Objective:** Create premium tier differentiation through advanced AI insights

**Implementation:**
- Monthly "Archetype Portrait" AI-generated essay analyzing user's unique card relationship patterns
- Trend forecasting: "Based on your patterns, [theme] may be important this month"
- Cross-reading correlation analysis: "When you draw [card X], you often ask about [topic Y]"

**Success Metrics:**
- Pro tier upgrade rate from Plus: 10%+ monthly
- Archetype Portrait share rate: 20%+ (social proof vector)

---

## Part 4: Success Metrics Framework

### North Star Metrics

| Metric | Current Baseline | Phase 1 Target | Phase 3 Target |
|--------|------------------|----------------|----------------|
| **7-day retention** | TBD | +15% | +40% |
| **30-day retention** | TBD | +10% | +30% |
| **Free-to-Plus conversion (30-day)** | TBD | +25% | +75% |
| **Plus-to-Pro upgrade (annual)** | TBD | +5% | +15% |
| **Monthly recurring revenue (MRR)** | TBD | +30% | +150% |
| **DAU/MAU ratio** | TBD | +5pp | +15pp |

### Health Metrics (Monitor for Regression)

| Metric | Alert Threshold |
|--------|-----------------|
| Reading completion rate | <70% (down from baseline) |
| Streak abandonment after 3+ days | >40% daily |
| Upgrade modal dismiss-without-action | >85% |
| TTS usage per reading | <10% of readings |
| Backfill API error rate | >1% |

---

## Part 5: Risk Assessment & Mitigations

### Risk 1: Over-Monetization Fatigue
**Risk:** Aggressive upgrade prompts degrade free user experience, harming long-term growth
**Mitigation:**
- Cap upgrade modal frequency: max 1 per session after initial limit hit
- Track "frustration signals" (rapid dismissal, immediate session end)
- A/B test "soft nudge" vs. "blocking modal" approaches
- Maintain meaningful free tier value (5 readings/mo is usable)

### Risk 2: Data Dependency Concerns
**Risk:** Users uncomfortable with server-side analytics tracking
**Mitigation:**
- Clear privacy messaging: "Your readings stay private—analytics help personalize your experience"
- Allow analytics opt-out (existing `archetype_journey_enabled` preference)
- Transparent data export/deletion via account settings

### Risk 3: AI Cost Escalation
**Risk:** Personalized coaching features drive unsustainable AI API costs
**Mitigation:**
- Cache common coaching patterns
- Use lightweight embeddings for clustering (not LLM calls)
- Tier GraphRAG depth (free: limited, Plus/Pro: full)
- Monitor cost-per-reading and set alerting thresholds

### Risk 4: Stripe Integration Drift
**Risk:** Portal/checkout changes cause tier extraction failures
**Mitigation:**
- Existing `extractTierFromSubscription()` has robust fallback chain:
  1. price.lookup_key
  2. price.metadata.tier
  3. price.unit_amount thresholds
  4. subscription.metadata.tier
- Add monitoring for "unknown tier" events
- Quarterly Stripe API version review

---

## Part 6: Implementation Dependencies

### Backend Prerequisites
- [ ] Notification service integration (push + email)
- [ ] Scheduled job infrastructure (badge detection, stale streak warnings)
- [ ] Analytics event pipeline (upgrade trigger tracking)

### Frontend Prerequisites
- [ ] Unified upgrade modal system with context injection
- [ ] Achievement UI components
- [ ] Streak visualization components

### Data Prerequisites
- [ ] Establish baseline metrics for all KPIs
- [ ] Implement event tracking for upgrade funnel steps
- [ ] Create cohort analysis queries for retention comparison

---

## Appendix A: Technical Architecture Overview

### Current Data Flow

```
User Reading Request
        │
        ▼
┌───────────────────┐
│ tarot-reading.js  │──────► Usage Tracking (monthly_usage)
│ + enforceReading  │        │
│   Limit()         │        ▼
└────────┬──────────┘   ┌──────────────────┐
         │              │ Limit Enforcement │
         │              │ (tier-aware)      │
         │              └──────────────────┘
         ▼
┌───────────────────┐
│ Narrative Gen     │──────► GraphRAG (tier-gated depth)
│ + Claude/GPT      │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ archetype-journey │──────► card_appearances (D1)
│ /track            │──────► archetype_badges (auto-award)
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ Client: Journal   │──────► useJourneyData (merged D1 + client)
│ + Insights        │──────► Coach Suggestions (priority scoring)
└───────────────────┘
```

### Subscription State Flow

```
Stripe Checkout/Portal
        │
        ▼
┌───────────────────┐
│ Webhook Handler   │──────► Signature Verification
│ (stripe.js)       │──────► Idempotency Check
│                   │──────► User Subscription Update (D1)
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ /api/subscription │──────► Current tier + Stripe renewal info
│ + /restore        │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ SubscriptionCtx   │──────► Client-side entitlement checks
│ (React)           │──────► canUseAIQuestions, etc.
└───────────────────┘
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Archetype Journey** | User-facing name for card frequency analytics and badge system |
| **Backfill** | Process of reconstructing analytics from historical journal entries |
| **Coaching Suggestion** | Personalized question/prompt derived from user's journal patterns |
| **GraphRAG** | Retrieval-Augmented Generation using the tarot knowledge graph |
| **Preference Drift** | Detected divergence between user's stated focus areas and actual reading contexts |
| **Streak** | Consecutive days with at least one reading |
| **Tier** | Subscription level (free/plus/pro) |

---

## Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-02 | AI Strategy | Initial assessment and roadmap |
