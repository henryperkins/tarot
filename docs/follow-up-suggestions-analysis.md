# Follow-Up Suggestions Analysis Report

**Updated:** 2026-01-27
**Scope:** `generateFollowUpSuggestions()` function in `src/lib/followUpSuggestions.js`

---

## A) 10 High-Value Follow-Up Suggestions

| # | Suggestion Text | Type | Trigger Condition | Priority | Trigger Key |
|---|-----------------|------|-------------------|----------|-------------|
| 1 | "What does [Card] reversed want me to acknowledge or release?" | reversal | Exactly 1 reversed card | 1 | `single-reversal` |
| 2 | "What pattern links the reversed cards, and where is that energy blocked or internal?" | reversal | >= 2 reversed cards | 1 | `multi-reversal` |
| 3 | "Which path aligns more with my values and long-term direction?" | spread | `spreadKey === 'decision'` | 2 | `path-values` |
| 4 | "How does the Present bridge the Past and Future?" | spread | `spreadKey === 'threeCard'` | 2 | `present-bridge` |
| 5 | "What life lesson do these Major Arcana cards emphasize?" | archetype | `majorRatio >= 0.35` OR `majorCount >= 3` | 2 | `major-emphasis` |
| 6 | "What does the strong [Fire/Water/Air/Earth] energy suggest I need most right now?" | elemental | `dominantElementEntry.ratio >= 0.4` AND `total >= 3` | 3 | `dominant-element` |
| 7 | "What might the absence of [Element] energy mean for this situation?" | elemental | 1-3 elements have count 0 | 4 | `missing-element` |
| 8 | "What does the recurring [symbol] symbol invite you to consider?" | symbol | Symbols extracted match dominant element/suit | 4 | `symbol` |
| 9 | "How do these cards change each other's meaning when read together?" | synthesis | `cards.length >= 2` | 4 | `synthesis` |
| 10 | "What might be blocking me from moving forward?" | shadow | Fallback (always present) | 5 | `shadow` |

---

## B) Bug/Logic Risk Review

### Open risks

| # | Area | Severity | Notes |
|---|------|----------|-------|
| R1 | Dedupe key | Low | Dedupe uses text + anchorKey + triggerKey; identical text without triggerKey can still collapse. |

### Resolved or mitigated since last review

| # | Area | Status | Notes |
|---|------|--------|-------|
| M1 | Deck title parsing | Resolved | Minor ranks include Thoth/Marseille court titles and deck-style canonicalization. |
| M2 | Suit detection | Resolved | Suit aliases + word-boundary matching prevent false positives. |
| M3 | Sort mutation | Resolved | Dominant entry sorting now uses a copied array. |
| L1 | Fool detection | Not an issue | Number check handles 0 as a valid Major Arcana number. |
| L2 | Major validation | Resolved | `isMajor()` checks arcana flag and canonical major names. |
| L3 | Court title coverage | Resolved | Princess/Prince and Marseille court ranks are recognized. |

---

## C) Test Matrix

| Spread | Scenario | Expected Top 4 Types | Notes |
|--------|----------|---------------------|-------|
| `celtic` | 1 reversed + 3 Majors | reversal -> archetype -> spread -> synthesis | Reversal (P1) leads, archetype (P2), Celtic spread (P2), synthesis (P4) |
| `celtic` | All upright, 4 Wands | action -> shadow -> spread -> suit | No reversal/major, Wands dominance triggers suit question (P3) |
| `threeCard` | No triggers | action -> shadow -> synthesis -> elemental | Minimal triggers, fallbacks fill slots |
| `threeCard` | 2 reversed | reversal -> action -> shadow -> synthesis | Multi-reversal pattern question (P1) |
| `single` | Reversed | reversal -> action -> shadow -> synthesis | Single reversed triggers card-specific question |
| `single` | Upright Ace | action -> shadow -> symbol -> synthesis | No reversal, Ace may trigger symbol reflection |
| `relationship` | Both reversed | reversal -> action -> shadow -> spread | Multi-reversal applies even in 3-card |
| `relationship` | You reversed, Them upright | reversal -> action -> shadow -> spread | Single reversal triggers card-specific |
| `decision` | Path A reversed | reversal -> spread -> action -> shadow | Path card reversed counts |
| `decision` | No reversals | spread -> action -> shadow -> synthesis | Decision spread questions primary |
| `fiveCard` | All triggers | reversal -> archetype -> spread -> elemental | FiveCard now has spread questions |
| Any | 4 elements present | action -> shadow -> synthesis -> elemental | Missing element triggers if 1-3 absent |
| Any | 2 elements, Fire=3, Water=0 | action -> shadow -> elemental (Fire) -> elemental (missing Water) | Dominant + missing both fire (P3) and missing water (P4) |

### Expected Behavior by Trigger Combination

| Trigger Combination | Slot 1 | Slot 2 | Slot 3 | Slot 4 |
|---------------------|--------|--------|--------|--------|
| Reversal only | reversal | spread/question | synthesis | action/shadow |
| Reversal + Major | reversal | archetype/spread | spread/question | synthesis |
| Major + Elemental | archetype | elemental | spread/question | synthesis |
| All triggers | reversal | archetype | spread/question | elemental/synthesis |
| No triggers | action | shadow | synthesis | (fallback order) |

---

## D) Coverage Gaps

### Supported Spread Types

All spread keys have dedicated questions:

| Spread Key | Has Questions | Questions Count |
|------------|---------------|-----------------|
| `celtic` | Yes | 3 |
| `threeCard` | Yes | 2 |
| `fiveCard` | Yes | 2 |
| `decision` | Yes | 2 |
| `relationship` | Yes | 2 |
| `single` | Yes | 2 |
| `general` | No (falls back to generic) | 0 |

### Missing Suggestion Types

| Suggestion Type | Gap Status | Trigger Condition |
|-----------------|------------|-------------------|
| Court card focus | Missing | >= 2 court cards from same suit |
| Numerology focus | Missing | Low avg card number (0-7) or high (14-21) |
| Timing/cyclical | Missing | Specific card combos (Wheel + Temperance, etc.) |
| Position-specific | Partial | `getPositionQuestions()` exists but not integrated |

---

## E) Rotation and Diversity Mechanism

### Current Implementation

```
const rotationSeedBase = String(options.rotationSeed || readingMeta?.requestId || readingMeta?.spreadKey || 'reading');
const rotationIndex = Number.isFinite(options.rotationIndex) ? options.rotationIndex : 0;
const rotationSeed = hashString(`${rotationSeedBase}:${rotationIndex}`);
```

- Each reading has a `rotationSeed` derived from request ID or spread key.
- `rotationIndex` increments when the user clicks "Need ideas?".
- Different indices produce different shuffles of the same suggestions.

### Known limitations

- No session memory across readings.
- No explicit diversity checks (multiple spread questions can surface together).
- Deduping is based on text + anchorKey + triggerKey.

---

## F) Integration Points

### Called From

| File | Function | Purpose |
|------|----------|---------|
| `src/components/FollowUpChat.jsx` | `generateFollowUpSuggestions()` | Generate initial suggestions and rotated variants |

### Related Backend Analysis

| Module | Function | Output Used |
|--------|----------|------------|
| `functions/lib/spreadAnalysis.js` | `analyzeSpreadThemes()` | `themes` object with counts and ratios |
| `functions/lib/symbolElementBridge.js` | `getSymbolFollowUpPrompt()` | Symbol-based reflection suggestions |
| `functions/lib/followUpPrompt.js` | `buildFollowUpPrompt()` | Backend prompt building (not frontend suggestions) |

---

## G) Recommendations

### Immediate

1) Decide if dedupe should include `triggerKey` to preserve context-specific duplicates.

### Short Term

1) Add court card pattern detection.
2) Add `general` spread-specific prompts or integrate `getPositionQuestions()` into the main flow.

### Long Term

1) Add numerology and lifecycle stage suggestions.
2) Add cross-session suggestion memory.
3) Add diversity controls to avoid repeated types in a single batch.

---

## H) Test Coverage Status

**Current test file:** `tests/followUpSuggestions.test.mjs`

| Category | Tests | Coverage |
|----------|-------|----------|
| Reversal detection | 5 | Good |
| Spread-specific | 6 | Good |
| Elemental suggestions | 5 | Good |
| Major Arcana | 5 | Good |
| Fallback suggestions | 2 | Good |
| Limits/ordering | 3 | Good |
| Edge cases | 5 | Good |
| Suit-based | 2 | Good |
| Symbol-based | 1 | Partial |
| Rotation behavior | 1 | Partial |

**Missing test cases:**

- Court card patterns (>= 2 courts from same suit)
- Multi-element dominance (Fire + Water both dominant)
- All 4 elements missing (should not trigger missing-element)
- Trigger key dedupe behavior

---

*End of Report*
