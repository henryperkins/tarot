# Mystic Tarot: Codebase Audit, Architecture Review, and Strategic Roadmap

## 1. Executive Summary

A comprehensive audit of the Mystic Tarot codebase reveals a sophisticated, spiritually-aware application that successfully blends modern web technologies with deep esoteric knowledge. The project demonstrates high maturity in prompt engineering, ethical guardrails, and vision integration, but faces scalability challenges in its frontend architecture and backend service decoupling.

**Key Strengths:**
*   **Advanced Prompt Engineering:** The `narrativeBuilder` and `promptCompliance` tests enforce a "high-agency" ethical framework that is rare in AI applications.
*   **GraphRAG Integration:** The knowledge graph system (`knowledgeBase.js`, `graphRAG.js`) provides a robust, hallucination-resistant mechanism for retrieving traditional tarot wisdom.
*   **Vision Pipeline Maturity:** The Python-based LoRA training pipeline (`scripts/training/`) and shared vision utilities (`symbolDetector.js`) are well-structured for deck-specific adaptation.

**Critical Risks:**
*   **Frontend "God Component":** `TarotReading.jsx` (1200+ lines) concentrates too much logic, mixing state management, API orchestration, and UI rendering.
*   **Backend Coupling:** The Cloudflare Functions (`functions/api/`) are tightly coupled to the specific narrative builders, making it harder to swap AI providers or scale independently.
*   **State Management:** The reliance on multiple dispersed contexts (`AuthContext`, `PreferencesContext`) and local hooks (`useTarotState`) without a unified state store (like Redux or Zustand) may lead to race conditions as features expand.

---

## 2. Architecture Audit

### 2.1. Frontend Architecture (React/Vite)
*   **Structure:** The `src/` directory follows a feature-based organization but suffers from component bloating. `TarotReading.jsx` acts as a monolithic orchestrator.
*   **State Management:**
    *   **`useTarotState`:** Handles the core reading lifecycle (shuffle, deal, reveal) effectively but is overloaded with UI-specific flags.
    *   **Contexts:** `PreferencesContext` and `AuthContext` are well-scoped, but the lack of a global "Reading Context" means props are drilled deeply into components like `SpreadSelector` and `RitualControls`.
*   **UI/UX:** The interface is polished and responsive, but the "Prepare" section's vertical density on mobile needs optimization. The `Journal.jsx` component is well-isolated and robust.

### 2.2. Backend Architecture (Cloudflare Pages Functions)
*   **Service Design:** The `functions/api/` directory implements a serverless backend.
    *   **`tarot-reading.js`:** The core endpoint. It intelligently delegates to Azure OpenAI (GPT-5) or Claude Sonnet based on availability. The fallback logic is solid.
    *   **`vision-proof.js`:** Handles image upload and validation securely.
    *   **`tts.js`:** A standalone service for text-to-speech, showing good separation of concerns.
*   **Data Access:** Direct binding to Cloudflare D1 (`env.DB`) in `journal.js` and `auth.js` is efficient but lacks an ORM or query builder, which could make schema migrations painful.

### 2.3. AI & Vision Pipeline
*   **Prompt Engineering:** The `narrativeBuilder` library is a standout feature. It dynamically constructs prompts based on spread type (Celtic Cross, Three-Card) and enforces "agency-forward" language.
*   **Vision Training:** The `scripts/training/` directory contains a professional-grade LoRA fine-tuning pipeline.
    *   **`trainLoRA.py`:** Uses `peft` and `transformers` to adapt CLIP models to specific artistic styles (RWS, Thoth, Marseille).
    *   **`buildVectorIndex.py`:** Generates FAISS indices for fast, accurate card recognition, replacing brittle centroid-based methods.
*   **Symbol Detection:** `symbolDetector.js` implements zero-shot object detection to verify if user-uploaded cards match the expected esoteric symbols, adding a layer of "grounding" to the AI's output.

---

## 3. Code Quality & Testing

*   **Test Coverage:** The `tests/` directory focuses heavily on the most critical risk areas: prompt compliance and vision integration.
    *   `narrativeBuilder.promptCompliance.test.mjs`: Excellent linguistic testing to ensure AI outputs respect user agency and avoid fatalism.
    *   `graphRAG.test.mjs`: Verifies the retrieval logic for the knowledge graph.
*   **Code Style:** The codebase uses consistent ES modules and modern JavaScript patterns. Variable naming is semantic and clear.
*   **Documentation:** `DEVELOPER_ONBOARDING.md` and `FRONTEND_AUDIT_REPORT.md` are up-to-date and helpful. Inline comments explain *why* complex logic exists (e.g., in `tarot-reading.js`).

---

## 4. Strategic Roadmap

### Phase 1: Stabilization & Refactoring (Immediate Priority)
**Goal:** Decompose the "God Component" and unify state management to reduce technical debt.

1.  **Refactor `TarotReading.jsx`:**
    *   Extract the "Prepare" section (Intention, Settings, Ritual) into a self-contained `ReadingPreparation` feature component.
    *   Move reading generation logic (API calls, error handling) into a dedicated `useReadingGenerator` hook.
    *   Create a `ReadingContext` to share state between `SpreadSelector`, `ReadingGrid`, and `FeedbackPanel`, eliminating prop drilling.
2.  **Standardize Backend Types:**
    *   Define shared TypeScript interfaces (or JSDoc types) for `Card`, `Spread`, and `ReadingResult` to ensure contract consistency between frontend and backend.

### Phase 2: Vision & Personalization Maturity (Short-Term)
**Goal:** Fully operationalize the vision pipeline and deepen the "GraphRAG" integration.

1.  **Deploy Vision Models:**
    *   Finalize the `trainLoRA.py` pipeline for the Thoth and Marseille decks.
    *   Deploy the FAISS indices to a lightweight vector store (or cache them in Cloudflare R2) for production inference.
2.  **Enhance GraphRAG:**
    *   Expand the knowledge graph (`knowledgeGraphData.js`) to include more "Suit Progression" and "Court Card Interaction" patterns.
    *   Tune the retrieval weights in `graphRAG.js` to prioritize "Triad" matches over generic card meanings.

### Phase 3: Deep Personalization (Medium-Term)
**Goal:** Leverage the journal data to create long-term user narratives.

1.  **Journal-Aware Readings:**
    *   Update `tarot-reading.js` to accept a summary of the user's last 3 journal entries.
    *   Modify the system prompt to allow the AI to reference past themes ("The Tower is appearing again, just like last week...").
2.  **"Deck Personality" Profiles:**
    *   Formalize the `deckProfiles.js` concept. Allow each deck (RWS, Thoth, Marseille) to have a distinct "Voice" in the `tts.js` service (e.g., Thoth = stern/abstract, RWS = gentle/narrative).

---

## 5. Actionable Next Steps

1.  **Immediate:** Create `src/context/ReadingContext.jsx` and begin migrating state from `TarotReading.jsx`.
2.  **Immediate:** Run the full test suite (`npm test`) to establish a baseline before refactoring.
3.  **Next Sprint:** Execute `scripts/training/trainLoRA.py --deck thoth` to generate the Thoth adapter.
4.  **Next Sprint:** Refactor `SpreadSelector.jsx` to consume `ReadingContext` instead of accepting 15+ props.