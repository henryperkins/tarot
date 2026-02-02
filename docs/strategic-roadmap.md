# Tableu Strategic Roadmap
## Leveraging Technical Capabilities for User Retention & Revenue Growth

*Version 1.0 | February 2026*

---

## Executive Summary

Tableu possesses a sophisticated technical foundation with three interconnected systems that, when strategically leveraged, can significantly improve user retention and revenue growth:

1. **Archetype Journey** — Gamified analytics with pattern detection and badge awards
2. **Stripe Subscription Integration** — 3-tier monetization with usage tracking
3. **Personalization Engine** — AI-driven memory and coaching systems

This roadmap evaluates these capabilities and provides a structured approach to maximize their business impact.

---

## Current Capability Assessment

### 1. Archetype Journey System

**Strengths:**
| Capability | Implementation Status | Business Value |
|------------|----------------------|----------------|
| Card frequency tracking | ✅ Production | Engagement visualization |
| Monthly streak detection | ✅ Production | Return incentive |
| Badge awards (3+ appearances) | ✅ Production | Achievement gratification |
| Pattern detection (triads/dyads) | ✅ Production | Depth perception |
| Fool's Journey stage tracking | ✅ Production | Narrative progression |
| 90-day pattern alerts | ✅ Production | Recurring theme awareness |
| Historical backfill | ✅ Production | Immediate value for new users |
| 6-month trend visualization | ✅ Production | Long-term engagement context |

**Gaps Identified:**
- Badge system limited to monthly streaks (no cross-month achievements)
- No social/sharing features for achievements
- Pattern alerts not tied to push notifications
- No progressive difficulty in badge earning

**Retention Impact Score:** 7/10 (Strong foundation, underutilized engagement hooks)

---

### 2. Stripe Subscription Integration

**Strengths:**
| Capability | Implementation Status | Business Value |
|------------|----------------------|----------------|
| 3-tier model (Free/Plus/Pro) | ✅ Production | Clear upgrade path |
| Monthly + Annual billing | ✅ Production | Revenue optimization |
| Webhook idempotency | ✅ Production | Reliability |
| Billing portal self-service | ✅ Production | Reduced support burden |
| Usage tracking (readings/TTS/API) | ✅ Production | Fair consumption limits |
| Promotion codes | ✅ Production | Marketing flexibility |
| Trial infrastructure | ✅ Built (0 days configured) | Conversion tool |
| Payment failure notifications | ✅ Production | Churn prevention |

**Current Tier Economics:**
| Tier | Monthly Price | Annual Price | Annual Discount |
|------|---------------|--------------|-----------------|
| Free | $0 | — | — |
| Plus | $7.99 | $79.99 | 17% savings |
| Pro | $19.99 | $199.99 | 17% savings |

**Gaps Identified:**
- Trial period set to 0 days (no active trials)
- No in-app upgrade prompts at limit boundaries
- No dunning/recovery automation beyond email
- Annual discount not prominently surfaced
- No referral program infrastructure

**Revenue Impact Score:** 6/10 (Solid infrastructure, minimal activation)

---

### 3. Personalization Engine

**Strengths:**
| Capability | Implementation Status | Business Value |
|------------|----------------------|----------------|
| Global memories (persistent) | ✅ Production | Long-term personalization |
| Session memories (contextual) | ✅ Production | Reading-specific tuning |
| Memory consolidation | ✅ Production | Durable insight capture |
| PII safety controls | ✅ Production | Trust/compliance |
| Follow-up conversation memory | ✅ Production | Coherent multi-turn |
| Journal pattern context | ✅ Production | Historical awareness |
| Coaching step extraction | ✅ Production | Actionable guidance |
| Step embeddings | ✅ Production | Semantic similarity |
| 5 memory categories | ✅ Production | Structured insights |

**Gaps Identified:**
- Coaching extraction requires admin backfill
- No proactive use of memories for reading initiation
- Memory insights not surfaced to user
- No memory-based personalization in initial readings (only follow-ups)

**Retention Impact Score:** 8/10 (Deep personalization creates sticky experience)

---

## Strategic Opportunities

### Phase 1: Quick Wins (1-2 Months)

#### 1.1 Activate Trial Period
**Effort:** Low | **Impact:** High

Enable 7-day trial for Plus tier to reduce conversion friction.

```javascript
// shared/monetization/subscription.js
TIERS.plus.trialDays = 7;
```

**Expected Outcome:** 15-25% increase in Plus trial starts based on industry benchmarks.

---

#### 1.2 Implement Soft Upgrade Prompts
**Effort:** Medium | **Impact:** High

Surface upgrade opportunities at natural friction points:

| Trigger | Location | Message |
|---------|----------|---------|
| Reading limit reached | TarotReading.jsx | "You've completed 5 readings this month. Unlock 50 readings with Plus." |
| TTS limit reached | AudioControls.jsx | "Upgrade to hear more readings aloud." |
| Premium spread selected (free user) | SpreadSelector.jsx | "Celtic Cross is available with Plus. Try 7 days free." |
| Pattern alert generated | Journal.jsx | "Recurring patterns detected. See detailed insights with Plus." |

---

#### 1.3 Surface Annual Savings Prominently
**Effort:** Low | **Impact:** Medium

Add annual toggle with savings callout in subscription UI:

```
○ Monthly: $7.99/mo
● Annual: $6.67/mo — Save $16/year
```

**Expected Outcome:** 20-30% of subscribers choose annual (improved LTV).

---

#### 1.4 Enable Backfill Auto-Prompt
**Effort:** Low | **Impact:** Medium

Currently, backfill requires manual trigger. Auto-prompt new authenticated users:

```javascript
// On first journal load with entries + no card_appearances
if (stats.needsBackfill && !hasPromptedBackfill) {
  showBackfillBanner({ variant: 'prominent' });
}
```

**Expected Outcome:** Higher activation of Archetype Journey features.

---

### Phase 2: Retention Deepening (2-4 Months)

#### 2.1 Progressive Badge System
**Effort:** Medium | **Impact:** High

Expand badge awards beyond monthly streaks:

| Badge Type | Criteria | Rarity |
|------------|----------|--------|
| **Streak Badges** | 3x, 5x, 10x same card in month | Common |
| **Journey Milestones** | Complete Fool's Journey stage | Rare |
| **Pattern Master** | Detect 3+ archetypal triads | Rare |
| **Consistency** | Readings 3+ months consecutively | Uncommon |
| **Deep Diver** | 10+ follow-up questions | Uncommon |
| **Triad Collector** | Experience all 5 triads | Epic |

**Implementation:**
- Add `badge_type` values: `journey`, `pattern`, `consistency`, `engagement`
- Create badge check functions in `archetype-journey.js`
- Award during reading save and backfill

---

#### 2.2 Pattern Alert Push Notifications
**Effort:** Medium | **Impact:** Medium

Connect 90-day pattern alerts to web push notifications:

```javascript
// When pattern_occurrences hits 3+ for user
await sendPushNotification(userId, {
  title: "Pattern Detected",
  body: "The Death-Temperance-Star arc has appeared 3 times. Explore what this means.",
  action: "/journal?filter=pattern&id=death-temperance-star"
});
```

**Expected Outcome:** 10-15% increase in return visits from dormant users.

---

#### 2.3 Memory Transparency Layer
**Effort:** Medium | **Impact:** High

Surface memories to users (opt-in) to build trust and demonstrate personalization:

```jsx
// New component: MemoryInsights.jsx
<MemoryPanel>
  <h3>What I Remember About You</h3>
  <ul>
    <li>You often explore themes of career transition</li>
    <li>The Moon card resonates deeply with you</li>
    <li>You prefer concrete, actionable guidance</li>
  </ul>
  <button>Manage Memories</button>
</MemoryPanel>
```

**Business Case:** Users who see personalization evidence report 40% higher satisfaction (industry data).

---

#### 2.4 Coaching Extraction Auto-Pipeline
**Effort:** Medium | **Impact:** Medium

Move coaching extraction from admin-only backfill to automatic:

```javascript
// In journal save handler
if (entry.narrative && !entry.extracted_steps) {
  ctx.waitUntil(extractCoachingSteps(entry));
}
```

**Expected Outcome:** 100% of readings have extractable coaching steps for future personalization.

---

### Phase 3: Revenue Acceleration (4-6 Months)

#### 3.1 Plus Tier Feature Expansion
**Effort:** High | **Impact:** High

Increase Plus value proposition to justify price point:

| Feature | Current State | Proposed |
|---------|---------------|----------|
| AI Question Generation | Plus+ | Plus+ |
| **Memory Insights Dashboard** | None | Plus+ |
| **Pattern Deep-Dive Reports** | None | Plus+ |
| **Reading Comparison Tool** | None | Plus+ |
| **Custom Reminder Schedules** | None | Plus+ |

---

#### 3.2 Pro Tier API Expansion
**Effort:** High | **Impact:** Medium

Expand Pro API capabilities to attract power users:

| Feature | Current State | Proposed |
|---------|---------------|----------|
| Reading Generation API | ✅ | ✅ |
| **Batch Reading API** | None | Pro |
| **Webhook Notifications** | None | Pro |
| **White-Label Embed** | None | Pro |
| **Custom Deck Support** | None | Pro |

---

#### 3.3 Referral Program Infrastructure
**Effort:** Medium | **Impact:** High

Implement viral growth mechanics:

```sql
CREATE TABLE referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL,
  referred_id TEXT,
  referral_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, converted, expired
  reward_granted INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  converted_at INTEGER,
  FOREIGN KEY (referrer_id) REFERENCES users(id),
  FOREIGN KEY (referred_id) REFERENCES users(id)
);
```

**Reward Structure:**
- Referrer: 1 free month Plus (or $5 credit toward Pro)
- Referred: Extended 14-day trial

---

#### 3.4 Dunning & Recovery Automation
**Effort:** Medium | **Impact:** Medium

Expand beyond single payment failure email:

| Day | Action |
|-----|--------|
| 0 | Payment failed email (✅ exists) |
| 3 | Reminder email with update link |
| 7 | "Your access will pause" warning |
| 10 | Offer 20% discount to retain |
| 14 | Final notice before downgrade |

**Expected Outcome:** 10-20% recovery of failed payments.

---

### Phase 4: Ecosystem Expansion (6-12 Months)

#### 4.1 Archetype Journey Sharing
**Effort:** Medium | **Impact:** Medium

Allow users to share achievements:

```javascript
// Generate shareable card
GET /api/archetype-journey/share-card
→ {
  imageUrl: "https://tableu.app/share/journey/abc123.png",
  stats: { topCard, streaks, badges }
}
```

Social sharing increases organic acquisition.

---

#### 4.2 Community Patterns Feature
**Effort:** High | **Impact:** Medium

Aggregate anonymized pattern data:

```jsx
<CommunityInsights>
  <p>This month, 23% of readers encountered the Tower-Sun liberation arc.</p>
  <p>You're one of them. Here's what it means collectively...</p>
</CommunityInsights>
```

**Business Case:** Community features increase retention by creating belonging.

---

#### 4.3 Personalization in Initial Readings
**Effort:** High | **Impact:** High

Currently, memories only affect follow-ups. Extend to initial readings:

```javascript
// In tarot-reading.js
const memories = await fetchUserMemories(userId);
const prompt = buildEnhancedClaudePrompt({
  ...params,
  userContext: formatMemoriesForPrompt(memories)
});
```

**Expected Outcome:** First-reading quality improves dramatically for returning users.

---

## Implementation Priority Matrix

| Initiative | Effort | Impact | Priority |
|------------|--------|--------|----------|
| Activate Trial Period | Low | High | **P0** |
| Soft Upgrade Prompts | Medium | High | **P0** |
| Surface Annual Savings | Low | Medium | **P0** |
| Backfill Auto-Prompt | Low | Medium | **P1** |
| Progressive Badge System | Medium | High | **P1** |
| Memory Transparency | Medium | High | **P1** |
| Pattern Push Notifications | Medium | Medium | **P2** |
| Coaching Auto-Pipeline | Medium | Medium | **P2** |
| Plus Feature Expansion | High | High | **P2** |
| Referral Program | Medium | High | **P2** |
| Dunning Automation | Medium | Medium | **P3** |
| Pro API Expansion | High | Medium | **P3** |
| Journey Sharing | Medium | Medium | **P3** |
| Community Patterns | High | Medium | **P4** |
| Initial Reading Personalization | High | High | **P4** |

---

## Key Performance Indicators

### Retention Metrics
| Metric | Current Baseline | 6-Month Target | 12-Month Target |
|--------|------------------|----------------|-----------------|
| D7 Retention | TBD | +15% | +25% |
| D30 Retention | TBD | +10% | +20% |
| Monthly Active Users | TBD | +20% | +40% |
| Readings per User/Month | TBD | +15% | +25% |
| Follow-up Rate | TBD | +20% | +35% |

### Revenue Metrics
| Metric | Current Baseline | 6-Month Target | 12-Month Target |
|--------|------------------|----------------|-----------------|
| Free → Plus Conversion | TBD | 5% | 8% |
| Plus → Pro Upgrade | TBD | 10% | 15% |
| Annual Plan Adoption | TBD | 25% | 40% |
| Monthly Recurring Revenue | TBD | +50% | +150% |
| Average Revenue Per User | TBD | +30% | +60% |
| Churn Rate (Plus) | TBD | -20% | -35% |
| Trial → Paid Conversion | N/A | 30% | 40% |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Trial abuse | Medium | Low | Limit trial features, track fraud patterns |
| Personalization creepiness | Low | High | Opt-in controls, transparent memory UI |
| Feature bloat in Plus | Medium | Medium | A/B test feature value before commitment |
| Badge fatigue | Medium | Low | Progressive difficulty, meaningful achievements only |
| Notification fatigue | Medium | Medium | Frequency caps, user preference controls |

---

## Technical Dependencies

### Immediate (P0 Initiatives)
- No new infrastructure required
- Configuration changes only

### Short-Term (P1 Initiatives)
- Badge schema extension (migration)
- Memory UI components (frontend)
- Push notification service (Web Push API)

### Medium-Term (P2-P3 Initiatives)
- Referral table (migration)
- Email automation service (Resend expansion)
- API rate limiting expansion

### Long-Term (P4 Initiatives)
- Anonymized analytics pipeline
- Embedding similarity search at scale
- Community moderation infrastructure

---

## Conclusion

Tableu's technical foundation is robust and underutilized. The three systems (Archetype Journey, Stripe Subscriptions, Personalization) create a powerful flywheel when properly activated:

```
Personalization → Higher Engagement → More Data → Better Personalization
                         ↓
              Archetype Journey Badges → Achievement Motivation
                         ↓
              Value Demonstration → Subscription Conversion
                         ↓
              Expanded Features → Deeper Engagement
```

**Recommended Immediate Actions:**
1. Enable 7-day Plus trial
2. Implement upgrade prompts at limit boundaries
3. Surface annual pricing prominently
4. Auto-prompt backfill for new authenticated users

These four changes require minimal engineering effort and can be deployed within weeks, providing immediate conversion lift while larger initiatives are planned.

---

*Document maintained by: Engineering & Product*
*Last updated: February 2026*
