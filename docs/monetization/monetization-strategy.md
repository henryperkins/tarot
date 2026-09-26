# Enhanced Monetization Strategy for Tableu

Type: strategy
Status: active background document
Last reviewed: 2026-09-25

This is a high-level strategy document. For the authoritative technical documentation of the implemented monetization features, see:
- [`./monetization-logic.md`](./monetization-logic.md) — current implementation details and tier logic
- [`shared/monetization/subscription.js`](../../shared/monetization/subscription.js) — Runtime subscription utilities

Not all features proposed below have been implemented. Check `monetization-logic.md` for current status.

Author: Manus AI
Date: December 05, 2025

## 1. Executive Summary

This document builds upon the collaborative monetization strategy, incorporating your feedback to provide a detailed, actionable implementation plan. The core approach remains a **multi-faceted freemium model**, leveraging Tableu's sophisticated AI and knowledge graph features as primary upgrade drivers. The focus of this enhanced guide is to provide concrete, code-level recommendations for implementing the proposed feature gating, ensuring a clear distinction between the Free, Plus, and Pro tiers.

By strategically controlling the depth, quality, and availability of AI-powered features, we can create compelling and tangible value for subscribers while maintaining a robust and engaging free experience for user acquisition.

## 2. Tiered Subscription Model (Confirmed)

The three-tier structure remains the foundation of our strategy. It is well-aligned with industry best practices and provides clear upgrade paths for different user segments.

| Feature                | Free (Seeker)        | Plus (Enlightened)  | Pro (Mystic)                 |
| :--------------------- | :------------------- | :------------------ | :--------------------------- |
| **Price**              | $0                   | $7.99 / month or $79.99 / year | $19.99 / month or $199.99 / year |
| **AI Readings**        | 5 / month            | 50 / month          | Unlimited                    |
| **Spreads**            | Basic (1, 3, 5-card) | All 6 built-in      | All 6 built-in; custom not shipped |
| **Journal**            | Local storage + local export | Cloud sync + local/server export | Cloud sync + local/server export |
| **Text-to-Speech**     | 3 / month            | 50 / month          | Unlimited                    |
| **Advanced Insights**  | Basic                | ✅ Full             | ✅ Full                      |
| **Ad-Free Experience** | ❌                   | ✅                  | ✅                           |
| **API Access**         | ❌                   | ❌                  | ✅ (1,000 calls/mo)          |

Local export remains available on Free; the server export is Plus/Pro-gated. The backend retains a `custom` compatibility key, but custom spread creation is not a shipped user feature. The shipped spread catalog is the six built-in layouts.

## 3. Detailed Feature Gating Implementation

This section records the current feature gates and separates shipped behavior from future proposals.

### 3.1. Intention Coach: AI-Powered Question Suggestions

- **Concept:** The free tier provides a guided, template-based question builder. Paid tiers unlock a personalized "Creative Coach" that uses a configured LLM when available.
- **Current provider path:** Free uses `local-template`. Plus/Pro use `openai-native` when `OPENAI_API_KEY` is configured, otherwise `azure-gpt5` when Azure is configured, and `local-fallback` when neither provider can complete the request.
- **Implementation Files:**
  - `src/lib/intentionCoach.js`: Contains the core logic.
  - `src/components/GuidedIntentionCoach.jsx`: The frontend component where the feature is surfaced.
  - `functions/api/generate-question.js`: The API endpoint that calls the LLM.
- **Strategy:** The `intentionCoach.js` library already has two distinct functions: `buildLocalCreativeQuestion` (a deterministic, template-based generator) and `buildCreativeQuestion` (which calls the `/api/generate-question` LLM endpoint). The frontend and endpoint now enforce the Plus/Pro entitlement server-side.

- **Status:** Shipped. The client and endpoint flow is summarized above.

- **Implementation context (shipped):** `GuidedIntentionCoachContext` renders the deterministic guided question locally and calls `buildCreativeQuestion` for creative mode. The endpoint then applies the entitlement and provider rules described above.

### 3.2. Retrieval Quality: GraphRAG Depth Control

- **Concept:** The richness of the AI narrative is partly determined by the number of relevant passages retrieved from the knowledge graph (GraphRAG). We can offer deeper, more insightful readings to paid users by increasing the number of retrieved passages.
- **Implementation File:** `functions/lib/graphRAG.js`
- **Status:** Shipped. `getPassageCountForSpread` is tier-aware and limits Free users to a smaller passage set while Plus/Pro use the base limits.

- **Implementation context:**

  1.  **Tier-aware passage limit (shipped):** `getPassageCountForSpread` accepts the user's tier and reduces the Free passage set.

      ```javascript
      // functions/lib/graphRAG.js

      export function getPassageCountForSpread(spreadKey, tier = "free") {
        const baseLimits = {
          single: 1,
          threeCard: 2,
          fiveCard: 3,
          celtic: 5,
          decision: 3,
          relationship: 2,
          general: 3,
        };

        const passageCount = baseLimits[spreadKey] || baseLimits.general;

        // Free users get a reduced number of passages for a more concise reading.
        if (tier === "free") {
          return Math.max(1, Math.floor(passageCount / 2));
        }

        // Paid users get the full, rich context.
        return passageCount;
      }
      ```

  2.  **Reader integration (shipped):** `tarot-reading.js` passes the effective tier into the passage-limit helper.

### 3.3. Depth & Esoteric Layers: Conditional Prompt Engineering

- **Concept:** The system can generate more profound and layered interpretations by including optional sections in the LLM prompt, such as astrological transits or Qabalistic correspondences. These can be reserved for paid tiers.
- **Implementation File:** `functions/lib/narrative/prompts/` (see `buildEnhancedClaudePrompt.js`)
- **Status:** Proposed, not shipped. The following is an optional future prompt-layer design, not current tier behavior.

- **Code-Level Plan:**

  1.  **Modify the main prompt builder:** Pass the user's tier and use it to gate specific sections.

      ```javascript
      // functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js

      export async function buildNarrativePrompt(params, options = {}) {
        const { tier = "free" } = options;
        let prompt = "..."; // Base prompt structure

        // ... existing prompt building logic ...

        // PREMIUM FEATURE: Astrological Insights
        if (
          (tier === "plus" || tier === "pro") &&
          shouldIncludeAstroInsights(params.cards, params.themes)
        ) {
          const astroSection = await buildAstrologicalWeatherSection(
            params.cards,
            params.themes
          );
          prompt += `\n\n## Astrological Weather\n${astroSection}`;
        }

        // PREMIUM FEATURE: Deeper esoteric context (example)
        if (tier === "pro") {
          // const qabalahSection = buildQabalahSection(params.cards);
          // prompt += `\n\n## Esoteric Correspondences\n${qabalahSection}`;
        }

        return prompt;
      }
      ```

## 4. Updated Implementation Roadmap

This roadmap now distinguishes shipped work from remaining proposals.

| Item | Status | Current state |
|------|--------|---------------|
| Stripe REST checkout, subscription fields, webhooks | ✅ Shipped | Monthly/annual Plus/Pro prices, claim-first idempotency, and portal routing are implemented. |
| Shared entitlements and usage enforcement | ✅ Shipped | Effective-tier gating covers readings, TTS, spreads, journals, API-key list/create, and API calls; authenticated key deletion remains available. |
| React subscription context, pricing, nudges, account | ✅ Shipped | Hosted Checkout and Billing Portal flows are wired; usage meters cover readings, authenticated TTS, and API calls. |
| Guided question generation | ✅ Shipped | Free uses a local template; Plus/Pro use native OpenAI or Azure Responses with local fallback. |
| Custom spread creation | ❌ Not shipped | Only a backend compatibility path exists; no user-facing builder or catalog. |
| Pro developer documentation and API-key management UI | ⏳ Remaining | API endpoints and usage meters exist; dedicated user-facing docs/UI remain optional work. |
| Conditional esoteric prompt layers | ⏳ Proposal | See §3.3; this is not current entitlement behavior. |
| Google Play billing | ⏳ Proposal | No purchase verification or RTDN endpoint is implemented. |

### Completed phase notes

- **Phase 1: Backend infrastructure — shipped.** Stripe REST, subscription fields, session metadata, effective-tier entitlements, reading/TTS limits, and webhook handling are implemented.
- **Phase 2: Frontend — shipped.** Subscription context, hosted Stripe Checkout, upgrade UI, and account billing management are implemented.
- **Phase 3: Usage dashboard — shipped.** Account usage meters cover readings, authenticated TTS, and Pro API calls. Historical charts remain optional.

## 5. Conclusion

This enhanced strategy provides a clear and actionable path to monetizing Tableu. By maintaining these feature gates, we can create a compelling value proposition for each subscription tier, directly linking revenue to the application's most powerful and costly AI features. This approach supports a sustainable business model that can grow alongside the user base and the continuous evolution of the AI landscape.
