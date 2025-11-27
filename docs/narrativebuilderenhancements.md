# Narrative Builder Enhancement Integration Guide

## 1. GraphRAG Passage Quality Control

### Current State

Passages are retrieved via [`retrievePassages()`](functions/lib/graphRAG.js) and injected without relevance scoring against the user's specific question.

### Enhancement: Semantic Similarity Filtering

**Step 1: Add similarity scoring to [`graphRAG.js`](functions/lib/graphRAG.js)**

```javascript
// functions/lib/graphRAG.js

import { cosineSimilarity, embedText } from "./embeddings.js"; // New dependency

/**
 * Score passage relevance against user query
 * @param {string} passage - The passage text
 * @param {string} userQuery - User's question
 * @param {Object} options - Scoring options
 * @returns {number} Relevance score 0-1
 */
export async function scorePassageRelevance(passage, userQuery, options = {}) {
  const { keywordWeight = 0.3, semanticWeight = 0.7 } = options;

  if (!userQuery || !passage) return 0.5; // Default neutral score

  // Keyword overlap scoring (fast, cheap)
  const queryTerms = userQuery
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 3);
  const passageText = passage.toLowerCase();
  const keywordMatches = queryTerms.filter((term) =>
    passageText.includes(term)
  );
  const keywordScore =
    queryTerms.length > 0 ? keywordMatches.length / queryTerms.length : 0;

  // Semantic similarity (requires embeddings API)
  let semanticScore = 0.5;
  if (options.enableSemanticScoring) {
    try {
      const [queryEmbed, passageEmbed] = await Promise.all([
        embedText(userQuery),
        embedText(passage.slice(0, 500)), // Truncate for efficiency
      ]);
      semanticScore = cosineSimilarity(queryEmbed, passageEmbed);
    } catch (err) {
      console.warn("[GraphRAG] Semantic scoring failed:", err.message);
    }
  }

  return keywordScore * keywordWeight + semanticScore * semanticWeight;
}

/**
 * Enhanced retrieval with quality filtering
 */
export function retrievePassagesWithQuality(graphKeys, options = {}) {
  const {
    maxPassages = 5,
    userQuery = "",
    minRelevanceScore = 0.3,
    enableDeduplication = true,
  } = options;

  // Get raw passages
  const rawPassages = retrievePassages(graphKeys, {
    maxPassages: maxPassages * 2,
  });

  // Score and filter
  const scoredPassages = rawPassages.map((passage) => ({
    ...passage,
    relevanceScore: scorePassageRelevance(passage.text, userQuery, {
      enableSemanticScoring: options.enableSemanticScoring,
    }),
  }));

  // Filter by quality threshold
  let filtered = scoredPassages.filter(
    (p) => p.relevanceScore >= minRelevanceScore
  );

  // Deduplicate similar passages
  if (enableDeduplication) {
    filtered = deduplicatePassages(filtered);
  }

  // Sort by relevance and take top N
  return filtered
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxPassages);
}

/**
 * Remove passages with >80% content overlap
 */
function deduplicatePassages(passages) {
  const seen = new Set();
  return passages.filter((passage) => {
    // Generate content fingerprint (first 100 chars normalized)
    const fingerprint = passage.text
      .toLowerCase()
      .replace(/\s+/g, " ")
      .slice(0, 100);

    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}
```

**Step 2: Update [`prompts.js`](functions/lib/narrative/prompts.js:321) to use quality-filtered retrieval**

```javascript
// In buildSystemPrompt() around line 324
if (
  includeGraphRAG &&
  isGraphRAGEnabled() &&
  themes?.knowledgeGraph?.graphKeys
) {
  try {
    // Use quality-filtered retrieval
    const { retrievePassagesWithQuality } = await import("../graphRAG.js");

    const retrievedPassages = retrievePassagesWithQuality(
      themes.knowledgeGraph.graphKeys,
      {
        maxPassages: getPassageCountForSpread(effectiveSpreadKey),
        userQuery: userQuestion,
        minRelevanceScore: 0.35,
        enableDeduplication: true,
        enableSemanticScoring: Boolean(options.enableSemanticScoring),
      }
    );

    // Only inject if we have quality passages
    if (retrievedPassages.length > 0) {
      const avgRelevance =
        retrievedPassages.reduce((sum, p) => sum + p.relevanceScore, 0) /
        retrievedPassages.length;
      console.log(
        `[GraphRAG] Injecting ${
          retrievedPassages.length
        } passages (avg relevance: ${(avgRelevance * 100).toFixed(1)}%)`
      );
      // ... rest of injection logic
    }
  } catch (err) {
    console.error("[GraphRAG] Quality retrieval failed:", err.message);
  }
}
```

---

## 2. Dynamic Prompt Structure for Returning Users

### Current State

The system prompt in [`buildSystemPrompt()`](functions/lib/narrative/prompts.js:266) is static per request.

### Enhancement: Previous Reading Context

**Step 1: Create user context store**

```javascript
// functions/lib/userContext.js

/**
 * User reading history for context continuity
 */
export async function getUserReadingContext(userId, env) {
  if (!userId || !env?.USER_CONTEXT_KV) return null;

  try {
    const key = `user:${userId}:context`;
    const stored = await env.USER_CONTEXT_KV.get(key, { type: "json" });
    return stored;
  } catch (err) {
    console.warn("[UserContext] Failed to retrieve:", err.message);
    return null;
  }
}

export async function updateUserReadingContext(userId, env, readingData) {
  if (!userId || !env?.USER_CONTEXT_KV) return;

  const key = `user:${userId}:context`;
  const existing = (await getUserReadingContext(userId, env)) || {
    readingCount: 0,
    recentThemes: [],
    frequentCards: {},
    lastReadingDate: null,
    feedbackHistory: [],
  };

  // Update context with new reading
  const updated = {
    readingCount: existing.readingCount + 1,
    recentThemes: [
      ...new Set([
        ...(readingData.themes?.suitFocus
          ? [readingData.themes.suitFocus]
          : []),
        ...existing.recentThemes,
      ]),
    ].slice(0, 5),
    frequentCards: updateCardFrequency(
      existing.frequentCards,
      readingData.cards
    ),
    lastReadingDate: new Date().toISOString(),
    lastSpread: readingData.spreadKey,
    lastContext: readingData.context,
    feedbackHistory: existing.feedbackHistory,
  };

  await env.USER_CONTEXT_KV.put(key, JSON.stringify(updated), {
    expirationTtl: 60 * 60 * 24 * 90, // 90 days
  });

  return updated;
}

function updateCardFrequency(existing, cards) {
  const updated = { ...existing };
  cards.forEach((card) => {
    const name = card.card || card.name;
    if (name) {
      updated[name] = (updated[name] || 0) + 1;
    }
  });
  // Keep top 20 most frequent
  return Object.fromEntries(
    Object.entries(updated)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
  );
}
```

**Step 2: Integrate into prompt building**

```javascript
// In buildSystemPrompt() - add new parameter and section
function buildSystemPrompt(
  spreadKey,
  themes,
  context,
  deckStyle,
  userQuestion,
  options = {}
) {
  const { userContext } = options;
  const lines = [
    /* ... existing lines ... */
  ];

  // Add returning user context if available
  if (userContext && userContext.readingCount > 1) {
    lines.push(
      "",
      "RETURNING USER CONTEXT",
      `- This is reading #${userContext.readingCount} for this querent.`
    );

    if (userContext.lastReadingDate) {
      const daysSince = Math.floor(
        (Date.now() - new Date(userContext.lastReadingDate).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      lines.push(`- Last reading was ${daysSince} day(s) ago.`);
    }

    if (userContext.recentThemes?.length > 0) {
      lines.push(
        `- Recent themes: ${userContext.recentThemes.slice(0, 3).join("; ")}`
      );
    }

    // Flag frequently appearing cards
    const frequentInThisReading = options.cardsInfo?.filter(
      (card) => userContext.frequentCards?.[card.card] >= 3
    );
    if (frequentInThisReading?.length > 0) {
      const names = frequentInThisReading.map((c) => c.card).join(", ");
      lines.push(
        `- Recurring cards (3+ appearances): ${names}. Consider acknowledging this pattern.`
      );
    }

    lines.push(
      "- Reference past themes briefly if they resonate with current cards, but prioritize the present spread."
    );
  }

  return lines.join("\n");
}
```

**Step 3: Add feedback learning**

```javascript
// functions/api/reading-feedback.js (new endpoint)

export const onRequestPost = async ({ request, env }) => {
  const { userId, requestId, feedback } = await request.json();

  if (!userId || !feedback) {
    return jsonResponse(
      { error: "Missing userId or feedback" },
      { status: 400 }
    );
  }

  // Store feedback
  const context = await getUserReadingContext(userId, env);
  if (context) {
    context.feedbackHistory = [
      { requestId, feedback, timestamp: Date.now() },
      ...(context.feedbackHistory || []),
    ].slice(0, 10); // Keep last 10

    await env.USER_CONTEXT_KV.put(
      `user:${userId}:context`,
      JSON.stringify(context)
    );
  }

  // Extract learnings for prompt adjustment
  const learnings = extractFeedbackLearnings(context.feedbackHistory);

  return jsonResponse({ success: true, learnings });
};

function extractFeedbackLearnings(history) {
  if (!history || history.length < 3) return null;

  // Analyze patterns
  const sentiments = history.map((h) => h.feedback.sentiment);
  const avgSentiment =
    sentiments.reduce((a, b) => a + b, 0) / sentiments.length;

  return {
    prefersConcise:
      history.filter((h) => h.feedback.tooLong).length > history.length / 2,
    prefersMoreEsoteric:
      history.filter((h) => h.feedback.wantsMoreDepth).length >
      history.length / 2,
    avgSatisfaction: avgSentiment,
  };
}
```

---

## 3. Narrative Spine Validation Enforcement

### Current State

[`validateReadingNarrative()`](functions/lib/narrativeSpine.js:328) only logs suggestions; incomplete sections pass through.

### Enhancement: Hard Enforcement with Auto-Repair

**Step 1: Add enforcement mode to validation**

```javascript
// functions/lib/narrativeSpine.js

/**
 * Validate and optionally enforce spine structure
 * @param {string} readingText - The narrative to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.enforceCompleteness - Fail if sections incomplete
 * @param {boolean} options.autoRepair - Attempt to fix incomplete sections
 * @param {number} options.minCompletionRate - Minimum % of complete sections (0-1)
 */
export function validateReadingNarrative(readingText, options = {}) {
  const {
    enforceCompleteness = false,
    autoRepair = false,
    minCompletionRate = 0.7,
  } = options;

  // ... existing parsing logic ...

  const incompleteCount = analyses.filter((a) => !a.analysis.isComplete).length;
  const completionRate =
    sections.length > 0
      ? (sections.length - incompleteCount) / sections.length
      : 1;

  const result = {
    isValid: incompleteCount === 0,
    completionRate,
    totalSections: sections.length,
    completeSections: sections.length - incompleteCount,
    incompleteSections: incompleteCount,
    sectionAnalyses: analyses,
    suggestions: [],
  };

  // Enforcement mode
  if (enforceCompleteness) {
    if (completionRate < minCompletionRate) {
      result.enforcementFailed = true;
      result.enforcementReason = `Completion rate ${(
        completionRate * 100
      ).toFixed(0)}% below threshold ${(minCompletionRate * 100).toFixed(0)}%`;
    }
  }

  // Auto-repair mode
  if (autoRepair && incompleteCount > 0) {
    result.repairedText = autoRepairNarrative(readingText, analyses);
    result.repairsApplied = true;
  }

  return result;
}

/**
 * Auto-repair incomplete narrative sections
 */
function autoRepairNarrative(readingText, analyses) {
  let repaired = readingText;

  analyses.forEach(({ header, analysis }) => {
    if (analysis.isComplete) return;

    const missing = analysis.missing || [];
    const repairs = [];

    if (missing.includes("what")) {
      // Can't auto-repair WHAT without card context
      repairs.push("*[Situation context needed]*");
    }

    if (missing.includes("why")) {
      repairs.push(
        "This dynamic emerges from the interplay of energies present in your spread."
      );
    }

    if (missing.includes("whatsNext")) {
      repairs.push(
        "Consider what small, intentional step might honor this insight as you move forward."
      );
    }

    if (repairs.length > 0) {
      // Find section and append repairs
      const sectionPattern = new RegExp(
        `(${escapeRegex(header)}[^]*?)(?=###|$)`,
        "i"
      );
      repaired = repaired.replace(sectionPattern, (match) => {
        return match.trimEnd() + "\n\n" + repairs.join(" ") + "\n\n";
      });
    }
  });

  return repaired;
}
```

**Step 2: Update quality gate in [`tarot-reading.js`](functions/api/tarot-reading.js:526)**

```javascript
// In the quality gate section
const qualityMetrics = buildNarrativeMetrics(result, cardsInfo, deckStyle);

// Enhanced spine validation with enforcement
const spineValidation = validateReadingNarrative(result, {
  enforceCompleteness: true,
  autoRepair: true,
  minCompletionRate: 0.6, // At least 60% of sections must be complete
});

if (spineValidation.enforcementFailed) {
  // Try auto-repair first
  if (spineValidation.repairedText) {
    console.log(
      `[${requestId}] Auto-repaired ${spineValidation.incompleteSections} incomplete sections`
    );
    result = spineValidation.repairedText;
    // Re-validate after repair
    const revalidation = validateReadingNarrative(result, {
      enforceCompleteness: true,
    });
    if (revalidation.enforcementFailed) {
      qualityIssues.push(
        `narrative structure incomplete: ${revalidation.enforcementReason}`
      );
    }
  } else {
    qualityIssues.push(
      `narrative structure incomplete: ${spineValidation.enforcementReason}`
    );
  }
}
```

**Step 3: Add per-section requirements**

```javascript
// functions/lib/narrativeSpine.js

const SECTION_REQUIREMENTS = {
  nucleus: { what: true, why: true, whatsNext: false },
  timeline: { what: true, why: true, whatsNext: true },
  consciousness: { what: true, why: false, whatsNext: false },
  staff: { what: true, why: false, whatsNext: true },
  outcome: { what: true, why: true, whatsNext: true },
  guidance: { what: false, why: false, whatsNext: true },
  default: { what: true, why: false, whatsNext: false },
};

export function validateSectionCompleteness(sectionType, present) {
  const requirements =
    SECTION_REQUIREMENTS[sectionType] || SECTION_REQUIREMENTS.default;
  const failures = [];

  Object.entries(requirements).forEach(([element, required]) => {
    if (required && !present[element]) {
      failures.push(element);
    }
  });

  return {
    isComplete: failures.length === 0,
    missingRequired: failures,
    requirements,
  };
}
```

---

## 4. Timing Profile Refinement

### Current State

[`timingMeta.js`](functions/lib/timingMeta.js) produces binary timing (near-term-tilt/longer-arc-tilt).

### Enhancement: Granular Timing with Question Parsing

**Step 1: Enhanced temporal parsing**

```javascript
// functions/lib/timingMeta.js (enhanced)

const TEMPORAL_PATTERNS = {
  immediate: {
    patterns: [
      /today/i,
      /right now/i,
      /this moment/i,
      /immediately/i,
      /tonight/i,
    ],
    horizon: "days",
    days: 1,
  },
  thisWeek: {
    patterns: [/this week/i, /next few days/i, /coming days/i],
    horizon: "week",
    days: 7,
  },
  thisMonth: {
    patterns: [/this month/i, /next few weeks/i, /coming weeks/i, /soon/i],
    horizon: "month",
    days: 30,
  },
  thisSeason: {
    patterns: [
      /this season/i,
      /next few months/i,
      /coming months/i,
      /quarter/i,
    ],
    horizon: "season",
    days: 90,
  },
  thisYear: {
    patterns: [/this year/i, /next year/i, /coming year/i, /annual/i],
    horizon: "year",
    days: 365,
  },
  longTerm: {
    patterns: [
      /long term/i,
      /years/i,
      /life/i,
      /ever/i,
      /future/i,
      /eventually/i,
    ],
    horizon: "long-term",
    days: null, // Undefined horizon
  },
};

/**
 * Parse temporal intent from user question
 */
export function parseQuestionTiming(userQuestion) {
  if (!userQuestion) return { horizon: "unspecified", confidence: 0 };

  const q = userQuestion.toLowerCase();

  // Check each pattern category
  for (const [category, config] of Object.entries(TEMPORAL_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(q)) {
        return {
          category,
          horizon: config.horizon,
          days: config.days,
          confidence: 0.8,
          matchedPattern: pattern.toString(),
        };
      }
    }
  }

  // Fallback: detect implicit timing from question type
  if (/will\s+\w+\s+(happen|come|arrive|change)/i.test(q)) {
    return { horizon: "future-focused", confidence: 0.5, implicit: true };
  }

  if (/should\s+i/i.test(q)) {
    return { horizon: "decision-point", confidence: 0.6, implicit: true };
  }

  return { horizon: "unspecified", confidence: 0 };
}

/**
 * Enhanced timing profile with granular signals
 */
export function analyzeTimingProfile(cardsInfo, options = {}) {
  const { userQuestion, spreadKey } = options;

  // Parse question timing
  const questionTiming = parseQuestionTiming(userQuestion);

  // Analyze card timing signals
  const cardSignals = analyzeCardTimingSignals(cardsInfo);

  // Combine signals
  const combined = combineTimingSignals(questionTiming, cardSignals, spreadKey);

  return {
    // Granular profile
    horizon: combined.primaryHorizon,
    horizonConfidence: combined.confidence,
    estimatedDays: combined.estimatedDays,

    // Legacy compatibility
    profile: mapToLegacyProfile(combined.primaryHorizon),

    // Detailed signals
    signals: {
      questionBased: questionTiming,
      cardBased: cardSignals,
      spreadModifier: getSpreadTimingModifier(spreadKey),
    },

    // Narrative guidance
    narrativeHint: generateTimingNarrativeHint(combined),
  };
}

function analyzeCardTimingSignals(cardsInfo) {
  const signals = {
    immediateIndicators: 0,
    developingIndicators: 0,
    longTermIndicators: 0,
  };

  const IMMEDIATE_CARDS = [
    "The Tower",
    "Ace of Wands",
    "Eight of Wands",
    "The Chariot",
  ];
  const LONG_TERM_CARDS = [
    "The Hermit",
    "The Hanged Man",
    "Four of Swords",
    "Seven of Pentacles",
  ];

  cardsInfo.forEach((card) => {
    const name = card.card || card.name;
    if (IMMEDIATE_CARDS.some((c) => name?.includes(c))) {
      signals.immediateIndicators++;
    }
    if (LONG_TERM_CARDS.some((c) => name?.includes(c))) {
      signals.longTermIndicators++;
    }
  });

  // Rank distribution affects timing
  const avgRank =
    cardsInfo.reduce((sum, c) => sum + (c.rankValue || 5), 0) /
    cardsInfo.length;
  if (avgRank <= 3) signals.immediateIndicators++;
  if (avgRank >= 8) signals.longTermIndicators++;

  return signals;
}

function generateTimingNarrativeHint(combined) {
  const { primaryHorizon, estimatedDays, confidence } = combined;

  if (confidence < 0.4) {
    return "The timing here is open—stay attentive to shifts as they emerge.";
  }

  const hints = {
    days: "These dynamics are quite immediate—expect movement within days if you engage actively.",
    week: "This energy is poised to shift within the week ahead.",
    month:
      "Give this pattern about a month to unfold; watch for early signals around the two-week mark.",
    season:
      "This story plays out across the coming season—plant seeds now and tend them consistently.",
    year: "This is a longer chapter that will take shape over the coming year.",
    "long-term":
      "This speaks to a life pattern rather than a specific timeline.",
    "decision-point":
      "The timing depends heavily on when you make your choice.",
    unspecified: "Trust your own sense of readiness as this unfolds.",
  };

  return hints[primaryHorizon] || hints.unspecified;
}
```

**Step 2: Integrate into prompt building**

```javascript
// In buildUserPrompt() - replace simple timing profile with enhanced version
if (activeThemes.timingAnalysis) {
  const timing = activeThemes.timingAnalysis;

  prompt += `**Timing Profile**:\n`;
  prompt += `- Horizon: ${timing.horizon}`;
  if (timing.estimatedDays) {
    prompt += ` (~${timing.estimatedDays} days)`;
  }
  prompt += `\n`;

  if (timing.signals?.questionBased?.confidence > 0.5) {
    prompt += `- Question suggests: ${timing.signals.questionBased.horizon}\n`;
  }

  prompt += `- Narrative hint: ${timing.narrativeHint}\n\n`;
}
```

**Step 3: Update [`analyzeSpreadThemes()`](functions/lib/spreadAnalysis.js) to use enhanced timing**

```javascript
// In analyzeSpreadThemes()
import { analyzeTimingProfile } from "./timingMeta.js";

// Replace simple timing analysis with enhanced version
const timingAnalysis = analyzeTimingProfile(cardsInfo, {
  userQuestion,
  spreadKey: getSpreadKeyFromName(spreadName),
});

return {
  // ... existing fields ...
  timingProfile: timingAnalysis.profile, // Legacy
  timingAnalysis, // Full enhanced analysis
};
```

---

## Summary

These four enhancements transform the system from a **static prompt generator** to an **adaptive, quality-controlled narrative engine**:

| Enhancement              | Impact                                      | Complexity |
| ------------------------ | ------------------------------------------- | ---------- |
| GraphRAG Quality Control | Better relevance, fewer irrelevant passages | Medium     |
| Dynamic Prompt Structure | Personalized readings for returning users   | High       |
| Spine Enforcement        | Guaranteed narrative completeness           | Medium     |
| Timing Refinement        | More nuanced temporal guidance              | Low-Medium |

**Recommended implementation order**:

1. Timing Refinement (lowest risk, immediate value)
2. Spine Enforcement (catches quality issues early)
3. GraphRAG Quality Control (improves grounding)
4. Dynamic Prompts (highest complexity, requires user auth)
