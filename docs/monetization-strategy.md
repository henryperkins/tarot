# Enhanced Monetization Strategy for Tableu

> 📋 **DOCUMENT TYPE: Planning / Strategy**
>
> This is a high-level strategy and implementation plan. For the authoritative technical documentation of the **implemented** monetization features, see:
> - [`docs/monetization-logic.md`](./monetization-logic.md) — Current implementation details and tier logic
> - [`shared/monetization/subscription.js`](../shared/monetization/subscription.js) — Runtime subscription utilities
>
> Not all features proposed below have been implemented. Check `monetization-logic.md` for current status.

**Author:** Manus AI
**Date:** December 05, 2025

## 1. Executive Summary

This document builds upon the collaborative monetization strategy, incorporating your feedback to provide a detailed, actionable implementation plan. The core approach remains a **multi-faceted freemium model**, leveraging Tableu's sophisticated AI and knowledge graph features as primary upgrade drivers. The focus of this enhanced guide is to provide concrete, code-level recommendations for implementing the proposed feature gating, ensuring a clear distinction between the Free, Plus, and Pro tiers.

By strategically controlling the depth, quality, and availability of AI-powered features, we can create compelling and tangible value for subscribers while maintaining a robust and engaging free experience for user acquisition.

## 2. Tiered Subscription Model (Confirmed)

The three-tier structure remains the foundation of our strategy. It is well-aligned with industry best practices and provides clear upgrade paths for different user segments.

| Feature                | Free (Seeker)        | Plus (Enlightened)  | Pro (Mystic)                 |
| :--------------------- | :------------------- | :------------------ | :--------------------------- |
| **Price**              | $0                   | $7.99 / month       | $19.99 / month               |
| **AI Readings**        | 5 / month            | 50 / month          | Unlimited                    |
| **Spreads**            | Basic (1, 3, 5-card) | All Spreads         | All + Custom                 |
| **Journal**            | Local Storage Only   | Cloud Sync & Backup | Cloud Sync & Advanced Search |
| **Text-to-Speech**     | 3 / month            | 50 / month          | Unlimited                    |
| **Advanced Insights**  | Basic                | ✅ Full             | ✅ Full                      |
| **Ad-Free Experience** | ❌                   | ✅                  | ✅                           |
| **API Access**         | ❌                   | ❌                  | ✅ (1,000 calls/mo)          |

## 3. Detailed Feature Gating Implementation

This section provides specific, code-level guidance for implementing the feature gates outlined in your strategy.

### 3.1. Intention Coach: AI-Powered Question Suggestions

- **Concept:** The free tier provides a guided, template-based question builder. Paid tiers unlock a premium "Creative Coach" that uses an LLM to generate personalized, context-aware questions.
- **Implementation Files:**
  - `src/lib/intentionCoach.js`: Contains the core logic.
  - `src/components/GuidedIntentionCoach.jsx`: The frontend component where the feature is surfaced.
  - `functions/api/generate-question.js`: The API endpoint that calls the LLM.
- **Strategy:** The `intentionCoach.js` library already has two distinct functions: `buildLocalCreativeQuestion` (a deterministic, template-based generator) and `buildCreativeQuestion` (which calls the `/api/generate-question` LLM endpoint). We will gate the call to the latter.

- **Code-Level Plan:**

  1.  **Modify `GuidedIntentionCoach.jsx`:** Introduce a check based on the user's subscription tier.

      ```jsx
      // src/components/GuidedIntentionCoach.jsx

      import { useSubscription } from "../contexts/SubscriptionContext"; // Assumes a new context

      const GuidedIntentionCoach = () => {
        const { subscription } = useSubscription();
        const isPaidTier =
          subscription.tier === "plus" || subscription.tier === "pro";

        const handleGenerateQuestion = async () => {
          if (isPaidTier) {
            // Paid users get AI-powered, personalized questions
            const result = await buildCreativeQuestion({
              topic,
              timeframe,
              depth,
              customFocus,
            });
            setQuestion(result.question);
          } else {
            // Free users get deterministic, template-based questions
            const result = buildLocalCreativeQuestion({
              topic,
              timeframe,
              depth,
              customFocus,
            });
            setQuestion(result);
          }
        };

        return (
          <div>
            {/* ... UI elements ... */}
            <button onClick={handleGenerateQuestion}>
              {isPaidTier ? "Get AI Suggestion" : "Generate Question"}
            </button>
            {!isPaidTier && <UpgradeNudge feature="AI-powered questions" />}
          </div>
        );
      };
      ```

  2.  **Secure the API Endpoint:** While the frontend can hide the button, the backend must enforce the restriction. Modify `functions/api/generate-question.js` to check the user's subscription status before processing the request.

### 3.2. Retrieval Quality: GraphRAG Depth Control

- **Concept:** The richness of the AI narrative is partly determined by the number of relevant passages retrieved from the knowledge graph (GraphRAG). We can offer deeper, more insightful readings to paid users by increasing the number of retrieved passages.
- **Implementation File:** `functions/lib/graphRAG.js`
- **Strategy:** The `getPassageCountForSpread` function is the central control point for determining retrieval depth. We will modify it to be tier-aware.

- **Code-Level Plan:**

  1.  **Update `getPassageCountForSpread`:** Add a `tier` parameter.

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

  2.  **Update `tarot-reading.js`:** When calling the GraphRAG functions, pass the user's subscription tier, which should be fetched from the database after session validation.

### 3.3. Depth & Esoteric Layers: Conditional Prompt Engineering

- **Concept:** The system can generate more profound and layered interpretations by including optional sections in the LLM prompt, such as astrological transits or Qabalistic correspondences. These can be reserved for paid tiers.
- **Implementation File:** `functions/lib/narrative/prompts/` (see `buildEnhancedClaudePrompt.js`)
- **Strategy:** The main prompt-building function in `prompts/buildEnhancedClaudePrompt.js` can be modified to conditionally include or exclude these advanced sections based on the user's tier.

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

This refined roadmap includes specific technical tasks for the engineering team.

- **Phase 1: Backend Infrastructure (2 Weeks)**

  - **Task:** Integrate Stripe SDK and configure webhook endpoints for subscription events (`invoice.payment_succeeded`, `customer.subscription.deleted`, etc.).
  - **Task:** Add `tier` (e.g., 'free', 'plus', 'pro') and `subscription_status` columns to the `users` table in the D1 database.
  - **Task:** Modify the `validateSession` function in `functions/lib/auth.js` to also return the user's subscription tier and status.
  - **Task:** Implement the tier-aware logic in `functions/api/tarot-reading.js`, `functions/api/generate-question.js`, and `functions/api/tts.js` to enforce usage limits.

- **Phase 2: Frontend Implementation (2 Weeks)**

  - **Task:** Create a `SubscriptionContext` in React to provide global access to the user's tier and status.
  - **Task:** Build the pricing page and integrate Stripe Elements for a secure checkout flow.
  - **Task:** Implement UI "nudges" and upgrade modals that appear when a free user attempts to access a premium feature.
  - **Task:** Create a "My Account" section where users can manage their subscription (upgrade, cancel, view billing history) via Stripe's customer portal.

- **Phase 3: API & Finalization (1 Week)**
  - **Task:** Create a developer documentation page for the Pro tier's API access.
  - **Task:** Build the API usage dashboard for Pro users to track their monthly call credits.
  - **Task:** Conduct end-to-end testing of the entire subscription lifecycle.

## 5. Conclusion

This enhanced strategy provides a clear and actionable path to monetizing Tableu. By implementing these code-level feature gates, we can create a compelling value proposition for each subscription tier, directly linking revenue to the application's most powerful and costly AI features. This approach ensures a sustainable business model that can grow alongside the user base and the continuous evolution of the AI landscape.
