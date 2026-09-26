# Tableu App Store Metadata Recommendations
## Optimized for 4.3(b) Appeal Success

Type: guide
Status: active background document
Last reviewed: 2026-09-25

---

## App Name (30 characters max)
**Current:** `Tableu`
**Recommended:** `Tableu: Ritual Tarot Reader`

Emphasizes the ritual system as a product differentiator.

---

## Subtitle (30 characters max)
**Recommended:** `Scholarly Self-Reflection`

Alternative options:
- `Knowledge-Powered Readings`
- `Pattern-Aware Tarot`
- `Beyond Fortune-Telling`

---

## Keywords (100 characters max)
**Recommended:**
```
tarot,self-reflection,ritual,journaling,celtic cross,archetype,pattern,mindfulness,growth,wisdom
```

**Avoid:** fortune, psychic, prediction, horoscope, astrology, future, fate

**Rationale:** Position away from "fortune-telling" category toward self-improvement/mindfulness.

---

## App Store Description

### Short Description (for Search Ads)
> Tableu is a scholarly tarot reflection system—not a fortune-telling app. Using ritual-seeded draws, knowledge graph retrieval, and archetypal pattern detection, Tableu transforms card readings into structured self-exploration.

### Full Description

```
TABLEU: WHERE TAROT MEETS SCHOLARSHIP

Tableu is not another random card generator. It's a structured self-reflection system built on curated internal tarot knowledge and modern knowledge graph technology.

▸ RITUAL-BASED DRAWS
Unlike apps that use random shuffles, Tableu creates ritual-seeded draws: knock timing, cut position, question text, and the shuffle timestamp combine into a seed. A fixed complete seed/session and the same draw settings reproduce the same cards; because the current browser seed includes `Date.now()`, repeating the ritual later can produce a different draw.

▸ KNOWLEDGE GRAPH INTELLIGENCE
Powered by GraphRAG (Graph-Enhanced Retrieval-Augmented Generation), Tableu can retrieve internally authored, tradition-aligned passages from the Tableu Tarot Canon for eligible pattern context. Retrieval is conditional: it does not guarantee that every reading uses a passage, and no copyrighted book text is included.

▸ ARCHETYPAL PATTERN DETECTION
• Fool's Journey Mapping: Recognizes which developmental stage your cards represent
• Archetypal Triads: Detects powerful 3-card combinations (Healing Arc, Liberation Arc, Mastery Arc)
• Elemental Dignities: Analyzes card relationships based on traditional correspondences

▸ OPTIONAL VISION RESEARCH
When vision research is explicitly enabled, Tableu can analyze photos of physical cards for research telemetry. The core reading works without photos, and the research UI is not on by default. Supported deck profiles include:
• Rider-Waite-Smith (1909)
• Thoth (Crowley-Harris)
• Marseille

▸ LONG-TERM JOURNEY TRACKING
Track recurring cards and patterns over weeks and months when journey analytics is enabled. Pattern alerts use a rolling 90-day, month-bucketed window; reading-day and repeated-card streaks are derived from saved entries rather than guaranteed notifications. Earn badges as you deepen your practice.

▸ SIX SPREADS FOR EVERY QUESTION
• One-Card Insight: Quick daily guidance
• Three-Card Story: Past, present, future
• Five-Card Clarity: Core, challenge, hidden, support, direction
• Decision/Two-Path: Compare options with agency
• Relationship Snapshot: You, them, connection
• Celtic Cross: Classic 10-card deep dive

▸ ETHICAL DESIGN
Tableu emphasizes agency, not destiny. Readings use "likely path if unchanged" language. Professional boundaries are maintained—no medical, legal, or financial advice.

—

This is tarot as a tool for structured introspection, not supernatural prediction. If you're seeking slot-machine randomness and vague fortunes, look elsewhere. If you want scholarly depth and meaningful self-reflection, welcome to Tableu.
```

---

## What's New (Version Notes)

```
Version 1.0.0
• Ritual-seeded draw system with fixed-seed replay
• GraphRAG knowledge retrieval
• Archetypal pattern detection (triads, dyads, Fool's Journey)
• Elemental dignity analysis
• Optional vision research mode for RWS, Thoth, and Marseille photos
• Long-term archetype journey tracking
• Six spread types including Celtic Cross
```

---

## Promotional Text (170 characters max)
> Scholarly tarot meets modern AI. Ritual-based draws, knowledge graph retrieval, and archetypal pattern detection for a more structured self-reflection practice.

---

## App Store Category Recommendations

**Primary:** Health & Fitness (or Lifestyle)
**Secondary:** Reference (or Education)

**Rationale:** Positioning in Health & Fitness/Lifestyle emphasizes self-reflection and personal development rather than entertainment. "Entertainment" category invites comparison with generic tarot apps.

---

## Screenshots (Required Order for Appeal)

1. **Ritual Screen** — Show knock/cut interface with "Your ritual shapes the reading" text
2. **Pattern Detection** — Show Fool's Journey or Triad detection overlay
3. **Elemental Dignities** — Fire-Air supportive / Fire-Water tension visualization
4. **Vision Research (if enabled)** — Camera recognizing a supported deck; label the research mode clearly
5. **Journey Tracking** — Archetype badges and recurring card alerts
6. **Celtic Cross Reading** — Full 10-card spread with position labels

---

## App Preview Video (30 seconds)

Suggested flow:
1. (0-5s) User types meaningful question
2. (5-12s) Knock ritual with timing visualization
3. (12-18s) Cards reveal with pattern detection callout
4. (18-25s) AI interpretation with a grounded card/position explanation
5. (25-30s) Journey dashboard showing long-term tracking

---

## Privacy Labels (App Store Connect)

These are draft disclosures for the web product. Verify the release build, App Store Connect definitions, retention settings, and processor behavior before filing. In particular, confirm the shipped Sentry replay/masking and identity settings, Stripe payment flow, consent/retention behavior, and `METRICS_STORAGE_MODE`.

### Data Linked to You
- **Contact Info (account data)** — account email and provider profile fields used for authentication, verification, and account management.
- **Identifiers** — account, session, and client identifiers used for synchronization, rate limits, and service operation.
- **User Content** — questions, reflections, saved readings and journal entries, stored memories, optional vision-photo uploads, and generated-media records; journal persistence requires explicit consent.
- **Usage Data** — reading history, journey/pattern analytics, and feature interactions.
- **Purchases** — subscription plan/status and payment-provider customer or session identifiers used for entitlements and billing support.
- **Financial Info** — payment and billing data processed through the payment provider; confirm the exact App Store category and whether Tableu receives payment details.
- **Diagnostics** — crash and error telemetry plus Sentry session replay. Replay is sampled in the current web configuration and can be captured on errors; the current client does not enable all-text or all-media blocking, so verify the release bundle and Sentry settings before labeling it.

### Data Not Linked to You
- Diagnostics and Sentry replay may be listed here only if the release build confirms that no account identity is attached; otherwise disclose them as linked.

### Data Not Collected
- Do not file a “not collected” claim for contact information, user content, purchases, financial data, or Sentry replay until the release build and payment/replay flows are verified.

### Conditional Data
- Location may be collected when the user enables location and grants browser permission. Journal persistence requires explicit consent. In the default `redact` metrics mode, stored evaluation metrics omit coordinates while retaining timezone and location-used metadata; `full` and `minimal` modes differ.

---

## Age Rating

**Recommended:** 12+
- Infrequent/Mild Mature/Suggestive Themes (archetypal content)
- No gambling, horror, violence, or explicit content

---

## Review Notes for Apple (App Store Connect)

```
Dear Review Team,

Tableu includes several product capabilities relevant to structured tarot reflection:

1. RITUAL-SEEDED DRAW SYSTEM: Draws are seeded by user ritual input plus the shuffle timestamp. A fixed complete seed/session and the same draw settings reproduce the same cards; repeating the ritual later can differ because the current browser seed includes `Date.now()`.

2. GRAPHRAG KNOWLEDGE RETRIEVAL: When eligible pattern context is available, narratives may include internally authored Tableu Tarot Canon passages; no copyrighted book text is included and retrieval is not guaranteed for every reading.

3. ARCHETYPAL PATTERN DETECTION: The app identifies Fool's Journey stages, archetypal triads (for example, Death-Temperance-Star "Healing Arc"), and elemental dignities between cards.

4. OPTIONAL VISION RESEARCH: When the research mode is enabled, users can submit photos from supported deck profiles (RWS, Thoth, Marseille) for research telemetry. Photo upload is not required for a normal reading.

5. LONG-TERM JOURNEY TRACKING: When journey analytics is enabled, Tableu tracks patterns across a user's saved readings over time, with a rolling 90-day month-bucketed pattern-alert window and streaks derived from saved entries.

These are product capability descriptions. Any claim that a feature is unique among current App Store products requires separate, current competitive evidence.

Demo credentials: N/A (create account in-app)
Full feature differentiation: [attach differentiation document]
```

---

## Repository Evidence

This repository currently documents and implements the web product. App Store
submission metadata, privacy disclosures, screenshots, and demo credentials should
be verified against the release build and App Store Connect before submission.

---

## Next Steps

1. **Update App Store Connect** with the description and metadata above
2. **Capture new screenshots** highlighting implemented features (patterns, rituals, optional vision research)
3. **Record app preview video** demonstrating ritual → pattern → interpretation flow
4. **Reply to rejection** with differentiation document attached
5. **Consider category change** from Entertainment to Health & Fitness
