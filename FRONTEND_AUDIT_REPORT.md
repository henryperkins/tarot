# Frontend Architecture & UX Audit Report

## 1. Executive Summary

The frontend examination of `src/components` and `src/TarotReading.jsx` reveals a sophisticated but increasingly complex application. While the core "draw-reveal-interpret" loop is functional, the codebase exhibits signs of rapid feature accretion without a unified architectural strategy. Key issues include prop drilling, inconsistent state management, and potential performance bottlenecks in the massive `TarotReading.jsx` orchestrator.

UX is rich but visually cluttered, particularly on mobile devices where the "Ritual" and "Experience" controls consume significant vertical space.

## 2. Architectural Gaps & Technical Debt

### A. The "God Component" Problem
`TarotReading.jsx` has become a monolithic orchestrator (lines 201-2335), managing:
- **State:** Deck state, UI toggles, auth, audio, vision, and API responses.
- **Effects:** Audio initialization, local storage persistence, and API health checks.
- **Layout:** Orchestrating `StepProgress`, `DeckSelector`, `RitualControls`, and the reading grid.

**Risk:** This makes the core reading flow fragile and difficult to test. Adding new features (like the pending feature flags) increases the risk of regression.

### B. Prop Drilling & State fragmentation
State is passed deep into components like `RitualControls` and `SettingsToggles`.
- `RitualControls` receives 10+ props (`hasKnocked`, `handleKnock`, `cutIndex`, etc.), indicating that the "Ritual" state should likely be encapsulated in its own context or hook.
- `VisionValidationPanel` and `Journal` handle their own data fetching patterns, inconsistent with the central state in `TarotReading`.

### C. Mobile Responsiveness Gaps
- **Vertical Sprawl:** The "Prepare" section (Intention, Experience, Ritual) stacks vertically on mobile, pushing the primary "Reading" action below the fold.
- **Touch Targets:** Some controls in `RitualControls` (slider, small badges) may be difficult to manipulate on smaller touchscreens.

### D. Feature Flag Implementation
Pending feature flags (likely related to advanced vision features or new spread types) lack a standardized implementation strategy, leading to conditional logic scattered throughout the render method.

## 3. UX Inconsistencies

- **Visual Noise:** `RitualControls` and `SettingsToggles` use complex visual styles (glassmorphism, borders, shadows) that compete with the tarot cards themselves.
- **Modal Overload:** `AuthModal`, `PhotoInputModal`, and `GuidedIntentionCoach` use different modal patterns and z-index strategies.
- **Feedback Loops:** The "Vision Validation" panel adds significant cognitive load to the reading process, potentially distracting from the spiritual/reflective intent.

## 4. Prioritized Enhancements

### P0: Critical Stability & Architecture
1.  **Refactor `TarotReading.jsx`:** Extract state logic into custom hooks:
    - `useTarotDeck`: Manages shuffle, deal, cut, and ritual state.
    - `useReadingSession`: Manages the current reading, spread selection, and analysis generation.
    - `useExperienceSettings`: Encapsulates voice, ambience, and theme preferences.
2.  **Standardize Modals:** Create a shared `Modal` primitive to ensure consistent behavior (focus trapping, backdrop click, escape key) across Auth, Photo, and Coach interactions.

### P1: Mobile Experience Optimization
1.  **Collapsible "Prepare" Section:** On mobile, default the "Experience" and "Ritual" sections to collapsed states (accordion style) to prioritize the "Spread" and "Draw" actions.
2.  **Sticky Action Bar:** Ensure the primary action (Draw/Reveal) is always accessible via a sticky bottom bar on mobile, rather than scrolling to find the button.

### P2: Feature Flag Implementation Strategy
1.  **Create `FeatureFlagContext`:** A centralized provider to manage feature toggles.
2.  **Implementation:**
    ```javascript
    // src/contexts/FeatureFlagContext.jsx
    export const useFeatureFlag = (flagKey) => {
      const { flags } = useContext(FeatureFlagContext);
      return flags[flagKey] || false;
    };
    ```
3.  **Rollout:** Wrap experimental components (like `VisionValidationPanel`) in feature flag checks to safely deploy code without exposing incomplete features.

## 5. Implementation Strategy for Pending Feature Flags

**Objective:** safely introduce "Vision Mode" and "Advanced Rituals" without destabilizing the core reading flow.

1.  **Define Flags:**
    - `ENABLE_VISION_MODE`: Toggles the camera capture and vision validation UI.
    - `ENABLE_ADVANCED_RITUALS`: Toggles the complex knock/cut interactions.

2.  **Component Integration:**
    - In `TarotReading.jsx`:
      ```jsx
      {featureFlags.ENABLE_VISION_MODE && (
        <VisionValidationPanel ... />
      )}
      ```
    - In `RitualControls.jsx`: Conditionally render advanced sliders based on `ENABLE_ADVANCED_RITUALS`.

3.  **Environment Configuration:** Map these flags to `import.meta.env.VITE_...` variables for build-time configuration.

## 6. Conclusion

Mystic Tarot is feature-rich but architecturally top-heavy. The immediate priority is decomposing `TarotReading.jsx` to improve maintainability and performance. Following this, a mobile-first UX refinement pass will significantly enhance the user experience on smaller devices.

## 7. Status Update (Current Session)

### Phase 1: Architecture Refactoring (Completed)
- [x] **Extracted Hooks:** Created `useTarotState`, `useVisionAnalysis`, `useAudioController`, and `useJournal` to decompose `TarotReading.jsx`.
- [x] **Context Implementation:** Implemented `PreferencesContext` for global settings.
- [x] **Component Cleanup:** `TarotReading.jsx` is now a cleaner orchestrator, delegating logic to specialized hooks.

### Phase 2: Mobile Experience Optimization (Completed)
- [x] **Action-First Layout:** Implemented `MobileSettingsDrawer` to move configuration out of the main flow on mobile.
- [x] **Sticky Action Bar:** Updated the mobile action bar to include a "Settings" trigger and ensure the "Draw" button is always accessible.
- [x] **Touch-Friendly Rituals:** Refactored `RitualControls` to provide large, tap-friendly targets for "Knock" and "Cut" actions on mobile devices.
- [x] **Visual De-cluttering:** Hidden the inline "Prepare" section on mobile to prioritize the reading experience.

### Next Steps (Phase 3)
- [ ] **UX Polish:** Further refine animations and transitions for the drawer and mobile interactions.
- [ ] **Feature Flags:** Implement the `FeatureFlagContext` as recommended in P2.
