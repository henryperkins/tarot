# Frontend Architecture & UX Audit Report (Updated)

## 1. Executive Summary

A comprehensive examination of the `src/` directory, specifically `TarotReading.jsx` and `src/components/`, confirms that while the application delivers a rich, immersive experience, it suffers from significant architectural scalability issues. The core orchestration component has grown to an unmaintainable size, mixing presentation, business logic, and device integration.

The user experience is visually polished but exhibits friction on mobile devices due to dense control panels and complex vertical stacking.

## 2. Architectural Gaps & Technical Debt

### A. The "God Component" (`TarotReading.jsx`)
The `TarotReading.jsx` file has exceeded 2,300 lines and violates the Single Responsibility Principle.
- **State Explosion:** It manages over 30 distinct `useState` hooks, covering everything from card selection to API health, audio playback state, and vision analysis results.
- **Logic Leakage:** Significant business logic resides directly in the component body, including:
  - Vision data normalization and conflict detection (~150 lines).
  - Audio state synchronization and persistence.
  - Complex derived state for "Prepare" section summaries.
- **Effect Tangle:** Numerous `useEffect` hooks handle disparate side effects (local storage syncing, API health checks, keyboard listeners), making the component lifecycle hard to predict and debug.

### B. Prop Drilling & Component Coupling
- **`RitualControls.jsx`:** Receives 10+ props (`hasKnocked`, `handleKnock`, `cutIndex`, etc.) purely to mutate state held in the parent. This tight coupling makes the component difficult to reuse or test in isolation.
- **`SpreadSelector.jsx`:** Similarly receives a dozen setters (`setReading`, `setRevealedCards`, `setJournalStatus`, etc.), indicating that the "Spread Selection" logic is not properly encapsulated.

### C. Inconsistent State Management
- **Feature Flags:** Feature toggles like `ENABLE_VISION_RESEARCH` are accessed via raw `import.meta.env` checks scattered throughout the code, rather than a unified configuration provider.
- **Data Persistence:** LocalStorage logic is duplicated across multiple `useState` initializers and `useEffect` hooks in `TarotReading.jsx`.

## 3. UX & Mobile Inconsistencies

### A. Mobile Responsiveness
- **Vertical Density:** The "Prepare" section, while collapsible, defaults to a layout that pushes the primary "Draw" action below the fold on many mobile screens.
- **Touch Targets:** The custom range slider in `RitualControls` and the small "Skip" text button may be difficult to operate on touch devices.
- **Complex Modals:** The "Skip Ritual" confirmation uses a custom absolute-positioned dialog that may behave unpredictably on small viewports or when zoomed.

### B. Visual & Interaction Polish
- **Feedback Noise:** The interface can become cluttered with multiple status banners (API Health, Minors Warning, Journal Status) stacking on top of each other.
- **Loading States:** The "Shuffling" state locks the UI but provides minimal feedback aside from a spinning icon, which may feel unresponsive on slower connections.

## 4. Prioritized Enhancements

### Phase 1: Architectural Stabilization (Completed)

1.  **Extract Custom Hooks (Decomposition):**
    -   **`useTarotState`:** Encapsulate the deck, spread, and reading state (shuffling, dealing, revealing).
    -   **`useVisionAnalysis`:** Move the ~150 lines of vision normalization, merging, and conflict detection into a dedicated hook.
    -   **`useAudioController`:** Abstract the `voiceOn`/`ambienceOn` persistence and `ttsState` subscription.

    *Status: Done. `TarotReading.jsx` reduced significantly.*

2.  **Context for Global Settings:**
    -   Create a `PreferencesContext` to manage Theme, Voice, Ambience, and Deck Style. This eliminates prop drilling into `SettingsToggles` and `RitualControls`.

    *Status: Done. `PreferencesContext` implemented and integrated.*

### Phase 2: Mobile Experience Optimization

1.  **"Action-First" Mobile Layout:**
    -   On mobile, collapse the "Prepare" section into a single "Reading Settings" drawer or modal.
    -   Ensure the "Draw Cards" / "Reveal Next" button is always pinned to the bottom of the viewport (Sticky Footer) on mobile web.

2.  **Simplified Rituals for Touch:**
    -   Replace the complex slider/knock UI on mobile with a simplified "Touch to Connect" gesture or a larger, thumb-friendly interface.

### Phase 3: User Experience Polish

1.  **Unified Notification System:**
    -   Replace stacking banners with a single "Toast" notification system for transient messages (Journal saved, API error).
    -   Keep persistent warnings (API Health) in a dedicated, unobtrusive status bar.

2.  **Immersive Transitions:**
    -   Add layout animations (using `framer-motion` or CSS transitions) when expanding/collapsing the "Prepare" sections to prevent jarring layout shifts.

## 5. Refactoring Strategy: Feature Flags

To standardize the management of completed features like Vision Mode:

1.  **Create `FeatureFlagContext`:**
    Centralize all `import.meta.env` checks (e.g., `VITE_ENABLE_VISION_RESEARCH`) into a single provider.
    ```javascript
    const defaultFlags = {
      enableVision: import.meta.env.VITE_ENABLE_VISION_RESEARCH === 'true',
      // ...other flags
    };
    ```
2.  **Implement `<FeatureGate>`:**
    Use a wrapper component to conditionally render features based on the context, ensuring cleaner separation of concerns in the render tree.
