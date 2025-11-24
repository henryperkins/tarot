# System Architecture Guide: Mystic Tarot

## 1. Executive Summary

**Mystic Tarot** is a sophisticated AI-powered tarot reading application designed to bridge the gap between traditional cartomancy and modern generative AI. Unlike simple database-lookup tarot apps, it uses advanced Large Language Models (LLMs) to synthesize complex card relationships, positional meanings, and user context into cohesive, human-like narratives.

**Core Problem Solved:**
Digital tarot readings often feel robotic and disjointed. Mystic Tarot solves this by implementing a "Knowledge Graph" of tarot patterns (triads, dyads, suit progressions) and feeding this structured analysis into state-of-the-art LLMs to generate readings that feel intuitive, empathetic, and contextually aware.

**Primary Tech Stack:**
*   **Frontend:** React, Vite, Tailwind CSS
*   **Backend:** Cloudflare Pages Functions (Serverless), Node.js (ESM)
*   **Database:** Cloudflare D1 (SQLite-compatible)
*   **AI Services:** Azure OpenAI (GPT-5.1, GPT-4o-mini TTS), Anthropic Claude Sonnet 4.5
*   **Infrastructure:** Cloudflare Platform (Pages, KV, D1)

---

## 2. Architectural Map

### Entry Points
*   **Web Client (`src/main.jsx`):** The React Single Page Application (SPA) entry point.
    *   **Main Route (`/`):** `TarotReading.jsx` - The core orchestration layer for selecting spreads, drawing cards, and displaying results.
*   **API Gateway (`functions/api/`):** Serverless functions handling business logic.
    *   **Reading Generation:** `POST /api/tarot-reading` - The primary intelligence engine.
    *   **Text-to-Speech:** `POST /api/tts` - Generates audio for readings.

### Component Communication & Data Flow
1.  **User Interaction:** User selects a spread (e.g., Celtic Cross) and draws cards in the React frontend.
2.  **Request Construction:** Frontend bundles card data, spread metadata, and user question into a JSON payload.
3.  **Analysis Phase (Backend):**
    *   The `tarot-reading` function receives the payload.
    *   **Deterministic Analysis:** `functions/lib/spreadAnalysis.js` and `knowledgeGraph.js` analyze the cards for objective patterns (e.g., "3 of Swords + 10 of Swords = Painful Ending"). This ensures the AI doesn't hallucinate card meanings.
4.  **Narrative Generation (AI):**
    *   The structured analysis is converted into a complex system prompt.
    *   The request is routed to **Azure OpenAI (GPT-5.1)** or **Claude Sonnet 4.5** via the Responses API.
5.  **Response:** The AI returns a JSON object containing the narrative text and metadata, which is sent back to the frontend.
6.  **Persistence:** Reading data is asynchronously stored in **Cloudflare D1** for history and analytics.

### Database Schema (Cloudflare D1)
*   **`readings`**: Stores core reading metadata (ID, timestamp, spread type, provider).
*   **`cards`**: Relational table storing individual cards linked to a reading ID.
*   **`users` / `sessions`**: Manages authentication and session tokens.
*   **`journal_entries`**: Stores full reading text and user reflections for authenticated users.

---

## 3. Feature Extraction

### Core Capabilities
*   **Multi-Spread Support:** Implements logic for standard spreads (Celtic Cross, Three-Card) and custom layouts (Decision, Relationship).
*   **Context-Aware Readings:** Infers context (Love, Career, General) from user questions to tailor the interpretation.
*   **Pattern Detection Engine:** A custom "Knowledge Graph" detects advanced tarot concepts:
    *   *Elemental Dignities* (Fire vs. Water)
    *   *Suit Progressions* (Ace -> 10 arcs)
    *   *Archetypal Triads* (Specific 3-card combinations)
*   **Steerable Text-to-Speech:** Generates audio readings using Azure GPT-4o-mini, with specific instructions for tone (e.g., "mystical," "gentle," "contemplative").
*   **Vision Mode (Research):** Includes pipelines (`scripts/vision/`) and API hooks (`verifyVisionProof`) to validate physical card spreads via image recognition.

### User Stories
*   *As a user, I want to draw cards digitally so I can get a reading anytime.*
*   *As a user, I want to listen to my reading spoken aloud with a soothing voice.*
*   *As a user, I want to save my readings to a journal to reflect on them later.*
*   *As a developer, I want to ensure the AI respects the traditional meanings of cards and doesn't invent symbols.*

---

## 4. Integrations & Dependencies

### External Services
*   **Azure OpenAI Service:**
    *   **Models:** `gpt-5.1` (High-reasoning text), `gpt-4o-mini` (TTS).
    *   **Usage:** Primary narrative generation and audio synthesis.
*   **Anthropic API:**
    *   **Models:** `claude-sonnet-4.5`.
    *   **Usage:** Fallback or alternative narrative provider.

### Critical Libraries
*   **`@xenova/transformers`**: Used for local/browser-based ML tasks (likely vision prototype).
*   **`react-markdown` / `remark-gfm`**: Renders the AI-generated Markdown text in the UI.
*   **`lucide-react`**: Iconography.
*   **`tailwindcss`**: Utility-first styling framework.

### Infrastructure (Cloudflare)
*   **Pages Functions:** Hosts the API.
*   **D1 (SQLite):** Relational data storage.
*   **KV (Key-Value):** Used for rate limiting (`RATELIMIT` binding) and caching.

---

*Generated by GitHub Copilot based on codebase analysis.*
