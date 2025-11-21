# Feature Research & Enhancement Proposal
*Date: November 20, 2025*

## 1. Market Landscape Analysis (2025 Trends)
Research into leading competitors (e.g., Labyrinthos, Golden Thread) and emerging AI tarot trends reveals a shift from simple "digital card draws" to **holistic spiritual ecosystems**.

### Key Competitor Features
*   **Gamified Learning:** Apps like Labyrinthos function as "mini-schools" with quizzes, spaced repetition for card meanings, and progress bars for archetype mastery.
*   **Custom Spread Builders:** Drag-and-drop interfaces allowing users to design their own layouts rather than picking from a static list.
*   **Astrological Integration:** Tying readings to live transit data (e.g., "Full Moon in Scorpio Spread") to increase daily active usage.
*   **Holistic Wellness:** Integration of non-divinatory tools like breathwork timers, meditation prompts, and "mood check-ins" before readings.
*   **Physical Deck Tracking:** Tools to log readings done with physical cards (manual entry or OCR), acknowledging that serious practitioners often use analog decks.

---

## 2. Gap Analysis: Mystic Tarot vs. Market
*Mystic Tarot excels in **AI narrative depth** and **esoteric authenticity** (GraphRAG, elemental dignities), but lags in **retention mechanics** and **user agency** outside the reading itself.*

| Feature Category | Mystic Tarot Current State | Market Standard | Gap |
| :--- | :--- | :--- | :--- |
| **Interpretation** | **Superior:** Context-aware, multi-model, halllucination-proof. | Generic "fortune cookie" or raw LLM output. | **None (Competitive Advantage)** |
| **Spreads** | Static list (Celtic Cross, 3-Card). | Drag-and-drop custom builders. | **High** |
| **Retention** | Basic Journal (List view). | Streaks, "Daily Card" widgets, Gamified mastery. | **High** |
| **Education** | Passive (Reading text). | Active (Quizzes, interactive tooltips). | **Medium** |
| **Holistic** | Intention setting (Text input). | Breathwork, somatic grounding exercises. | **Medium** |
| **Platform** | Web / Responsive. | PWA with Offline Mode / Native App. | **Medium** |

---

## 3. Proposed Feature Roadmap

### P1: "Tarot Lab" (Custom Spread Engine)
**Concept:** A drag-and-drop interface allowing users to create, save, and share custom spreads.
**Rationale:** Addresses the "Static Spread" gap and leverages the existing flexible `narrativeBuilder`.
**Implementation:**
*   New `SpreadDesigner` component (drag positions onto a canvas).
*   Save spreads to `user_preferences` in DB.
*   Update `analyzeSpreadThemes` to handle dynamic position counts.

### P2: "Archetype Journey" (Gamified Analytics)
**Concept:** A dashboard tracking the user's "relationship" with specific cards over time.
**Rationale:** Turns the Journal from a passive archive into an active growth tool (retention hook).
**Features:**
*   "Stalker Card" alert: "You've drawn The Tower 3 times this month."
*   "Suit Balance": Visual chart of Earth/Air/Fire/Water ratios over the last 30 readings.
*   **Unlockable Insights:** "You've encountered all 4 Aces. Unlock the 'Master of Beginnings' narrative."

### P3: "Somatic Centering" (Ritual Mode)
**Concept:** A 30-60 second interactive "breathing visualizer" displayed *after* the intention is set but *before* the cards are revealed.
**Rationale:** Aligns perfectly with the project's "Trauma-Informed / High Agency" ethos. Grounds the user, reducing anxiety before viewing potentially heavy cards (e.g., 10 of Swords).
**Implementation:**
*   Simple CSS animation (expanding/contracting circle).
*   Haptic feedback (if mobile PWA).

### P4: "Cosmic Pulse" (Contextual Integration)
**Concept:** A home screen widget showing the current Moon Phase and Sun Sign, suggesting a "Theme of the Day."
**Rationale:** Gives users a reason to open the app even if they don't have a specific question.
**Implementation:**
*   Lightweight astronomical calculation lib (e.g., `suncalc`).
*   Inject "Current Transit" context into the `narrativeBuilder` system prompt.

### P5: Interactive Card Tooltips (Educational Layer)
**Concept:** Click-to-reveal annotations on card images during a reading.
**Rationale:** Bridges the gap between "Getting a reading" and "Learning Tarot."
**Features:**
*   Highlight specific symbols (e.g., "The Dog" in The Fool) using the existing `symbolDetector` data.
*   Show "Esoteric Dignity" (e.g., "Mars in Aries") on hover.

---

## 4. Alignment with Technical Roadmap
*   **Refactoring:** Implementing "Tarot Lab" (P1) requires decoupling the `SpreadSelector` from `TarotReading.jsx`, aligning with the **Phase 1 Refactoring** goal in `CODEBASE_AUDIT_AND_ROADMAP.md`.
*   **Journal-Awareness:** "Archetype Journey" (P2) directly supports the "Journal-Aware Readings" goal by aggregating user history.
