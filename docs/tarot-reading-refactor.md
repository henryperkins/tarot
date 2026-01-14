# Tarot Reading Refactor Plan

> ⚠️ **STATUS: DESIGN DOCUMENT — NOT IMPLEMENTED**
>
> This document describes a proposed refactor to split `functions/api/tarot-reading.js` into modular files under `functions/lib/tarotReading/`. **This refactor was never implemented.** The codebase still uses the monolithic `tarot-reading.js` file.
>
> The todo items marked `[x]` below represent the original plan, not actual implementation status. If you're looking for the current implementation, see:
> - [`functions/api/tarot-reading.js`](../functions/api/tarot-reading.js) — Main endpoint (current implementation)
> - [`functions/lib/narrativeBuilder.js`](../functions/lib/narrativeBuilder.js) — Narrative generation
> - [`functions/lib/narrative/`](../functions/lib/narrative/) — Spread-specific composers
>
> **Last reviewed:** 2026-01-10

---

## ✅ What's actually required (and what I'm going to do)

tarot-reading.js is currently ~2,500+ lines and is imported by:

- the Worker router: index.js imports `* as tarotReading` and expects `onRequestGet/onRequestPost`
- tests that import **directly** from the endpoint module:
  - api.vision.test.mjs imports `onRequestPost`
  - api.validatePayload.test.mjs imports `validatePayload`
  - telemetry.test.js imports `summarizeNarrativeEnhancements`

So we need to:

1. Keep `onRequestGet` + `onRequestPost` in tarot-reading.js (not a thin re-export-only file).
2. Keep `validatePayload` and `summarizeNarrativeEnhancements` available from the same module for test compatibility.
3. Move the **big** helper subsystems out into `functions/lib/tarotReading/*` (server-only boundary is correct).
4. While we’re here, apply the known bugfix in your plan: **release the reading reservation on 503** (all backends failed), not only in the catch block.

Below is a cohesive refactor that reduces tarot-reading.js to an orchestrator while keeping it “real” (not a shell).

---

## Todo

- [x] Identify all imports/usages of tarot-reading.js (worker + tests)
- [x] Design module split that preserves runtime boundaries and public exports
- [x] Implement new `functions/lib/tarotReading/*` modules (analysis, backends, metrics, telemetry, etc.)
- [x] Rewrite tarot-reading.js as orchestration glue (still contains the endpoint flow)
- [x] Preserve `validatePayload` + `summarizeNarrativeEnhancements` exports for tests
- [x] Fix reservation leak on 503 (all backends failed)

---

## 1) Add new modules (server-only) under `functions/lib/tarotReading/`

```javascript
import { parseMinorName } from "../minorMeta.js";

const SPREAD_NAME_MAP = {
  "Celtic Cross (Classic 10-Card)": { key: "celtic", count: 10 },
  "Three-Card Story (Past · Present · Future)": { key: "threeCard", count: 3 },
  "Five-Card Clarity": { key: "fiveCard", count: 5 },
  "One-Card Insight": { key: "single", count: 1 },
  "Relationship Snapshot": { key: "relationship", count: 3 },
  "Decision / Two-Path": { key: "decision", count: 5 },
};

export function getSpreadDefinition(spreadName) {
  return SPREAD_NAME_MAP[spreadName] || null;
}

export function getSpreadKey(spreadName) {
  const def = getSpreadDefinition(spreadName);
  return def?.key || "general";
}

export function getExpectedCardCount(spreadName) {
  const def = getSpreadDefinition(spreadName);
  return def?.count ?? null;
}

/**
 * Validates the baseline structure expected by the tarot-reading endpoint.
 * Kept as a standalone export because tests and prompts explicitly reference it.
 */
export function validatePayload({ spreadInfo, cardsInfo }) {
  if (!spreadInfo || typeof spreadInfo.name !== "string") {
    return "Missing spread information.";
  }

  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0) {
    return "No cards were provided for the reading.";
  }

  const def = getSpreadDefinition(spreadInfo.name);
  if (!def) {
    return `Unknown spread "${spreadInfo.name}". Please update your app and try again.`;
  }

  const providedKey =
    typeof spreadInfo.key === "string" ? spreadInfo.key.trim() : "";
  if (providedKey && providedKey !== def.key) {
    return `Spread "${spreadInfo.name}" did not match its expected key. Please refresh and try again.`;
  }

  if (typeof def.count === "number" && cardsInfo.length !== def.count) {
    return `Spread "${spreadInfo.name}" expects ${def.count} cards, but received ${cardsInfo.length}.`;
  }

  const hasInvalidCard = cardsInfo.some((card) => {
    if (typeof card !== "object" || card === null) return true;
    const requiredFields = ["position", "card", "orientation", "meaning"];
    return requiredFields.some((field) => {
      const value = card[field];
      return typeof value !== "string" || !value.trim();
    });
  });

  if (hasInvalidCard) {
    return "One or more cards are missing required details.";
  }

  // Warn (without rejecting) if Minor Arcana cards are missing suit/rank metadata.
  const minorMetadataIssues = [];
  cardsInfo.forEach((card, index) => {
    if (!card || typeof card.card !== "string") return;
    const parsed = parseMinorName(card.card);
    if (!parsed) return;

    const hasSuit =
      typeof card.suit === "string" && card.suit.trim().length > 0;
    const hasRank =
      typeof card.rank === "string" && card.rank.trim().length > 0;
    const hasRankValue = typeof card.rankValue === "number";

    if (hasSuit && hasRank && hasRankValue) return;

    const missing = [];
    if (!hasSuit) missing.push("suit");
    if (!hasRank) missing.push("rank");
    if (!hasRankValue) missing.push("rankValue");

    minorMetadataIssues.push(
      `${card.card} @ position ${index + 1} missing ${missing.join(", ")}`
    );
  });

  if (minorMetadataIssues.length > 0) {
    console.warn(
      "[validatePayload] Minor Arcana metadata incomplete; falling back to string parsing which may degrade nuance:",
      minorMetadataIssues.join(" | ")
    );
  }

  return null;
}
```

```javascript
import { getClientIdentifier } from "../clientId.js";
import {
  decrementUsageCounter,
  getMonthKeyUtc,
  getResetAtUtc,
  getUsageRow,
  incrementUsageCounter,
} from "../usageTracking.js";

const READINGS_MONTHLY_KEY_PREFIX = "readings-monthly";
const READINGS_MONTHLY_TTL_SECONDS = 35 * 24 * 60 * 60;

export async function releaseReadingReservation(env, reservation) {
  if (!reservation) return;

  try {
    if (reservation.type === "d1") {
      await decrementUsageCounter(env.DB, {
        userId: reservation.userId,
        month: reservation.month,
        counter: "readings",
        nowMs: Date.now(),
      });
      return;
    }

    if (reservation.type === "kv") {
      const store = env?.RATELIMIT;
      if (!store) return;

      const existing = await store.get(reservation.key);
      const currentCount = existing ? Number(existing) || 0 : 0;
      const next = Math.max(0, currentCount - 1);

      await store.put(reservation.key, String(next), {
        expirationTtl: READINGS_MONTHLY_TTL_SECONDS,
      });
    }
  } catch (error) {
    console.warn(
      "Failed to release reading reservation:",
      error?.message || error
    );
  }
}

export async function enforceReadingLimit(
  env,
  request,
  user,
  subscription,
  requestId
) {
  const limit = subscription?.config?.monthlyReadings ?? 5;
  const now = new Date();
  const month = getMonthKeyUtc(now);
  const resetAt = getResetAtUtc(now);

  // Authenticated users: use D1 tracking (also tracks unlimited tiers for usage meter).
  if (user?.id && env?.DB) {
    try {
      const nowMs = Date.now();

      if (limit === Infinity) {
        await incrementUsageCounter(env.DB, {
          userId: user.id,
          month,
          counter: "readings",
          nowMs,
        });
        const row = await getUsageRow(env.DB, user.id, month);
        return {
          allowed: true,
          used: row?.readings_count || 0,
          limit: null,
          resetAt,
          reservation: { type: "d1", userId: user.id, month },
        };
      }

      const incrementResult = await incrementUsageCounter(env.DB, {
        userId: user.id,
        month,
        counter: "readings",
        limit,
        nowMs,
      });

      if (incrementResult.changed === 0) {
        const row = await getUsageRow(env.DB, user.id, month);
        const used = row?.readings_count || limit;
        return {
          allowed: false,
          used,
          limit,
          resetAt,
          message: `You've reached your monthly reading limit (${limit}). Upgrade for more readings.`,
        };
      }

      const row = await getUsageRow(env.DB, user.id, month);
      const used = row?.readings_count || 0;
      console.log(
        `[${requestId}] Reading usage: ${used}/${limit} (${
          subscription?.effectiveTier || subscription?.tier || "free"
        })`
      );

      return {
        allowed: true,
        used,
        limit,
        resetAt,
        reservation: { type: "d1", userId: user.id, month },
      };
    } catch (error) {
      console.error(
        `[${requestId}] Usage tracking error (allowing request):`,
        error.message
      );
      return {
        allowed: true,
        used: 0,
        limit: limit === Infinity ? null : limit,
        resetAt,
      };
    }
  }

  // Anonymous users: enforce IP-based monthly quota in KV when available.
  if (limit !== Infinity && env?.RATELIMIT) {
    try {
      const clientId = getClientIdentifier(request);
      const key = `${READINGS_MONTHLY_KEY_PREFIX}:${clientId}:${month}`;
      const existing = await env.RATELIMIT.get(key);
      const currentCount = existing ? Number(existing) || 0 : 0;

      if (currentCount >= limit) {
        return {
          allowed: false,
          used: currentCount,
          limit,
          resetAt,
          message: `You've reached your monthly reading limit (${limit}). Upgrade for more readings.`,
        };
      }

      const nextCount = currentCount + 1;
      await env.RATELIMIT.put(key, String(nextCount), {
        expirationTtl: READINGS_MONTHLY_TTL_SECONDS,
      });

      return {
        allowed: true,
        used: nextCount,
        limit,
        resetAt,
        reservation: { type: "kv", key },
      };
    } catch (error) {
      console.warn(
        `[${requestId}] Guest usage tracking failed, allowing request:`,
        error?.message || error
      );
    }
  }

  return {
    allowed: true,
    used: 0,
    limit: limit === Infinity ? null : limit,
    resetAt,
  };
}
```

```javascript
import { redactPII } from "../promptEngineering.js";

function normalizeBooleanFlag(value) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null) return false;
  return String(value).toLowerCase() === "true";
}

export function trimForTelemetry(text = "", limit = 500) {
  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}...` : trimmed;
}

function shouldLogLLMPrompts(env) {
  if (!env) return false;

  const normalizedBranch = (env.CF_PAGES_BRANCH || "").toLowerCase();
  const prodBranches = new Set(["main", "master"]);
  if (env.CF_PAGES_BRANCH_PRODUCTION) {
    prodBranches.add(String(env.CF_PAGES_BRANCH_PRODUCTION).toLowerCase());
  }
  const isProdBranch = normalizedBranch && prodBranches.has(normalizedBranch);

  const isProd =
    isProdBranch ||
    env.NODE_ENV === "production" ||
    env.ENVIRONMENT === "production";

  if (isProd) return false;

  if (env.LOG_LLM_PROMPTS !== undefined)
    return normalizeBooleanFlag(env.LOG_LLM_PROMPTS);
  if (env.DEBUG_LLM_PROMPTS !== undefined)
    return normalizeBooleanFlag(env.DEBUG_LLM_PROMPTS);
  if (env.DEBUG_PROMPTS !== undefined)
    return normalizeBooleanFlag(env.DEBUG_PROMPTS);
  return false;
}

function shouldLogNarrativeEnhancements(env) {
  if (!env) return false;
  if (env.LOG_NARRATIVE_ENHANCEMENTS !== undefined) {
    return normalizeBooleanFlag(env.LOG_NARRATIVE_ENHANCEMENTS);
  }
  if (env.DEBUG_NARRATIVE_ENHANCEMENTS !== undefined) {
    return normalizeBooleanFlag(env.DEBUG_NARRATIVE_ENHANCEMENTS);
  }
  return false;
}

function shouldLogEnhancementTelemetry(env) {
  if (!env) return false;
  if (env.LOG_ENHANCEMENT_TELEMETRY !== undefined) {
    return normalizeBooleanFlag(env.LOG_ENHANCEMENT_TELEMETRY);
  }
  if (env.DEBUG_ENHANCEMENT_TELEMETRY !== undefined) {
    return normalizeBooleanFlag(env.DEBUG_ENHANCEMENT_TELEMETRY);
  }
  return false;
}

export function summarizeNarrativeEnhancements(sections = []) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return null;
  }

  const summary = {
    totalSections: sections.length,
    enhancedSections: 0,
    enhancementCounts: {},
    sectionTypes: {},
    sectionNames: [],
    missingCounts: {},
    totalEnhancements: 0,
    sections: [],
  };

  sections.forEach((section, index) => {
    const metadata = section?.metadata || {};
    const validation = section?.validation || {};
    const type = metadata.type || metadata.section || `section-${index + 1}`;
    const name = metadata.name || metadata.label || metadata.title || type;

    const enhanced = Boolean(validation?.enhanced);
    const enhancements = Array.isArray(validation?.enhancements)
      ? validation.enhancements
      : [];
    const missing = Array.isArray(validation?.missing)
      ? validation.missing
      : [];
    const present = validation?.present || {};

    if (!summary.sectionTypes[type]) {
      summary.sectionTypes[type] = { total: 0, enhanced: 0 };
    }
    summary.sectionTypes[type].total += 1;
    if (enhanced) {
      summary.enhancedSections += 1;
      summary.sectionTypes[type].enhanced += 1;
    }

    enhancements.forEach((tag) => {
      if (!tag) return;
      summary.enhancementCounts[tag] =
        (summary.enhancementCounts[tag] || 0) + 1;
    });

    summary.totalEnhancements += enhancements.length;
    summary.sectionNames.push(name);

    missing.forEach((key) => {
      if (!key) return;
      summary.missingCounts[key] = (summary.missingCounts[key] || 0) + 1;
    });

    summary.sections.push({
      type,
      name,
      enhanced,
      enhancements,
      missing,
      present,
    });
  });

  return summary;
}

export function maybeLogNarrativeEnhancements(
  env,
  requestId,
  provider,
  summary
) {
  if (!shouldLogNarrativeEnhancements(env) || !summary) return;
  console.log(
    `[${requestId}] [${provider}] Narrative enhancement summary:`,
    summary
  );
}

export function maybeLogPromptPayload(
  env,
  requestId,
  backendLabel,
  systemPrompt,
  userPrompt,
  promptMeta,
  options = {}
) {
  if (!shouldLogLLMPrompts(env)) return;

  const personalization = options.personalization || null;
  const redactionOptions = {
    displayName: personalization?.displayName,
  };

  const redactedSystem = redactPII(systemPrompt, redactionOptions);
  const redactedUser = redactPII(userPrompt, redactionOptions);

  console.log(`[${requestId}] [${backendLabel}] === SYSTEM PROMPT BEGIN ===`);
  console.log(redactedSystem);
  console.log(`[${requestId}] [${backendLabel}] === SYSTEM PROMPT END ===`);

  console.log(`[${requestId}] [${backendLabel}] === USER PROMPT BEGIN ===`);
  console.log(redactedUser);
  console.log(`[${requestId}] [${backendLabel}] === USER PROMPT END ===`);

  if (promptMeta?.estimatedTokens) {
    const { total, system, user, budget } = promptMeta.estimatedTokens;
    const budgetNote = budget ? ` / budget ${budget}` : "";
    console.log(
      `[${requestId}] [${backendLabel}] Estimated tokens (slimming enabled): total ${total} (system ${system} + user ${user})${budgetNote}`
    );
  }
}

export function maybeLogEnhancementTelemetry(env, requestId, telemetry) {
  if (!shouldLogEnhancementTelemetry(env)) return;
  if (!telemetry) return;

  const summary = telemetry.summary || telemetry;
  console.log(
    `[${requestId}] [enhancement-telemetry] sections=${
      summary.totalSections || 0
    }, enhanced=${summary.enhancedSections || 0}, tags=${
      summary.totalEnhancements || 0
    }`
  );

  if (
    summary.enhancementCounts &&
    Object.keys(summary.enhancementCounts).length > 0
  ) {
    console.log(
      `[${requestId}] [enhancement-telemetry] enhancementCounts`,
      summary.enhancementCounts
    );
  }
}
```

```javascript
import {
  canonicalizeCardName,
  canonicalCardKey,
} from "../../../shared/vision/cardNameMapping.js";
import { normalizeVisionLabel } from "../visionLabels.js";

export function annotateVisionInsights(
  proofInsights,
  cardsInfo = [],
  deckStyle = "rws-1909"
) {
  if (!Array.isArray(proofInsights) || proofInsights.length === 0) {
    return [];
  }

  const normalizedDeck = deckStyle || "rws-1909";
  const drawnNames = new Set(
    (cardsInfo || [])
      .map((card) => canonicalCardKey(card?.card || card?.name, normalizedDeck))
      .filter(Boolean)
  );

  return proofInsights
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const predictedCard = canonicalizeCardName(
        entry.predictedCard || entry.card,
        normalizedDeck
      );
      if (!predictedCard) return null;

      const predictedKey = canonicalCardKey(predictedCard, normalizedDeck);
      const matchesDrawnCard =
        drawnNames.size > 0
          ? predictedKey
            ? drawnNames.has(predictedKey)
            : null
          : null;

      const matches = Array.isArray(entry.matches)
        ? entry.matches
            .map((match) => {
              const card = canonicalizeCardName(
                match?.card || match?.cardName,
                normalizedDeck
              );
              if (!card) return null;
              return { ...match, card };
            })
            .filter(Boolean)
            .slice(0, 3)
        : [];

      return {
        label: normalizeVisionLabel(entry.label),
        predictedCard,
        confidence:
          typeof entry.confidence === "number" ? entry.confidence : null,
        basis: typeof entry.basis === "string" ? entry.basis : null,
        matchesDrawnCard,
        matches,
        attention: entry.attention || null,
        symbolVerification: entry.symbolVerification || null,
        visualProfile: entry.visualProfile || null,
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

export function buildVisionMetrics(insights, avgConfidence, mismatchCount) {
  const safeInsights = Array.isArray(insights) ? insights : [];
  const symbolStats = safeInsights
    .filter((entry) => entry && entry.symbolVerification)
    .map((entry) => ({
      card: entry.predictedCard,
      matchRate:
        typeof entry.symbolVerification.matchRate === "number"
          ? entry.symbolVerification.matchRate
          : null,
      missingSymbols: Array.isArray(entry.symbolVerification.missingSymbols)
        ? entry.symbolVerification.missingSymbols
        : [],
      unexpectedDetections: Array.isArray(
        entry.symbolVerification.unexpectedDetections
      )
        ? entry.symbolVerification.unexpectedDetections
        : [],
      expectedCount: entry.symbolVerification.expectedCount ?? null,
      detectedCount: entry.symbolVerification.detectedCount ?? null,
    }));

  return {
    uploads: safeInsights.length,
    avgConfidence: Number.isFinite(avgConfidence) ? avgConfidence : null,
    mismatchCount,
    symbolStats,
  };
}
```

```javascript
import { validateReadingNarrative } from "../narrativeSpine.js";
import { canonicalCardKey } from "../../../shared/vision/cardNameMapping.js";
import {
  escapeRegex,
  hasExplicitCardContext,
  normalizeCardName,
  AMBIGUOUS_CARD_NAMES,
  TAROT_TERMINOLOGY_EXCLUSIONS,
} from "../cardContextDetection.js";

import { MAJOR_ARCANA } from "../../../src/data/majorArcana.js";
import { MINOR_ARCANA } from "../../../src/data/minorArcana.js";

const CARD_NAME_PATTERNS = [...MAJOR_ARCANA, ...MINOR_ARCANA]
  .map((card) => card.name)
  .map((name) => ({
    name,
    normalized: normalizeCardName(name),
    pattern: new RegExp(`\\b${escapeRegex(name)}\\b`, "i"),
  }));

const CARD_NAMES_REQUIRING_CARD_CASE = new Set(
  MAJOR_ARCANA.map((card) => normalizeCardName(card.name)).filter(
    (name) => name.startsWith("the ") || name === "wheel of fortune"
  )
);

const CARD_NAME_STOP_WORDS = new Set(["the", "of"]);

function analyzeCardCoverage(readingText, cardsInfo = []) {
  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0) {
    return { coverage: 1, missingCards: [] };
  }

  const text = typeof readingText === "string" ? readingText : "";
  const missingCards = cardsInfo
    .filter((card) => card && typeof card.card === "string")
    .map((card) => card.card)
    .filter((name) => {
      if (!name) return true;
      const pattern = new RegExp(escapeRegex(name), "i");
      return !pattern.test(text);
    });

  const presentCount = cardsInfo.length - missingCards.length;
  const coverage = cardsInfo.length ? presentCount / cardsInfo.length : 1;
  return { coverage, missingCards };
}

function looksLikeCardNameCase(matchText) {
  if (!matchText || typeof matchText !== "string") return false;
  if (matchText === matchText.toUpperCase()) return true;

  const words = matchText.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return false;

  const significantWords = words.filter(
    (word) => !CARD_NAME_STOP_WORDS.has(word.toLowerCase())
  );
  if (!significantWords.length) return false;

  return significantWords.every((word) => /^[A-Z]/.test(word));
}

function detectHallucinatedCards(
  readingText,
  cardsInfo = [],
  deckStyle = "rws-1909"
) {
  if (!readingText) return [];

  let text = typeof readingText === "string" ? readingText : "";
  const safeCards = Array.isArray(cardsInfo) ? cardsInfo : [];

  TAROT_TERMINOLOGY_EXCLUSIONS.forEach((pattern) => {
    text = text.replace(pattern, "[TERMINOLOGY]");
  });

  const drawnKeys = new Set(
    safeCards
      .filter((card) => card && typeof card.card === "string")
      .map((card) => {
        const canonical = canonicalCardKey(card.card, deckStyle);
        return canonical || normalizeCardName(card.card);
      })
      .filter(Boolean)
  );

  const hallucinated = [];

  CARD_NAME_PATTERNS.forEach(({ name, normalized, pattern }) => {
    const flags = pattern.flags.includes("g")
      ? pattern.flags
      : `${pattern.flags}g`;
    const matches = Array.from(
      text.matchAll(new RegExp(pattern.source, flags))
    );
    if (!matches.length) return;

    const hasContext = hasExplicitCardContext(text, name);
    const requiresCardCase = CARD_NAMES_REQUIRING_CARD_CASE.has(normalized);
    const hasCardCase = requiresCardCase
      ? matches.some((match) => looksLikeCardNameCase(match[0]))
      : true;

    if (AMBIGUOUS_CARD_NAMES.has(normalized) && !hasContext) {
      return;
    }

    if (requiresCardCase && !hasContext && !hasCardCase) {
      return;
    }

    const key = canonicalCardKey(name, deckStyle) || normalized;
    if (!drawnKeys.has(key)) {
      hallucinated.push(name);
    }
  });

  return [...new Set(hallucinated)];
}

export function buildNarrativeMetrics(
  readingText,
  cardsInfo,
  deckStyle = "rws-1909"
) {
  const text = typeof readingText === "string" ? readingText : "";
  const safeCards = Array.isArray(cardsInfo) ? cardsInfo : [];

  const spine = validateReadingNarrative(text);
  const coverage = analyzeCardCoverage(text, safeCards);
  const hallucinatedCards = detectHallucinatedCards(text, safeCards, deckStyle);

  return {
    spine: {
      isValid: spine.isValid,
      totalSections: spine.totalSections || 0,
      completeSections: spine.completeSections || 0,
      incompleteSections: spine.incompleteSections || 0,
      suggestions: spine.suggestions || [],
    },
    cardCoverage: coverage.coverage,
    missingCards: coverage.missingCards,
    hallucinatedCards,
  };
}
```

```javascript
import { getPositionWeight } from "../positionWeights.js";
import { buildNarrativeMetrics } from "./narrativeMetrics.js";

const HIGH_WEIGHT_POSITION_THRESHOLD = 0.75;
const MIN_SPINE_COMPLETION = 0.5;

function getQualityGateThresholds(spreadKey, cardCount) {
  const normalizedSpread = (spreadKey || "general").toLowerCase();

  if (normalizedSpread === "celtic") {
    return {
      minCoverage: 0.75,
      maxHallucinations: 2,
      highWeightThreshold: HIGH_WEIGHT_POSITION_THRESHOLD,
    };
  }

  if (
    ["relationship", "decision", "threecard", "fivecard", "single"].includes(
      normalizedSpread
    )
  ) {
    return {
      minCoverage: 0.8,
      maxHallucinations: 1,
      highWeightThreshold: HIGH_WEIGHT_POSITION_THRESHOLD,
    };
  }

  const isLargeSpread = cardCount >= 8;
  return {
    minCoverage: isLargeSpread ? 0.75 : 0.8,
    maxHallucinations: isLargeSpread ? 2 : 1,
    highWeightThreshold: HIGH_WEIGHT_POSITION_THRESHOLD,
  };
}

export function runNarrativeQualityGate({
  readingText,
  cardsInfo,
  deckStyle,
  spreadKey,
}) {
  const metrics = buildNarrativeMetrics(readingText, cardsInfo, deckStyle);
  const issues = [];

  const { minCoverage, maxHallucinations, highWeightThreshold } =
    getQualityGateThresholds(spreadKey, (cardsInfo || []).length);

  if (
    metrics.hallucinatedCards &&
    metrics.hallucinatedCards.length > maxHallucinations
  ) {
    issues.push(
      `excessive hallucinated cards (${
        metrics.hallucinatedCards.length
      } > ${maxHallucinations} allowed): ${metrics.hallucinatedCards.join(
        ", "
      )}`
    );
  }

  if (metrics.cardCoverage < minCoverage) {
    issues.push(
      `low card coverage: ${(metrics.cardCoverage * 100).toFixed(0)}% (min ${(
        minCoverage * 100
      ).toFixed(0)}%)`
    );
  }

  const missingSet = new Set(metrics.missingCards || []);
  const highWeightMisses = (cardsInfo || []).reduce((acc, card, index) => {
    if (!card || !card.card) return acc;
    const weight = getPositionWeight(spreadKey, index) || 0;
    if (weight >= highWeightThreshold && missingSet.has(card.card)) {
      acc.push(card.card);
    }
    return acc;
  }, []);

  if (highWeightMisses.length > 0) {
    issues.push(
      `missing high-weight positions: ${highWeightMisses.join(", ")}`
    );
  }

  const spine = metrics.spine || null;
  if (spine && spine.totalSections > 0) {
    const ratio = (spine.completeSections || 0) / spine.totalSections;
    if (ratio < MIN_SPINE_COMPLETION) {
      issues.push(
        `incomplete spine (${spine.completeSections || 0}/${
          spine.totalSections
        }, need ${Math.ceil(MIN_SPINE_COMPLETION * 100)}%)`
      );
    }
  }

  if (metrics.spine && metrics.spine.totalSections === 0) {
    issues.push("no narrative sections detected");
  }

  return {
    passed: issues.length === 0,
    issues,
    metrics,
  };
}
```

```javascript
export async function persistReadingMetrics(env, payload) {
  if (!env?.METRICS_DB?.put) return;

  try {
    const key = `reading:${payload.requestId}`;
    await env.METRICS_DB.put(key, JSON.stringify(payload), {
      metadata: {
        provider: payload.provider,
        spreadKey: payload.spreadKey,
        deckStyle: payload.deckStyle,
        timestamp: payload.timestamp,
      },
    });
  } catch (err) {
    console.warn(
      `[${payload.requestId}] Failed to persist reading metrics: ${err.message}`
    );
  }
}
```

```javascript
import {
  analyzeSpreadThemes,
  analyzeCelticCross,
  analyzeThreeCard,
  analyzeFiveCard,
  analyzeRelationship,
  analyzeDecision,
} from "../spreadAnalysis.js";

import {
  fetchEphemerisContext,
  fetchEphemerisForecast,
  matchTransitsToCards,
  getEphemerisSummary,
} from "../ephemerisIntegration.js";

import { getSpreadKey } from "./spread.js";

function normalizeBooleanFlag(value) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null) return false;
  return String(value).toLowerCase() === "true";
}

/**
 * Determine if semantic scoring should be enabled for GraphRAG retrieval.
 * Returns true/false for explicit env override, null for auto-detect.
 */
export function getSemanticScoringConfig(env) {
  if (!env) return null;

  if (env.ENABLE_SEMANTIC_SCORING !== undefined) {
    return normalizeBooleanFlag(env.ENABLE_SEMANTIC_SCORING);
  }
  if (env.GRAPHRAG_SEMANTIC_SCORING !== undefined) {
    return normalizeBooleanFlag(env.GRAPHRAG_SEMANTIC_SCORING);
  }

  return null;
}

// Detect if question asks about future timeframe
function detectForecastTimeframe(userQuestion) {
  if (!userQuestion) return null;
  const q = userQuestion.toLowerCase();

  if (
    q.includes("season") ||
    q.includes("next few months") ||
    q.includes("coming months") ||
    q.includes("quarter")
  ) {
    return 90;
  }

  if (
    q.includes("month") ||
    q.includes("30 days") ||
    q.includes("next weeks") ||
    q.includes("coming weeks")
  ) {
    return 30;
  }

  if (q.includes("week") || q.includes("next few days")) {
    return 14;
  }

  return null;
}

// Minimal, UI-friendly ephemeris payload
export function buildEphemerisClientPayload(ephemerisContext) {
  if (!ephemerisContext?.available) {
    return {
      available: false,
      error: ephemerisContext?.error || null,
    };
  }

  const moon = ephemerisContext.moonPhase || null;
  return {
    available: true,
    timestamp: ephemerisContext.timestamp || null,
    source: ephemerisContext.source || null,
    summary: getEphemerisSummary(ephemerisContext),
    moonPhase: moon
      ? {
          phaseName: moon.phaseName || null,
          illumination:
            typeof moon.illumination === "number" ? moon.illumination : null,
          sign: moon.sign || null,
          isWaxing: typeof moon.isWaxing === "boolean" ? moon.isWaxing : null,
          interpretation: moon.interpretation || null,
        }
      : null,
  };
}

/**
 * Perform comprehensive spread analysis (themes + spread-specific + GraphRAG memo + ephemeris)
 */
export async function performSpreadAnalysis(
  spreadInfo,
  cardsInfo,
  options = {},
  requestId = "unknown",
  env = null
) {
  if (!spreadInfo || !Array.isArray(cardsInfo) || cardsInfo.length === 0) {
    console.warn(
      `[${requestId}] performSpreadAnalysis: missing/invalid spreadInfo/cardsInfo, falling back to generic themes only.`
    );
    return {
      themes: {
        suitCounts: {},
        elementCounts: {},
        reversalCount: 0,
        reversalFramework: "contextual",
        reversalDescription: {
          name: "Context-Dependent",
          description:
            "Reversed cards are interpreted individually based on context.",
          guidance:
            "Read each reversal in light of its position and relationships.",
        },
      },
      spreadAnalysis: null,
      spreadKey: "general",
    };
  }

  if (env && !options.env) options.env = env;

  const semanticScoringConfig = env ? getSemanticScoringConfig(env) : null;
  if (
    semanticScoringConfig !== null &&
    options.enableSemanticScoring === undefined
  ) {
    options.enableSemanticScoring = semanticScoringConfig;
  }

  // Theme analysis
  let themes;
  try {
    console.log(`[${requestId}] Analyzing spread themes...`);
    themes = await analyzeSpreadThemes(cardsInfo, {
      reversalFrameworkOverride: options.reversalFrameworkOverride,
      deckStyle: options.deckStyle,
      userQuestion: options.userQuestion,
    });
  } catch (err) {
    console.error(
      `[${requestId}] performSpreadAnalysis: analyzeSpreadThemes failed; using minimal fallback.`,
      err
    );
    themes = {
      suitCounts: {},
      elementCounts: {},
      reversalCount: 0,
      reversalFramework: "contextual",
      reversalDescription: {
        name: "Context-Dependent",
        description:
          "Reversed cards are interpreted individually based on context.",
        guidance:
          "Read each reversal by listening to its position and neighboring cards.",
      },
    };
  }

  // Spread-specific
  let spreadAnalysis = null;
  let spreadKey = "general";
  let graphRAGPayload = null;

  try {
    spreadKey = getSpreadKey(spreadInfo.name);
    console.log(`[${requestId}] Spread key identified: ${spreadKey}`);

    if (spreadKey === "celtic" && cardsInfo.length === 10) {
      spreadAnalysis = analyzeCelticCross(cardsInfo);
    } else if (spreadKey === "threeCard" && cardsInfo.length === 3) {
      spreadAnalysis = analyzeThreeCard(cardsInfo);
    } else if (spreadKey === "fiveCard" && cardsInfo.length === 5) {
      spreadAnalysis = analyzeFiveCard(cardsInfo);
    } else if (spreadKey === "relationship" && cardsInfo.length >= 3) {
      spreadAnalysis = analyzeRelationship(cardsInfo);
    } else if (spreadKey === "decision" && cardsInfo.length === 5) {
      spreadAnalysis = analyzeDecision(cardsInfo);
    }
  } catch (err) {
    console.error(
      `[${requestId}] performSpreadAnalysis: spread-specific analysis failed; continuing with themes only.`,
      err
    );
    spreadAnalysis = null;
    spreadKey = "general";
  }

  // GraphRAG memoization (shared across backends)
  try {
    const graphKeys = themes?.knowledgeGraph?.graphKeys;
    if (graphKeys) {
      const {
        isGraphRAGEnabled,
        retrievePassages,
        retrievePassagesWithQuality,
        formatPassagesForPrompt,
        buildRetrievalSummary,
        buildQualityRetrievalSummary,
        getPassageCountForSpread,
        isSemanticScoringAvailable,
      } = await import("../graphRAG.js");

      const semanticAvailable = isSemanticScoringAvailable(options.env);
      const requestedSemanticScoring =
        options.enableSemanticScoring === true ||
        (options.enableSemanticScoring === undefined && semanticAvailable);
      const enableSemanticScoring =
        requestedSemanticScoring && semanticAvailable;

      const attachGraphRAGPlaceholder = (reason) => {
        const patternsDetected = {
          completeTriads: graphKeys?.completeTriadIds?.length || 0,
          partialTriads:
            (graphKeys?.triadIds?.length || 0) -
            (graphKeys?.completeTriadIds?.length || 0),
          foolsJourneyStage: graphKeys?.foolsJourneyStageKey || null,
          highDyads:
            graphKeys?.dyadPairs?.filter((d) => d.significance === "high")
              .length || 0,
          strongSuitProgressions:
            graphKeys?.suitProgressions?.filter(
              (p) => p.significance === "strong-progression"
            ).length || 0,
        };

        graphRAGPayload = {
          passages: [],
          formattedBlock: null,
          retrievalSummary: {
            graphKeysProvided: Boolean(graphKeys),
            patternsDetected,
            passagesRetrieved: 0,
            passagesByType: {},
            passagesByPriority: {},
            semanticScoringRequested: requestedSemanticScoring,
            semanticScoringUsed: false,
            semanticScoringFallback: requestedSemanticScoring,
            reason,
          },
          maxPassages: 0,
          initialPassageCount: 0,
          rankingStrategy: null,
          enableSemanticScoring,
          qualityMetrics: null,
          semanticScoringRequested: requestedSemanticScoring,
          semanticScoringUsed: false,
          semanticScoringFallback: requestedSemanticScoring,
        };

        themes.knowledgeGraph = themes.knowledgeGraph || {
          graphKeys: graphKeys || null,
        };
        themes.knowledgeGraph.graphRAGPayload = graphRAGPayload;
      };

      if (requestedSemanticScoring && !semanticAvailable) {
        console.warn(
          `[${requestId}] Semantic scoring requested but embeddings unavailable; falling back to keyword scoring.`
        );
      }

      if (!isGraphRAGEnabled(options.env)) {
        attachGraphRAGPlaceholder("graphrag-disabled-env");
      } else {
        const tier = options.subscriptionTier || "free";
        const maxPassages = getPassageCountForSpread(
          spreadKey || "general",
          tier
        );
        console.log(
          `[${requestId}] GraphRAG passage limit: ${maxPassages} (tier: ${tier})`
        );

        let passages;
        let retrievalSummary;

        if (enableSemanticScoring) {
          passages = await retrievePassagesWithQuality(graphKeys, {
            maxPassages,
            userQuery: options.userQuestion,
            minRelevanceScore: 0.3,
            enableDeduplication: true,
            enableSemanticScoring: true,
            env: options.env,
          });
          retrievalSummary = buildQualityRetrievalSummary(graphKeys, passages);
        } else {
          passages = retrievePassages(graphKeys, {
            maxPassages,
            userQuery: options.userQuestion,
          });
          retrievalSummary = buildRetrievalSummary(graphKeys, passages);
        }

        const semanticScoringRequested = requestedSemanticScoring;
        const semanticScoringUsed =
          retrievalSummary?.qualityMetrics?.semanticScoringUsed === true;
        const semanticScoringFallback =
          semanticScoringRequested && !semanticScoringUsed;

        retrievalSummary = {
          ...retrievalSummary,
          semanticScoringRequested,
          semanticScoringUsed,
          semanticScoringFallback,
        };

        const formattedBlock = formatPassagesForPrompt(passages, {
          includeSource: true,
          markdown: true,
        });

        graphRAGPayload = {
          passages,
          formattedBlock,
          retrievalSummary,
          maxPassages,
          initialPassageCount: passages.length,
          rankingStrategy: enableSemanticScoring ? "semantic" : "keyword",
          enableSemanticScoring,
          qualityMetrics: retrievalSummary.qualityMetrics || null,
          semanticScoringRequested,
          semanticScoringUsed,
          semanticScoringFallback,
        };

        themes.knowledgeGraph = {
          ...(themes.knowledgeGraph || {}),
          graphRAGPayload,
        };
      }
    } else {
      graphRAGPayload = {
        passages: [],
        formattedBlock: null,
        retrievalSummary: {
          graphKeysProvided: false,
          patternsDetected: {
            completeTriads: 0,
            partialTriads: 0,
            foolsJourneyStage: null,
            highDyads: 0,
            strongSuitProgressions: 0,
          },
          passagesRetrieved: 0,
          passagesByType: {},
          passagesByPriority: {},
          semanticScoringRequested: options.enableSemanticScoring === true,
          semanticScoringUsed: false,
          semanticScoringFallback: options.enableSemanticScoring === true,
          reason: "missing-graph-keys",
        },
        maxPassages: 0,
        initialPassageCount: 0,
        rankingStrategy: null,
        enableSemanticScoring: Boolean(options.enableSemanticScoring),
        qualityMetrics: null,
        semanticScoringRequested: options.enableSemanticScoring === true,
        semanticScoringUsed: false,
        semanticScoringFallback: options.enableSemanticScoring === true,
      };
      themes.knowledgeGraph = themes.knowledgeGraph || { graphKeys: null };
      themes.knowledgeGraph.graphRAGPayload = graphRAGPayload;
      console.warn(
        `[${requestId}] GraphRAG skipped: no graph patterns detected for this spread.`
      );
    }
  } catch (err) {
    console.warn(
      `[${requestId}] performSpreadAnalysis: GraphRAG memoization failed: ${err.message}`
    );
  }

  // Ephemeris integration
  let ephemerisContext = null;
  let transitResonances = [];
  let ephemerisForecast = null;

  try {
    console.log(`[${requestId}] Fetching ephemeris context...`);
    ephemerisContext = await fetchEphemerisContext();

    if (ephemerisContext?.available) {
      transitResonances = matchTransitsToCards(cardsInfo, ephemerisContext);

      const forecastDays = detectForecastTimeframe(options.userQuestion);
      if (forecastDays) {
        console.log(
          `[${requestId}] Detected future timeframe, fetching ${forecastDays}-day forecast...`
        );
        ephemerisForecast = await fetchEphemerisForecast(forecastDays);
      }
    } else {
      console.log(`[${requestId}] Ephemeris context not available`);
    }
  } catch (err) {
    console.warn(
      `[${requestId}] performSpreadAnalysis: Ephemeris fetch failed: ${err.message}`
    );
    ephemerisContext = { available: false, error: err.message };
  }

  return {
    themes,
    spreadAnalysis,
    spreadKey,
    graphRAGPayload,
    ephemerisContext,
    ephemerisForecast,
    transitResonances,
  };
}
```

```javascript
import {
  buildCelticCrossReading,
  buildThreeCardReading,
  buildFiveCardReading,
  buildRelationshipReading,
  buildDecisionReading,
  buildSingleCardReading,
  buildEnhancedClaudePrompt,
  buildPositionCardText,
  buildElementalRemedies,
  shouldOfferElementalRemedies,
  formatReversalLens,
  computeRemedyRotationIndex,
} from "../narrativeBuilder.js";

import { enhanceSection } from "../narrativeSpine.js";
import {
  getToneStyle,
  buildPersonalizedClosing,
  getDepthProfile,
} from "../narrative/styleHelpers.js";
import { buildOpening, setProseMode } from "../narrative/helpers.js";
import { buildReadingReasoning } from "../narrative/reasoning.js";
import { getSemanticScoringConfig } from "./analysis.js";
import { maybeLogPromptPayload } from "./telemetry.js";

function requiresHighReasoningEffort(modelName = "") {
  const normalized = modelName.toLowerCase();
  return normalized.includes("gpt-5-pro") || normalized.includes("gpt-5.1");
}

const NARRATIVE_BACKEND_ORDER = [
  "azure-gpt5",
  "claude-opus45",
  "local-composer",
];

const NARRATIVE_BACKENDS = {
  "azure-gpt5": {
    id: "azure-gpt5",
    label: "Azure GPT-5 Responses",
    isAvailable: (env) =>
      Boolean(
        env?.AZURE_OPENAI_API_KEY &&
          env?.AZURE_OPENAI_ENDPOINT &&
          env?.AZURE_OPENAI_GPT5_MODEL
      ),
  },
  "claude-opus45": {
    id: "claude-opus45",
    label: "Claude Opus 4.5 (Azure Foundry)",
    isAvailable: (env) =>
      Boolean(
        (env?.AZURE_ANTHROPIC_API_KEY || env?.AZURE_OPENAI_API_KEY) &&
          env?.AZURE_ANTHROPIC_ENDPOINT
      ),
  },
  "local-composer": {
    id: "local-composer",
    label: "Local Narrative Composer",
    isAvailable: () => true,
  },
};

export function getAvailableNarrativeBackends(env) {
  return NARRATIVE_BACKEND_ORDER.map((id) => {
    const backend = NARRATIVE_BACKENDS[id];
    if (!backend) return null;
    if (!backend.isAvailable(env)) return null;
    return backend;
  }).filter(Boolean);
}

async function generateWithAzureGPT5Responses(
  env,
  payload,
  requestId = "unknown"
) {
  const {
    spreadInfo,
    cardsInfo,
    userQuestion,
    reflectionsText,
    analysis,
    context,
    visionInsights,
    contextDiagnostics = [],
  } = payload;

  let capturedSystemPrompt = "";
  let capturedUserPrompt = "";

  const rawEndpoint = env.AZURE_OPENAI_ENDPOINT || "";
  const endpoint = rawEndpoint
    .replace(/\/+$/, "")
    .replace(/\/openai\/v1\/?$/, "")
    .replace(/\/openai\/?$/, "");

  const apiKey = env.AZURE_OPENAI_API_KEY;
  const deploymentName = env.AZURE_OPENAI_GPT5_MODEL;
  const apiVersion =
    env.AZURE_OPENAI_RESPONSES_API_VERSION ||
    env.AZURE_OPENAI_API_VERSION ||
    "v1";

  const semanticScoringConfig = getSemanticScoringConfig(env);
  const enableSemanticScoring =
    semanticScoringConfig !== null
      ? semanticScoringConfig
      : analysis.graphRAGPayload?.enableSemanticScoring ?? null;

  const {
    systemPrompt,
    userPrompt,
    promptMeta,
    contextDiagnostics: promptDiagnostics,
  } = buildEnhancedClaudePrompt({
    spreadInfo,
    cardsInfo,
    userQuestion,
    reflectionsText,
    themes: analysis.themes,
    spreadAnalysis: analysis.spreadAnalysis,
    context,
    visionInsights,
    deckStyle: payload.deckStyle || "rws-1909",
    graphRAGPayload: analysis.graphRAGPayload,
    ephemerisContext: analysis.ephemerisContext,
    ephemerisForecast: analysis.ephemerisForecast,
    transitResonances: analysis.transitResonances,
    budgetTarget: "azure",
    contextDiagnostics,
    promptBudgetEnv: env,
    personalization: payload.personalization,
    enableSemanticScoring,
    subscriptionTier: payload.subscriptionTier,
  });

  if (promptMeta) payload.promptMeta = promptMeta;
  if (Array.isArray(promptDiagnostics) && promptDiagnostics.length) {
    payload.contextDiagnostics = Array.from(
      new Set([...(payload.contextDiagnostics || []), ...promptDiagnostics])
    );
  }

  capturedSystemPrompt = systemPrompt;
  capturedUserPrompt = userPrompt;

  maybeLogPromptPayload(
    env,
    requestId,
    "azure-gpt5",
    systemPrompt,
    userPrompt,
    promptMeta,
    { personalization: payload.personalization }
  );

  const url = `${endpoint}/openai/v1/responses?api-version=${encodeURIComponent(
    apiVersion
  )}`;

  let reasoningEffort = "medium";
  if (deploymentName && requiresHighReasoningEffort(deploymentName)) {
    reasoningEffort = "high";
  }

  const requestBody = {
    model: deploymentName,
    instructions: systemPrompt,
    input: userPrompt,
    reasoning: { effort: reasoningEffort },
    text: { verbosity: "medium" },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      `Azure OpenAI GPT-5 Responses API error ${response.status}: ${errText}`
    );
  }

  const data = await response.json();

  let content = "";
  if (data.output && Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.type === "message" && item.content) {
        for (const contentItem of item.content) {
          if (contentItem.type === "output_text" && contentItem.text) {
            content += contentItem.text;
          }
        }
      }
    }
  }
  if (!content && data.output_text) content = data.output_text;

  if (!content || typeof content !== "string" || !content.trim()) {
    throw new Error("Empty response from Azure OpenAI GPT-5 Responses API");
  }

  return {
    reading: content.trim(),
    prompts: { system: capturedSystemPrompt, user: capturedUserPrompt },
    usage: data.usage,
  };
}

async function generateWithClaudeSonnet45Enhanced(
  env,
  payload,
  requestId = "unknown"
) {
  const {
    spreadInfo,
    cardsInfo,
    userQuestion,
    reflectionsText,
    analysis,
    context,
    visionInsights,
    contextDiagnostics = [],
  } = payload;

  let capturedSystemPrompt = "";
  let capturedUserPrompt = "";

  const apiKey = env.AZURE_ANTHROPIC_API_KEY || env.AZURE_OPENAI_API_KEY;
  const baseEndpoint = env.AZURE_ANTHROPIC_ENDPOINT || "";
  const apiUrl = baseEndpoint.endsWith("/v1/messages")
    ? baseEndpoint
    : `${baseEndpoint.replace(/\/$/, "")}/v1/messages`;
  const model = env.AZURE_ANTHROPIC_MODEL || "claude-opus-4-5";

  const semanticScoringConfig = getSemanticScoringConfig(env);
  const enableSemanticScoring =
    semanticScoringConfig !== null
      ? semanticScoringConfig
      : analysis.graphRAGPayload?.enableSemanticScoring ?? null;

  const {
    systemPrompt,
    userPrompt,
    promptMeta,
    contextDiagnostics: promptDiagnostics,
  } = buildEnhancedClaudePrompt({
    spreadInfo,
    cardsInfo,
    userQuestion,
    reflectionsText,
    themes: analysis.themes,
    spreadAnalysis: analysis.spreadAnalysis,
    context,
    visionInsights,
    deckStyle: payload.deckStyle || "rws-1909",
    graphRAGPayload: analysis.graphRAGPayload,
    ephemerisContext: analysis.ephemerisContext,
    ephemerisForecast: analysis.ephemerisForecast,
    transitResonances: analysis.transitResonances,
    budgetTarget: "claude",
    contextDiagnostics,
    promptBudgetEnv: env,
    personalization: payload.personalization,
    enableSemanticScoring,
    subscriptionTier: payload.subscriptionTier,
  });

  capturedSystemPrompt = systemPrompt;
  capturedUserPrompt = userPrompt;

  if (promptMeta) payload.promptMeta = promptMeta;
  if (Array.isArray(promptDiagnostics) && promptDiagnostics.length) {
    payload.contextDiagnostics = Array.from(
      new Set([...(payload.contextDiagnostics || []), ...promptDiagnostics])
    );
  }

  maybeLogPromptPayload(
    env,
    requestId,
    "claude-opus45",
    systemPrompt,
    userPrompt,
    promptMeta,
    { personalization: payload.personalization }
  );

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: 0.75,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      `Azure Anthropic proxy error ${response.status}: ${errText}`
    );
  }

  const data = await response.json();
  const content = Array.isArray(data.content)
    ? data.content
        .map((part) => part.text || "")
        .join("")
        .trim()
    : (data.content?.toString?.() || "").trim();

  if (!content) {
    throw new Error("Empty response from Azure Claude Opus 4.5");
  }

  return {
    reading: content,
    prompts: { system: capturedSystemPrompt, user: capturedUserPrompt },
    usage: data.usage,
  };
}

const SPREAD_READING_BUILDERS = {
  celtic: (
    {
      spreadAnalysis,
      cardsInfo,
      userQuestion,
      reflectionsText,
      themes,
      context,
    },
    options = {}
  ) =>
    spreadAnalysis
      ? buildCelticCrossReading(
          {
            cardsInfo,
            userQuestion,
            reflectionsText,
            celticAnalysis: spreadAnalysis,
            themes,
            context,
          },
          options
        )
      : null,

  threeCard: (
    {
      spreadAnalysis,
      cardsInfo,
      userQuestion,
      reflectionsText,
      themes,
      context,
    },
    options = {}
  ) =>
    spreadAnalysis
      ? buildThreeCardReading(
          {
            cardsInfo,
            userQuestion,
            reflectionsText,
            threeCardAnalysis: spreadAnalysis,
            themes,
            context,
          },
          options
        )
      : null,

  fiveCard: (
    {
      spreadAnalysis,
      cardsInfo,
      userQuestion,
      reflectionsText,
      themes,
      context,
    },
    options = {}
  ) =>
    spreadAnalysis
      ? buildFiveCardReading(
          {
            cardsInfo,
            userQuestion,
            reflectionsText,
            fiveCardAnalysis: spreadAnalysis,
            themes,
            context,
          },
          options
        )
      : null,

  relationship: (
    { cardsInfo, userQuestion, reflectionsText, themes, context },
    options = {}
  ) =>
    buildRelationshipReading(
      { cardsInfo, userQuestion, reflectionsText, themes, context },
      options
    ),

  decision: (
    { cardsInfo, userQuestion, reflectionsText, themes, context },
    options = {}
  ) =>
    buildDecisionReading(
      { cardsInfo, userQuestion, reflectionsText, themes, context },
      options
    ),

  single: (
    { cardsInfo, userQuestion, reflectionsText, themes, context },
    options = {}
  ) =>
    buildSingleCardReading(
      { cardsInfo, userQuestion, reflectionsText, themes, context },
      options
    ),
};

function condenseDescriptionForDepth(text, sentenceCount = 2) {
  if (!text || typeof text !== "string") return text;
  const segments = text.match(/[^.!?]+[.!?]?/g);
  if (!segments || segments.length <= sentenceCount) return text;
  return segments.slice(0, sentenceCount).join(" ").trim();
}

function buildDepthReflectionPrompt(card, position) {
  if (!card) return "";
  const cardName =
    typeof card.card === "string" && card.card.trim()
      ? card.card.trim()
      : "this card";
  const orientation =
    typeof card.orientation === "string" && card.orientation.trim()
      ? ` ${card.orientation.trim()}`
      : "";
  const focus = (position || "this position").toLowerCase();
  return `Journal on how ${cardName}${orientation} wants you to engage with ${focus}.`;
}

function buildCardsSection(cardsInfo, context, options = {}) {
  const safeCards = Array.isArray(cardsInfo) ? cardsInfo : [];
  const normalizedDetail =
    typeof options.detailLevel === "string" ? options.detailLevel : "standard";
  const heading =
    options.heading ||
    (normalizedDetail === "concise"
      ? "**Quick Card Highlights**"
      : normalizedDetail === "expansive"
      ? "**Layered Card Weaving**"
      : "**The Cards Speak**");

  const lines = safeCards.map((card, index) => {
    const position = (card?.position || "").trim() || `Card ${index + 1}`;
    let description = buildPositionCardText(card, position, { context });

    if (normalizedDetail === "concise") {
      description = condenseDescriptionForDepth(description);
    } else if (normalizedDetail === "expansive") {
      const reflectionPrompt = buildDepthReflectionPrompt(card, position);
      if (reflectionPrompt)
        description = `${description}\n*Deep dive: ${reflectionPrompt}*`;
    }

    return `**${position}**\n${description}`;
  });

  let section = `${heading}\n\n${lines.join("\n\n")}`;
  if (options.note) section += `\n\n${options.note}`;
  return section;
}

function buildEnhancedSynthesis(
  cardsInfo,
  themes,
  userQuestion,
  context,
  options = {}
) {
  const safeCards = Array.isArray(cardsInfo) ? cardsInfo : [];
  const depthProfile = options.depthProfile || null;
  const heading =
    depthProfile?.key === "short"
      ? "**Quick Trajectory**"
      : depthProfile?.key === "deep"
      ? "**Deep Synthesis & Guidance**"
      : "**Synthesis & Guidance**";

  let section = `${heading}\n\n`;
  const rotationIndex = Number.isFinite(options.rotationIndex)
    ? Math.abs(Math.floor(options.rotationIndex))
    : 0;

  if (context && context !== "general") {
    const contextMap = {
      love: "relationships and heart-centered experience",
      career: "career, vocation, and material pathways",
      self: "personal growth and inner landscape",
      spiritual: "spiritual practice and meaning-making",
    };
    section += `Focus: Interpreting the spread through the lens of ${
      contextMap[context] || "your life as a whole"
    }.\n\n`;
  }

  if (themes.suitFocus) section += `${themes.suitFocus}\n\n`;

  if (themes.timingProfile === "near-term-tilt") {
    section += `Pace: These influences are likely to move or clarify in the nearer term, assuming you stay engaged with them.\n\n`;
  } else if (themes.timingProfile === "longer-arc-tilt") {
    section += `Pace: This reading leans toward a slower-burn, structural arc that unfolds over a longer chapter, not overnight.\n\n`;
  } else if (themes.timingProfile === "developing-arc") {
    section += `Pace: Themes here describe an unfolding chapter—neither instant nor distant, but evolving as you work with them.\n\n`;
  }

  if (themes.archetypeDescription)
    section += `${themes.archetypeDescription}\n\n`;

  if (themes.elementalBalance) {
    section += `Elemental context: ${themes.elementalBalance}\n\n`;
    if (shouldOfferElementalRemedies(themes.elementCounts, safeCards.length)) {
      const remedies = buildElementalRemedies(
        themes.elementCounts,
        safeCards.length,
        context,
        { rotationIndex }
      );
      if (remedies) section += `${remedies}\n\n`;
    }
  }

  if (themes.lifecycleStage)
    section += `The cards speak to ${themes.lifecycleStage}.\n\n`;

  section += userQuestion?.trim()
    ? "Take the next small, intentional step that honors both your intuition and the practical realities at hand.\n\n"
    : "Carry this insight gently into your next steps, allowing space for new awareness to bloom.\n\n";

  section +=
    "Remember: These cards show a trajectory based on current patterns. Your awareness, choices, and actions shape what unfolds. You are co-creating this path.";

  if (depthProfile?.synthesisReminder)
    section += `\n\n${depthProfile.synthesisReminder}`;

  return section;
}

function appendGenericReversalReminder(readingText, cardsInfo, themes) {
  if (!readingText) return readingText;

  const hasReversed =
    Array.isArray(cardsInfo) &&
    cardsInfo.some(
      (card) => (card?.orientation || "").toLowerCase() === "reversed"
    );
  if (!hasReversed || !themes?.reversalDescription) return readingText;

  const lens = formatReversalLens(themes, {
    includeExamples: false,
    includeReminder: false,
  });
  const guidanceLine = Array.isArray(lens.lines)
    ? lens.lines.find((line) => line.toLowerCase().includes("guidance"))
    : null;
  const reminderText = guidanceLine
    ? guidanceLine.replace(/^[-\s]*/, "").trim()
    : themes.reversalDescription.guidance
    ? `Guidance: ${themes.reversalDescription.guidance}`
    : `Reversal lens: ${themes.reversalDescription.name}`;

  const reminder = `*Reversal lens reminder: ${reminderText}*`;
  if (readingText.includes(reminder)) return readingText;

  return `${readingText}\n\n${reminder}`;
}

async function buildGenericReading(
  { spreadInfo, cardsInfo, userQuestion, reflectionsText, themes, context },
  options = {}
) {
  const { collectValidation, personalization = null } = options;

  const spreadName = spreadInfo?.name?.trim() || "your chosen spread";
  const entries = [];
  const safeCards = Array.isArray(cardsInfo) ? cardsInfo : [];
  const remedyRotationIndex = computeRemedyRotationIndex({
    cardsInfo: safeCards,
    userQuestion,
    spreadInfo,
  });
  const tone = getToneStyle(personalization?.readingTone);
  const depthProfile = getDepthProfile(personalization?.preferredSpreadDepth);

  const composedOpening = buildOpening(spreadName, userQuestion, context, {
    personalization,
  });
  const openingText = depthProfile?.openingPreface
    ? `${depthProfile.openingPreface}\n\n${composedOpening}`.trim()
    : composedOpening;

  entries.push({
    text: openingText,
    metadata: {
      type: "opening",
      cards: safeCards.length > 0 ? [safeCards[0]] : [],
    },
  });

  let cardsSection = buildCardsSection(safeCards, context, {
    detailLevel: depthProfile?.cardDetail,
    heading: depthProfile?.cardsHeading,
    note: depthProfile?.cardsNote,
  });

  if (tone.challengeFraming) {
    cardsSection += `\n\nTreat any friction or challenge as a ${tone.challengeFraming}; the spread is highlighting choices, not fixed fate.`;
  }

  entries.push({
    text: cardsSection,
    metadata: { type: "cards", cards: safeCards },
  });

  if (reflectionsText && reflectionsText.trim()) {
    entries.push({
      text: `**Your Reflections**\n\n${reflectionsText.trim()}\n\nYour intuitive impressions add personal meaning to this reading.`,
      metadata: { type: "reflections" },
    });
  }

  const finalCard =
    safeCards.length > 0 ? safeCards[safeCards.length - 1] : null;
  entries.push({
    text: buildEnhancedSynthesis(safeCards, themes, userQuestion, context, {
      rotationIndex: remedyRotationIndex,
      depthProfile,
    }),
    metadata: { type: "synthesis", cards: finalCard ? [finalCard] : [] },
  });

  const enhancedSections = entries
    .map(({ text, metadata }) => {
      const result = enhanceSection(text, metadata || {});
      if (!result || !result.text) return null;

      const sectionRecord = {
        text: result.text,
        metadata: metadata || {},
        validation: result.validation || null,
      };
      if (typeof collectValidation === "function")
        collectValidation(sectionRecord);
      return sectionRecord;
    })
    .filter(Boolean);

  const readingBody = enhancedSections
    .map((section) => section.text)
    .join("\n\n");
  const closing = buildPersonalizedClosing(personalization);
  const bodyWithClosing = closing
    ? `${readingBody}\n\n${closing}`
    : readingBody;
  return appendGenericReversalReminder(bodyWithClosing, safeCards, themes);
}

async function generateReadingFromAnalysis(
  {
    spreadKey,
    spreadAnalysis,
    cardsInfo,
    userQuestion,
    reflectionsText,
    themes,
    spreadInfo,
    context,
  },
  options = {}
) {
  const builder = SPREAD_READING_BUILDERS[spreadKey];

  if (builder) {
    const result = await builder(
      {
        spreadAnalysis,
        cardsInfo,
        userQuestion,
        reflectionsText,
        themes,
        spreadInfo,
        context,
      },
      options
    );
    if (typeof result === "string" && result.trim()) return result;
  }

  return buildGenericReading(
    { spreadInfo, cardsInfo, userQuestion, reflectionsText, themes, context },
    options
  );
}

async function composeReadingEnhanced(payload) {
  const {
    spreadInfo,
    cardsInfo,
    userQuestion,
    reflectionsText,
    analysis,
    context,
    personalization = null,
  } = payload;
  const { themes, spreadAnalysis, spreadKey } = analysis;

  const collectedSections = [];
  const reasoning = buildReadingReasoning(
    cardsInfo,
    userQuestion,
    context,
    themes,
    spreadKey
  );

  setProseMode(true);
  try {
    const readingText = await generateReadingFromAnalysis(
      {
        spreadKey,
        spreadAnalysis,
        cardsInfo,
        userQuestion,
        reflectionsText,
        themes,
        spreadInfo,
        context,
      },
      {
        personalization,
        reasoning,
        collectValidation: (section) => {
          if (!section) return;
          collectedSections.push({
            text: section.text || "",
            metadata: section.metadata || {},
            validation: section.validation || null,
          });
        },
      }
    );

    payload.narrativeEnhancements = collectedSections;
    if (!payload.promptMeta) {
      payload.promptMeta = {
        backend: "local-composer",
        estimatedTokens: null,
        slimmingSteps: [],
      };
    }

    return { reading: readingText, prompts: null, usage: null };
  } finally {
    setProseMode(false);
  }
}

export async function runNarrativeBackend(backendId, env, payload, requestId) {
  switch (backendId) {
    case "azure-gpt5":
      return generateWithAzureGPT5Responses(env, payload, requestId);
    case "claude-opus45":
      return generateWithClaudeSonnet45Enhanced(env, payload, requestId);
    case "local-composer":
    default:
      return composeReadingEnhanced(payload);
  }
}
```

---

## 2) Replace tarot-reading.js with a smaller orchestrator (still “real” logic)

This keeps the endpoint flow, but pulls the bulky subsystems into the new modules.

```javascript
/**
 * Cloudflare Pages/Workers handler for generating a personalized tarot reading.
 *
 * This file is intentionally kept as an orchestration layer:
 * - request validation + entitlement checks + safety gates
 * - calls analysis + narrative backends + quality/eval gates
 * Implementation details live in functions/lib/tarotReading/*
 */

import { inferContext } from "../lib/contextDetection.js";
import { jsonResponse, readJsonBody } from "../lib/utils.js";
import { safeParseReadingRequest } from "../../shared/contracts/readingSchema.js";
import { verifyVisionProof } from "../lib/visionProof.js";
import {
  buildPromptEngineeringPayload,
  shouldPersistPrompts,
  redactPII,
} from "../lib/promptEngineering.js";
import {
  scheduleEvaluation,
  runSyncEvaluationGate,
  generateSafeFallbackReading,
} from "../lib/evaluation.js";
import { deriveEmotionalTone } from "../../src/data/emotionMapping.js";
import { detectCrisisSignals } from "../lib/safetyChecks.js";
import { collectGraphRAGAlerts } from "../lib/graphRAGAlerts.js";
import { getUserFromRequest } from "../lib/auth.js";
import { enforceApiCallLimit } from "../lib/apiUsage.js";
import {
  buildTierLimitedPayload,
  getSubscriptionContext,
} from "../lib/entitlements.js";

import {
  enforceReadingLimit,
  releaseReadingReservation,
} from "../lib/tarotReading/readingLimit.js";
import {
  performSpreadAnalysis,
  buildEphemerisClientPayload,
} from "../lib/tarotReading/analysis.js";
import {
  annotateVisionInsights,
  buildVisionMetrics,
} from "../lib/tarotReading/vision.js";
import {
  getAvailableNarrativeBackends,
  runNarrativeBackend,
} from "../lib/tarotReading/backends.js";
import { runNarrativeQualityGate } from "../lib/tarotReading/qualityGate.js";
import { persistReadingMetrics } from "../lib/tarotReading/metricsStorage.js";
import {
  summarizeNarrativeEnhancements,
  trimForTelemetry,
  maybeLogNarrativeEnhancements,
  maybeLogEnhancementTelemetry,
} from "../lib/tarotReading/telemetry.js";

import { validatePayload, getSpreadKey } from "../lib/tarotReading/spread.js";

// Preserve public exports for tests/back-compat:
export { summarizeNarrativeEnhancements };
export { validatePayload };

export const onRequestGet = async ({ env }) => {
  return jsonResponse({
    status: "ok",
    provider: env?.AZURE_OPENAI_GPT5_MODEL ? "azure-gpt5" : "local",
    timestamp: new Date().toISOString(),
  });
};

export const onRequestPost = async ({ request, env, waitUntil }) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID
    ? crypto.randomUUID()
    : `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  let readingReservation = null;

  console.log(`[${requestId}] === TAROT READING REQUEST START ===`);

  try {
    const payload = await readJsonBody(request);
    const schemaResult = safeParseReadingRequest(payload);
    if (!schemaResult.success) {
      console.error(
        `[${requestId}] Schema validation failed: ${schemaResult.error}`
      );
      return jsonResponse(
        { error: schemaResult.error || "Invalid reading request payload." },
        { status: 400 }
      );
    }

    const normalizedPayload = schemaResult.data;
    const {
      spreadInfo,
      cardsInfo,
      userQuestion,
      reflectionsText,
      reversalFrameworkOverride,
      visionProof,
      deckStyle: requestDeckStyle,
      personalization,
    } = normalizedPayload;

    const deckStyle = requestDeckStyle || spreadInfo?.deckStyle || "rws-1909";

    const validationError = validatePayload(normalizedPayload);
    if (validationError) {
      console.error(`[${requestId}] Validation failed:`, validationError);
      return jsonResponse({ error: validationError }, { status: 400 });
    }

    const user = await getUserFromRequest(request, env);
    const subscription = getSubscriptionContext(user);
    const subscriptionTier = subscription.effectiveTier;

    const requestedSpreadKey = getSpreadKey(spreadInfo.name);
    const spreadsConfig = subscription.config?.spreads;
    const spreadAllowed =
      spreadsConfig === "all" ||
      spreadsConfig === "all+custom" ||
      (Array.isArray(spreadsConfig) &&
        spreadsConfig.includes(requestedSpreadKey));

    if (!spreadAllowed) {
      const requiredTier = ["relationship", "decision", "celtic"].includes(
        requestedSpreadKey
      )
        ? "plus"
        : "pro";
      return jsonResponse(
        buildTierLimitedPayload({
          message: `The "${spreadInfo.name}" spread requires an active ${
            requiredTier === "plus" ? "Plus" : "Pro"
          } subscription`,
          user,
          requiredTier,
        }),
        { status: 403 }
      );
    }

    // API key usage is Pro-only and subject to API call limits.
    if (user?.auth_provider === "api_key") {
      const apiLimit = await enforceApiCallLimit(env, user);
      if (!apiLimit.allowed) {
        return jsonResponse(apiLimit.payload, { status: apiLimit.status });
      }
    }

    // Vision validation is OPTIONAL - used for research/development purposes only
    let sanitizedVisionInsights = [];
    let visionMetrics = null;

    if (!visionProof) {
      console.log(
        `[${requestId}] No vision proof provided (research mode disabled).`
      );
    } else {
      console.log(
        `[${requestId}] Vision proof provided - validating for research telemetry...`
      );

      let verifiedProof;
      try {
        verifiedProof = await verifyVisionProof(
          visionProof,
          env?.VISION_PROOF_SECRET
        );
      } catch (err) {
        console.warn(
          `[${requestId}] Vision proof verification failed: ${err.message}`
        );
        const status = /expired/i.test(err.message) ? 409 : 400;
        return jsonResponse(
          {
            error:
              err.message ||
              "Vision validation proof invalid. Please re-upload your photos.",
          },
          { status }
        );
      }

      sanitizedVisionInsights = annotateVisionInsights(
        verifiedProof.insights,
        cardsInfo,
        deckStyle
      );

      if (sanitizedVisionInsights.length > 0) {
        const avgConfidence =
          sanitizedVisionInsights.reduce(
            (sum, item) => sum + (item.confidence ?? 0),
            0
          ) / sanitizedVisionInsights.length;

        const mismatchedDetections = sanitizedVisionInsights.filter(
          (item) => item.matchesDrawnCard === false
        );
        visionMetrics = buildVisionMetrics(
          sanitizedVisionInsights,
          avgConfidence,
          mismatchedDetections.length
        );

        if (mismatchedDetections.length > 0) {
          console.warn(
            `[${requestId}] Vision uploads that do not match selected cards:`,
            mismatchedDetections.map((item) => ({
              label: item.label,
              predictedCard: item.predictedCard,
              confidence: item.confidence,
            }))
          );
        }
      } else {
        console.warn(
          `[${requestId}] Vision proof did not contain recognizable cards. Proceeding without vision data.`
        );
      }
    }

    // Enforce reading limits before expensive processing
    const readingLimitResult = await enforceReadingLimit(
      env,
      request,
      user,
      subscription,
      requestId
    );
    if (!readingLimitResult.allowed) {
      return jsonResponse(
        {
          error: readingLimitResult.message,
          tierLimited: true,
          currentTier: subscriptionTier,
          accountTier: subscription.tier,
          currentStatus: subscription.status,
          effectiveTier: subscriptionTier,
          limit: readingLimitResult.limit,
          used: readingLimitResult.used,
          resetAt: readingLimitResult.resetAt,
        },
        { status: 429 }
      );
    }
    readingReservation = readingLimitResult.reservation || null;

    // STEP 1: Comprehensive spread analysis
    const analysis = await performSpreadAnalysis(
      spreadInfo,
      cardsInfo,
      {
        reversalFrameworkOverride,
        deckStyle,
        userQuestion,
        subscriptionTier,
      },
      requestId,
      env
    );

    const contextDiagnostics = [];
    const context = inferContext(userQuestion, analysis.spreadKey, {
      onUnknown: (message) => contextDiagnostics.push(message),
    });

    // Crisis safety check (blocks, returns safe fallback)
    const crisisCheck = detectCrisisSignals(
      [userQuestion, reflectionsText].filter(Boolean).join(" ")
    );
    if (crisisCheck.matched) {
      const crisisReason = `crisis_${
        crisisCheck.categories.join("_") || "safety"
      }`;

      const timestamp = new Date().toISOString();
      const graphRAGStats = analysis.graphRAGPayload?.retrievalSummary || null;

      const narrativeMetrics = {
        spine: {
          isValid: false,
          totalSections: 0,
          completeSections: 0,
          incompleteSections: 0,
          suggestions: [],
        },
        cardCoverage: 0,
        missingCards: (cardsInfo || []).map((c) => c?.card).filter(Boolean),
        hallucinatedCards: [],
      };

      await persistReadingMetrics(env, {
        requestId,
        timestamp,
        provider: "safe-fallback",
        deckStyle,
        spreadKey: analysis.spreadKey,
        context,
        vision: null,
        narrative: narrativeMetrics,
        narrativeEnhancements: null,
        graphRAG: graphRAGStats,
        promptMeta: null,
        enhancementTelemetry: null,
        contextDiagnostics: {
          messages: contextDiagnostics,
          count: contextDiagnostics.length,
        },
        promptEngineering: null,
        llmUsage: null,
        evalGate: { ran: false, blocked: true, reason: crisisReason },
      });

      return jsonResponse({
        reading: generateSafeFallbackReading({
          spreadKey: analysis.spreadKey,
          cardCount: cardsInfo.length,
          reason: crisisReason,
        }),
        provider: "safe-fallback",
        requestId,
        themes: analysis.themes,
        emotionalTone: deriveEmotionalTone(analysis.themes),
        ephemeris: buildEphemerisClientPayload(analysis.ephemerisContext),
        context,
        contextDiagnostics,
        narrativeMetrics,
        graphRAG: graphRAGStats,
        spreadAnalysis: {
          version: "1.0.0",
          spreadKey: analysis.spreadKey,
          ...(analysis.spreadAnalysis || {}),
        },
        gateBlocked: true,
        gateReason: crisisReason,
      });
    }

    // STEP 2: Narrative backends + quality gate
    const baseContextDiagnostics = Array.isArray(contextDiagnostics)
      ? [...contextDiagnostics]
      : [];

    const narrativePayload = {
      spreadInfo,
      cardsInfo,
      userQuestion,
      reflectionsText,
      analysis,
      context,
      contextDiagnostics: [...baseContextDiagnostics],
      visionInsights: sanitizedVisionInsights,
      deckStyle,
      personalization: personalization || null,
      subscriptionTier,
      narrativeEnhancements: [],
      graphRAGPayload: analysis.graphRAGPayload || null,
      promptMeta: null,
    };

    let reading = null;
    let provider = "local-composer";
    let acceptedQualityMetrics = null;

    const backendErrors = [];
    const candidateBackends = getAvailableNarrativeBackends(env);
    const backendsToTry = candidateBackends.length
      ? candidateBackends
      : [{ id: "local-composer", label: "Local Narrative Composer" }];

    let capturedPrompts = null;
    let capturedUsage = null;

    for (const backend of backendsToTry) {
      narrativePayload.narrativeEnhancements = [];
      narrativePayload.promptMeta = null;
      narrativePayload.contextDiagnostics = [...baseContextDiagnostics];

      try {
        const backendResult = await runNarrativeBackend(
          backend.id,
          env,
          narrativePayload,
          requestId
        );

        const result =
          typeof backendResult === "object" && backendResult.reading
            ? backendResult.reading
            : backendResult;

        if (!result || !result.toString().trim()) {
          throw new Error("Backend returned empty narrative.");
        }

        const attemptPrompts =
          typeof backendResult === "object" && backendResult.prompts
            ? backendResult.prompts
            : null;

        const attemptUsage =
          typeof backendResult === "object" && backendResult.usage
            ? backendResult.usage
            : null;

        const graphRAGAlerts = collectGraphRAGAlerts(
          narrativePayload.promptMeta || {}
        );
        if (graphRAGAlerts.length) {
          graphRAGAlerts.forEach((msg) =>
            console.warn(`[${requestId}] [${backend.id}] ${msg}`)
          );
          narrativePayload.contextDiagnostics = Array.from(
            new Set([
              ...(narrativePayload.contextDiagnostics || []),
              ...graphRAGAlerts,
            ])
          );
        }

        const gate = runNarrativeQualityGate({
          readingText: result,
          cardsInfo,
          deckStyle,
          spreadKey: analysis.spreadKey,
        });

        if (!gate.passed) {
          throw new Error(
            `Narrative failed quality checks: ${gate.issues.join("; ")}`
          );
        }

        capturedPrompts = attemptPrompts;
        capturedUsage = attemptUsage;

        reading = result;
        provider = backend.id;
        acceptedQualityMetrics = gate.metrics;
        break;
      } catch (err) {
        backendErrors.push({ backend: backend.id, error: err.message });
        console.error(
          `[${requestId}] Backend ${backend.id} failed:`,
          err.message
        );
      }
    }

    if (!reading) {
      console.error(
        `[${requestId}] All narrative backends failed.`,
        backendErrors
      );

      // IMPORTANT: refund reservation on clear infrastructure failure (503)
      await releaseReadingReservation(env, readingReservation);

      return jsonResponse(
        {
          error:
            "All narrative providers are currently unavailable. Please try again shortly.",
        },
        { status: 503 }
      );
    }

    // STEP 3: Build telemetry + evaluation gate + persist metrics
    const narrativeEnhancementSummary = summarizeNarrativeEnhancements(
      Array.isArray(narrativePayload.narrativeEnhancements)
        ? narrativePayload.narrativeEnhancements
        : []
    );
    maybeLogNarrativeEnhancements(
      env,
      requestId,
      provider,
      narrativeEnhancementSummary
    );

    const enhancementSections = (
      narrativePayload.narrativeEnhancements || []
    ).map((section, index) => ({
      name:
        section?.metadata?.name ||
        section?.metadata?.type ||
        `section-${index + 1}`,
      type: section?.metadata?.type || null,
      // Privacy: redact PII in stored section snippets
      text: redactPII(trimForTelemetry(section?.text, 500), {
        displayName: personalization?.displayName,
      }),
      validation: section?.validation || null,
    }));

    const enhancementTelemetry = narrativeEnhancementSummary
      ? { summary: narrativeEnhancementSummary, sections: enhancementSections }
      : null;

    const promptMeta = narrativePayload.promptMeta || null;
    const graphRAGStats = analysis.graphRAGPayload?.retrievalSummary || null;
    const finalContextDiagnostics = Array.isArray(
      narrativePayload.contextDiagnostics
    )
      ? narrativePayload.contextDiagnostics
      : contextDiagnostics;

    const baseNarrativeMetrics = acceptedQualityMetrics;
    const narrativeMetrics = {
      ...baseNarrativeMetrics,
      enhancementTelemetry,
      promptTokens: promptMeta?.estimatedTokens || null,
      promptSlimming: promptMeta?.slimmingSteps || [],
      graphRAG: graphRAGStats,
      contextDiagnostics: {
        messages: finalContextDiagnostics,
        count: finalContextDiagnostics.length,
      },
    };

    const evalParams = {
      reading,
      userQuestion,
      cardsInfo,
      spreadKey: analysis.spreadKey,
      requestId,
    };

    const gateResult = await runSyncEvaluationGate(
      env,
      evalParams,
      baseNarrativeMetrics
    );
    let evalGateResult = gateResult;
    let wasGateBlocked = false;

    if (!gateResult.passed) {
      wasGateBlocked = true;
      console.warn(
        `[${requestId}] Evaluation gate blocked reading, using safe fallback`
      );

      reading = generateSafeFallbackReading({
        spreadKey: analysis.spreadKey,
        cardCount: cardsInfo.length,
        reason: gateResult.gateResult?.reason,
      });
      provider = "safe-fallback";
    }

    let promptEngineering = null;
    if (capturedPrompts && shouldPersistPrompts(env)) {
      try {
        promptEngineering = await buildPromptEngineeringPayload({
          systemPrompt: capturedPrompts.system,
          userPrompt: capturedPrompts.user,
          response: reading,
          redactionOptions: { displayName: personalization?.displayName },
        });
      } catch (err) {
        console.warn(
          `[${requestId}] Failed to build prompt engineering payload: ${err.message}`
        );
      }
    }

    const timestamp = new Date().toISOString();
    const tokens = capturedUsage
      ? {
          input: capturedUsage.input_tokens,
          output: capturedUsage.output_tokens,
          total:
            capturedUsage.total_tokens ||
            capturedUsage.input_tokens + capturedUsage.output_tokens,
          source: "api",
        }
      : null;

    const metricsPayload = {
      requestId,
      timestamp,
      provider,
      deckStyle,
      spreadKey: analysis.spreadKey,
      context,
      tokens,
      vision: visionMetrics,
      narrative: narrativeMetrics,
      narrativeEnhancements: narrativeEnhancementSummary,
      graphRAG: graphRAGStats,
      promptMeta,
      enhancementTelemetry,
      contextDiagnostics: {
        messages: finalContextDiagnostics,
        count: finalContextDiagnostics.length,
      },
      promptEngineering,
      llmUsage: capturedUsage,
      evalGate: evalGateResult
        ? {
            ran: true,
            passed: evalGateResult.passed,
            reason: evalGateResult.gateResult?.reason,
            latencyMs: evalGateResult.latencyMs,
            blocked: wasGateBlocked,
          }
        : { ran: false },
    };

    await persistReadingMetrics(env, metricsPayload);

    scheduleEvaluation(env, evalParams, metricsPayload, {
      waitUntil,
      precomputedEvalResult: evalGateResult?.evalResult || null,
      allowAsyncRetry: Boolean(
        evalGateResult?.evalResult?.mode === "heuristic" ||
          evalGateResult?.evalResult?.error
      ),
    });

    maybeLogEnhancementTelemetry(env, requestId, enhancementTelemetry);

    return jsonResponse({
      reading,
      provider,
      requestId,
      backendErrors: backendErrors.length > 0 ? backendErrors : undefined,
      themes: analysis.themes,
      emotionalTone: deriveEmotionalTone(analysis.themes),
      ephemeris: buildEphemerisClientPayload(analysis.ephemerisContext),
      context,
      contextDiagnostics: finalContextDiagnostics,
      narrativeMetrics,
      graphRAG: graphRAGStats,
      spreadAnalysis: {
        version: "1.0.0",
        spreadKey: analysis.spreadKey,
        ...(analysis.spreadAnalysis || {}),
      },
      ...(wasGateBlocked
        ? { gateBlocked: true, gateReason: evalGateResult?.gateResult?.reason }
        : {}),
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[${requestId}] FATAL ERROR after ${totalTime}ms:`, {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });

    await releaseReadingReservation(env, readingReservation);

    return jsonResponse(
      { error: "Failed to generate reading." },
      { status: 500 }
    );
  } finally {
    console.log(`[${requestId}] === TAROT READING REQUEST END ===`);
  }
};
```

---

## What this accomplishes

- tarot-reading.js becomes **dramatically smaller** (orchestrator only), easily under 24k tokens.
- The module still contains real endpoint logic (validation → entitlement → vision telemetry → limits → analysis → backends → quality gate → eval gate → persistence).
- Tests keep working because `validatePayload` and `summarizeNarrativeEnhancements` remain available from tarot-reading.js.
- Bonus: fixes the known **reservation leak** on 503 by calling `releaseReadingReservation()` before returning.

---

## Follow-up (recommended but optional)

After applying this, update docs that reference internal function locations (e.g. narrative-builder-and-evaluation.md mentioning `buildNarrativeMetrics` in tarot-reading.js) since that logic now lives in `functions/lib/tarotReading/narrativeMetrics.js`.

---

## Updated Todo

- [x] Identify all imports/usages of tarot-reading.js (worker + tests)
- [x] Design module split that preserves runtime boundaries and public exports
- [x] Implement new `functions/lib/tarotReading/*` modules (analysis, backends, metrics, telemetry, etc.)
- [x] Rewrite tarot-reading.js as orchestration glue (still contains the endpoint flow)
- [x] Preserve `validatePayload` + `summarizeNarrativeEnhancements` exports for tests
- [x] Fix reservation leak on 503 (all backends failed)
